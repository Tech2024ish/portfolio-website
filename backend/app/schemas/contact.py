"""Public contact-form contract.

Normalisation happens here, once: surrounding whitespace is trimmed, runs of whitespace in
single-line fields collapse to one space, line endings become ``\\n``, and control
characters are rejected (PostgreSQL text cannot hold NUL, and none belong in a message).
"""

from __future__ import annotations

import re
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field

from app.models.contact import EMAIL_MAX, MESSAGE_MAX, NAME_MAX, SUBJECT_MAX

_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_WHITESPACE_RUN = re.compile(r"\s+")


def _no_control_characters(value: str) -> str:
    if _CONTROL.search(value):
        raise ValueError("Contains characters that are not allowed.")
    return value


def _single_line(value: str) -> str:
    return _WHITESPACE_RUN.sub(" ", _no_control_characters(value)).strip()


def _multi_line(value: str) -> str:
    return _no_control_characters(value.replace("\r\n", "\n").replace("\r", "\n")).strip()


SingleLine = Annotated[str, AfterValidator(_single_line)]
MultiLine = Annotated[str, AfterValidator(_multi_line)]


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
