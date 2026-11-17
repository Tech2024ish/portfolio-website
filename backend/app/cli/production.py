"""Production database checks and the legacy data migration. Uses DATABASE_URL.

    python -m app.cli.production check                       read-only preflight; exit 1 on problems
    python -m app.cli.production legacy-report               read-only summary of the V1/V2 data
    python -m app.cli.production import-legacy-contacts      dry run: what would be imported
    python -m app.cli.production import-legacy-contacts --apply

``check`` and ``legacy-report`` run in a READ ONLY transaction: they cannot change anything.

``import-legacy-contacts`` copies the rows of ``legacy.contacts`` (moved there by migration
``v3_0000``) into the V3 inbox, keeping each message's original date. It never sends email, never
changes or deletes the legacy rows, and is safe to repeat: each imported message carries a
fingerprint derived from its legacy id, and rows already imported are skipped. Rows that do not
pass V3's validation are reported and left out. Without ``--apply`` nothing is written.

Nothing here prints secrets: connection details are reduced to the host and database name.
"""

from __future__ import annotations

import argparse
import hashlib
import sys
from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Any

from alembic.config import Config
from alembic.script import ScriptDirectory
from pydantic import ValidationError
from sqlalchemy import text
from sqlalchemy.engine import Connection, make_url
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.database.revision import EXPECTED_REVISION
from app.database.session import Database
from app.models.contact import ContactMessage, MessageStatus
from app.schemas.contact import ContactSubmission

CLIENT_ROLES = ("anon", "authenticated")
LEGACY_SUBJECT = "Message from the previous website"
LEGACY_TABLES = ("contacts", "projects", "visits", "customer", "skills", "visit_stats")


@dataclass
class Report:
    lines: list[str] = field(default_factory=list)
    failures: int = 0
    warnings: int = 0

    def ok(self, text_: str) -> None:
        self.lines.append(f"  PASS  {text_}")

    def warn(self, text_: str) -> None:
        self.warnings += 1
        self.lines.append(f"  WARN  {text_}")

    def fail(self, text_: str) -> None:
        self.failures += 1
        self.lines.append(f"  FAIL  {text_}")

    def info(self, text_: str) -> None:
        self.lines.append(f"        {text_}")

    def section(self, title: str) -> None:
        self.lines.append(f"\n{title}")


def _rows(conn: Connection, sql: str, **params: Any) -> list[Any]:
    return list(conn.execute(text(sql), params))


def _scalar(conn: Connection, sql: str, **params: Any) -> Any:
    return conn.execute(text(sql), params).scalar()


def _target(settings: Settings) -> str:
    if settings.database_url is None:
        return "not configured"
    url = make_url(settings.database_url.get_secret_value())
    return f"{url.host or 'local socket'} / {url.database}"


def _pending(current: str | None) -> list[str]:
    config = Config()
    config.set_main_option("script_location", str(_migrations_dir()))
    script = ScriptDirectory.from_config(config)
    upgrade = list(script.iterate_revisions("heads", current or "base"))
    return [rev.revision for rev in reversed(upgrade) if rev.revision != current]


def _migrations_dir() -> str:
    from pathlib import Path

    return str(Path(__file__).resolve().parents[2] / "migrations")


