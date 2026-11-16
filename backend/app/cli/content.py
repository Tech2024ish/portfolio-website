"""Load the verified portfolio content into an empty database.

    python -m app.cli.content import [--file PATH]

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
            **schemas.SkillCategoryFields(name=group["name"]).model_dump(),
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


def run(argv: Sequence[str], *, settings: Settings | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli.content")
    commands = parser.add_subparsers(dest="command", required=True)
    command = commands.add_parser("import", help="load verified content into an empty database")
    command.add_argument("--file", type=Path, default=DEFAULT_FILE)
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
            counts = import_content(db, data)
    except ImportFileError as error:
        print(str(error))
        return 1
    finally:
        database.dispose()
    print("Imported: " + ", ".join(f"{count} {kind}" for kind, count in counts.items()))
    return 0


def main() -> None:
    raise SystemExit(run(sys.argv[1:]))


if __name__ == "__main__":
    main()
