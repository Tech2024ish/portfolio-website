"""Website settings and analytics contracts."""

from __future__ import annotations

from datetime import date, datetime
from typing import ClassVar

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.text import SingleLine
from app.schemas.translations import Translatable


class SettingsFields(Translatable):
    TRANSLATABLE: ClassVar[tuple[str, ...]] = ("seo_title", "seo_description")

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    # Search engines show about 60 characters of a title and 160 of a description.
    seo_title: SingleLine = Field(min_length=10, max_length=70)
    seo_description: SingleLine = Field(min_length=50, max_length=200)
    show_skills: bool = True
    show_experience: bool = True  # experience, education and certifications
    show_contact_form: bool = True  # off: the form is hidden and the API refuses messages
    show_cv_download: bool = True
    home_project_count: int = Field(default=3, ge=1, le=6)


class SettingsUpdate(SettingsFields):
    # 0 creates the settings row; otherwise the version the editor loaded.
    version: int = Field(ge=0)


class SettingsOut(SettingsFields):
    model_config = ConfigDict(from_attributes=True)

    version: int  # 0: defaults, never saved
    updated_at: datetime | None


class PageViewIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    path: str = Field(max_length=200)
    referrer: str | None = Field(default=None, max_length=2000)


class DailyCount(BaseModel):
    day: date
    views: int
    visitors: int


class CountItem(BaseModel):
    label: str
    views: int
    visitors: int


class AnalyticsSummary(BaseModel):
    start: date
    end: date
    # The first day anything was recorded (None: nothing yet). Earlier days show zero because
    # nothing was measured then, not because nobody visited.
    recording_since: date | None
    views: int
    # Sum of each day's distinct visitors: someone visiting on two days counts twice.
    visitors: int
    daily: list[DailyCount]
    pages: list[CountItem]
    projects: list[CountItem]
    referrers: list[CountItem]
    devices: list[CountItem]
