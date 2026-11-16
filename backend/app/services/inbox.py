"""The owner's inbox: listing, searching and managing contact messages.

Deleting a message removes it and its email records for good (it holds a visitor's personal
data); the audit trail keeps only that message #N was deleted, never its contents.
"""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.models.contact import ContactMessage, EmailDelivery, MessageStatus
from app.services import audit
from app.services.auth import OwnerContext

# "inbox" is new and read messages; the others are single statuses.
FILTERS = ("inbox", "new", "read", "archived", "spam", "all")


def _escape_like(text: str) -> str:
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _filtered(view: str, q: str | None) -> Select[ContactMessage]:
    query = select(ContactMessage)
    if view == "inbox":
        query = query.where(
            ContactMessage.status.in_((MessageStatus.NEW.value, MessageStatus.READ.value))
        )
    elif view != "all":
        query = query.where(ContactMessage.status == view)
    if q:
        pattern = f"%{_escape_like(q)}%"
        query = query.where(
            or_(
                ContactMessage.name.ilike(pattern, escape="\\"),
                ContactMessage.email.ilike(pattern, escape="\\"),
                ContactMessage.subject.ilike(pattern, escape="\\"),
                ContactMessage.message.ilike(pattern, escape="\\"),
            )
        )
    return query


def list_messages(
    session: Session, *, view: str, q: str | None, page: int, page_size: int
) -> tuple[list[ContactMessage], int, dict[int, str]]:
    """A page of messages (newest first), the total, and each message's notification status."""
    if view not in FILTERS:
        raise AppError(
            422,
            "validation_error",
            "Unknown filter.",
            fields=[{"field": "status", "message": f"One of: {', '.join(FILTERS)}."}],
        )
    query = _filtered(view, q)
    total = session.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = list(
        session.scalars(
            query.order_by(ContactMessage.created_at.desc(), ContactMessage.id.desc())
            .limit(page_size)
            .offset((page - 1) * page_size)
        )
    )
    pairs = session.execute(
        select(EmailDelivery.message_id, EmailDelivery.status).where(
            EmailDelivery.kind == "notification",
            EmailDelivery.message_id.in_([row.id for row in rows]),
        )
    )
    notified = {int(message_id): str(status) for message_id, status in pairs}
    return rows, int(total), notified


def get_message(session: Session, message_id: int) -> ContactMessage:
    message = session.get(ContactMessage, message_id)
    if message is None:
        raise AppError(404, "not_found", "Message not found.")
    return message


def deliveries(session: Session, message_id: int) -> list[EmailDelivery]:
    return list(
        session.scalars(
            select(EmailDelivery)
            .where(EmailDelivery.message_id == message_id)
            .order_by(EmailDelivery.id)
        )
    )


def set_status(
    session: Session, owner: OwnerContext, message_id: int, status: str
) -> ContactMessage:
    message = get_message(session, message_id)
    if message.status == status:
        return message
    now = datetime.now(UTC)
    previous = message.status
    message.status = status
    message.updated_at = now
    if status == MessageStatus.READ.value and message.read_at is None:
        message.read_at = now
    if status != MessageStatus.SPAM.value:
        message.spam_reason = None
    audit.record(
        session,
        owner,
        action="status",
        entity_type="message",
        entity_id=message.id,
        summary=f"Moved message #{message.id} from {previous} to {status}",
    )
    return message


def delete_message(session: Session, owner: OwnerContext, message_id: int) -> None:
    message = get_message(session, message_id)
    session.delete(message)  # its deliveries go with it (ON DELETE CASCADE)
    audit.record(
        session,
        owner,
        action="delete",
        entity_type="message",
        entity_id=message_id,
        summary=f"Deleted message #{message_id}",
    )
