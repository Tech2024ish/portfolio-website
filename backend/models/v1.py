"""Pydantic request schemas for /api/v1. Every write is validated here first."""

from __future__ import annotations

import re
from datetime import date
from typing import Annotated, Literal
from urllib.parse import urlparse

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field, StringConstraints, field_validator

SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def _http_url(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    if value == "":
        return None
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("Enter a full http(s) URL.")
    return value


def _slug(value: str) -> str:
    value = value.strip().lower()
    if not SLUG_RE.match(value):
        raise ValueError("Use lowercase letters, numbers and single hyphens, e.g. my-project.")
    return value


Url = Annotated[str | None, Field(default=None, max_length=400), AfterValidator(_http_url)]
Slug = Annotated[str, StringConstraints(min_length=2, max_length=120), AfterValidator(_slug)]
Text = Annotated[str, StringConstraints(max_length=20_000)]
Short = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]
Name = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)]
Tag = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=60)]


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


# ------------------------------------------------------------------ public


class ContactIn(Strict):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)]
    email: EmailStr
    subject: Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)] = ""
    message: Annotated[str, StringConstraints(strip_whitespace=True, min_length=10, max_length=5000)]
    website: str = Field(default="", max_length=200)  # honeypot


# ------------------------------------------------------------------ auth


class LoginIn(Strict):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)


class PasswordChangeIn(Strict):
    current_password: str = Field(min_length=1, max_length=256)
    new_password: str = Field(min_length=1, max_length=256)


# ------------------------------------------------------------------ profile


class SocialLink(Strict):
    label: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
    url: Annotated[str, AfterValidator(_http_url)]


class Principle(Strict):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
    body: Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)] = ""


Translations = dict[Literal["fr", "rw"], dict[str, str | list[str]]]


class ProfileUpdate(Strict):
    full_name: Name | None = None
    professional_title: Name | None = None
    location: Short | None = None
    is_available: bool | None = None
    availability_text: Short | None = None
    hero_title: Short | None = None
    hero_title_accent: Short | None = None
    hero_summary: Annotated[str, StringConstraints(max_length=600)] | None = None
    about_title: Short | None = None
    about_lead: Annotated[str, StringConstraints(max_length=800)] | None = None
    about_body: Text | None = None
    engineering_principles: list[Principle] | None = Field(default=None, max_length=8)
    contact_intro: Annotated[str, StringConstraints(max_length=600)] | None = None
    email: EmailStr | None = None
    phone: Annotated[str, StringConstraints(strip_whitespace=True, max_length=40)] | None = None
    whatsapp: Annotated[str, StringConstraints(strip_whitespace=True, max_length=40, pattern=r"^\+?[0-9 ]*$")] | None = None
    social_links: list[SocialLink] | None = Field(default=None, max_length=10)
    photo_id: int | None = None
    og_image_id: int | None = None
    seo_title: Annotated[str, StringConstraints(strip_whitespace=True, max_length=70)] | None = None
    seo_description: Annotated[str, StringConstraints(strip_whitespace=True, max_length=170)] | None = None
    default_theme: Literal["dark", "light"] | None = None
    translations: Translations | None = None


class ResumeSelect(Strict):
    media_id: int | None


# ------------------------------------------------------------------ skills


class SkillCategoryIn(Strict):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
    description: Annotated[str, StringConstraints(max_length=300)] = ""
    is_visible: bool = True
    translations: Translations = Field(default_factory=dict)


class SkillCategoryPatch(Strict):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)] | None = None
    description: Annotated[str, StringConstraints(max_length=300)] | None = None
    is_visible: bool | None = None
    translations: Translations | None = None


class SkillIn(Strict):
    category_id: int
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
    description: Annotated[str, StringConstraints(max_length=300)] = ""
    is_visible: bool = True


class SkillPatch(Strict):
    category_id: int | None = None
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)] | None = None
    description: Annotated[str, StringConstraints(max_length=300)] | None = None
    is_visible: bool | None = None


class ReorderIn(Strict):
    ids: list[int] = Field(min_length=1, max_length=500)

    @field_validator("ids")
    @classmethod
    def unique(cls, ids: list[int]) -> list[int]:
        if len(set(ids)) != len(ids):
            raise ValueError("Each id may appear only once.")
        return ids


# ------------------------------------------------------------------ projects


class ProjectImageIn(Strict):
    media_id: int
    caption: Annotated[str, StringConstraints(max_length=300)] = ""


class ProjectIn(Strict):
    slug: Slug
    title: Name
    category: Annotated[str, StringConstraints(strip_whitespace=True, max_length=80)] = ""
    role: Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)] = ""
    summary: Annotated[str, StringConstraints(max_length=400)] = ""
    problem: Text = ""
    approach: Text = ""
    architecture: Text = ""
    challenges: Text = ""
    outcome: Text = ""
    tech_stack: list[Tag] = Field(default_factory=list, max_length=30)
    github_url: Url = None
    live_url: Url = None
    thumbnail_id: int | None = None
    is_featured: bool = False
    translations: Translations = Field(default_factory=dict)


