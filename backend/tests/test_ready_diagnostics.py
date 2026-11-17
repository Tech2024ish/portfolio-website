"""Readiness failures say *why* they failed (stage, driver class, SQLSTATE, a fixed reason
label, the kind of server), without driver messages, hosts, ports, users or passwords.

Before this, every connection problem was logged as ``OperationalError`` only, so a production
``/ready`` 503 could not be told apart: unreachable pooler, slow connect, rejected credentials,
pooler limits and network restrictions all looked the same.
"""

from __future__ import annotations

import logging
import socket
import threading
import time
from collections.abc import Iterator

import psycopg
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import make_url
from sqlalchemy.exc import OperationalError

from app.database.readiness import UNAVAILABLE, check_database, describe_failure
from app.database.session import Database
from app.main import create_app
from tests.conftest import SettingsFactory

SECRET_HOST = "aws-1-eu-central-1.pooler.supabase.com"
SECRET_USER = "postgres.abcdefghijklmnopqrst"
SECRET_PASSWORD = "s3cret%40pw"
POOLER_URL = f"postgresql://{SECRET_USER}:{SECRET_PASSWORD}@{SECRET_HOST}:5432/postgres"


def _wrapped(orig: Exception) -> OperationalError:
    return OperationalError("SELECT 1", {}, orig)


# ------------------------------------------------------------------ classification


@pytest.mark.parametrize(
    ("orig", "reason"),
    [
        (psycopg.errors.ConnectionTimeout("connection timeout expired"), "timeout"),
        (
            psycopg.errors.QueryCanceled("canceling statement due to statement timeout"),
            "statement_timeout",
        ),
        (psycopg.OperationalError(f"failed to resolve host '{SECRET_HOST}': [Errno -2]"), "dns"),
        (
            psycopg.OperationalError(
                f'connection failed: connection to server at "10.0.0.1", port 5432 failed: '
                f"FATAL:  Tenant or user not found ({SECRET_USER})"
            ),
            "pooler_tenant_or_user",
        ),
        (
            psycopg.OperationalError("connection failed: FATAL:  Max client connections reached"),
            "too_many_connections",
        ),
        (
            psycopg.OperationalError(
                f'FATAL:  password authentication failed for user "{SECRET_USER}"'
            ),
            "credentials",
        ),
        (
            psycopg.OperationalError("connection failed: Network is unreachable"),
            "network_unreachable",
        ),
        (psycopg.OperationalError("connection failed: Connection refused"), "tcp_rejected"),
        (psycopg.OperationalError("SSL SYSCALL error: EOF detected"), "tls"),
        (psycopg.OperationalError("server closed the connection unexpectedly"), "server_closed"),
        (psycopg.OperationalError("something new"), "other"),
    ],
)
def test_failures_are_classified_without_their_message(orig: Exception, reason: str) -> None:
    summary = describe_failure(_wrapped(orig), "connect", 0.25)
    assert f"reason={reason}" in summary
    assert f"driver={type(orig).__name__}" in summary
    assert "stage=connect" in summary
    assert "elapsed_ms=250" in summary
    for leak in (SECRET_HOST, SECRET_USER, "10.0.0.1", "5432", "Tenant", "password", "FATAL"):
        assert leak not in summary


def test_every_address_attempt_is_counted() -> None:
    message = (
        "connection timeout expired\nMultiple connection attempts failed. All failures were:\n"
        f"- host: '{SECRET_HOST}', port: '5432', hostaddr: '3.1.1.1': connection timeout expired\n"
        f"- host: '{SECRET_HOST}', port: '5432', hostaddr: '3.1.1.2': connection timeout expired"
    )
    summary = describe_failure(_wrapped(psycopg.errors.ConnectionTimeout(message)), "connect", 6)
    assert "attempts=2" in summary
    assert "reason=timeout" in summary
    assert "attempt_reasons=timeout,timeout" in summary
    assert "3.1.1." not in summary and SECRET_HOST not in summary


