from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool

import models.entities  # noqa: F401  (registers tables)
from core.config import get_settings
from core.db import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Tables that already exist in the production Supabase database and are owned by
# the legacy /api routes (see supabase_schema.sql). Alembic does not manage them.
LEGACY_TABLES = frozenset({"projects", "skills", "contacts", "visit_stats"})


def include_name(name, type_, parent_names):
    """Only compare tables this migration history owns.

    Without this, autogenerate/`alembic check` reflect every table in the database
    and propose dropping anything not in the models — including the legacy tables
    above. Tables are matched against the models (an allow-list), so any other
    unmanaged table is preserved too.
    """
    if type_ == "table":
        return name in target_metadata.tables
    return True


def _configure(**kwargs) -> None:
    context.configure(
        target_metadata=target_metadata,
        render_as_batch=True,
        include_name=include_name,
        **kwargs,
    )


def _url() -> str:
    url = config.attributes.get("url") or get_settings().database_url
    if not url:
        raise RuntimeError("Set DATABASE_URL before running migrations.")
    return url


def run_migrations_offline() -> None:
    _configure(url=_url(), literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = config.attributes.get("connection")
    if connectable is not None:
        _configure(connection=connectable)
        with context.begin_transaction():
            context.run_migrations()
        return
    engine = create_engine(_url(), poolclass=pool.NullPool)
    with engine.connect() as connection:
        _configure(connection=connection)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
