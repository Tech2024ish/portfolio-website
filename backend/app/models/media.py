"""Images in the media library.

Each row is one image. Its files live in object storage under
``{folder}/{uid}/r{revision}/``: ``original.{ext}`` (re-encoded, metadata stripped) and
``w{width}.webp`` variants for responsive delivery. Replacing the image writes a new revision,
so every URL is immutable and can be cached forever; content that used the old URL is pointed
at the new one in the same transaction. ``url`` is the public URL of the original, which is
what content fields store.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    Identity,
    Index,
    Integer,
    String,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

MEDIA_FOLDERS = ("profile", "projects", "notes", "general")


class MediaAsset(Base):
    __tablename__ = "media_assets"
    __table_args__ = (
        CheckConstraint(
            "folder in ('profile', 'projects', 'notes', 'general')", name="folder_known"
        ),
        CheckConstraint(
            "content_type in ('image/jpeg', 'image/png', 'image/webp')", name="content_type_image"
        ),
        CheckConstraint("width > 0 and height > 0 and byte_size > 0", name="dimensions_positive"),
        Index(
            "uq_media_assets_url_live",
            "url",
            unique=True,
            postgresql_where=text("deleted_at is null"),
        ),
        Index("ix_media_assets_folder", "folder"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    uid: Mapped[str] = mapped_column(String(32), nullable=False, unique=True)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    folder: Mapped[str] = mapped_column(String(20), nullable=False, server_default="general")
    filename: Mapped[str] = mapped_column(String(160), nullable=False)
    content_type: Mapped[str] = mapped_column(String(20), nullable=False)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    key_prefix: Mapped[str] = mapped_column(String(200), nullable=False)
    extension: Mapped[str] = mapped_column(String(5), nullable=False)
    byte_size: Mapped[int] = mapped_column(Integer, nullable=False)
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    # [{"width": 480, "url": "...", "key": "...", "byte_size": 12345}, ...], narrowest first.
    variants: Mapped[list[Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'[]'::jsonb"), default=list
    )
    alt_text: Mapped[str] = mapped_column(String(300), nullable=False, server_default="")
    version: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    def keys(self) -> list[str]:
        """Every stored object of this revision."""
        return [f"{self.key_prefix}/original.{self.extension}"] + [
            str(variant["key"]) for variant in self.variants
        ]
