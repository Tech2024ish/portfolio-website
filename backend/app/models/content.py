"""Portfolio content managed in the Owner Studio, and the audit trail of owner actions.

Conventions shared by the content tables:
- ``position`` orders items within their list; ``version`` increases on every change and is
  checked on update, so a stale editor cannot overwrite a newer save (409 instead).
- Deletion is soft (``deleted_at``): rows stay for the audit trail but are invisible everywhere.
- Publishable tables have ``status`` (draft | published) and ``published_at``. Public reads go
  through ``app.repositories.content``, which only returns published, undeleted rows.
- Slugs and names are unique among undeleted rows only (partial unique indexes), so a deleted
  item's slug can be reused.
"""

from __future__ import annotations

from datetime import date, datetime
from enum import StrEnum
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Identity,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

SLUG_PATTERN = "^[a-z0-9]+(-[a-z0-9]+)*$"
_EMPTY_LIST = text("'[]'::jsonb")
_EMPTY_OBJECT = text("'{}'::jsonb")
_LIVE = text("deleted_at is null")


class ContentStatus(StrEnum):
    DRAFT = "draft"
    PUBLISHED = "published"


_STATUS_CHECK = "status in ('draft', 'published')"


def _json_list() -> Mapped[list[Any]]:
    return mapped_column(JSONB, nullable=False, server_default=_EMPTY_LIST, default=list)


def _translations() -> Mapped[dict[str, Any]]:
    """French and Kinyarwanda text for this record: ``{"fr": {field: value}, "rw": {...}}``.

    Only the translatable fields appear (see ``app.schemas.content``); a field without a
    translation is shown in English.
    """
    return mapped_column(JSONB, nullable=False, server_default=_EMPTY_OBJECT, default=dict)


