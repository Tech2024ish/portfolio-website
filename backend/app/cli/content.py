"""Load the verified portfolio content into an empty database, or add its translations.

    python -m app.cli.content import [--file PATH]
    python -m app.cli.content translations [--file PATH] [--apply]

``translations`` adds the French and Kinyarwanda text of the same file to content that already
exists (a database imported before translations existed). It matches records by their English
identity (project slug, institution, ...), only fills in translations that are still missing (so
nothing typed in the Studio is overwritten), and is a dry run unless ``--apply`` is given.

The file defaults to ``app/cli/verified-content.json``, exported from the frontend's verified
content (``frontend/scripts/export-content.mjs``). Every record keeps its publication state:
drafts stay drafts. Everything is validated with the same schemas the Studio uses before
anything is written, and the import runs only when no content exists yet, so it can never
overwrite changes made in the Studio. It is one transaction: all or nothing.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Sequence
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.database.session import Database
from app.models.content import (
    Article,
    Certification,
    ContentStatus,
    Education,
    Experience,
    Profile,
    Project,
    Skill,
    SkillCategory,
)
from app.schemas import content as schemas
from app.services import audit

DEFAULT_FILE = Path(__file__).with_name("verified-content.json")

_COLLECTIONS: tuple[tuple[str, type[Any], type[BaseModel]], ...] = (
    ("experiences", Experience, schemas.ExperienceFields),
    ("education", Education, schemas.EducationFields),
    ("certifications", Certification, schemas.CertificationFields),
    ("projects", Project, schemas.ProjectFields),
    ("articles", Article, schemas.ArticleFields),
)
_STATUSES = {ContentStatus.DRAFT.value, ContentStatus.PUBLISHED.value}


class ImportFileError(Exception):
    pass


def _validated(data: dict[str, Any]) -> list[tuple[type[Any], list[tuple[BaseModel, str]]]]:
    """Validate every publishable record first, so a bad file imports nothing."""
    result = []
    for key, model, fields in _COLLECTIONS:
        rows = []
        for index, record in enumerate(data.get(key, [])):
            record = dict(record)
            status = record.pop("status", ContentStatus.DRAFT.value)
            if status not in _STATUSES:
                raise ImportFileError(f"{key}[{index}]: unknown status {status!r}")
            try:
                rows.append((fields.model_validate(record), status))
            except ValidationError as error:
                raise ImportFileError(f"{key}[{index}]: {error.errors()[0]['msg']}") from error
        result.append((model, rows))
    return result


def _has_content(db: Session) -> bool:
    if db.get(Profile, 1) is not None:
        return True
    for model in (SkillCategory, Experience, Education, Certification, Project, Article):
        if db.scalar(select(model.id).limit(1)) is not None:
            return True
    return False


def import_content(db: Session, data: dict[str, Any]) -> dict[str, int]:
    """Insert everything into an empty database. Returns the number of rows per kind."""
    try:
        profile = schemas.ProfileFields.model_validate(data["profile"])
    except (KeyError, ValidationError) as error:
        raise ImportFileError(f"profile: {error}") from error
    collections = _validated(data)
    if _has_content(db):
        raise ImportFileError("Content already exists; nothing was imported.")

    now = datetime.now(UTC)
    db.add(Profile(id=1, **profile.model_dump(), version=1, updated_at=now))
    counts = {"profile": 1, "skill_categories": 0, "skills": 0}

    for category_position, group in enumerate(data.get("skill_groups", []), start=1):
        category = SkillCategory(
            **schemas.SkillCategoryFields(
                name=group["name"], translations=group.get("translations", {})
            ).model_dump(),
            position=category_position,
            created_at=now,
            updated_at=now,
        )
        db.add(category)
        db.flush()
        counts["skill_categories"] += 1
        for skill_position, name in enumerate(group["skills"], start=1):
            skill = schemas.SkillFields(category_id=category.id, name=name)
            db.add(
                Skill(**skill.model_dump(), position=skill_position, created_at=now, updated_at=now)
            )
            counts["skills"] += 1

    for model, rows in collections:
        for position, (fields, status) in enumerate(rows, start=1):
            published = status == ContentStatus.PUBLISHED.value
            db.add(
                model(
                    **fields.model_dump(),
                    status=status,
                    published_at=now if published else None,
                    position=position,
                    created_at=now,
                    updated_at=now,
                )
            )
        counts[model.__tablename__] = len(rows)

    db.flush()
    audit.record(
        db,
        None,
        action="import",
        entity_type="content",
        entity_id=None,
        summary="Imported the verified portfolio content",
    )
    return counts


# How a record in the file finds its row: the fields that identify it in English.
_IDENTITY: dict[str, tuple[type[Any], type[BaseModel], tuple[str, ...]]] = {
    "skill_groups": (SkillCategory, schemas.SkillCategoryFields, ("name",)),
    "experiences": (Experience, schemas.ExperienceFields, ("organization", "role")),
    "education": (Education, schemas.EducationFields, ("institution",)),
    "certifications": (Certification, schemas.CertificationFields, ("name",)),
    "projects": (Project, schemas.ProjectFields, ("slug",)),
    "articles": (Article, schemas.ArticleFields, ("slug",)),
}


def _validated_translations(fields: type[BaseModel], row: Any, translations: Any) -> dict[str, Any]:
    """The file's translations for one row, checked with the Studio's rules for that record."""
    english = {
        name: getattr(row, name)
        for name in fields.model_fields
        if name != "translations" and hasattr(row, name)
    }
    if fields is schemas.SkillCategoryFields:
        english = {"name": row.name}
    validated = fields.model_validate({**english, "translations": translations or {}})
    return dict(validated.translations)  # type: ignore[attr-defined]


def _merge(current: dict[str, Any], incoming: dict[str, Any]) -> tuple[dict[str, Any], int]:
    """Adds the missing incoming values. Returns the result and how many were added."""
    merged = {lang: dict(values) for lang, values in (current or {}).items()}
    added = 0
    for lang, values in incoming.items():
        for name, value in values.items():
            if name not in merged.setdefault(lang, {}):
                merged[lang][name] = value
                added += 1
    return {lang: values for lang, values in merged.items() if values}, added


def add_translations(db: Session, data: dict[str, Any], *, apply: bool) -> list[str]:
    """Fills in the missing translations of existing content. Returns a report, one line per row."""
    report: list[str] = []
    now = datetime.now(UTC)
    changed = 0

    def update(row: Any, label: str, incoming: dict[str, Any], fields: type[BaseModel]) -> None:
        nonlocal changed
        merged, added = _merge(row.translations, _validated_translations(fields, row, incoming))
        if added == 0:
            report.append(f"  {label}: nothing to add")
            return
        report.append(f"  {label}: {added} translated field(s) to add")
        if apply:
            row.translations = merged
            row.version += 1
            row.updated_at = now
            changed += 1

    profile = db.get(Profile, 1)
    if profile is None:
        raise ImportFileError("No content yet: run `import` instead.")
    update(profile, "profile", data["profile"].get("translations", {}), schemas.ProfileFields)

    for key, (model, fields, identity) in _IDENTITY.items():
        for record in data.get(key, []):
            if not record.get("translations"):
                continue
            label = f"{key} " + " / ".join(str(record[name]) for name in identity)
            query = select(model).where(model.deleted_at.is_(None))
            for name in identity:
                query = query.where(getattr(model, name) == record[name])
            row = db.scalars(query).first()
            if row is None:
                report.append(f"  {label}: not found (renamed or deleted in the Studio), skipped")
                continue
            update(row, label, record["translations"], fields)

    if apply and changed:
        db.flush()
        audit.record(
            db,
            None,
            action="import",
            entity_type="content",
            entity_id=None,
            summary=f"Added translations to {changed} content record(s)",
        )
    return report


def run(argv: Sequence[str], *, settings: Settings | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli.content")
    commands = parser.add_subparsers(dest="command", required=True)
    command = commands.add_parser("import", help="load verified content into an empty database")
    command.add_argument("--file", type=Path, default=DEFAULT_FILE)
    command = commands.add_parser(
        "translations", help="add the file's missing translations to existing content"
    )
    command.add_argument("--file", type=Path, default=DEFAULT_FILE)
    command.add_argument("--apply", action="store_true", help="write (default: dry run)")
    args = parser.parse_args(argv)

    try:
        data = json.loads(args.file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        print(f"Cannot read {args.file}: {error}")
        return 1
    settings = settings or get_settings()
    database = Database(settings)
    if not database.configured:
        print("Set DATABASE_URL first.")
        return 1
    try:
        with database.session() as db, db.begin():
            if args.command == "translations":
                report = add_translations(db, data, apply=args.apply)
                if not args.apply:
                    db.rollback()
            else:
                counts = import_content(db, data)
    except (ImportFileError, ValidationError) as error:
        print(str(error))
        return 1
    finally:
        database.dispose()
    if args.command == "translations":
        print("Translations " + ("added:" if args.apply else "to add (dry run, nothing written):"))
        print("\n".join(report))
        if not args.apply:
            print("Run again with --apply to write them.")
        return 0
    print("Imported: " + ", ".join(f"{count} {kind}" for kind, count in counts.items()))
    return 0


def main() -> None:
    raise SystemExit(run(sys.argv[1:]))


if __name__ == "__main__":
    main()
