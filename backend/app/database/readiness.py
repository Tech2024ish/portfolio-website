"""Database readiness: connectivity plus the expected Alembic revision, strictly read-only.

- Every query runs inside a ``READ ONLY`` transaction with a short statement timeout on a
  dedicated pool-less engine (``Database.readiness_engine``); it is never committed, so a
  readiness check cannot write even by mistake, and it never competes with request handlers
  for pooled connections.
- ``check_database`` never raises: any failure, expected or not, becomes a sanitised
  "not ready" result. Logs carry exception class names only, never messages, hosts or URLs.
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


def check_database(database: Database) -> Readiness:
    """Never raises; never returns or logs exception details."""
    try:
        with read_only_connection(database) as connection:
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
        logger.warning("readiness: database check failed (%s)", type(exc).__name__)
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