class _Tracked:
    """Columns every managed content row has."""

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    position: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    version: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class _Publishable(_Tracked):
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="draft")
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Profile(Base):
    """The single profile row (id = 1): who the site is about."""

    __tablename__ = "profile"
    __table_args__ = (CheckConstraint("id = 1", name="single_row"),)

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True, autoincrement=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    initials: Mapped[str] = mapped_column(String(4), nullable=False)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    location: Mapped[str] = mapped_column(String(120), nullable=False)
    availability: Mapped[str] = mapped_column(String(120), nullable=False)
    headline: Mapped[str] = mapped_column(String(200), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    about_lead: Mapped[str] = mapped_column(Text, nullable=False)
    about_body: Mapped[list[str]] = _json_list()
    email: Mapped[str] = mapped_column(String(254), nullable=False)
    cv_href: Mapped[str] = mapped_column(String(300), nullable=False)
    portrait_src: Mapped[str] = mapped_column(String(300), nullable=False)
    portrait_alt: Mapped[str] = mapped_column(String(200), nullable=False)
    contact_intro: Mapped[str] = mapped_column(Text, nullable=False)
    social: Mapped[list[dict[str, str]]] = _json_list()
    principles: Mapped[list[dict[str, str]]] = _json_list()
    translations: Mapped[dict[str, Any]] = _translations()
    version: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class SkillCategory(_Tracked, Base):
    __tablename__ = "skill_categories"
    __table_args__ = (
        Index("uq_skill_categories_name_live", "name", unique=True, postgresql_where=_LIVE),
    )

    name: Mapped[str] = mapped_column(String(80), nullable=False)
    translations: Mapped[dict[str, Any]] = _translations()


class Skill(_Tracked, Base):
    """A skill in a category. Hidden skills (``visible`` false) are never shown publicly."""

    __tablename__ = "skills"
    __table_args__ = (
        Index(
            "uq_skills_category_id_name_live",
            "category_id",
            "name",
            unique=True,
            postgresql_where=_LIVE,
        ),
    )

    category_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("skill_categories.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    visible: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")


class Experience(_Publishable, Base):
    __tablename__ = "experiences"
    __table_args__ = (
        CheckConstraint(_STATUS_CHECK, name="status_allowed"),
        CheckConstraint("not (is_current and end_month is not null)", name="current_has_no_end"),
        CheckConstraint("end_month is null or end_month >= start_month", name="end_after_start"),
    )

    organization: Mapped[str] = mapped_column(String(150), nullable=False)
    role: Mapped[str] = mapped_column(String(150), nullable=False)
    location: Mapped[str | None] = mapped_column(String(120))
    start_month: Mapped[date] = mapped_column(Date, nullable=False)
    end_month: Mapped[date | None] = mapped_column(Date)
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    highlights: Mapped[list[str]] = _json_list()
    translations: Mapped[dict[str, Any]] = _translations()


class Education(_Publishable, Base):
    __tablename__ = "education"
    __table_args__ = (
        CheckConstraint(_STATUS_CHECK, name="status_allowed"),
        CheckConstraint(
            "end_month is null or start_month is null or end_month >= start_month",
            name="end_after_start",
        ),
    )

    institution: Mapped[str] = mapped_column(String(150), nullable=False)
    qualification: Mapped[str] = mapped_column(String(150), nullable=False)
    location: Mapped[str | None] = mapped_column(String(120))
    status_label: Mapped[str | None] = mapped_column(String(80))
    start_month: Mapped[date | None] = mapped_column(Date)
    end_month: Mapped[date | None] = mapped_column(Date)
    coursework: Mapped[list[str]] = _json_list()
    translations: Mapped[dict[str, Any]] = _translations()


class Certification(_Publishable, Base):
    __tablename__ = "certifications"
    __table_args__ = (CheckConstraint(_STATUS_CHECK, name="status_allowed"),)

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    issuer: Mapped[str] = mapped_column(String(150), nullable=False)
    issued_month: Mapped[date | None] = mapped_column(Date)
    credential_url: Mapped[str | None] = mapped_column(String(400))
    translations: Mapped[dict[str, Any]] = _translations()


class Project(_Publishable, Base):
    """A project. Its case study has its own status: a published project can keep a draft one."""

    __tablename__ = "projects"
    __table_args__ = (
        CheckConstraint(_STATUS_CHECK, name="status_allowed"),
        CheckConstraint(
            "case_study_status in ('draft', 'published')", name="case_study_status_allowed"
        ),
        CheckConstraint(f"slug ~ '{SLUG_PATTERN}'", name="slug_format"),
        Index("uq_projects_slug_live", "slug", unique=True, postgresql_where=_LIVE),
    )

    slug: Mapped[str] = mapped_column(String(120), nullable=False)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    tech: Mapped[list[str]] = _json_list()
    featured: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    repo_url: Mapped[str | None] = mapped_column(String(400))
    live_url: Mapped[str | None] = mapped_column(String(400))
    case_study_status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="draft"
    )
    overview: Mapped[list[str]] = _json_list()
    problem: Mapped[str | None] = mapped_column(Text)
    objectives: Mapped[list[str]] = _json_list()
    approach: Mapped[str | None] = mapped_column(Text)
    architecture: Mapped[list[str]] = _json_list()
    decisions: Mapped[list[dict[str, str]]] = _json_list()
    challenges: Mapped[list[dict[str, str]]] = _json_list()
    outcomes: Mapped[list[str]] = _json_list()
    scope_implemented: Mapped[list[str]] = _json_list()
    scope_not_yet: Mapped[list[str]] = _json_list()
    media: Mapped[list[dict[str, Any]]] = _json_list()
    sources: Mapped[list[str]] = _json_list()
    translations: Mapped[dict[str, Any]] = _translations()


class Article(_Publishable, Base):
    """An Engineering Note. ``body`` is plain text with a small, text-only markup (see the API)."""

    __tablename__ = "articles"
    __table_args__ = (
        CheckConstraint(_STATUS_CHECK, name="status_allowed"),
        CheckConstraint(f"slug ~ '{SLUG_PATTERN}'", name="slug_format"),
        Index("uq_articles_slug_live", "slug", unique=True, postgresql_where=_LIVE),
    )

    slug: Mapped[str] = mapped_column(String(120), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False)
    published_on: Mapped[date | None] = mapped_column(Date)
    body: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    translations: Mapped[dict[str, Any]] = _translations()


class AuditEvent(Base):
    """One important owner action. Records what changed, never the content itself."""

    __tablename__ = "audit_events"
    __table_args__ = (Index("ix_audit_events_created_at", "created_at"),)

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    owner_id: Mapped[int | None] = mapped_column(
        BigInteger, ForeignKey("owner_users.id", ondelete="SET NULL")
    )
    session_id: Mapped[int | None] = mapped_column(BigInteger)
    action: Mapped[str] = mapped_column(String(40), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(40), nullable=False)
    entity_id: Mapped[int | None] = mapped_column(BigInteger)
    summary: Mapped[str] = mapped_column(String(300), nullable=False)
    changed_fields: Mapped[list[str]] = _json_list()
