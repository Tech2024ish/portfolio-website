"""``GET /ready``: read-only database readiness, against real PostgreSQL."""

from __future__ import annotations

import time
import uuid
from collections.abc import Callable, Iterator
from pathlib import Path
from typing import Any

import psycopg
import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.api import health
from app.database.readiness import check_database, read_only_connection
from app.database.revision import EXPECTED_REVISION
from app.database.session import Database
from app.main import create_app
from tests.conftest import SettingsFactory, libpq_url

ALEMBIC_INI = Path(__file__).resolve().parents[1] / "alembic.ini"
READY = {"status": "ready", "checks": {"database": "ok", "migrations": "ok"}}


@pytest.fixture(autouse=True)
def no_readiness_cache(monkeypatch: pytest.MonkeyPatch) -> None:
    """Each request performs a real check unless a test opts back into caching."""
    monkeypatch.setattr(health, "READY_CACHE_SECONDS", 0.0)


def _get_ready(make_settings: SettingsFactory, database_url: str | None) -> Any:
    settings = make_settings(database_url=database_url) if database_url else make_settings()
    with TestClient(create_app(settings)) as client:
        return client.get("/ready")


@pytest.fixture
def scratch_database(postgres_url: str) -> Iterator[Callable[[str | None], str]]:
    """Creates empty databases on the test server; ``setup`` SQL may seed them. Dropped after."""
    admin_url = libpq_url(postgres_url).rsplit("/", 1)[0] + "/postgres"
    created: list[str] = []

    def make(setup: str | None = None) -> str:
        name = f"ready_scratch_{uuid.uuid4().hex[:10]}"
        with psycopg.connect(admin_url, autocommit=True) as conn:
            conn.execute(f'create database "{name}"')
        created.append(name)
        url = admin_url.rsplit("/", 1)[0] + f"/{name}"
        if setup:
            with psycopg.connect(url) as conn:
                conn.execute(setup)
        return url

    yield make
    with psycopg.connect(admin_url, autocommit=True) as conn:
        for name in created:
            conn.execute(f'drop database if exists "{name}" with (force)')


# ------------------------------------------------------------------ revision contract


def test_expected_revision_is_the_alembic_head() -> None:
    head = ScriptDirectory.from_config(Config(str(ALEMBIC_INI))).get_current_head()
    assert head == EXPECTED_REVISION


# ------------------------------------------------------------------ outcomes


@pytest.mark.postgres
def test_ready_when_migrated_to_the_expected_revision(
    make_settings: SettingsFactory, clean_database: str
) -> None:
    response = _get_ready(make_settings, clean_database)
    assert response.status_code == 200
    assert response.json() == READY
    assert response.headers["cache-control"] == "no-store"


@pytest.mark.postgres
def test_not_ready_when_never_migrated(
    make_settings: SettingsFactory, scratch_database: Callable[[str | None], str]
) -> None:
    response = _get_ready(make_settings, scratch_database(None))
    assert response.status_code == 503
    assert response.json() == {
        "status": "not_ready",
        "checks": {"database": "ok", "migrations": "pending"},
    }
    assert response.headers["cache-control"] == "no-store"


@pytest.mark.postgres
@pytest.mark.parametrize(
    "rows",
    [
        ["v0_older"],  # behind
        ["v3_9999"],  # unknown / ahead
        [],  # table exists but empty
        [EXPECTED_REVISION, "v3_branch"],  # multiple heads
    ],
)
def test_not_ready_when_the_revision_is_not_exactly_the_expected_one(
    make_settings: SettingsFactory,
    scratch_database: Callable[[str | None], str],
    rows: list[str],
) -> None:
    url = scratch_database("create table alembic_version (version_num varchar(32) primary key)")
    with psycopg.connect(url) as conn:
        for row in rows:
            conn.execute("insert into alembic_version (version_num) values (%s)", (row,))
    response = _get_ready(make_settings, url)
    assert response.status_code == 503
    assert response.json()["checks"] == {"database": "ok", "migrations": "pending"}