def check(conn: Connection, settings: Settings) -> Report:
    report = Report()
    report.section("Target")
    report.info(f"database: {_target(settings)}")
    report.info(f"server: PostgreSQL {_scalar(conn, 'show server_version')}")
    report.info(f"connected as: {_scalar(conn, 'select current_user')}")

    report.section("Migrations")
    has_version = _scalar(conn, "select to_regclass('public.alembic_version') is not null")
    current = _scalar(conn, "select version_num from alembic_version") if has_version else None
    pending = _pending(current)
    if current == EXPECTED_REVISION:
        report.ok(f"at the expected revision {EXPECTED_REVISION}")
    else:
        report.warn(
            f"at {current or 'no revision (empty)'}; this code expects {EXPECTED_REVISION}; "
            f"pending: {', '.join(pending) or 'none'} (/ready answers 503 until applied)"
        )

    report.section("Legacy (V1/V2) tables")
    in_public = [
        name
        for (name,) in _rows(
            conn,
            "select table_name from information_schema.tables "
            "where table_schema = 'public' and table_name = any(:names)",
            names=list(LEGACY_TABLES),
        )
    ]
    legacy_public = [
        name
        for name in in_public
        if name not in ("projects", "skills")
        or _scalar(
            conn,
            "select bool_or(column_name in ('tech_stack', 'level')) "
            "and not bool_or(column_name in ('slug', 'category_id')) "
            "from information_schema.columns where table_schema = 'public' and table_name = :t",
            t=name,
        )
    ]
    if legacy_public:
        report.warn(
            f"still in public: {', '.join(sorted(legacy_public))} "
            "(migration v3_0000 moves them to the legacy schema, keeping every row)"
        )
    in_legacy = [
        name
        for (name,) in _rows(
            conn, "select table_name from information_schema.tables where table_schema = 'legacy'"
        )
    ]
    if in_legacy:
        report.ok(f"in the legacy schema: {', '.join(sorted(in_legacy))}")
    if not legacy_public and not in_legacy:
        report.info("none found")

    report.section("Row-level security (public schema)")
    without_rls = [
        name
        for (name,) in _rows(
            conn,
            "select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace "
            "where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity order by 1",
        )
    ]
    if without_rls:
        report.fail(f"RLS is off on: {', '.join(without_rls)}")
    else:
        report.ok("enabled on every table")

    report.section("Supabase client roles (anon, authenticated)")
    roles = [
        r
        for (r,) in _rows(
            conn, "select rolname from pg_roles where rolname = any(:r)", r=list(CLIENT_ROLES)
        )
    ]
    if not roles:
        report.info("not present (not a Supabase database)")
    for role in roles:
        exposed = [
            f"{schema}.{name}"
            for schema, name in _rows(
                conn,
                "select n.nspname, c.relname from pg_class c "
                "join pg_namespace n on n.oid = c.relnamespace "
                "where n.nspname in ('public', 'legacy') and c.relkind in ('r', 'S') "
                "and (has_table_privilege(:role, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') "
                "     or (c.relkind = 'S' "
                "         and has_sequence_privilege(:role, c.oid, 'USAGE,SELECT,UPDATE'))) "
                "order by 1, 2",
                role=role,
            )
        ]
        if exposed:
            report.fail(f"{role} can still reach: {', '.join(exposed)}")
        else:
            report.ok(f"{role} has no privilege on any table or sequence")

    report.section("Sequences (identity columns are ahead of their data)")
    behind = []
    for table, sequence in _rows(
        conn,
        "select c.relname, pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), 'id') "
        "from pg_class c join pg_namespace n on n.oid = c.relnamespace "
        "join information_schema.columns col on col.table_schema = n.nspname "
        "and col.table_name = c.relname and col.column_name = 'id' "
        "where n.nspname = 'public' and c.relkind = 'r'",
    ):
        if not sequence:
            continue
        top = _scalar(conn, f"select coalesce(max(id), 0) from public.{table}")  # noqa: S608 - catalog name
        last = _scalar(
            conn,
            "select case when is_called then last_value else last_value - 1 end "  # noqa: S608
            f"from {sequence}",  # sequence name from the catalogue, not input
        )
        if last < top:
            behind.append(f"{table} (max id {top}, sequence at {last})")
    if behind:
        report.fail(f"behind their data: {', '.join(behind)}")
    else:
        report.ok("every id sequence is at or past its table's largest id")
    return report


