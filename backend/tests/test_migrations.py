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

from app.cli import production
from app.database.revision import EXPECTED_REVISION
from app.database.session import Database
from tests.conftest import SettingsFactory, libpq_url

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
    "site_settings",
    "page_views",
    "analytics_keys",
    *CONTENT_TABLES,
)
# One row with the fixed id 1: they must not have an id sequence.
SINGLE_ROW_TABLES = ("profile", "site_settings")
# Tables with an identity sequence (analytics_keys is keyed by day).
SEQUENCED_TABLES = tuple(
    table for table in DATA_TABLES if table not in (*SINGLE_ROW_TABLES, "analytics_keys")
)
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
        assert conn.execute("select version_num from alembic_version").fetchall() == [
            (EXPECTED_REVISION,)
        ]
        updated = conn.execute(
            "update alembic_version set version_num = version_num where version_num = %s",
            (EXPECTED_REVISION,),
        )
        assert updated.rowcount == 1
        conn.rollback()
    # Alembic itself must keep working on the locked-down table: down and up again.
    command.downgrade(config, "base")
    with psycopg.connect(url) as conn:
        assert conn.execute("select count(*) from alembic_version").fetchone() == (0,)
    command.upgrade(config, "head")
    with psycopg.connect(url) as conn:
        assert conn.execute("select version_num from alembic_version").fetchall() == [
            (EXPECTED_REVISION,)
        ]


SETTINGS_ROW = (
    "insert into site_settings (id, seo_title, seo_description) "
    "values (1, 'A title', 'A description')"
)


def test_single_row_tables_have_no_id_sequence(
    supabase_first_deploy: tuple[str, Config],
) -> None:
    url, _ = supabase_first_deploy
    with psycopg.connect(url) as conn:
        for table in SINGLE_ROW_TABLES:
            assert conn.execute("select pg_get_serial_sequence(%s, 'id')", (table,)).fetchone() == (
                None,
            ), table
            assert conn.execute(
                "select column_default from information_schema.columns "
                "where table_schema = 'public' and table_name = %s and column_name = 'id'",
                (table,),
            ).fetchone() == (None,), table


def test_the_production_preflight_passes_under_supabase_grants(
    supabase_first_deploy: tuple[str, Config], make_settings: SettingsFactory
) -> None:
    """The check that found the defect in production, on a Supabase-like database with a
    fixed-id row present."""
    url, _ = supabase_first_deploy
    with psycopg.connect(url, autocommit=True) as conn:
        conn.execute(SETTINGS_ROW)
    settings = make_settings(database_url=url)
    database = Database(settings)
    try:
        with database.engine.connect() as conn:
            report = production.check(conn, settings)
            conn.rollback()
    finally:
        database.dispose()
        with psycopg.connect(url, autocommit=True) as conn:
            conn.execute("delete from site_settings")
    assert report.failures == 0, "\n".join(report.lines)


def test_removing_the_sequences_keeps_rows_and_can_be_reversed(
    supabase_first_deploy: tuple[str, Config],
) -> None:
    """From the state production was in: sequences present and granted, a fixed-id row stored."""
    url, config = supabase_first_deploy
    command.downgrade(config, "v3_0006")
    try:
        with psycopg.connect(url, autocommit=True) as conn:
            for table in SINGLE_ROW_TABLES:
                sequence = f"{table}_id_seq"
                assert conn.execute("select to_regclass(%s)", (sequence,)).fetchone() != (None,)
                for role in CLIENT_ROLES:
                    # The downgrade itself leaves the recreated sequence closed.
                    assert conn.execute(
                        "select has_sequence_privilege(%s, %s, 'USAGE')", (role, sequence)
                    ).fetchone() == (False,)
                    conn.execute(f"grant all on sequence {sequence} to {role}")
            conn.execute(SETTINGS_ROW)
        command.upgrade(config, "head")
        with psycopg.connect(url) as conn:
            assert conn.execute("select id, seo_title from site_settings").fetchall() == [
                (1, "A title")
            ]
            for table in SINGLE_ROW_TABLES:
                assert conn.execute("select to_regclass(%s)", (f"{table}_id_seq",)).fetchone() == (
                    None,
                )
    finally:
        command.upgrade(config, "head")
        with psycopg.connect(url, autocommit=True) as conn:
            conn.execute("delete from site_settings")


# ------------------------------------------------------------------ the V1/V2 tables on Supabase

