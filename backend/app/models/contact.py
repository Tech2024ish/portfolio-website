"""Contact messages submitted through the public site, and the rate-limit ledger."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from sqlalchemy import BigInteger, CheckConstraint, DateTime, Identity, Index, String, Text, func
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


class ContactMessage(Base):
    __tablename__ = "contact_messages"
    __table_args__ = (
        CheckConstraint("status in ('new', 'read', 'archived')", name="status_allowed"),
        CheckConstraint(f"char_length(message) <= {MESSAGE_MAX}", name="message_length"),
        Index("ix_contact_messages_status_created_at", "status", "created_at"),
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
