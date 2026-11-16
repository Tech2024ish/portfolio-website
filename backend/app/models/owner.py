"""The owner account and its sign-in sessions."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, Identity, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

EMAIL_MAX = 254
DISPLAY_NAME_MAX = 120
PASSWORD_HASH_MAX = 255
IP_ADDRESS_MAX = 64
USER_AGENT_MAX = 300


class OwnerUser(Base):
    """The single owner of the site. Created and reset only through the owner CLI."""

    __tablename__ = "owner_users"
    __table_args__ = (
        # Stored lowercase so sign-in is case-insensitive and the unique index is exact.
        CheckConstraint("email = lower(email)", name="email_lowercase"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    email: Mapped[str] = mapped_column(String(EMAIL_MAX), nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(
        String(DISPLAY_NAME_MAX), nullable=False, server_default="Owner"
    )
    password_hash: Mapped[str] = mapped_column(String(PASSWORD_HASH_MAX), nullable=False)
    password_changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class OwnerSession(Base):
    """One signed-in browser. Only the SHA-256 digest of its token is stored.

    A session ends when it expires (``expires_at``), when it is idle for longer than the
    configured idle timeout (``last_seen_at``), or when it is revoked (``revoked_at``).
    """

    __tablename__ = "owner_sessions"

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("owner_users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ip_address: Mapped[str | None] = mapped_column(String(IP_ADDRESS_MAX))
    user_agent: Mapped[str | None] = mapped_column(String(USER_AGENT_MAX))
