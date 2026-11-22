"""Website settings and privacy-preserving analytics.

``site_settings`` has one row (id 1): defaults for search engines and sharing, which home-page
sections show, whether the contact form accepts messages, and how many projects the home page
features. Without a row, the defaults below apply.

``page_views`` records one row per public page view actually reported by a browser. No IP
address, user agent or cookie is stored: only the page, the referring site's host name, a device
class and ``visitor_hash``, an HMAC of address and user agent with a key that exists for one day
(``analytics_keys``). Keys older than two days are deleted, after which no hash can be linked to
anything, so visitors are counted per day and never followed across days.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Identity,
    Index,
    Integer,
    SmallInteger,
    String,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base

DEFAULT_SEO_TITLE = "Jean Claude Ishimwe — Backend Software Engineer"
DEFAULT_SEO_DESCRIPTION = (
    "Backend Software Engineer in Kigali, Rwanda, building reliable APIs, database-driven "
    "applications and maintainable software systems with Python, FastAPI and PostgreSQL."
)


class SiteSettings(Base):
    __tablename__ = "site_settings"
    __table_args__ = (
        CheckConstraint("id = 1", name="single_row"),
        CheckConstraint("home_project_count between 1 and 6", name="home_project_count_range"),
    )

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True, autoincrement=False, default=1)
    seo_title: Mapped[str] = mapped_column(String(70), nullable=False)
    seo_description: Mapped[str] = mapped_column(String(200), nullable=False)
    # French and Kinyarwanda title and description: {"fr": {...}, "rw": {...}}.
    translations: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb"), default=dict
    )
    show_skills: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    show_experience: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    show_contact_form: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    show_cv_download: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    home_project_count: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, server_default="3"
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class PageView(Base):
    __tablename__ = "page_views"
    __table_args__ = (
        CheckConstraint("device in ('mobile', 'tablet', 'desktop')", name="device_allowed"),
        Index("ix_page_views_day", "day"),
        Index("ix_page_views_path_day", "path", "day"),
    )

    id: Mapped[int] = mapped_column(BigInteger, Identity(always=True), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    day: Mapped[date] = mapped_column(Date, nullable=False)  # UTC
    path: Mapped[str] = mapped_column(String(200), nullable=False)
    referrer_host: Mapped[str | None] = mapped_column(String(253))
    device: Mapped[str] = mapped_column(String(10), nullable=False)
    visitor_hash: Mapped[str] = mapped_column(String(64), nullable=False)


class AnalyticsKey(Base):
    """The day's secret for visitor hashes; deleted after two days."""

    __tablename__ = "analytics_keys"

    day: Mapped[date] = mapped_column(Date, primary_key=True)
    secret: Mapped[str] = mapped_column(String(64), nullable=False)
