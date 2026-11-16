"""Manage the single owner account. Uses DATABASE_URL from the environment or backend/.env.

    python -m app.cli.owner create EMAIL [--name NAME]
    python -m app.cli.owner set-password EMAIL
    python -m app.cli.owner import-legacy-hash EMAIL [--name NAME]   (hash read from stdin)
    python -m app.cli.owner revoke-sessions EMAIL

- Passwords are typed at a hidden prompt, twice, and are never accepted as arguments (those
  end up in shell history and process listings).
- ``import-legacy-hash`` preserves access during migration from V2: it stores an existing
  ``scrypt$...`` hash unchanged, and the API re-hashes it with Argon2id at the next sign-in.
- Setting a password ends every session of that account.
"""

from __future__ import annotations

import argparse
import getpass
import sys
from collections.abc import Callable, Sequence
from typing import TextIO

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.security import hash_password, password_problems
from app.database.session import Database
from app.models.owner import DISPLAY_NAME_MAX, OwnerSession, OwnerUser
from app.services.auth import normalise_email, utcnow

PasswordPrompt = Callable[[str], str]


def _read_new_password(prompt: PasswordPrompt) -> str | None:
    password = prompt("New owner password: ")
    problems = password_problems(password)
    if problems:
        print("Password rejected: " + " ".join(problems))
        return None
    if prompt("Repeat the password: ") != password:
        print("The passwords do not match.")
        return None
    return password


def _end_sessions(db: Session, user_id: int) -> int:
    result = db.execute(
        update(OwnerSession)
        .where(OwnerSession.user_id == user_id, OwnerSession.revoked_at.is_(None))
        .values(revoked_at=utcnow())
    )
    return int(getattr(result, "rowcount", 0) or 0)


def _valid_legacy_hash(value: str) -> bool:
    parts = value.split("$")
    return len(parts) == 6 and parts[0] == "scrypt" and all(parts[1:])


def run(
    argv: Sequence[str],
    *,
    settings: Settings | None = None,
    prompt: PasswordPrompt = getpass.getpass,
    stdin: TextIO | None = None,
) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m app.cli.owner", description=__doc__.split("\n\n")[0]
    )
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("create", "import-legacy-hash"):
        command = commands.add_parser(name)
        command.add_argument("email")
        command.add_argument("--name", default="Owner")
    for name in ("set-password", "revoke-sessions"):
        commands.add_parser(name).add_argument("email")
    args = parser.parse_args(argv)

    email = normalise_email(args.email)
    if "@" not in email:
        print("Give the owner's email address.")
        return 2
    settings = settings or get_settings()
    database = Database(settings)
    if not database.configured:
        print("Set DATABASE_URL first.")
        return 1

    try:
        with database.session() as db, db.begin():
            existing = db.scalar(select(OwnerUser))
            if args.command in ("create", "import-legacy-hash"):
                if existing is not None:
                    print("An owner account already exists. Use set-password to reset it.")
                    return 1
                if args.command == "create":
                    password = _read_new_password(prompt)
                    if password is None:
                        return 1
                    password_hash = hash_password(password)
                else:
                    password_hash = (stdin or sys.stdin).readline().strip()
                    if not _valid_legacy_hash(password_hash):
                        print("Expected one V2 hash of the form scrypt$N$r$p$salt$digest on stdin.")
                        return 1
                db.add(
                    OwnerUser(
                        email=email,
                        display_name=args.name.strip()[:DISPLAY_NAME_MAX] or "Owner",
                        password_hash=password_hash,
                    )
                )
                print("Owner account created.")
                return 0

            if existing is None or existing.email != email:
                print("No owner account with that email.")
                return 1
            if args.command == "set-password":
                password = _read_new_password(prompt)
                if password is None:
                    return 1
                existing.password_hash = hash_password(password)
                existing.password_changed_at = utcnow()
                ended = _end_sessions(db, existing.id)
                print(f"Password set; {ended} session(s) ended.")
                return 0
            ended = _end_sessions(db, existing.id)
            print(f"{ended} session(s) ended.")
            return 0
    finally:
        database.dispose()


def main() -> None:
    raise SystemExit(run(sys.argv[1:]))


if __name__ == "__main__":
    main()
