"""Accepting a public contact message.

Order matters:
1. Rate limit first, so spam and honeypot hits are counted too.
2. Honeypot hits get the same success response as real messages but are not stored,
   so bots learn nothing.
3. The message is inserted and flushed; the request transaction commits it before the
   response is sent, so success always means the row is durable.
"""

from __future__ import annotations

import logging
from datetime import timedelta

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import AppError
from app.models.contact import ContactMessage, MessageStatus
from app.repositories import rate_limit
from app.schemas.contact import ContactSubmission

logger = logging.getLogger("app.contact")

RATE_LIMIT_BUCKET = "contact"


def submit_contact_message(
    session: Session, submission: ContactSubmission, client_address: str, settings: Settings
) -> ContactMessage | None:
    """Store the message. Returns None for a silently discarded honeypot submission."""
    key = rate_limit.client_key(RATE_LIMIT_BUCKET, client_address)
    window = timedelta(minutes=settings.contact_rate_window_minutes)
    if not rate_limit.acquire(session, RATE_LIMIT_BUCKET, key, settings.contact_rate_limit, window):
        raise AppError(
            429,
            "rate_limited",
            "Too many messages from this connection. Please try again later.",
            headers={"Retry-After": str(int(window.total_seconds()))},
        )

    if submission.website:
        logger.info("contact honeypot triggered; message discarded")
        return None

    message = ContactMessage(
        name=submission.name,
        email=str(submission.email),
        subject=submission.subject,
        message=submission.message,
        status=MessageStatus.NEW.value,
    )
    session.add(message)
    session.flush()  # surfaces constraint or connection errors before we report success
    return message
