"""Contact messages submitted through the public site, their email deliveries, and the
rate-limit ledger.

A message is stored first, in its own transaction; email is sent afterwards from the
``email_deliveries`` outbox. Delivery can fail, be retried or be skipped (no provider), and none of
that affects the stored message. A delivery is "sent" only when the provider accepted it.
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    Integer,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

# Shared with the request schema and the migration so all three agree.
NAME_MAX = 100
EMAIL_MAX = 254
SUBJECT_MAX = 150
MESSAGE_MAX = 5000


class MessageStatus(StrEnum):
    NEW = "new"
    READ = "read"
    ARCHIVED = "archived"
    SPAM = "spam"  # kept for the owner to review; never notified


class DeliveryKind(StrEnum):
    NOTIFICATION = "notification"  # to the owner, about a new message
    REPLY = "reply"  # to the visitor, written in the Studio


class DeliveryStatus(StrEnum):
    PENDING = "pending"  # waiting for its first or next attempt
    SENDING = "sending"  # claimed by a worker
    SENT = "sent"  # accepted by the provider
    FAILED = "failed"  # permanent error, or attempts exhausted
    SKIPPED = "skipped"  # no email provider configured: nothing was sent


class ContactMessage(Base):
    __tablename__ = "contact_messages"
    __table_args__ = (
        CheckConstraint("status in ('new', 'read', 'archived', 'spam')", name="status_allowed"),
        CheckConstraint(f"char_length(message) <= {MESSAGE_MAX}", name="message_length"),
        Index("ix_contact_messages_status_created_at", "status", "created_at"),
        Index("ix_contact_messages_fingerprint_created_at", "fingerprint", "created_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    name: Mapped[str] = mapped_column(String(NAME_MAX), nullable=False)
    email: Mapped[str] = mapped_column(String(EMAIL_MAX), nullable=False)
    subject: Mapped[str] = mapped_column(String(SUBJECT_MAX), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=MessageStatus.NEW.value
    )
    # SHA-256 of the normalised email, subject and text: identical resubmissions are accepted once.
    fingerprint: Mapped[str | None] = mapped_column(String(64))
    # Why a message was filed as spam, for the owner's review ("links", ...).
    spam_reason: Mapped[str | None] = mapped_column(String(100))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class EmailDelivery(Base):
    """One email to send: a new-message notification (at most one per message) or a reply."""

    __tablename__ = "email_deliveries"
    __table_args__ = (
        CheckConstraint("kind in ('notification', 'reply')", name="kind_allowed"),
        CheckConstraint(
            "status in ('pending', 'sending', 'sent', 'failed', 'skipped')", name="status_allowed"
        ),
        Index(
            "uq_email_deliveries_notification",
            "message_id",
            unique=True,
            postgresql_where=text("kind = 'notification'"),
        ),
        Index("ix_email_deliveries_status_next_attempt_at", "status", "next_attempt_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    message_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("contact_messages.id", ondelete="CASCADE"), nullable=False
    )
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="pending")
    recipient: Mapped[str] = mapped_column(String(EMAIL_MAX), nullable=False)
    subject: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    next_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # A short, credential-free description of the last failure (provider status, error type).
    last_error: Mapped[str | None] = mapped_column(String(300))
    provider_message_id: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class RateLimitEvent(Base):
    """One row per counted action. Rows older than the window are deleted as new ones arrive.

    ``client_key`` is a SHA-256 digest of the bucket and client address, so raw IP addresses
    are never stored.
    """

    __tablename__ = "rate_limit_events"
    __table_args__ = (
        Index(
            "ix_rate_limit_events_bucket_client_key_created_at",
            "bucket",
            "client_key",
            "created_at",
        ),
        Index("ix_rate_limit_events_bucket_created_at", "bucket", "created_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    bucket: Mapped[str] = mapped_column(String(50), nullable=False)
    client_key: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
