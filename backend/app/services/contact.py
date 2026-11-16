"""Accepting a public contact message.

Order matters:
1. Rate limit first, so spam, duplicates and honeypot hits are counted too.
2. Honeypot hits get the same success response as real messages but are not stored,
   so bots learn nothing.
3. An identical message (same email, subject and text) sent again within
   ``CONTACT_DUPLICATE_WINDOW_MINUTES`` gets the same success response and is not stored or
   notified twice: double clicks and retried requests are harmless.
4. Messages with many links are stored with status ``spam`` (the owner can review them) and are
   never notified.
5. The message, and its notification in the email outbox, are inserted and flushed; the request
   transaction commits them before the response is sent, so success always means the message is
   durable. Email is sent afterwards and its outcome never affects the stored message.
"""

from __future__ import annotations

import hashlib
import logging
import re
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import AppError
from app.models.contact import ContactMessage, EmailDelivery, MessageStatus
from app.repositories import rate_limit
from app.schemas.contact import ContactSubmission
from app.services import mail

logger = logging.getLogger("app.contact")

RATE_LIMIT_BUCKET = "contact"
MAX_LINKS = 3
_LINK = re.compile(r"https?://|www\.", re.IGNORECASE)
_MARKUP_LINK = re.compile(r"<a\s+href|\[url[=\]]", re.IGNORECASE)


@dataclass
class Submission:
    message: ContactMessage | None  # None: honeypot (discarded)
    duplicate: bool = False
    delivery: EmailDelivery | None = None


def fingerprint(submission: ContactSubmission) -> str:
    text = "\n".join(
        [
            str(submission.email).casefold(),
            " ".join(submission.subject.split()).casefold(),
            " ".join(submission.message.split()).casefold(),
        ]
    )
    return hashlib.sha256(text.encode()).hexdigest()


def spam_reason(submission: ContactSubmission) -> str | None:
    text = f"{submission.subject}\n{submission.message}"
    if _MARKUP_LINK.search(text):
        return "link markup"
    if len(_LINK.findall(text)) > MAX_LINKS:
        return "many links"
    return None


def submit_contact_message(
    session: Session, submission: ContactSubmission, client_address: str, settings: Settings
) -> Submission:
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
        return Submission(None)

    digest = fingerprint(submission)
    since = datetime.now(UTC) - timedelta(minutes=settings.contact_duplicate_window_minutes)
    existing = session.scalar(
        select(ContactMessage)
        .where(ContactMessage.fingerprint == digest, ContactMessage.created_at >= since)
        .limit(1)
    )
    if existing is not None:
        logger.info("duplicate contact message ignored")
        return Submission(existing, duplicate=True)

    reason = spam_reason(submission)
    message = ContactMessage(
        name=submission.name,
        email=str(submission.email),
        subject=submission.subject,
        message=submission.message,
        status=MessageStatus.SPAM.value if reason else MessageStatus.NEW.value,
        spam_reason=reason,
        fingerprint=digest,
    )
    session.add(message)
    session.flush()  # surfaces constraint or connection errors before we report success
    return Submission(message, delivery=mail.queue_notification(session, message, settings))