def test_not_ready_when_the_database_is_unreachable_and_nothing_leaks(
    make_settings: SettingsFactory,
) -> None:
    started = time.perf_counter()
    response = _get_ready(make_settings, "postgresql://admin:s3cret-pw@127.0.0.1:1/portfolio")
    assert time.perf_counter() - started < 6
    assert response.status_code == 503
    assert response.json() == {
        "status": "not_ready",
        "checks": {"database": "unavailable", "migrations": "unknown"},
    }
    assert response.headers["cache-control"] == "no-store"
    for secret in ("s3cret", "admin", "127.0.0.1", "portfolio", "Error", "psycopg"):
        assert secret not in response.text


def test_not_ready_without_a_database_url(make_settings: SettingsFactory) -> None:
    response = _get_ready(make_settings, None)
    assert response.status_code == 503
    assert response.json()["checks"] == {"database": "unavailable", "migrations": "unknown"}


def test_health_stays_independent_of_the_database(make_settings: SettingsFactory) -> None:
    app = create_app(make_settings(database_url="postgresql://u:p@127.0.0.1:1/x"))
    with TestClient(app) as client:
        assert client.get("/health").status_code == 200
        assert client.get("/ready").status_code == 503


# ------------------------------------------------------------------ read-only guarantees


@pytest.mark.postgres
def test_readiness_connection_is_read_only_with_a_statement_timeout(
    make_settings: SettingsFactory, clean_database: str
) -> None:
    database = Database(make_settings(database_url=clean_database))
    try:
        with read_only_connection(database) as connection:
            assert connection.execute(text("show transaction_read_only")).scalar() == "on"
            assert connection.execute(text("show statement_timeout")).scalar() == "2s"
            with pytest.raises(DBAPIError) as caught:
                connection.execute(
                    text("insert into rate_limit_events (bucket, client_key) values ('x', 'y')")
                )
            assert isinstance(caught.value.orig, psycopg.errors.ReadOnlySqlTransaction)
    finally:
        database.dispose()


@pytest.mark.postgres
def test_ready_does_not_change_any_data(
    make_settings: SettingsFactory, clean_database: str, query: Any
) -> None:
    def snapshot() -> list[tuple[Any, ...]]:
        rows: list[tuple[Any, ...]] = query(
            "select (select count(*) from contact_messages), "
            "(select count(*) from rate_limit_events), "
            "(select string_agg(version_num, ',') from alembic_version)"
        )
        return rows

    before = snapshot()
    settings = make_settings(database_url=clean_database)
    with TestClient(create_app(settings)) as client:
        for _ in range(5):
            assert client.get("/ready").status_code == 200
    assert snapshot() == before == [(0, 0, EXPECTED_REVISION)]


# ------------------------------------------------------------------ caching and contract


def test_results_are_cached_briefly_to_protect_the_connection_pool(
    make_settings: SettingsFactory, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[int] = []
    real = check_database

    def counting(database: Database) -> Any:
        calls.append(1)
        return real(database)

    monkeypatch.setattr(health, "check_database", counting)
    monkeypatch.setattr(health, "READY_CACHE_SECONDS", 60.0)
    with TestClient(create_app(make_settings())) as client:
        for _ in range(3):
            assert client.get("/ready").status_code == 503
    assert len(calls) == 1

    monkeypatch.setattr(health, "READY_CACHE_SECONDS", 0.0)
    with TestClient(create_app(make_settings())) as client:
        client.get("/ready")
        client.get("/ready")
    assert len(calls) == 3


def test_ready_is_documented_and_get_only(client: TestClient) -> None:
    schema = client.get("/api/v1/openapi.json").json()
    assert set(schema["paths"]["/ready"]) == {"get"}
    assert "503" in schema["paths"]["/ready"]["get"]["responses"]
    assert client.post("/ready").status_code == 405
