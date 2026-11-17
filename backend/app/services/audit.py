"""The audit trail of important owner actions: what was done to which item, never its content."""

from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.content import AuditEvent
from app.services.auth import OwnerContext

SUMMARY_MAX = 300


def record(
    session: Session,
    owner: OwnerContext | None,
    *,
    action: str,
    entity_type: str,
    entity_id: int | None,
    summary: str,
    changed_fields: Iterable[str] = (),
) -> None:
    session.add(
        AuditEvent(
            owner_id=owner.user.id if owner else None,
            session_id=owner.session.id if owner else None,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            summary=summary[:SUMMARY_MAX],
            changed_fields=sorted(changed_fields),
        )
    )


# Activity filters: what kinds of events each one shows.
KINDS: dict[str, tuple[str, ...]] = {
    "content": (
        "content",
        "profile",
        "skill_category",
        "skill",
        "experience",
        "education",
        "certification",
        "project",
        "article",
    ),
    "media": ("media",),
    "messages": ("message",),
    "settings": ("settings",),
    "auth": ("auth",),
}


def recent(session: Session, limit: int = 50, kind: str | None = None) -> list[AuditEvent]:
    query = select(AuditEvent)
    if kind is not None:
        types = KINDS.get(kind, ())
        if kind == "content":
            # Anything that is not one of the other kinds is content.
            others = [t for name, values in KINDS.items() if name != "content" for t in values]
            query = query.where(AuditEvent.entity_type.not_in(others))
        else:
            query = query.where(AuditEvent.entity_type.in_(types))
    return list(
        session.scalars(
            query.order_by(AuditEvent.created_at.desc(), AuditEvent.id.desc()).limit(limit)
        )
    )
