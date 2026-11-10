"""Alembic history against real PostgreSQL: reversible, in sync with the models, and safe
under Supabase's default grants."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import psycopg
import pytest
from alembic import command
from alembic.config import Config

from tests.conftest import libpq_url

pytestmark = pytest.mark.postgres

ALEMBIC_INI = Path(__file__).resolve().parents[1] / "alembic.ini"


def _config(url: str) -> Config:
    config = Config(str(ALEMBIC_INI))
    config.set_main_option("sqlalchemy.url", url)
    return config


def test_migrations_round_trip_and_match_the_models(migrated_database: str) -> None:
    config = _config(migrated_database)
    command.downgrade(config, "base")
    command.upgrade(config, "head")
    command.check(config)  # raises if the models and the migrated schema differ


CLIENT_ROLES = ("anon", "authenticated")
PROTECTED_TABLES = ("contact_messages", "rate_limit_events", "alembic_version")


@pytest.fixture
def supabase_first_deploy(migrated_database: str) -> Iterator[tuple[str, Config]]:
    """Reproduce a first deploy on Supabase: default privileges grant everything on new public
    tables to the client roles, and no Alembic tables exist yet (``alembic_version`` included),
    so the upgrade creates all of them under those grants."""
    url = libpq_url(migrated_database)
    config = _config(migrated_database)
    with psycopg.connect(url, autocommit=True) as conn:
        for role in CLIENT_ROLES:
            exists = conn.execute("select 1 from pg_roles where rolname = %s", (role,)).fetchone()
            if not exists:
                conn.execute(f"create role {role} nologin")
            conn.execute(f"alter default privileges in schema public grant all on tables to {role}")
            conn.execute(
                f"alter default privileges in schema public grant all on sequences to {role}"
            )
    command.downgrade(config, "base")
    with psycopg.connect(url, autocommit=True) as conn:
        conn.execute("drop table alembic_version")
    try:
        command.upgrade(config, "head")
        yield url, config
    finally:
        with psycopg.connect(url, autocommit=True) as conn:
            for role in CLIENT_ROLES:
                conn.execute(
                    f"alter default privileges in schema public revoke all on tables from {role}"
                )
                conn.execute(
                    f"alter default privileges in schema public revoke all on sequences from {role}"
                )
        command.upgrade(config, "head")


def test_tables_are_closed_to_supabase_client_roles(
    supabase_first_deploy: tuple[str, Config],
) -> None:
    url, _ = supabase_first_deploy
    with psycopg.connect(url) as conn:
        for role in CLIENT_ROLES:
            for table in PROTECTED_TABLES:
                for privilege in ("SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE"):
                    row = conn.execute(
                        "select has_table_privilege(%s, %s, %s)", (role, table, privilege)
                    ).fetchone()
                    assert row == (False,), f"{role} has {privilege} on {table}"
            for table in ("contact_messages", "rate_limit_events"):
                row = conn.execute(
                    "select has_sequence_privilege(%s, pg_get_serial_sequence(%s, 'id'), 'USAGE')",
                    (role, table),
                ).fetchone()
                assert row == (False,), f"{role} can use the {table} id sequence"
        rls = conn.execute(
            "select relname, relrowsecurity, relforcerowsecurity from pg_class "
            "where relname = any(%s) and relkind = 'r' order by relname",
            (list(PROTECTED_TABLES),),
        ).fetchall()
        # RLS on, never forced: the owning migration/API role is not restricted by it.
        assert rls == [
            ("alembic_version", True, False),
            ("contact_messages", True, False),
            ("rate_limit_events", True, False),
        ]


def test_migration_role_can_still_read_and_update_alembic_version(
    supabase_first_deploy: tuple[str, Config],
) -> None:
    url, config = supabase_first_deploy
    with psycopg.connect(url) as conn:
        assert conn.execute("select version_num from alembic_version").fetchall() == [("v3_0001",)]
        updated = conn.execute(
            "update alembic_version set version_num = version_num where version_num = 'v3_0001'"
        )
        assert updated.rowcount == 1
        conn.rollback()
    # Alembic itself must keep working on the locked-down table: down and up again.
    command.downgrade(config, "base")
    with psycopg.connect(url) as conn:
        assert conn.execute("select count(*) from alembic_version").fetchone() == (0,)
    command.upgrade(config, "head")
    with psycopg.connect(url) as conn:
        assert conn.execute("select version_num from alembic_version").fetchall() == [("v3_0001",)]
