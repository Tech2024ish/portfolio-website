"""Database readiness: connectivity plus the expected Alembic revision, strictly read-only.

- Every query runs inside a ``READ ONLY`` transaction with a short statement timeout on a
  dedicated pool-less engine (``Database.readiness_engine``); it is never committed, so a
  readiness check cannot write even by mistake, and it never competes with request handlers
  for pooled connections.
- ``check_database`` never raises: any failure, expected or not, becomes a sanitised
  "not ready" result. Logs carry the stage, exception class names, the SQLSTATE and a fixed
  reason label (``describe_failure``), never driver messages, hosts or URLs.
- ``ReadinessCache`` runs at most one check per process at a time and stores the result for a
  fixed period measured from when the check *finished*. Concurrent callers never wait for the
  check; they get the last result immediately (or "unknown" before the first one completes),
  so a slow database cannot tie up worker threads through this endpoint.

Runtime-role requirement: the tables, including ``alembic_version``, have row-level security
enabled without policies. Only their owner (the migration role) or a role with ``BYPASSRLS``
can read them. If the API connects as any other role, readiness reports
``migrations: pending`` even after a successful migration.
"""

from __future__ import annotations

import logging
import threading
import time
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Literal

import psycopg.errors
from sqlalchemy import Connection, text
from sqlalchemy.exc import DBAPIError

from app.database.revision import EXPECTED_REVISION
from app.database.session import Database

logger = logging.getLogger("app.readiness")

STATEMENT_TIMEOUT = "2s"


@dataclass(frozen=True)
class Readiness:
    database: Literal["ok", "unavailable", "unknown"]
    migrations: Literal["ok", "pending", "unknown"]

    @property
    def ready(self) -> bool:
        return self.database == "ok" and self.migrations == "ok"


UNAVAILABLE = Readiness(database="unavailable", migrations="unknown")
NOT_YET_CHECKED = Readiness(database="unknown", migrations="unknown")


@contextmanager
def read_only_connection(database: Database) -> Iterator[Connection]:
    """A connection whose transaction is READ ONLY and always rolled back."""
    with database.readiness_engine.connect() as connection:
        connection.execute(text("SET TRANSACTION READ ONLY"))
        connection.execute(text(f"SET LOCAL statement_timeout = '{STATEMENT_TIMEOUT}'"))
        try:
            yield connection
        finally:
            connection.rollback()


# Driver messages are never logged (they carry hosts, ports, user and database names). They are
# matched against these fragments and only the fixed label is logged. Order matters: first match.
_REASONS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("timeout", ("timeout expired", "timed out")),
    ("dns", ("failed to resolve host", "could not translate host", "name or service not known")),
    ("network_unreachable", ("network is unreachable", "no route to host")),
    ("tcp_rejected", ("connection refused",)),
    ("credentials", ("password authentication failed", "authentication error", "sasl")),
    ("pooler_tenant_or_user", ("tenant or user not found",)),
    (
        "too_many_connections",
        ("max client connections", "too many connections", "remaining connection slots"),
    ),
    ("pooler_circuit_breaker", ("circuit breaker",)),
    ("network_restricted", ("not allowed", "no pg_hba.conf entry", "address not permitted")),
    ("tls", ("ssl", "tls", "certificate")),
    (
        "server_closed",
        ("server closed the connection", "connection reset", "unexpected eof", "eof detected"),
    ),
)
_SQLSTATE_REASONS = {
    "28P01": "credentials",
    "28000": "credentials",
    "53300": "too_many_connections",
    "57014": "statement_timeout",
    "57P03": "server_starting",
}


def describe_failure(exc: BaseException, stage: str, elapsed: float) -> str:
    """A log-safe summary of a failed check: fixed labels, class names and SQLSTATE codes only.

    ``OperationalError`` alone (SQLAlchemy's wrapper) does not say whether the server was
    unreachable, slow, or refused the credentials; this does, without the driver's message.
    """
    orig = exc.orig if isinstance(exc, DBAPIError) and exc.orig is not None else exc
    sqlstate = getattr(orig, "sqlstate", None)
    message = str(orig).lower()
    # psycopg tries every address a host resolves to. When all fail, the message starts with
    # the last attempt's error (the one whose class was raised), then lists every attempt on
    # its own "- " line. The reason must describe the last attempt only: an earlier address
    # timing out must not hide, say, rejected credentials on the address that answered.
    head, _, listing = message.partition("\nmultiple connection attempts failed")
    per_attempt = [_reason_from_text(line) for line in listing.split("\n- ")[1:]]
    if isinstance(orig, psycopg.errors.ConnectionTimeout):
        reason = "timeout"
    elif isinstance(orig, psycopg.errors.QueryCanceled):
        reason = "statement_timeout"
    elif sqlstate in _SQLSTATE_REASONS:
        reason = _SQLSTATE_REASONS[sqlstate]
    else:
        reason = _reason_from_text(head)
    code = sqlstate if isinstance(sqlstate, str) and sqlstate.isalnum() else "none"
    summary = (
        f"stage={stage} driver={type(orig).__name__} sqlstate={code} reason={reason} "
        f"attempts={max(1, len(per_attempt))}"
    )
    if len(per_attempt) > 1:
        summary += f" attempt_reasons={','.join(per_attempt)}"
    return f"{summary} elapsed_ms={round(elapsed * 1000)}"


def _reason_from_text(message: str) -> str:
    for label, fragments in _REASONS:
        if any(fragment in message for fragment in fragments):
            return label
    return "other"


def check_database(database: Database) -> Readiness:
    """Never raises; never returns or logs exception details (see ``describe_failure``)."""
    stage = "connect"  # opening the connection and starting the read-only transaction
    began = time.monotonic()
    try:
        with read_only_connection(database) as connection:
            stage = "query"
            connection.execute(text("SELECT 1"))
            try:
                found = list(
                    connection.execute(text("SELECT version_num FROM alembic_version")).scalars()
                )
            except DBAPIError as exc:
                if isinstance(exc.orig, psycopg.errors.UndefinedTable):
                    return Readiness(database="ok", migrations="pending")  # never migrated
                raise
    except Exception as exc:  # any failure is "not ready"; details stay out of logs and bodies
        # The target (kind of server, driver, option names; never host, port, user or password)
        # shows which server the deployed process really uses.
        logger.warning(
            "readiness: database check failed (%s) %s target: %s",
            type(exc).__name__,
            describe_failure(exc, stage, time.monotonic() - began),
            database.target_summary(),
        )
        return UNAVAILABLE

    if found != [EXPECTED_REVISION]:
        logger.warning("readiness: unexpected migration state (%d revision rows)", len(found))
        return Readiness(database="ok", migrations="pending")
    return Readiness(database="ok", migrations="ok")


class ReadinessCache:
    """Single-flight, time-boxed cache for readiness results. Thread-safe."""

    def __init__(self, clock: Callable[[], float] = time.monotonic) -> None:
        self._clock = clock
        self._lock = threading.Lock()
        self._result: Readiness | None = None
        self._expires_at = 0.0

    def get(self, check: Callable[[], Readiness], ttl_seconds: float) -> Readiness:
        result = self._result
        if result is not None and self._expires_at > self._clock():
            return result
        # Only one caller performs the check; everyone else answers at once with what we know.
        if not self._lock.acquire(blocking=False):
            return result if result is not None else NOT_YET_CHECKED
        try:
            result = self._result
            if result is not None and self._expires_at > self._clock():
                return result  # refreshed by another caller while we were arriving
            result = check()
            self._result = result
            self._expires_at = self._clock() + ttl_seconds  # measured from completion
            return result
        finally:
            self._lock.release()