def legacy_report(conn: Connection) -> Report:
    report = Report()
    present = {
        name
        for (name,) in _rows(
            conn, "select table_name from information_schema.tables where table_schema = 'legacy'"
        )
    }
    if not present:
        report.info("No legacy schema yet: apply the migrations first (v3_0000 creates it).")
        return report
    if "contacts" in present:
        count, first, last, emails = _rows(
            conn,
            "select count(*), min(created_at), max(created_at), count(distinct lower(email)) "
            "from legacy.contacts",
        )[0]
        report.section("legacy.contacts: messages from the earlier site")
        report.info(f"{count} messages from {emails} addresses, {first} to {last}")
        report.info("Import with: python -m app.cli.production import-legacy-contacts")
    if "projects" in present:
        report.section("legacy.projects: not imported (V3 has the verified project content)")
        for title, github, live in _rows(
            conn, "select title, github_url, live_url from legacy.projects order by id"
        ):
            report.info(f"- {title} (repository: {github or 'none'}, site: {live or 'none'})")
    if "visits" in present:
        report.section("legacy.visits: visit history of the earlier site (kept as is)")
        total = _scalar(conn, "select count(*) from legacy.visits")
        report.info(f"{total} visits recorded (time only: no page, no visitor)")
        for month, visits in _rows(
            conn,
            "select to_char(date_trunc('month', created_at), 'YYYY-MM'), count(*) "
            "from legacy.visits group by 1 order by 1",
        ):
            report.info(f"  {month}: {visits}")
    for name in sorted(present - {"contacts", "projects", "visits"}):
        rows = _scalar(conn, f"select count(*) from legacy.{name}")  # noqa: S608 - catalog name
        report.section(f"legacy.{name}")
        report.info(f"{rows} rows (no V3 equivalent; kept as is)")
    return report


def _fingerprint(legacy_id: int) -> str:
    return hashlib.sha256(f"legacy-contact:{legacy_id}".encode()).hexdigest()


@dataclass
class ImportResult:
    to_import: list[ContactMessage]
    already: int
    invalid: list[str]


def plan_contact_import(session: Session) -> ImportResult:
    if not session.execute(text("select to_regclass('legacy.contacts') is not null")).scalar():
        return ImportResult([], 0, [])
    existing = set(
        session.execute(
            text("select fingerprint from contact_messages where fingerprint is not null")
        ).scalars()
    )
    plan: list[ContactMessage] = []
    already = 0
    invalid: list[str] = []
    for legacy_id, name, email, message, created_at in session.execute(
        text("select id, name, email, message, created_at from legacy.contacts order by id")
    ):
        fingerprint = _fingerprint(legacy_id)
        if fingerprint in existing:
            already += 1
            continue
        try:
            valid = ContactSubmission(
                name=name or "", email=email or "", subject=LEGACY_SUBJECT, message=message or ""
            )
        except ValidationError as error:
            fields = sorted({str(item["loc"][0]) for item in error.errors()})
            invalid.append(f"legacy id {legacy_id}: invalid {', '.join(fields)}")
            continue
        plan.append(
            ContactMessage(
                name=valid.name,
                email=str(valid.email),
                subject=valid.subject,
                message=valid.message,
                status=MessageStatus.NEW.value,
                fingerprint=fingerprint,
                created_at=created_at,
                updated_at=created_at,
            )
        )
    return ImportResult(plan, already, invalid)


def run(argv: Sequence[str], *, settings: Settings | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli.production")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("check", help="read-only production preflight")
    commands.add_parser("legacy-report", help="read-only summary of the V1/V2 data")
    importer = commands.add_parser(
        "import-legacy-contacts", help="copy legacy messages into the inbox"
    )
    importer.add_argument("--apply", action="store_true", help="write; without it, a dry run")
    args = parser.parse_args(argv)

    settings = settings or get_settings()
    database = Database(settings)
    if not database.configured:
        print("Set DATABASE_URL first.")
        return 1
    try:
        if args.command in ("check", "legacy-report"):
            with database.engine.connect() as conn:
                conn.execute(text("set transaction read only"))
                report = check(conn, settings) if args.command == "check" else legacy_report(conn)
                conn.rollback()
            print("\n".join(report.lines).lstrip("\n"))
            if args.command == "check":
                print(f"\n{report.failures} problem(s), {report.warnings} warning(s).")
            return 1 if report.failures else 0

        with database.session() as session, session.begin():
            result = plan_contact_import(session)
            for line in result.invalid:
                print(f"skipped: {line}")
            print(
                f"{len(result.to_import)} message(s) to import, {result.already} already imported, "
                f"{len(result.invalid)} skipped as invalid."
            )
            if not args.apply:
                print("Dry run: nothing was written. Add --apply to import.")
                session.rollback()
                return 0
            session.add_all(result.to_import)
            session.flush()
        print(f"Imported {len(result.to_import)} message(s). No email was sent.")
        return 0
    finally:
        database.dispose()


def main() -> None:
    raise SystemExit(run(sys.argv[1:]))


if __name__ == "__main__":
    main()
