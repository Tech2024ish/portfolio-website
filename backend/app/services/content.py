"""Owner management of portfolio content: one implementation for every collection.

Each collection is described by a ``CollectionSpec``; the operations below are the same for all
of them, so the safety rules hold everywhere:

- Updates name the ``version`` they were based on. A different current version is a conflict
  (409): the owner reloads instead of silently overwriting a newer save.
- Unique slugs and names are checked among undeleted rows before writing, so the owner gets a
  field error instead of a database error.
- Deletion is soft and audited. Publishing sets ``published_at``; unpublishing returns an item to
  draft. Every change is recorded in the audit trail with the names of the changed fields.

Services never commit; the endpoint commits once the whole change has succeeded.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from typing import Any

from pydantic import BaseModel
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.contact import ContactMessage
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
from app.services.auth import OwnerContext

Item = Any  # a row of one of the collection models


def utcnow() -> datetime:
    return datetime.now(UTC)


def _conflict() -> AppError:
    return AppError(
        409,
        "conflict",
        "This item was changed after you opened it. Reload it to see the latest version.",
    )


def _not_found(label: str) -> AppError:
    return AppError(404, "not_found", f"{label} not found.")


@dataclass(frozen=True)
class CollectionSpec:
    key: str  # URL segment, e.g. "projects"
    entity: str  # audit entity type, e.g. "project"
    label: str  # "Project"
    model: type[Any]
    fields: type[BaseModel]
    update: type[BaseModel]
    out: type[BaseModel]
    publishable: bool
    title: Callable[[Item], str]
    unique: tuple[str, ...] = ()  # fields unique among undeleted rows
    validate: Callable[[Session, dict[str, Any]], None] | None = None
    on_delete: Callable[[Session, Item, datetime], None] | None = None
    on_publish: Callable[[Item], None] | None = None
    order_by: tuple[str, ...] = field(default=("position", "id"))


def _category_exists(session: Session, data: dict[str, Any]) -> None:
    category = session.get(SkillCategory, data["category_id"])
    if category is None or category.deleted_at is not None:
        raise AppError(
            422,
            "validation_error",
            "Some fields need attention.",
            fields=[{"field": "category_id", "message": "Choose an existing category."}],
        )


def _delete_category_skills(session: Session, category: Item, now: datetime) -> None:
    session.execute(
        update(Skill)
        .where(Skill.category_id == category.id, Skill.deleted_at.is_(None))
        .values(deleted_at=now)
    )


def _date_article(article: Item) -> None:
    if article.published_on is None:
        article.published_on = date.today()


COLLECTIONS: dict[str, CollectionSpec] = {
    spec.key: spec
    for spec in (
        CollectionSpec(
            key="skill-categories",
            entity="skill_category",
            label="Skill category",
            model=SkillCategory,
            fields=schemas.SkillCategoryFields,
            update=schemas.SkillCategoryUpdate,
            out=schemas.SkillCategoryOut,
            publishable=False,
            title=lambda item: item.name,
            unique=("name",),
            on_delete=_delete_category_skills,
        ),
        CollectionSpec(
            key="skills",
            entity="skill",
            label="Skill",
            model=Skill,
            fields=schemas.SkillFields,
            update=schemas.SkillUpdate,
            out=schemas.SkillOut,
            publishable=False,
            title=lambda item: item.name,
            validate=_category_exists,
            order_by=("category_id", "position", "id"),
        ),
        CollectionSpec(
            key="experiences",
            entity="experience",
            label="Experience",
            model=Experience,
            fields=schemas.ExperienceFields,
            update=schemas.ExperienceUpdate,
            out=schemas.ExperienceOut,
            publishable=True,
            title=lambda item: f"{item.role} at {item.organization}",
        ),
        CollectionSpec(
            key="education",
            entity="education",
            label="Education",
            model=Education,
            fields=schemas.EducationFields,
            update=schemas.EducationUpdate,
            out=schemas.EducationOut,
            publishable=True,
            title=lambda item: f"{item.qualification}, {item.institution}",
        ),
        CollectionSpec(
            key="certifications",
            entity="certification",
            label="Certification",
            model=Certification,
            fields=schemas.CertificationFields,
            update=schemas.CertificationUpdate,
            out=schemas.CertificationOut,
            publishable=True,
            title=lambda item: f"{item.name} ({item.issuer})",
        ),
        CollectionSpec(
            key="projects",
            entity="project",
            label="Project",
            model=Project,
            fields=schemas.ProjectFields,
            update=schemas.ProjectUpdate,
            out=schemas.ProjectOut,
            publishable=True,
            title=lambda item: item.title,
            unique=("slug",),
        ),
        CollectionSpec(
            key="articles",
            entity="article",
            label="Article",
            model=Article,
            fields=schemas.ArticleFields,
            update=schemas.ArticleUpdate,
            out=schemas.ArticleOut,
            publishable=True,
            title=lambda item: item.title,
            unique=("slug",),
            on_publish=_date_article,
        ),
    )
}


# ------------------------------------------------------------------ queries


def list_items(session: Session, spec: CollectionSpec) -> list[Item]:
    model = spec.model
    order = [getattr(model, column) for column in spec.order_by]
    return list(session.scalars(select(model).where(model.deleted_at.is_(None)).order_by(*order)))


def get_item(session: Session, spec: CollectionSpec, item_id: int) -> Item:
    item = session.get(spec.model, item_id)
    if item is None or item.deleted_at is not None:
        raise _not_found(spec.label)
    return item


def _check_unique(
    session: Session, spec: CollectionSpec, data: dict[str, Any], exclude_id: int | None
) -> None:
    model = spec.model
    for column in spec.unique:
        query = select(model.id).where(
            getattr(model, column) == data[column], model.deleted_at.is_(None)
        )
        if exclude_id is not None:
            query = query.where(model.id != exclude_id)
        if session.scalar(query) is not None:
            raise AppError(
                409,
                "conflict",
                f"Another {spec.label.lower()} already uses this {column}.",
                fields=[
                    {
                        "field": column,
                        "message": f"Another {spec.label.lower()} already uses this {column}.",
                    }
                ],
            )


# ------------------------------------------------------------------ changes


def create_item(
    session: Session, owner: OwnerContext, spec: CollectionSpec, body: BaseModel
) -> Item:
    data = body.model_dump()
    if spec.validate:
        spec.validate(session, data)
    _check_unique(session, spec, data, exclude_id=None)
    model = spec.model
    last = session.scalar(select(func.max(model.position)).where(model.deleted_at.is_(None)))
    now = utcnow()
    item = model(**data, position=(last or 0) + 1, created_at=now, updated_at=now, version=1)
    session.add(item)
    session.flush()
    audit.record(
        session,
        owner,
        action="create",
        entity_type=spec.entity,
        entity_id=item.id,
        summary=f"Created {spec.label.lower()} “{spec.title(item)}”",
    )
    return item


def update_item(
    session: Session, owner: OwnerContext, spec: CollectionSpec, item_id: int, body: BaseModel
) -> Item:
    item = get_item(session, spec, item_id)
    data = body.model_dump()
    if data.pop("version") != item.version:
        raise _conflict()
    if spec.validate:
        spec.validate(session, data)
    _check_unique(session, spec, data, exclude_id=item.id)
    changed = [name for name, value in data.items() if getattr(item, name) != value]
    if not changed:
        return item
    for name in changed:
        setattr(item, name, data[name])
    item.version += 1
    item.updated_at = utcnow()
    session.flush()
    audit.record(
        session,
        owner,
        action="update",
        entity_type=spec.entity,
        entity_id=item.id,
        summary=f"Edited {spec.label.lower()} “{spec.title(item)}”",
        changed_fields=changed,
    )
    return item


def delete_item(session: Session, owner: OwnerContext, spec: CollectionSpec, item_id: int) -> None:
    item = get_item(session, spec, item_id)
    now = utcnow()
    item.deleted_at = now
    item.version += 1
    if spec.on_delete:
        spec.on_delete(session, item, now)
    audit.record(
        session,
        owner,
        action="delete",
        entity_type=spec.entity,
        entity_id=item.id,
        summary=f"Deleted {spec.label.lower()} “{spec.title(item)}”",
    )


def set_published(
    session: Session, owner: OwnerContext, spec: CollectionSpec, item_id: int, published: bool
) -> Item:
    if not spec.publishable:
        raise _not_found(spec.label)
    item = get_item(session, spec, item_id)
    target = ContentStatus.PUBLISHED.value if published else ContentStatus.DRAFT.value
    if item.status == target:
        return item
    item.status = target
    if published:
        item.published_at = utcnow()
        if spec.on_publish:
            spec.on_publish(item)
    item.version += 1
    item.updated_at = utcnow()
    audit.record(
        session,
        owner,
        action="publish" if published else "unpublish",
        entity_type=spec.entity,
        entity_id=item.id,
        summary=(
            f"{'Published' if published else 'Unpublished'} "
            f"{spec.label.lower()} “{spec.title(item)}”"
        ),
    )
    return item


def reorder(session: Session, owner: OwnerContext, spec: CollectionSpec, ids: list[int]) -> None:
    """Set the order of every undeleted item. The list must contain each of them exactly once."""
    items = {item.id: item for item in list_items(session, spec)}
    if len(ids) != len(set(ids)) or set(ids) != set(items):
        raise AppError(
            422,
            "validation_error",
            "The new order must list every item exactly once. Reload and try again.",
        )
    now = utcnow()
    for position, item_id in enumerate(ids, start=1):
        if items[item_id].position != position:
            items[item_id].position = position
            items[item_id].updated_at = now
    audit.record(
        session,
        owner,
        action="reorder",
        entity_type=spec.entity,
        entity_id=None,
        summary=f"Reordered {spec.label.lower()} items",
    )


# ------------------------------------------------------------------ profile


def get_profile(session: Session) -> Profile:
    profile = session.get(Profile, 1)
    if profile is None:
        raise _not_found("Profile")
    return profile


def save_profile(session: Session, owner: OwnerContext, body: schemas.ProfileUpdate) -> Profile:
    data = body.model_dump()
    version = data.pop("version")
    profile = session.get(Profile, 1)
    now = utcnow()
    if profile is None:
        if version != 0:
            raise _conflict()
        profile = Profile(id=1, **data, version=1, updated_at=now)
        session.add(profile)
        session.flush()
        audit.record(
            session,
            owner,
            action="create",
            entity_type="profile",
            entity_id=1,
            summary="Created the profile",
        )
        return profile
    if version != profile.version:
        raise _conflict()
    changed = [name for name, value in data.items() if getattr(profile, name) != value]
    if not changed:
        return profile
    for name in changed:
        setattr(profile, name, data[name])
    profile.version += 1
    profile.updated_at = now
    session.flush()
    audit.record(
        session,
        owner,
        action="update",
        entity_type="profile",
        entity_id=1,
        summary="Edited the profile",
        changed_fields=changed,
    )
    return profile


# ------------------------------------------------------------------ dashboard


def status_counts(session: Session, spec: CollectionSpec) -> dict[str, int]:
    model = spec.model
    rows = session.execute(
        select(model.status, func.count()).where(model.deleted_at.is_(None)).group_by(model.status)
    ).all()
    counts = {"draft": 0, "published": 0}
    for status, count in rows:
        counts[str(status)] = int(count)
    return counts


def recent_messages(session: Session, limit: int = 5) -> list[ContactMessage]:
    return list(
        session.scalars(
            select(ContactMessage)
            .order_by(ContactMessage.created_at.desc(), ContactMessage.id.desc())
            .limit(limit)
        )
    )
