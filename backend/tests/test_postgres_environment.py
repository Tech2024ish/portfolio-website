"""Proves the integration-test database is real PostgreSQL at the agreed major version.

Phase 2 builds on this fixture to run Alembic migrations against PostgreSQL.
"""

from __future__ import annotations

import os

import psycopg
import pytest

from app.core.config import normalise_database_url

pytestmark = pytest.mark.postgres


def _libpq_url(url: str) -> str:
    return normalise_database_url(url).replace("postgresql+psycopg://", "postgresql://", 1)


def test_integration_database_is_postgres_at_expected_major(postgres_url: str) -> None:
    expected_major = int(os.environ.get("EXPECTED_POSTGRES_MAJOR", "17"))
    with psycopg.connect(_libpq_url(postgres_url), connect_timeout=5) as conn:
        version_num = conn.execute("show server_version_num").fetchone()
    assert version_num is not None
    assert int(version_num[0]) // 10000 == expected_major


def test_integration_database_supports_transactions(postgres_url: str) -> None:
    with psycopg.connect(_libpq_url(postgres_url), connect_timeout=5) as conn:
        conn.execute("create temporary table phase1_probe (id int primary key)")
        conn.execute("insert into phase1_probe values (1)")
        with pytest.raises(psycopg.errors.UniqueViolation):
            conn.execute("insert into phase1_probe values (1)")
        conn.rollback()
