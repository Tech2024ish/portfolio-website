"""Create or reset the single owner account.

    python -m scripts.create_owner owner@example.com

The password is read interactively (never from argv or source code).
Resetting the password signs out every existing session.
"""

import getpass
import sys

from sqlalchemy import select

from core.config import get_settings
from core.db import configure_engine
from core.security import hash_password, password_problems
from models.entities import OwnerSession, OwnerUser, utcnow
from sqlalchemy.orm import Session


def main() -> int:
    if len(sys.argv) != 2 or "@" not in sys.argv[1]:
        print(__doc__)
        return 2
    email = sys.argv[1].strip().lower()
    url = get_settings().database_url
    if not url:
        print("Set DATABASE_URL first.")
        return 1
    password = getpass.getpass("New owner password: ")
    problems = password_problems(password)
    if problems:
        print("Password rejected: " + " ".join(problems))
        return 1
    if getpass.getpass("Repeat password: ") != password:
        print("Passwords do not match.")
        return 1

    engine = configure_engine(url)
    with Session(engine) as db, db.begin():
        user = db.scalar(select(OwnerUser))
        if user and user.email != email:
            print(f"An owner already exists ({user.email}). Updating its email to {email}.")
        if user is None:
            db.add(OwnerUser(email=email, display_name="Jean Claude", password_hash=hash_password(password)))
            print("Owner account created.")
        else:
            user.email = email
            user.password_hash = hash_password(password)
            user.password_changed_at = utcnow()
            for session in db.scalars(select(OwnerSession).where(OwnerSession.revoked_at.is_(None))):
                session.revoked_at = utcnow()
            print("Owner password reset; all sessions signed out.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