LEGACY_SETUP = """
create table public.contacts (id serial primary key, name text not null, email text not null,
  message text not null, created_at timestamptz not null default now());
create table public.projects (id serial primary key, title text not null, description text not null,
  tech_stack text[] not null default '{}', github_url text, live_url text, image_url text,
  created_at timestamptz not null default now());
create table public.visits (id bigint generated by default as identity primary key,
  created_at timestamptz not null default now());
create table public.customer (id bigint generated by default as identity primary key,
  created_at timestamptz not null default now());
insert into public.contacts (name, email, message, created_at) values
  ('Ada', 'ada@example.com', 'An old message.', '2026-05-01T10:00:00Z'),
  ('Grace', 'grace@example.com', 'Another old message.', '2026-06-01T10:00:00Z');
insert into public.projects (title, description, tech_stack) values
  ('REST API Service', 'Demo', array['Python']);
insert into public.visits (created_at) select '2026-05-01'::timestamptz from generate_series(1, 5);
alter table public.contacts enable row level security;
create policy "Allow public insert" on public.contacts for insert to public with check (true);
"""
LEGACY_TABLES = ("contacts", "projects", "visits", "customer")


@pytest.fixture
def supabase_with_legacy_tables(migrated_database: str) -> Iterator[tuple[str, Config]]:
    """The production database as inventoried: V1/V2 tables in public, open to the client roles,
    and no V3 tables yet."""
    url = libpq_url(migrated_database)
    config = _config(migrated_database)
    command.downgrade(config, "base")
    with psycopg.connect(url, autocommit=True) as conn:
        conn.execute("drop table if exists alembic_version")
        for role in CLIENT_ROLES:
            if not conn.execute("select 1 from pg_roles where rolname = %s", (role,)).fetchone():
                conn.execute(f"create role {role} nologin")
        conn.execute(LEGACY_SETUP)
        for role in CLIENT_ROLES:
            for table in LEGACY_TABLES:
                conn.execute(f"grant all on table public.{table} to {role}")
    try:
        command.upgrade(config, "head")
        yield url, config
    finally:
        command.downgrade(config, "base")
        with psycopg.connect(url, autocommit=True) as conn:
            conn.execute("drop schema if exists legacy cascade")
            for table in LEGACY_TABLES:
                conn.execute(f"drop table if exists public.{table} cascade")
        command.upgrade(config, "head")


def test_legacy_tables_are_moved_aside_with_their_data(
    supabase_with_legacy_tables: tuple[str, Config],
) -> None:
    url, _ = supabase_with_legacy_tables
    with psycopg.connect(url) as conn:
        counts = {
            table: conn.execute(f"select count(*) from legacy.{table}").fetchone()  # noqa: S608
            for table in LEGACY_TABLES
        }
        assert counts == {"contacts": (2,), "projects": (1,), "visits": (5,), "customer": (0,)}
        # public.projects is now the V3 table (it has a slug), not the old one.
        assert conn.execute(
            "select count(*) from information_schema.columns "
            "where table_schema = 'public' and table_name = 'projects' and column_name = 'slug'"
        ).fetchone() == (1,)
        # Policies and sequences moved with their tables; ids continue where they were.
        assert conn.execute(
            "select count(*) from pg_policies "
            "where schemaname = 'legacy' and tablename = 'contacts'"
        ).fetchone() == (1,)
        assert conn.execute(
            "select nextval(pg_get_serial_sequence('legacy.contacts', 'id'))"
        ).fetchone() == (3,)
        conn.rollback()
        for role in CLIENT_ROLES:
            assert conn.execute(
                "select has_schema_privilege(%s, 'legacy', 'USAGE')", (role,)
            ).fetchone() == (False,)
            for table in LEGACY_TABLES:
                for privilege in ("SELECT", "INSERT", "DELETE", "TRUNCATE"):
                    assert conn.execute(
                        "select has_table_privilege(%s, %s, %s)",
                        (role, f"legacy.{table}", privilege),
                    ).fetchone() == (False,), f"{role} has {privilege} on legacy.{table}"


def test_moving_legacy_tables_is_reversible(
    supabase_with_legacy_tables: tuple[str, Config],
) -> None:
    url, config = supabase_with_legacy_tables
    command.downgrade(config, "base")
    with psycopg.connect(url) as conn:
        assert conn.execute("select count(*) from public.contacts").fetchone() == (2,)
        assert conn.execute("select to_regnamespace('legacy')").fetchone() == (None,)
    command.upgrade(config, "head")
