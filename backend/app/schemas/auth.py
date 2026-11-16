"""Owner sign-in, session and password contracts.

Passwords are never trimmed or otherwise changed: they are compared exactly as typed.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.core.security import MAX_PASSWORD_LENGTH
from app.models.owner import EMAIL_MAX


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr = Field(max_length=EMAIL_MAX)
    password: str = Field(min_length=1, max_length=MAX_PASSWORD_LENGTH)


class PasswordChangeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_password: str = Field(min_length=1, max_length=MAX_PASSWORD_LENGTH)
    new_password: str = Field(min_length=1, max_length=MAX_PASSWORD_LENGTH)


class OwnerProfile(BaseModel):
    email: str
    display_name: str


class SessionInfo(BaseModel):
    """The signed-in owner. ``csrf_token`` must accompany every state-changing request."""

    user: OwnerProfile
    csrf_token: str
    expires_at: datetime


class SessionSummary(BaseModel):
    id: int
    created_at: datetime
    last_seen_at: datetime
    expires_at: datetime
    ip_address: str | None
    user_agent: str | None
    current: bool


class RevokedSessions(BaseModel):
    revoked: int


class MessageCounts(BaseModel):
    new: int
    read: int
    archived: int


class OwnerOverview(BaseModel):
    messages: MessageCounts