class ProjectPatch(Strict):
    slug: Slug | None = None
    title: Name | None = None
    category: Annotated[str, StringConstraints(strip_whitespace=True, max_length=80)] | None = None
    role: Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)] | None = None
    summary: Annotated[str, StringConstraints(max_length=400)] | None = None
    problem: Text | None = None
    approach: Text | None = None
    architecture: Text | None = None
    challenges: Text | None = None
    outcome: Text | None = None
    tech_stack: list[Tag] | None = Field(default=None, max_length=30)
    github_url: Url = None
    live_url: Url = None
    thumbnail_id: int | None = None
    is_featured: bool | None = None
    translations: Translations | None = None
    images: list[ProjectImageIn] | None = Field(default=None, max_length=20)


# ------------------------------------------------------------------ career


class ExperienceIn(Strict):
    organization: Name
    role: Name
    employment_type: Annotated[str, StringConstraints(strip_whitespace=True, max_length=60)] = ""
    location: Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)] = ""
    start_date: date | None = None
    end_date: date | None = None
    is_current: bool = False
    period_label: Annotated[str, StringConstraints(strip_whitespace=True, max_length=80)] = ""
    summary: Text = ""
    highlights: list[Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)]] = Field(
        default_factory=list, max_length=12
    )
    skills: list[Tag] = Field(default_factory=list, max_length=20)
    logo_id: int | None = None
    is_visible: bool = True
    translations: Translations = Field(default_factory=dict)


class ExperiencePatch(Strict):
    organization: Name | None = None
    role: Name | None = None
    employment_type: Annotated[str, StringConstraints(strip_whitespace=True, max_length=60)] | None = None
    location: Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)] | None = None
    start_date: date | None = None
    end_date: date | None = None
    is_current: bool | None = None
    period_label: Annotated[str, StringConstraints(strip_whitespace=True, max_length=80)] | None = None
    summary: Text | None = None
    highlights: list[Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)]] | None = Field(
        default=None, max_length=12
    )
    skills: list[Tag] | None = Field(default=None, max_length=20)
    logo_id: int | None = None
    is_visible: bool | None = None
    translations: Translations | None = None


class EducationIn(Strict):
    institution: Name
    degree: Name
    field_of_study: Annotated[str, StringConstraints(strip_whitespace=True, max_length=160)] = ""
    status: Annotated[str, StringConstraints(strip_whitespace=True, max_length=60)] = ""
    period_label: Annotated[str, StringConstraints(strip_whitespace=True, max_length=80)] = ""
    description: Text = ""
    logo_id: int | None = None
    is_visible: bool = True
    translations: Translations = Field(default_factory=dict)


class EducationPatch(Strict):
    institution: Name | None = None
    degree: Name | None = None
    field_of_study: Annotated[str, StringConstraints(strip_whitespace=True, max_length=160)] | None = None
    status: Annotated[str, StringConstraints(strip_whitespace=True, max_length=60)] | None = None
    period_label: Annotated[str, StringConstraints(strip_whitespace=True, max_length=80)] | None = None
    description: Text | None = None
    logo_id: int | None = None
    is_visible: bool | None = None
    translations: Translations | None = None


class CertificationIn(Strict):
    name: Name
    issuer: Annotated[str, StringConstraints(strip_whitespace=True, max_length=160)] = ""
    issued_label: Annotated[str, StringConstraints(strip_whitespace=True, max_length=60)] = ""
    credential_url: Url = None
    certificate_id: int | None = None
    is_visible: bool = True


class CertificationPatch(Strict):
    name: Name | None = None
    issuer: Annotated[str, StringConstraints(strip_whitespace=True, max_length=160)] | None = None
    issued_label: Annotated[str, StringConstraints(strip_whitespace=True, max_length=60)] | None = None
    credential_url: Url = None
    certificate_id: int | None = None
    is_visible: bool | None = None


# ------------------------------------------------------------------ writing


class ArticleIn(Strict):
    slug: Slug
    title: Name
    excerpt: Annotated[str, StringConstraints(max_length=400)] = ""
    body: Annotated[str, StringConstraints(max_length=200_000)] = ""
    category: Annotated[str, StringConstraints(strip_whitespace=True, max_length=80)] = ""
    tags: list[Tag] = Field(default_factory=list, max_length=12)
    cover_id: int | None = None
    seo_title: Annotated[str, StringConstraints(strip_whitespace=True, max_length=70)] = ""
    seo_description: Annotated[str, StringConstraints(strip_whitespace=True, max_length=170)] = ""
    canonical_url: Url = None


class ArticlePatch(Strict):
    slug: Slug | None = None
    title: Name | None = None
    excerpt: Annotated[str, StringConstraints(max_length=400)] | None = None
    body: Annotated[str, StringConstraints(max_length=200_000)] | None = None
    category: Annotated[str, StringConstraints(strip_whitespace=True, max_length=80)] | None = None
    tags: list[Tag] | None = Field(default=None, max_length=12)
    cover_id: int | None = None
    seo_title: Annotated[str, StringConstraints(strip_whitespace=True, max_length=70)] | None = None
    seo_description: Annotated[str, StringConstraints(strip_whitespace=True, max_length=170)] | None = None
    canonical_url: Url = None


# ------------------------------------------------------------------ media & inbox


class MediaPatch(Strict):
    filename: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)] | None = None
    alt_text: Annotated[str, StringConstraints(strip_whitespace=True, max_length=300)] | None = None


class MessagePatch(Strict):
    is_read: bool | None = None
    archived: bool | None = None


class ReplyIn(Strict):
    subject: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    body: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=20_000)]
