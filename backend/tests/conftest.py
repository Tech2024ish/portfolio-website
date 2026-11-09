"""Shared fixtures.

Settings are always built explicitly with ``_env_file=None`` so a developer's local
``.env`` can never leak into, or change the outcome of, a test.
"""

from __future__ import annotations

import os
from collections.abc import Callable, Iterator
from typing import Any

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
