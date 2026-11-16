"""The email outbox: queueing notifications and replies, sending them, and recording the result.

Messages are stored before any email is attempted, and a delivery is a separate row, so a
provider outage can never lose a message. Each delivery is claimed with ``FOR UPDATE SKIP
LOCKED`` and marked ``sending`` in its own short transaction before the provider is called, so two
workers never send the same email; the result is recorded in another transaction. A delivery
stuck in ``sending`` (the process died mid-send) is picked up again after ``STUCK_AFTER``.

Statuses mean exactly what happened: ``sent`` only when the provider accepted the email,
``skipped`` when no provider is configured (nothing was sent), ``failed`` after a permanent error
or the last attempt, ``pending`` while waiting for a retry.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import AppError
from app.database.session import Database
from app.integrations.email import Email, PermanentMailError, TransientMailError, mailer_for
from app.models.contact import (
    ContactMessage,
    DeliveryKind,
    DeliveryStatus,
    EmailDelivery,
    MessageStatus,
)
from app.services import audit
from app.services.auth import OwnerContext

logger = logging.getLogger("app.mail")

# Waits before attempts 2, 3, 4, 5, ...: a short outage is retried soon, a long one less often.
RETRY_DELAYS = (
    timedelta(minutes=1),
    timedelta(minutes=5),
    timedelta(minutes=30),
    timedelta(hours=2),
    timedelta(hours=6),
)
STUCK_AFTER = timedelta(minutes=10)
NOT_CONFIGURED = "Email is not configured on the server; nothing was sent."


def utcnow() -> datetime:
    return datetime.now(UTC)


def _studio_link(settings: Settings, message_id: int) -> str:
    return f"{settings.public_site_url.rstrip('/')}/owner/messages/{message_id}"


def queue_notification(
    session: Session, message: ContactMessage, settings: Settings
) -> EmailDelivery | None:
    """The owner's notification for a new message. None for spam (never notified)."""
    if message.status == MessageStatus.SPAM.value:
        return None
    configured = settings.email_configured and bool(settings.contact_notify_email)
    delivery = EmailDelivery(
        message_id=message.id,
        kind=DeliveryKind.NOTIFICATION.value,
        status=DeliveryStatus.PENDING.value if configured else DeliveryStatus.SKIPPED.value,
        recipient=settings.contact_notify_email or "",
        subject=f"New message: {message.subject}"[:200],
        body=(
            f"{message.name} <{message.email}> sent a message through the portfolio.\n\n"
            f"Subject: {message.subject}\n\n{message.message}\n\n"
            f"Open it in the Owner Studio: {_studio_link(settings, message.id)}\n"
            "Replying to this email answers the sender directly.\n"
        ),
        last_error=None if configured else NOT_CONFIGURED,
    )
    session.add(delivery)
    session.flush()
    return delivery


def queue_reply(
    session: Session, owner: OwnerContext, message: ContactMessage, body: str, settings: Settings
) -> EmailDelivery:
    if not settings.email_configured:
        raise AppError(
            503,
            "email_unavailable",
            "Email is not configured on the server, so replies cannot be sent.",
        )
    delivery = EmailDelivery(
        message_id=message.id,
        kind=DeliveryKind.REPLY.value,
        status=DeliveryStatus.PENDING.value,
        recipient=message.email,
        subject=(
            message.subject
            if message.subject.lower().startswith("re:")
            else f"Re: {message.subject}"
        )[:200],
        body=body,
    )
    session.add(delivery)
    session.flush()
    audit.record(
        session,
        owner,
        action="reply",
        entity_type="message",
        entity_id=message.id,
        summary=f"Replied to message #{message.id}",
    )
    return delivery


