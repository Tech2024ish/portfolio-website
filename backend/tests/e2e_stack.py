"""Prepare the throwaway database for the full-stack browser test (frontend/e2e/full-stack).

    E2E_DATABASE_URL=postgresql://portfolio:portfolio@127.0.0.1:54329/portfolio_e2e \
    E2E_OWNER_EMAIL=owner@example.com E2E_OWNER_PASSWORD=... \
    uv run python -m tests.e2e_stack

Recreates the database from nothing, exactly as a new production database is built: Alembic
migrations, the verified content import (app/cli/content.py) and the owner account
(app/cli/owner.py). It refuses any database that is not on this machine or whose name does not end
in ``_e2e``, so it can never reach a real database. Lives under tests/ so it is never deployed.
"""

from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

import psycopg
from alembic import command
from alembic.config import Config
from psycopg import sql
from pydantic import SecretStr
from sqlalchemy.engine import make_url

from app.cli import content, owner
from app.core.config import Settings, normalise_database_url

LOCAL_HOSTS = {"127.0.0.1", "localhost", "::1"}


def _required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise SystemExit(f"Set {name} first.")
    return value


def main() -> None:
    url = normalise_database_url(_required("E2E_DATABASE_URL"))
    email = _required("E2E_OWNER_EMAIL")
    password = _required("E2E_OWNER_PASSWORD")

    target = make_url(url)
    name = target.database or ""
    if target.host not in LOCAL_HOSTS or not name.endswith("_e2e"):
        raise SystemExit("Refusing: the full-stack test database must be local and named *_e2e.")

    # Recreate the database from the server's maintenance database.
    admin = target.set(drivername="postgresql", database="postgres")
    with psycopg.connect(admin.render_as_string(hide_password=False), autocommit=True) as conn:
        database = sql.Identifier(name)
        conn.execute(sql.SQL("drop database if exists {} with (force)").format(database))
        conn.execute(sql.SQL("create database {}").format(database))

    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", url.replace("%", "%%"))
    command.upgrade(config, "head")

    settings = Settings(database_url=SecretStr(url))
    if content.run(["import"], settings=settings) != 0:
        raise SystemExit("The content import failed.")
    created = owner.run(
        ["create", email, "--name", "E2E Owner"], settings=settings, prompt=lambda _: password
    )
    if created != 0:
        raise SystemExit("Creating the owner failed.")
    # Uploaded images from earlier runs (only a folder made for this test).
    media = os.environ.get("E2E_MEDIA_DIR", "").strip()
    if media and Path(media).name == "portfolio-e2e-media":
        shutil.rmtree(media, ignore_errors=True)
    print("Full-stack test database ready.", file=sys.stderr)


if __name__ == "__main__":
    main()
