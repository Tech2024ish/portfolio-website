"""Media library contracts."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.text import SingleLine

Folder = Literal["profile", "projects", "notes", "general"]


class MediaVariant(BaseModel):
    width: int
    height: int
    url: str


class MediaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    folder: Folder
    filename: str
    content_type: str
    url: str
    byte_size: int
    width: int
    height: int
    variants: list[MediaVariant]
    alt_text: str
    version: int
    created_at: datetime
    updated_at: datetime


class MediaDetail(MediaOut):
    used_by: list[str]


class MediaUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    alt_text: SingleLine = Field(default="", max_length=300)
    folder: Folder
    version: int = Field(ge=1)


class PublicImage(BaseModel):
    """Responsive versions of a library image, for `srcset`."""

    width: int
    height: int
    variants: list[MediaVariant]