def retry(
    session: Session, owner: OwnerContext, delivery_id: int, settings: Settings
) -> EmailDelivery:
    delivery = session.get(EmailDelivery, delivery_id)
    if delivery is None:
        raise AppError(404, "not_found", "Delivery not found.")
    if delivery.status not in (DeliveryStatus.FAILED.value, DeliveryStatus.SKIPPED.value):
        raise AppError(409, "conflict", "Only failed or skipped emails can be sent again.")
    if not settings.email_configured or (
        delivery.kind == DeliveryKind.NOTIFICATION.value and not settings.contact_notify_email
    ):
        raise AppError(503, "email_unavailable", "Email is not configured on the server.")
    if not delivery.recipient:
        delivery.recipient = settings.contact_notify_email or ""
    delivery.status = DeliveryStatus.PENDING.value
    delivery.attempts = 0
    delivery.next_attempt_at = None
    delivery.last_error = None
    delivery.updated_at = utcnow()
    audit.record(
        session,
        owner,
        action="retry",
        entity_type="message",
        entity_id=delivery.message_id,
        summary=f"Sent the {delivery.kind} for message #{delivery.message_id} again",
    )
    return delivery


def _claim(database: Database) -> tuple[int, Email] | None:
    now = utcnow()
    with database.session() as session, session.begin():
        delivery = session.scalar(
            select(EmailDelivery)
            .where(
                or_(
                    and_(
                        EmailDelivery.status == DeliveryStatus.PENDING.value,
                        or_(
                            EmailDelivery.next_attempt_at.is_(None),
                            EmailDelivery.next_attempt_at <= now,
                        ),
                    ),
                    and_(
                        EmailDelivery.status == DeliveryStatus.SENDING.value,
                        EmailDelivery.updated_at < now - STUCK_AFTER,
                    ),
                )
            )
            .order_by(EmailDelivery.id)
            .limit(1)
            .with_for_update(skip_locked=True)
        )
        if delivery is None:
            return None
        delivery.status = DeliveryStatus.SENDING.value
        delivery.attempts += 1
        delivery.updated_at = now
        reply_to: str | None = None
        if delivery.kind == DeliveryKind.NOTIFICATION.value:
            reply_to = session.scalar(
                select(ContactMessage.email).where(ContactMessage.id == delivery.message_id)
            )
        return delivery.id, Email(
            to=delivery.recipient, subject=delivery.subject, text=delivery.body, reply_to=reply_to
        )


def _record(
    database: Database,
    delivery_id: int,
    settings: Settings,
    outcome: str | None,
    error: Exception | None,
) -> None:
    now = utcnow()
    with database.session() as session, session.begin():
        delivery = session.get(EmailDelivery, delivery_id, with_for_update=True)
        if delivery is None:  # the message was deleted meanwhile
            return
        delivery.updated_at = now
        if error is None:
            delivery.status = DeliveryStatus.SENT.value
            delivery.sent_at = now
            delivery.provider_message_id = (outcome or None) and outcome[:200]
            delivery.last_error = None
            delivery.next_attempt_at = None
        elif (
            isinstance(error, TransientMailError) and delivery.attempts < settings.mail_max_attempts
        ):
            delay = RETRY_DELAYS[min(delivery.attempts - 1, len(RETRY_DELAYS) - 1)]
            delivery.status = DeliveryStatus.PENDING.value
            delivery.next_attempt_at = now + delay
            delivery.last_error = str(error)[:300]
        elif error.args and error.args[0] == NOT_CONFIGURED:
            delivery.status = DeliveryStatus.SKIPPED.value
            delivery.last_error = NOT_CONFIGURED
        else:
            delivery.status = DeliveryStatus.FAILED.value
            delivery.next_attempt_at = None
            delivery.last_error = str(error)[:300]


def process_due(database: Database, settings: Settings, limit: int = 20) -> int:
    """Send up to ``limit`` due deliveries. Returns how many were attempted."""
    mailer = mailer_for(settings)
    attempted = 0
    while attempted < limit:
        claimed = _claim(database)
        if claimed is None:
            break
        attempted += 1
        delivery_id, email = claimed
        if mailer is None:
            _record(database, delivery_id, settings, None, PermanentMailError(NOT_CONFIGURED))
            continue
        try:
            provider_id = mailer.send(email)
        except (TransientMailError, PermanentMailError) as error:
            logger.warning("email delivery %s failed: %s", delivery_id, error)
            _record(database, delivery_id, settings, None, error)
        except Exception as error:  # an unexpected bug must not leave the row in "sending"
            logger.exception("email delivery %s crashed", delivery_id)
            _record(database, delivery_id, settings, None, TransientMailError(type(error).__name__))
        else:
            _record(database, delivery_id, settings, provider_id, None)
    return attempted
