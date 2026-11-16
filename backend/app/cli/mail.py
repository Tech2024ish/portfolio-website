"""Send due emails from the outbox (notifications and replies, including retries).

    python -m app.cli.mail process [--limit N]

The API already sends each email right after it is queued; this command sends what is still due
(retries after a provider outage, or anything left by a restart). Run it on a schedule, for
example every few minutes with a Render cron job. Safe to run concurrently.
"""

from __future__ import annotations

import argparse
import sys
from collections.abc import Sequence

from app.core.config import Settings, get_settings
from app.database.session import Database
from app.services import mail


def run(argv: Sequence[str], *, settings: Settings | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli.mail")
    commands = parser.add_subparsers(dest="command", required=True)
    process = commands.add_parser("process", help="send due emails")
    process.add_argument("--limit", type=int, default=100)
    args = parser.parse_args(argv)

    settings = settings or get_settings()
    database = Database(settings)
    if not database.configured:
        print("Set DATABASE_URL first.")
        return 1
    try:
        attempted = mail.process_due(database, settings, limit=args.limit)
    finally:
        database.dispose()
    print(f"Attempted {attempted} email(s).")
    return 0


def main() -> None:
    raise SystemExit(run(sys.argv[1:]))


if __name__ == "__main__":
    main()
