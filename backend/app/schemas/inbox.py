"""Owner inbox contracts."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.text import MultiLine

MessageStatusValue = Literal["new", "read", "archived", "spam"]
DeliveryStatusValue = Literal["pending", "sending", "sent", "failed", "skipped"]


class MessageSummary(BaseModel):
    id: int
    created_at: datetime
    name: str
    email: str
    subject: str
    snippet: str
    status: MessageStatusValue
    # The owner notification's delivery status; None for spam (never notified) or old messages.
    notification: DeliveryStatusValue | None


class MessagePage(BaseModel):
    items: list[MessageSummary]
    total: int
    page: int
    page_size: int


class DeliveryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    kind: Literal["notification", "reply"]
    status: DeliveryStatusValue
    recipient: str
    subject: str
    body: str
    attempts: int
    next_attempt_at: datetime | None
    last_error: str | None
    created_at: datetime
    sent_at: datetime | None


class MessageDetail(BaseModel):
    id: int
    created_at: datetime
    name: str
    email: str
    subject: str
    message: str
    status: MessageStatusValue
    spam_reason: str | None
    read_at: datetime | None
    deliveries: list[DeliveryOut]
    # Whether replies can be sent (a provider is configured); never a claim that anything was sent.
    email_configured: bool


class StatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: MessageStatusValue


class ReplyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    body: MultiLine = Field(min_length=2, max_length=10_000)
