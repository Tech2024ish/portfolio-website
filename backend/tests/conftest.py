"""Shared fixtures.

Settings are always built explicitly with ``_env_file=None`` so a developer's local
``.env`` can never leak into, or change the outcome of, a test.
"""

from __future__ import annotations

import os
from collections.abc import Callable, Iterator
from pathlib import Path
from typing import Any

import psycopg
import pytest
from fastapi.testclient import TestClient

from app.core.config import Environment, Settings
from app.main import create_app

SettingsFactory = Callable[..., Settings]


@pytest.fixture
def make_settings() -> SettingsFactory:
    def factory(**overrides: Any) -> Settings:
        values: dict[str, Any] = {"environment": Environment.TEST, "cors_origins": []}
        values.update(overrides)
        return Settings(_env_file=None, **values)

    return factory


@pytest.fixture
def client(make_settings: SettingsFactory) -> Iterator[TestClient]:
    app = create_app(make_settings(cors_origins=["http://localhost:3000"]))
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="session")
def postgres_url() -> str:
    """URL of the real PostgreSQL used by integration tests.

    Deliberately fails instead of skipping: a missing database is a broken test
    environment, not a reason to report green.
    """
    url = os.environ.get("TEST_DATABASE_URL", "").strip()
    if not url:
        pytest.fail(
            "TEST_DATABASE_URL is not set. Start the database with `docker compose up -d db` "
            "(see backend/README.md) or deselect explicitly with `-m 'not postgres'`.",
            pytrace=False,
        )
    return url


def libpq_url(url: str) -> str:
    """Plain libpq URL (psycopg) for direct assertions outside SQLAlchemy."""
    from app.core.config import normalise_database_url

    return normalise_database_url(url).replace("postgresql+psycopg://", "postgresql://", 1)


@pytest.fixture(scope="session")
def migrated_database(postgres_url: str) -> str:
    """Bring the integration database to the latest Alembic revision, exactly as production."""
    from alembic import command
    from alembic.config import Config

    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", postgres_url)
    command.upgrade(config, "head")
    return postgres_url


@pytest.fixture
def clean_database(migrated_database: str) -> Iterator[str]:
    with psycopg.connect(libpq_url(migrated_database)) as conn:
        conn.execute("truncate contact_messages, rate_limit_events restart identity")
    yield migrated_database


@pytest.fixture
def db_client(make_settings: SettingsFactory, clean_database: str) -> Iterator[TestClient]:
    app = create_app(make_settings(database_url=clean_database))
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
def query(clean_database: str) -> Callable[..., list[tuple[Any, ...]]]:
    def run(sql: str, *params: Any) -> list[tuple[Any, ...]]:
        with psycopg.connect(libpq_url(clean_database)) as conn:
            return conn.execute(sql, params).fetchall()

    return run
