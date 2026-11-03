"""Helpers shared by v1 routers: lookups, patching, ordering and serialisation."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, TypeVar

from fastapi import HTTPException
from pydantic import BaseModel
from sqlalchemy import func, inspect, or_, select
from sqlalchemy.orm import Session

from models.entities import (
    Article,
    Certification,
    Education,
    Experience,
    MediaAsset,
    Project,
    ProjectImage,
    SiteProfile,
)

T = TypeVar("T")


def get_or_404(db: Session, model: type[T], item_id: int, label: str) -> T:
    item = db.get(model, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail=f"{label} not found.")
    return item


def ensure_media(db: Session, media_id: int | None, kind: str | None = None, field: str = "media") -> None:
    if media_id is None:
        return
    media = db.get(MediaAsset, media_id)
    if media is None:
        raise HTTPException(status_code=422, detail=f"{field}: the selected file does not exist.")
    if kind and media.kind != kind:
        raise HTTPException(status_code=422, detail=f"{field}: choose a{'n' if kind == 'image' else ''} {kind}.")


def apply_patch(item: Any, patch: BaseModel, skip: set[str] | None = None) -> dict[str, Any]:
    """Apply only the fields the client sent; refuse null for required columns."""
    data = patch.model_dump(exclude_unset=True)
    columns = {c.key: c for c in inspect(type(item)).mapper.column_attrs}
    changes = {}
    for key, value in data.items():
        if skip and key in skip:
            continue
        column = columns.get(key)
        if column is None:
            continue
        if value is None and not column.columns[0].nullable:
            raise HTTPException(status_code=422, detail=f"{key} cannot be empty.")
        setattr(item, key, value)
        changes[key] = value
    return changes


def next_position(db: Session, model, *filters) -> int:
    current = db.scalar(select(func.max(model.position)).where(*filters))
    return 0 if current is None else current + 1


def reorder(db: Session, model, ids: list[int], *filters) -> None:
    existing = set(db.scalars(select(model.id).where(*filters)))
    if set(ids) != existing:
        raise HTTPException(status_code=422, detail="Reorder must list every item exactly once.")
    for position, item_id in enumerate(ids):
        db.get(model, item_id).position = position


def media_usage(db: Session, media_id: int) -> list[str]:
    usages: list[str] = []
    profile = db.get(SiteProfile, 1)
    if profile:
        for field, label in (("photo_id", "Profile photo"), ("resume_id", "Active resume"), ("og_image_id", "Social image")):
            if getattr(profile, field) == media_id:
                usages.append(label)
    for title in db.scalars(select(Project.title).where(Project.thumbnail_id == media_id)):
        usages.append(f"Project thumbnail: {title}")
    for title in db.scalars(
        select(Project.title).join(ProjectImage, ProjectImage.project_id == Project.id).where(ProjectImage.media_id == media_id)
    ):
        usages.append(f"Project screenshot: {title}")
    for title in db.scalars(select(Article.title).where(Article.cover_id == media_id)):
        usages.append(f"Article cover: {title}")
    for org in db.scalars(select(Experience.organization).where(Experience.logo_id == media_id)):
        usages.append(f"Experience logo: {org}")
    for inst in db.scalars(select(Education.institution).where(Education.logo_id == media_id)):
        usages.append(f"Education logo: {inst}")
    for name in db.scalars(select(Certification.name).where(Certification.certificate_id == media_id)):
        usages.append(f"Certificate: {name}")
    return usages


def search_filter(columns, q: str | None):
    if not q:
        return None
    pattern = f"%{q.strip()[:100]}%"
    return or_(*[column.ilike(pattern) for column in columns])


# ------------------------------------------------------------------ serialisation


def _value(value: Any) -> Any:
    if isinstance(value, datetime):
        return (value if value.tzinfo else value.replace(tzinfo=timezone.utc)).isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return value


def media_out(media: MediaAsset | None) -> dict | None:
    if media is None:
        return None
    return {
        "id": media.id,
        "url": media.url,
        "filename": media.filename,
        "content_type": media.content_type,
        "kind": media.kind,
        "size_bytes": media.size_bytes,
        "width": media.width,
        "height": media.height,
        "alt_text": media.alt_text,
        "created_at": _value(media.created_at),
        "updated_at": _value(media.updated_at),
    }


def row_out(item: Any, media: tuple[str, ...] = (), exclude: tuple[str, ...] = ()) -> dict:
    out = {
        attr.key: _value(getattr(item, attr.key))
        for attr in inspect(type(item)).mapper.column_attrs
        if attr.key not in exclude
    }
    for rel in media:
        out[rel] = media_out(getattr(item, rel))
    return out


def project_out(project: Project) -> dict:
    out = row_out(project, media=("thumbnail",))
    out["images"] = [
        {"media_id": image.media_id, "caption": image.caption, "media": media_out(image.media)} for image in project.images
    ]
    return out
