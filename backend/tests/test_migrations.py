"""Alembic history against real PostgreSQL: reversible, in sync with the models, and safe
under Supabase's default grants."""

from __future__ import annotations

import re
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


EXPECTED_NAMES = {
    "contact_messages": {
        "pk_contact_messages",
        "ck_contact_messages_status_allowed",
        "ck_contact_messages_message_length",
        "ix_contact_messages_status_created_at",
        "ix_contact_messages_fingerprint_created_at",
    },
    "rate_limit_events": {
        "pk_rate_limit_events",
        "ix_rate_limit_events_bucket_client_key_created_at",
        "ix_rate_limit_events_bucket_created_at",
    },
    "owner_users": {
        "pk_owner_users",
        "uq_owner_users_email",
        "ck_owner_users_email_lowercase",
    },
    "owner_sessions": {
        "pk_owner_sessions",
        "uq_owner_sessions_token_hash",
        "fk_owner_sessions_user_id_owner_users",
        "ix_owner_sessions_user_id",
    },
}


def _model_names(table_name: str) -> set[str]:
    """Constraint and index names exactly as the SQLAlchemy models would create them."""
    from sqlalchemy.dialects import postgresql
    from sqlalchemy.schema import CreateIndex, CreateTable

    from app.models import Base

    table = Base.metadata.tables[table_name]
    dialect = postgresql.dialect()  # type: ignore[no-untyped-call]
    ddl = str(CreateTable(table).compile(dialect=dialect))
    ddl += "".join(str(CreateIndex(index).compile(dialect=dialect)) for index in table.indexes)
    return set(re.findall(r"(?:CONSTRAINT|INDEX) (\w+)", ddl))


def test_every_table_has_exactly_the_names_its_model_declares(migrated_database: str) -> None:
    """The same guard as below for every table, including ones added later."""
    from app.models import Base

    with psycopg.connect(libpq_url(migrated_database)) as conn:
        for table in Base.metadata.tables:
            constraints = conn.execute(
                "select conname from pg_constraint where conrelid = %s::regclass", (table,)
            ).fetchall()
            indexes = conn.execute(
                "select indexname from pg_indexes where tablename = %s", (table,)
            ).fetchall()
            in_database = {name for (name,) in constraints} | {name for (name,) in indexes}
            assert in_database == _model_names(table), table


def test_migrated_names_match_the_models_exactly(migrated_database: str) -> None:
    """Guards against naming-convention double prefixes (e.g. ck_<table>_ck_<table>_...)."""
    config = _config(migrated_database)
    command.downgrade(config, "base")
    command.upgrade(config, "head")
    with psycopg.connect(libpq_url(migrated_database)) as conn:
        for table, expected in EXPECTED_NAMES.items():
            constraints = conn.execute(
                "select conname from pg_constraint where conrelid = %s::regclass", (table,)
            ).fetchall()
            indexes = conn.execute(
                "select indexname from pg_indexes where tablename = %s", (table,)
            ).fetchall()
            in_database = {name for (name,) in constraints} | {name for (name,) in indexes}
            assert in_database == expected, table
            assert _model_names(table) == expected, table


CLIENT_ROLES = ("anon", "authenticated")
CONTENT_TABLES = (
    "profile",
    "skill_categories",
    "skills",
    "experiences",
    "education",
    "certifications",
    "projects",
    "articles",
    "audit_events",
    "media_assets",
)
DATA_TABLES = (
    "contact_messages",
    "rate_limit_events",
    "owner_users",
    "owner_sessions",
    "email_deliveries",
    *CONTENT_TABLES,
)
# Tables with an identity sequence (profile's id is fixed at 1).
SEQUENCED_TABLES = tuple(table for table in DATA_TABLES if table != "profile")
PROTECTED_TABLES = (*DATA_TABLES, "alembic_version")


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
            for table in SEQUENCED_TABLES:
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
        assert rls == sorted((table, True, False) for table in PROTECTED_TABLES)


def test_migration_role_can_still_read_and_update_alembic_version(
    supabase_first_deploy: tuple[str, Config],
) -> None:
    url, config = supabase_first_deploy
    with psycopg.connect(url) as conn:
        assert conn.execute("select version_num from alembic_version").fetchall() == [("v3_0005",)]
        updated = conn.execute(
            "update alembic_version set version_num = version_num where version_num = 'v3_0005'"
        )
        assert updated.rowcount == 1
        conn.rollback()
    # Alembic itself must keep working on the locked-down table: down and up again.
    command.downgrade(config, "base")
    with psycopg.connect(url) as conn:
        assert conn.execute("select count(*) from alembic_version").fetchone() == (0,)
    command.upgrade(config, "head")
    with psycopg.connect(url) as conn:
        assert conn.execute("select version_num from alembic_version").fetchall() == [("v3_0005",)]
