"""``GET /ready`` under failure: single-flight cache, slow databases, isolation from the
application pool, sanitised errors and logs."""

from __future__ import annotations

import logging
import threading
import time
from typing import Any

import psycopg
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.api import health
from app.database import readiness
from app.database.readiness import (
    NOT_YET_CHECKED,
    UNAVAILABLE,
    Readiness,
    ReadinessCache,
    check_database,
    read_only_connection,
)
from app.database.session import Database
from app.main import create_app
from tests.conftest import SettingsFactory, libpq_url

OK = Readiness(database="ok", migrations="ok")


class _FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


# ------------------------------------------------------------------ cache: deterministic


def test_cache_expiry_is_measured_from_when_the_check_finished() -> None:
    clock = _FakeClock()
    cache = ReadinessCache(clock=clock)
    calls: list[int] = []

    def slow_check() -> Readiness:
        calls.append(1)
        clock.now += 10  # the check itself takes longer than the TTL
        return UNAVAILABLE

    assert cache.get(slow_check, ttl_seconds=5) == UNAVAILABLE
    assert cache.get(slow_check, ttl_seconds=5) == UNAVAILABLE  # still fresh: no second check
    assert calls == [1]
    clock.now += 5.01
    cache.get(slow_check, ttl_seconds=5)
    assert calls == [1, 1]


def test_cache_runs_one_check_at_a_time_and_never_blocks_other_callers() -> None:
    cache = ReadinessCache()
    started, release = threading.Event(), threading.Event()
    calls: list[int] = []

    def blocking_check() -> Readiness:
        calls.append(1)
        started.set()
        release.wait(5)
        return OK

    first = threading.Thread(target=cache.get, args=(blocking_check, 0.0))
    first.start()
    assert started.wait(5)
    began = time.perf_counter()
    # No result yet: another caller gets "unknown" at once instead of waiting or re-checking.
    assert cache.get(blocking_check, 0.0) == NOT_YET_CHECKED
    assert time.perf_counter() - began < 0.1
    release.set()
    first.join(5)
    assert calls == [1]

    # Expired (ttl 0) while a refresh is running: callers get the last known result.
    started.clear()
    release.clear()
    refresh = threading.Thread(target=cache.get, args=(blocking_check, 0.0))
    refresh.start()
    assert started.wait(5)
    assert cache.get(blocking_check, 0.0) == OK
    release.set()
    refresh.join(5)
    assert calls == [1, 1]


# ------------------------------------------------------------------ a genuinely slow database


