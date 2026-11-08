from __future__ import annotations

from sqlalchemy.orm import Session

from models.entities import ActivityLog


def record(
    db: Session,
    owner,
    action: str,
    entity_type: str,
    summary: str,
    entity_id: int | None = None,
) -> None:
    """Append an audit entry inside the caller's transaction."""
    db.add(
        ActivityLog(
            actor=owner.user.email,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            summary=summary[:300],
            ip_address=owner.ip,
        )
    )
