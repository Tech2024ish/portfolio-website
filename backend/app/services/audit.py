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


def recent(session: Session, limit: int = 50) -> list[AuditEvent]:
    return list(
        session.scalars(
            select(AuditEvent)
            .order_by(AuditEvent.created_at.desc(), AuditEvent.id.desc())
            .limit(limit)
        )
    )
