"""Public contact-form contract. Text is normalised by ``app.schemas.text`` (trimmed, single-line
whitespace collapsed, line endings unified, control characters rejected)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.contact import EMAIL_MAX, MESSAGE_MAX, NAME_MAX, SUBJECT_MAX
from app.schemas.text import MultiLine, SingleLine


class ContactSubmission(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: SingleLine = Field(min_length=2, max_length=NAME_MAX)
    email: EmailStr = Field(max_length=EMAIL_MAX)
    subject: SingleLine = Field(min_length=3, max_length=SUBJECT_MAX)
    message: MultiLine = Field(min_length=10, max_length=MESSAGE_MAX)
    # Honeypot: hidden from people, filled in by naive bots. Any value marks the request as spam.
    website: str = Field(default="", max_length=200)


class ContactReceipt(BaseModel):
    status: Literal["received"] = "received"
