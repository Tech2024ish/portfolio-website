"""The PostgreSQL rate limiter: concurrency, retention and bounded, non-blocking cleanup."""

from __future__ import annotations

import threading
import time
from collections.abc import Callable, Iterator
from datetime import timedelta
from typing import Any

import psycopg
import pytest
from sqlalchemy import Engine, create_engine, text
from sqlalchemy.orm import Session

from app.core.config import normalise_database_url
from app.repositories import rate_limit
from tests.conftest import libpq_url

pytestmark = pytest.mark.postgres

BUCKET = "contact"
WINDOW = timedelta(minutes=60)
LIMIT = 5


@pytest.fixture
def engine(clean_database: str) -> Iterator[Engine]:
    engine = create_engine(normalise_database_url(clean_database), pool_size=40, max_overflow=0)
    yield engine
    engine.dispose()


def key(name: str) -> str:
    """Production-shaped key: the SHA-256 digest the service derives from a client address."""
    return rate_limit.client_key(BUCKET, name)


@pytest.fixture
def seed(clean_database: str) -> Callable[..., None]:
    """Insert ``count`` events for ``key`` that are ``age`` old (a PostgreSQL interval)."""

    def insert(name: str, age: str, count: int = 1) -> None:
        with psycopg.connect(libpq_url(clean_database)) as conn:
            conn.execute(
                "insert into rate_limit_events (bucket, client_key, created_at) "
                "select %s, %s, clock_timestamp() - %s::interval from generate_series(1, %s)",
                (BUCKET, key(name), age, count),
            )

    return insert


def acquire(engine: Engine, name: str, **session_settings: str) -> bool:
    with Session(engine) as session:
        for setting, value in session_settings.items():
            session.execute(text(f"set local {setting} = '{value}'"))
        allowed = rate_limit.acquire(session, BUCKET, key(name), LIMIT, WINDOW)
        session.commit()
        return allowed


def count(query: Any, *names: str) -> int:
    [(total,)] = query(
        "select count(*) from rate_limit_events where client_key = any(%s)",
        [key(name) for name in names],
    )
    return int(total)


def ages(query: Any, name: str) -> list[int]:
    """Whole minutes since each event for ``name``, oldest first."""
    rows = query(
        "select floor(extract(epoch from clock_timestamp() - created_at) / 60)::int "
        "from rate_limit_events where client_key = %s order by created_at",
        key(name),
    )
    return [age for (age,) in rows]


# ------------------------------------------------------------------ active-window preservation


def test_cleanup_never_removes_events_inside_the_active_window(
    engine: Engine, seed: Callable[..., None], query: Any
) -> None:
    seed("blocked", "59 minutes", LIMIT)  # still counts: this client is at its limit
    seed("blocked", "90 minutes")  # outside the window but inside retention: kept
    seed("blocked", "150 minutes")  # beyond two windows: purged

    assert acquire(engine, "someone-else") is True  # triggers cleanup for the bucket
    assert ages(query, "blocked") == [90] + [59] * LIMIT
    assert acquire(engine, "blocked") is False  # the active limit is untouched


def test_retention_is_exactly_two_windows(
    engine: Engine, seed: Callable[..., None], query: Any
) -> None:
    seed("edge", "119 minutes")
    seed("edge", "121 minutes")
    assert acquire(engine, "trigger") is True
    assert ages(query, "edge") == [119]


def test_events_outside_the_window_do_not_count_but_inside_do(
    engine: Engine, seed: Callable[..., None]
) -> None:
    seed("recent", "61 minutes", LIMIT)  # retained, but no longer counted
    assert acquire(engine, "recent") is True
    seed("full", "1 minute", LIMIT)
    assert acquire(engine, "full") is False


# ------------------------------------------------------------------ bounded, non-blocking cleanup


def test_cleanup_is_bounded_per_request(
    engine: Engine, seed: Callable[..., None], query: Any
) -> None:
    seed("old", "3 hours", rate_limit.CLEANUP_BATCH * 2 + 200)
    assert acquire(engine, "a") is True
    assert count(query, "old") == rate_limit.CLEANUP_BATCH + 200
    assert acquire(engine, "b") is True
    assert acquire(engine, "c") is True
    assert count(query, "old") == 0


def test_cleanup_skips_rows_locked_by_another_transaction_instead_of_waiting(
    engine: Engine, seed: Callable[..., None], clean_database: str, query: Any
) -> None:
    seed("old", "3 hours", 50)
    holder = psycopg.connect(libpq_url(clean_database))
    try:
        # Another transaction holds every expired row (as a concurrent cleanup would).
        holder.execute(
            "select id from rate_limit_events where client_key = %s for update", (key("old"),)
        )
        started = time.perf_counter()
        # Without SKIP LOCKED this request would block and hit the lock timeout.
        assert acquire(engine, "visitor", lock_timeout="1s") is True
        assert time.perf_counter() - started < 1
    finally:
        holder.rollback()
        holder.close()
    assert count(query, "old") == 50


def test_concurrent_cleanup_has_no_deadlocks_or_failed_requests(
    engine: Engine, seed: Callable[..., None], query: Any
) -> None:
    seed("old", "3 hours", 3000)
    seed("active", "10 minutes", 3)
    workers = 30
    barrier = threading.Barrier(workers)
    results: list[bool] = []
    errors: list[BaseException] = []

    def visit(n: int) -> None:
        barrier.wait()
        try:
            # lock_timeout turns any lock wait into a visible failure; a deadlock would raise too.
            results.append(acquire(engine, f"client-{n}", lock_timeout="2s"))
        except BaseException as exc:  # recorded and asserted below
            errors.append(exc)

    threads = [threading.Thread(target=visit, args=(n,)) for n in range(workers)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert errors == []
    assert results == [True] * workers
    assert count(query, "old") == 0
    assert count(query, "active") == 3
    assert count(query, *(f"client-{n}" for n in range(workers))) == workers


def test_concurrent_requests_from_one_client_never_exceed_the_limit(engine: Engine) -> None:
    workers = 20
    barrier = threading.Barrier(workers)
    results: list[bool] = []

    def visit() -> None:
        barrier.wait()
        results.append(acquire(engine, "burst"))

    threads = [threading.Thread(target=visit) for _ in range(workers)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert results.count(True) == LIMIT
    assert results.count(False) == workers - LIMIT
