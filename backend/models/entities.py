"""SQLAlchemy models for the v1 content and owner workspace.

Table names avoid the legacy Supabase tables (`projects`, `skills`, `contacts`),
which are left untouched for the legacy /api routes.
"""

from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.db import Base

JSONType = JSON().with_variant(JSONB(), "postgresql")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )


# --------------------------------------------------------------------------- owner


class OwnerUser(TimestampMixin, Base):
    __tablename__ = "owner_users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False, default="Owner")
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    password_changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)


class OwnerSession(Base):
    __tablename__ = "owner_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("owner_users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ip_address: Mapped[str | None] = mapped_column(String(64))
    user_agent: Mapped[str | None] = mapped_column(String(300))

    user: Mapped[OwnerUser] = relationship()


class ActivityLog(Base):
    __tablename__ = "activity_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)
    actor: Mapped[str] = mapped_column(String(320), nullable=False)
    action: Mapped[str] = mapped_column(String(60), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(60), nullable=False)
    entity_id: Mapped[int | None] = mapped_column(Integer)
    summary: Mapped[str] = mapped_column(String(300), nullable=False)
    ip_address: Mapped[str | None] = mapped_column(String(64))


# --------------------------------------------------------------------------- media


class MediaAsset(TimestampMixin, Base):
    __tablename__ = "media_assets"
    __table_args__ = (
        CheckConstraint("kind in ('image', 'document')", name="ck_media_kind"),
        CheckConstraint("size_bytes > 0", name="ck_media_size"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    storage_key: Mapped[str] = mapped_column(String(300), unique=True, nullable=False)
    url: Mapped[str] = mapped_column(String(600), nullable=False)
    filename: Mapped[str] = mapped_column(String(200), nullable=False)
    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    alt_text: Mapped[str] = mapped_column(String(300), nullable=False, default="")


# --------------------------------------------------------------------------- profile


class SiteProfile(TimestampMixin, Base):
    """Single-row table (id = 1) holding identity, hero, contact and SEO settings."""

    __tablename__ = "site_profile"
    __table_args__ = (CheckConstraint("id = 1", name="ck_site_profile_singleton"),)

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    professional_title: Mapped[str] = mapped_column(String(120), nullable=False)
    location: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    is_available: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    availability_text: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    hero_title: Mapped[str] = mapped_column(String(200), nullable=False)
    hero_title_accent: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    hero_summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    about_title: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    about_lead: Mapped[str] = mapped_column(Text, nullable=False, default="")
    about_body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    engineering_principles: Mapped[list] = mapped_column(JSONType, nullable=False, default=list)
    contact_intro: Mapped[str] = mapped_column(Text, nullable=False, default="")
    email: Mapped[str] = mapped_column(String(320), nullable=False, default="")
    phone: Mapped[str] = mapped_column(String(40), nullable=False, default="")
    whatsapp: Mapped[str] = mapped_column(String(40), nullable=False, default="")
    social_links: Mapped[list] = mapped_column(JSONType, nullable=False, default=list)
    photo_id: Mapped[int | None] = mapped_column(ForeignKey("media_assets.id", ondelete="SET NULL"))
    resume_id: Mapped[int | None] = mapped_column(ForeignKey("media_assets.id", ondelete="SET NULL"))
    seo_title: Mapped[str] = mapped_column(String(70), nullable=False, default="")
    seo_description: Mapped[str] = mapped_column(String(170), nullable=False, default="")
    og_image_id: Mapped[int | None] = mapped_column(ForeignKey("media_assets.id", ondelete="SET NULL"))
    default_theme: Mapped[str] = mapped_column(String(10), nullable=False, default="dark")
    translations: Mapped[dict] = mapped_column(JSONType, nullable=False, default=dict)

    photo: Mapped[MediaAsset | None] = relationship(foreign_keys=[photo_id])
    resume: Mapped[MediaAsset | None] = relationship(foreign_keys=[resume_id])
    og_image: Mapped[MediaAsset | None] = relationship(foreign_keys=[og_image_id])


# --------------------------------------------------------------------------- skills


class SkillCategory(TimestampMixin, Base):
    __tablename__ = "skill_categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(String(300), nullable=False, default="")
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    translations: Mapped[dict] = mapped_column(JSONType, nullable=False, default=dict)

    skills: Mapped[list[SkillItem]] = relationship(
        back_populates="category", cascade="all, delete-orphan", order_by="SkillItem.position"
    )


class SkillItem(TimestampMixin, Base):
    __tablename__ = "skill_items"
    __table_args__ = (UniqueConstraint("category_id", "name", name="uq_skill_per_category"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    category_id: Mapped[int] = mapped_column(
        ForeignKey("skill_categories.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    description: Mapped[str] = mapped_column(String(300), nullable=False, default="")
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    category: Mapped[SkillCategory] = relationship(back_populates="skills")


# --------------------------------------------------------------------------- projects


class Project(TimestampMixin, Base):
    __tablename__ = "portfolio_projects"
    __table_args__ = (CheckConstraint("status in ('draft', 'published')", name="ck_project_status"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    role: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    summary: Mapped[str] = mapped_column(String(400), nullable=False, default="")
    problem: Mapped[str] = mapped_column(Text, nullable=False, default="")
    approach: Mapped[str] = mapped_column(Text, nullable=False, default="")
    architecture: Mapped[str] = mapped_column(Text, nullable=False, default="")
    challenges: Mapped[str] = mapped_column(Text, nullable=False, default="")
    outcome: Mapped[str] = mapped_column(Text, nullable=False, default="")
    tech_stack: Mapped[list] = mapped_column(JSONType, nullable=False, default=list)
    github_url: Mapped[str | None] = mapped_column(String(400))
    live_url: Mapped[str | None] = mapped_column(String(400))
    thumbnail_id: Mapped[int | None] = mapped_column(ForeignKey("media_assets.id", ondelete="SET NULL"))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    is_featured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    translations: Mapped[dict] = mapped_column(JSONType, nullable=False, default=dict)

    thumbnail: Mapped[MediaAsset | None] = relationship()
    images: Mapped[list[ProjectImage]] = relationship(
        back_populates="project", cascade="all, delete-orphan", order_by="ProjectImage.position"
    )


class ProjectImage(Base):
    __tablename__ = "project_images"
    __table_args__ = (UniqueConstraint("project_id", "media_id", name="uq_project_image"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("portfolio_projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    media_id: Mapped[int] = mapped_column(ForeignKey("media_assets.id", ondelete="RESTRICT"), nullable=False)
    caption: Mapped[str] = mapped_column(String(300), nullable=False, default="")
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    project: Mapped[Project] = relationship(back_populates="images")
    media: Mapped[MediaAsset] = relationship()


# --------------------------------------------------------------------------- career


class Experience(TimestampMixin, Base):
    __tablename__ = "experiences"

    id: Mapped[int] = mapped_column(primary_key=True)
    organization: Mapped[str] = mapped_column(String(160), nullable=False)
    role: Mapped[str] = mapped_column(String(160), nullable=False)
    employment_type: Mapped[str] = mapped_column(String(60), nullable=False, default="")
    location: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    period_label: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    highlights: Mapped[list] = mapped_column(JSONType, nullable=False, default=list)
    skills: Mapped[list] = mapped_column(JSONType, nullable=False, default=list)
    logo_id: Mapped[int | None] = mapped_column(ForeignKey("media_assets.id", ondelete="SET NULL"))
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    translations: Mapped[dict] = mapped_column(JSONType, nullable=False, default=dict)

    logo: Mapped[MediaAsset | None] = relationship()


class Education(TimestampMixin, Base):
    __tablename__ = "education"

    id: Mapped[int] = mapped_column(primary_key=True)
    institution: Mapped[str] = mapped_column(String(160), nullable=False)
    degree: Mapped[str] = mapped_column(String(160), nullable=False)
    field_of_study: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    status: Mapped[str] = mapped_column(String(60), nullable=False, default="")
    period_label: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    logo_id: Mapped[int | None] = mapped_column(ForeignKey("media_assets.id", ondelete="SET NULL"))
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    translations: Mapped[dict] = mapped_column(JSONType, nullable=False, default=dict)

    logo: Mapped[MediaAsset | None] = relationship()


class Certification(TimestampMixin, Base):
    __tablename__ = "certifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    issuer: Mapped[str] = mapped_column(String(160), nullable=False, default="")
    issued_label: Mapped[str] = mapped_column(String(60), nullable=False, default="")
    credential_url: Mapped[str | None] = mapped_column(String(400))
    certificate_id: Mapped[int | None] = mapped_column(ForeignKey("media_assets.id", ondelete="SET NULL"))
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    certificate: Mapped[MediaAsset | None] = relationship()


# --------------------------------------------------------------------------- writing


class Article(TimestampMixin, Base):
    __tablename__ = "articles"
    __table_args__ = (CheckConstraint("status in ('draft', 'published')", name="ck_article_status"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(140), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    excerpt: Mapped[str] = mapped_column(String(400), nullable=False, default="")
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    category: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    tags: Mapped[list] = mapped_column(JSONType, nullable=False, default=list)
    cover_id: Mapped[int | None] = mapped_column(ForeignKey("media_assets.id", ondelete="SET NULL"))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    seo_title: Mapped[str] = mapped_column(String(70), nullable=False, default="")
    seo_description: Mapped[str] = mapped_column(String(170), nullable=False, default="")
    canonical_url: Mapped[str | None] = mapped_column(String(400))

    cover: Mapped[MediaAsset | None] = relationship()


# --------------------------------------------------------------------------- inbox


class ContactMessage(Base):
    __tablename__ = "contact_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    subject: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    message: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    source: Mapped[str] = mapped_column(String(40), nullable=False, default="website")

    replies: Mapped[list[MessageReply]] = relationship(
        back_populates="message", cascade="all, delete-orphan", order_by="MessageReply.created_at"
    )


class MessageReply(Base):
    __tablename__ = "message_replies"
    __table_args__ = (
        CheckConstraint("status in ('sending', 'sent', 'failed', 'not_configured')", name="ck_reply_status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    message_id: Mapped[int] = mapped_column(
        ForeignKey("contact_messages.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    subject: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="sending")
    provider_message_id: Mapped[str | None] = mapped_column(String(200))
    error: Mapped[str | None] = mapped_column(String(500))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    message: Mapped[ContactMessage] = relationship(back_populates="replies")