@pytest.mark.postgres
def test_slow_database_check_is_single_flight_cached_and_keeps_health_responsive(
    make_settings: SettingsFactory,
    clean_database: str,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Another session holds an ACCESS EXCLUSIVE lock on alembic_version, so the readiness
    query really blocks inside PostgreSQL until the 2 s statement timeout cancels it."""
    calls: list[int] = []

    def counting(database: Database) -> Readiness:
        calls.append(1)
        return check_database(database)

    monkeypatch.setattr(health, "check_database", counting)
    monkeypatch.setattr(health, "READY_CACHE_SECONDS", 1.0)  # shorter than the slow check

    holder = psycopg.connect(libpq_url(clean_database))
    holder.execute("lock table alembic_version in access exclusive mode")
    try:
        with TestClient(create_app(make_settings(database_url=clean_database))) as client:
            results: list[tuple[int, float]] = []

            def call_ready() -> None:
                began = time.perf_counter()
                response = client.get("/ready")
                results.append((response.status_code, time.perf_counter() - began))

            burst = [threading.Thread(target=call_ready) for _ in range(20)]
            for thread in burst:
                thread.start()
            time.sleep(0.3)
            began = time.perf_counter()
            assert client.get("/health").status_code == 200
            health_latency = time.perf_counter() - began
            for thread in burst:
                thread.join(10)

            # One real database check served 20 concurrent requests.
            assert calls == [1]
            assert len(results) == 20
            assert all(status == 503 for status, _ in results)
            slow = [elapsed for _, elapsed in results if elapsed > 1.5]
            assert len(slow) == 1
            assert slow[0] < 3.5  # cancelled by the 2 s statement timeout
            assert health_latency < 0.5

            # Expiry counts from completion: an immediate repeat is served from the cache.
            began = time.perf_counter()
            again = client.get("/ready")
            assert time.perf_counter() - began < 0.5
            assert again.status_code == 503
            assert again.json()["checks"] == {"database": "unavailable", "migrations": "unknown"}
            assert calls == [1]

            holder.rollback()  # the database recovers
            time.sleep(1.1)
            assert client.get("/ready").status_code == 200
            assert calls == [1, 1]
    finally:
        holder.rollback()
        holder.close()


@pytest.mark.postgres
def test_statement_timeout_really_cancels_a_slow_query(
    make_settings: SettingsFactory, clean_database: str
) -> None:
    database = Database(make_settings(database_url=clean_database))
    try:
        began = time.perf_counter()
        with read_only_connection(database) as connection, pytest.raises(DBAPIError) as caught:
            connection.execute(text("select pg_sleep(3)"))
        elapsed = time.perf_counter() - began
        assert isinstance(caught.value.orig, psycopg.errors.QueryCanceled)
        assert 1.5 < elapsed < 2.9
    finally:
        database.dispose()


@pytest.mark.postgres
def test_readiness_does_not_wait_for_the_application_pool(
    make_settings: SettingsFactory, clean_database: str
) -> None:
    app = create_app(make_settings(database_url=clean_database))
    with TestClient(app) as client:
        engine = app.state.database.engine
        held = [engine.connect() for _ in range(10)]  # pool_size 5 + max_overflow 5: exhausted
        try:
            began = time.perf_counter()
            response = client.get("/ready")
            assert time.perf_counter() - began < 2  # pool_timeout is 10 s
            assert response.status_code == 200
        finally:
            # Release before the app shuts down and disposes its pool.
            for connection in held:
                connection.close()
    app.state.database.dispose()


# ------------------------------------------------------------------ unexpected errors and logs


def test_unexpected_errors_become_sanitised_503s(
    make_settings: SettingsFactory,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    def explode(database: Database) -> Readiness:
        raise RuntimeError("boom: postgresql://admin:s3cret-pw@db.internal:5432/prod")

    monkeypatch.setattr(health, "check_database", explode)
    caplog.set_level(logging.DEBUG)
    with TestClient(create_app(make_settings())) as client:
        response = client.get("/ready")
    assert response.status_code == 503
    assert response.json() == {
        "status": "not_ready",
        "checks": {"database": "unavailable", "migrations": "unknown"},
    }
    assert response.headers["cache-control"] == "no-store"
    assert "readiness: unexpected failure (RuntimeError)" in caplog.text
    for secret in ("s3cret", "db.internal", "admin", "boom"):
        assert secret not in response.text
        assert secret not in caplog.text


def test_non_database_exceptions_inside_the_check_are_contained(
    make_settings: SettingsFactory,
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    def broken(database: Database) -> Any:
        raise ValueError("unexpected s3cret detail")

    monkeypatch.setattr(readiness, "read_only_connection", broken)
    caplog.set_level(logging.DEBUG)
    assert check_database(Database(make_settings())) == UNAVAILABLE
    assert "readiness: database check failed (ValueError)" in caplog.text
    assert "s3cret" not in caplog.text


@pytest.mark.postgres
@pytest.mark.parametrize(
    ("url", "secrets"),
    [
        (  # wrong password on a reachable server: PostgreSQL's error names the user
            "postgresql://portfolio:wr0ng-s3cret@127.0.0.1:54329/portfolio_test",
            ("wr0ng-s3cret", "portfolio_test", "54329", "password authentication", '"portfolio"'),
        ),
        (  # nothing listening: the driver's error names the host and port
            "postgresql://admin:s3cret-pw@127.0.0.1:1/private_db",
            ("s3cret-pw", "admin", "127.0.0.1", "private_db", "refused"),
        ),
    ],
)
def test_connection_details_never_reach_logs_or_responses(
    make_settings: SettingsFactory,
    caplog: pytest.LogCaptureFixture,
    url: str,
    secrets: tuple[str, ...],
) -> None:
    caplog.set_level(logging.INFO)  # the production default (LOG_LEVEL=INFO)
    with TestClient(create_app(make_settings(database_url=url))) as client:
        response = client.get("/ready")
    assert response.status_code == 503
    assert "readiness: database check failed (OperationalError)" in caplog.text
    for secret in secrets:
        assert secret not in caplog.text, secret
        assert secret not in response.text, secret
