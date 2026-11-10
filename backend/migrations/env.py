"""Alembic environment.

The URL comes from an explicit ``sqlalchemy.url`` (tests) or from ``DATABASE_URL`` via the
application settings. Only tables defined in ``app.models`` are compared by autogenerate, so
legacy Supabase tables (``contacts``, ``projects``, ``visits``, ``customer``) are never
proposed for dropping.
"""

from __future__ import annotations

from typing import Literal

from alembic import context
from sqlalchemy import create_engine, pool

from app.core.config import Settings, normalise_database_url
from app.models import Base

config = context.config
target_metadata = Base.metadata


def _database_url() -> str:
    explicit = config.get_main_option("sqlalchemy.url")
    if explicit:
        return normalise_database_url(explicit)
    url = Settings().database_url
    if url is None:
        raise RuntimeError("DATABASE_URL is not set; cannot run migrations.")
    return url.get_secret_value()


def _include_name(
    name: str | None,
    type_: Literal[
        "schema", "table", "column", "index", "unique_constraint", "foreign_key_constraint"
    ],
    _parent: dict[str, str | None],
) -> bool:
    if type_ == "table":
        return name in target_metadata.tables
    return True


def run_migrations_offline() -> None:
    context.configure(
        url=_database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        include_name=_include_name,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    engine = create_engine(_database_url(), poolclass=pool.NullPool)
    with engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_name=_include_name,
            compare_type=True,
            transaction_per_migration=True,
        )
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