def test_the_reason_describes_the_last_attempt_not_the_first_match() -> None:
    """``localhost`` (or a pooler with several addresses): one address times out, the next
    answers and rejects the password. The reason is the answer, not the earlier timeout."""
    message = (
        f'connection failed: FATAL:  password authentication failed for user "{SECRET_USER}"\n'
        "Multiple connection attempts failed. All failures were:\n"
        "- host: 'localhost', port: '5432', hostaddr: '::1': connection timeout expired\n"
        "- host: 'localhost', port: '5432', hostaddr: '127.0.0.1': connection failed: "
        f'FATAL:  password authentication failed for user "{SECRET_USER}"'
    )
    summary = describe_failure(_wrapped(psycopg.OperationalError(message)), "connect", 3.0)
    assert "reason=credentials attempts=2 attempt_reasons=timeout,credentials" in summary
    for leak in (SECRET_USER, "localhost", "::1", "127.0.0.1", "FATAL"):
        assert leak not in summary


# ------------------------------------------------------------------ target summary


@pytest.mark.parametrize(
    ("url", "kind"),
    [
        (POOLER_URL, "supabase_session_pooler"),
        (POOLER_URL.replace(":5432/", ":6543/"), "supabase_transaction_pooler"),
        (
            f"postgresql://postgres:{SECRET_PASSWORD}@db.abcdefghijklmnopqrst.supabase.co/postgres",
            "supabase_direct",
        ),
        ("postgresql://portfolio:portfolio@127.0.0.1:54329/portfolio", "local"),
        ("postgresql://u:p@db.example.com/x", "other"),
    ],
)
def test_target_summary_names_the_kind_of_server_only(
    make_settings: SettingsFactory, url: str, kind: str
) -> None:
    summary = Database(make_settings(database_url=url + "?sslmode=require")).target_summary()
    assert summary == f"kind={kind} driver=postgresql+psycopg options=sslmode"
    for leak in (SECRET_HOST, SECRET_USER, SECRET_PASSWORD, "s3cret", "54329", "require"):
        assert leak not in summary


# ------------------------------------------------------------------ a server that never answers


@pytest.fixture
def silent_server() -> Iterator[int]:
    """Accepts TCP connections and never says a word: what a blackholed or overloaded pooler
    looks like to the driver. The connect timeout must fire and be reported as such."""
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.bind(("127.0.0.1", 0))
    server.listen(8)
    accepted: list[socket.socket] = []
    stop = threading.Event()

    def accept() -> None:
        server.settimeout(0.2)
        while not stop.is_set():
            try:
                accepted.append(server.accept()[0])
            except OSError:
                continue

    thread = threading.Thread(target=accept, daemon=True)
    thread.start()
    try:
        yield server.getsockname()[1]
    finally:
        stop.set()
        thread.join(2)
        for conn in accepted:
            conn.close()
        server.close()


def test_a_server_that_never_answers_is_reported_as_a_connect_timeout(
    make_settings: SettingsFactory, silent_server: int, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.INFO)
    url = f"postgresql://admin:s3cret-pw@127.0.0.1:{silent_server}/private_db"
    database = Database(make_settings(database_url=url))
    try:
        began = time.perf_counter()
        assert check_database(database) == UNAVAILABLE
        assert time.perf_counter() - began < 6  # connect_timeout is 3 s
    finally:
        database.dispose()
    line = caplog.text
    assert "readiness: database check failed (OperationalError)" in line
    assert "stage=connect driver=ConnectionTimeout" in line
    assert "reason=timeout" in line
    assert "kind=local" in line
    for leak in ("s3cret", "admin", "private_db", str(silent_server)):
        assert leak not in line


@pytest.mark.postgres
def test_wrong_credentials_are_reported_as_such(
    make_settings: SettingsFactory, postgres_url: str, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.INFO)
    # The configured test server (its host and port differ locally and in CI), wrong password.
    url = make_url(postgres_url).set(password="wr0ng-s3cret").render_as_string(hide_password=False)
    with TestClient(create_app(make_settings(database_url=url))) as client:
        assert client.get("/ready").status_code == 503
    assert "stage=connect" in caplog.text
    assert "reason=credentials" in caplog.text
    assert "wr0ng-s3cret" not in caplog.text
