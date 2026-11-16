"""Contracts for Studio-managed content (owner) and the public content API.

Every editable entity has three shapes:
- ``<Entity>Fields``: what the owner submits when creating it, validated here;
- ``<Entity>Update``: the same plus ``version``, the version the editor loaded (a mismatch is
  answered with 409, so a stale editor never overwrites a newer save);
- ``<Entity>Out``: what the owner API returns.
The public API has its own shapes, which never include drafts or Studio-only fields.
"""

from __future__ import annotations

import re
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import (
    AfterValidator,
    AnyHttpUrl,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    EmailStr,
    Field,
    model_validator,
)

from app.models.content import SLUG_PATTERN
from app.schemas.media import MediaVariant, PublicImage
from app.schemas.text import MultiLine, SingleLine

Status = Literal["draft", "published"]

_SLUG = re.compile(SLUG_PATTERN)


def _slug(value: str) -> str:
    value = value.strip().lower()
    if not _SLUG.fullmatch(value):
        raise ValueError("Use lowercase letters, digits and single hyphens, like my-project.")
    return value


def _http_url(value: str) -> str:
    value = value.strip()
    url = AnyHttpUrl(value)
    if url.scheme not in ("http", "https"):
        raise ValueError("Use an http:// or https:// address.")
    return value


def _asset(value: str) -> str:
    """A site path (``/file.png``) or an https URL; never a relative or traversing path."""
    value = value.strip()
    if value.startswith("https://"):
        return _http_url(value)
    if not value.startswith("/") or value.startswith("//") or ".." in value or "\\" in value:
        raise ValueError(
            "Use a site path starting with / (for example /Resume.pdf) or an https URL."
        )
    return value


def _month(value: object) -> object:
    """Accept ``YYYY-MM`` or a date; store the first day of that month."""
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        if re.fullmatch(r"\d{4}-\d{2}", text):
            text += "-01"
        value = date.fromisoformat(text)
    if isinstance(value, date):
        return value.replace(day=1)
    return value


def _drop_blank(values: list[str]) -> list[str]:
    return [value for value in values if value]


def _blank_is_none(value: object) -> object:
    return None if isinstance(value, str) and not value.strip() else value


Slug = Annotated[str, Field(min_length=1, max_length=120), AfterValidator(_slug)]
HttpUrlText = Annotated[str, Field(max_length=400), AfterValidator(_http_url)]
OptionalUrl = Annotated[HttpUrlText | None, BeforeValidator(_blank_is_none)]
AssetPath = Annotated[str, Field(min_length=1, max_length=300), AfterValidator(_asset)]
Month = Annotated[date, BeforeValidator(_month)]
OptionalMonth = Annotated[date | None, BeforeValidator(_month)]
OptionalLine = Annotated[SingleLine | None, BeforeValidator(_blank_is_none)]
OptionalText = Annotated[MultiLine | None, BeforeValidator(_blank_is_none)]


OptionalDate = Annotated[date | None, BeforeValidator(_blank_is_none)]

# Lists of short items (one per line in the Studio); blank items are dropped. The number of
# items is limited per field with Field(max_length=...).
Lines40 = Annotated[list[Annotated[SingleLine, Field(max_length=40)]], AfterValidator(_drop_blank)]
Lines120 = Annotated[
    list[Annotated[SingleLine, Field(max_length=120)]], AfterValidator(_drop_blank)
]
Lines300 = Annotated[
    list[Annotated[SingleLine, Field(max_length=300)]], AfterValidator(_drop_blank)
]
Lines400 = Annotated[
    list[Annotated[SingleLine, Field(max_length=400)]], AfterValidator(_drop_blank)
]
Paragraphs = Annotated[
    list[Annotated[MultiLine, Field(max_length=2000)]], AfterValidator(_drop_blank)
]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class _Versioned(_Strict):
    version: int = Field(ge=0)


class _OutBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    position: int
    version: int
    created_at: datetime
    updated_at: datetime


class _PublishableOut(_OutBase):
    status: Status
    published_at: datetime | None


# ------------------------------------------------------------------ profile


class SocialLink(_Strict):
    label: SingleLine = Field(min_length=2, max_length=40)
    href: HttpUrlText


class Principle(_Strict):
    title: SingleLine = Field(min_length=2, max_length=80)
    body: SingleLine = Field(min_length=5, max_length=300)
    icon: Literal["architecture", "database", "api", "quality"]


class ProfileFields(_Strict):
    name: SingleLine = Field(min_length=2, max_length=100)
    initials: SingleLine = Field(min_length=1, max_length=4)
    title: SingleLine = Field(min_length=2, max_length=120)
    location: SingleLine = Field(min_length=2, max_length=120)
    availability: SingleLine = Field(min_length=2, max_length=120)
    headline: SingleLine = Field(min_length=5, max_length=200)
    summary: MultiLine = Field(min_length=10, max_length=600)
    about_lead: MultiLine = Field(min_length=10, max_length=600)
    about_body: Paragraphs = Field(default_factory=list, max_length=6)
    email: EmailStr = Field(max_length=254)
    cv_href: AssetPath
    portrait_src: AssetPath
    portrait_alt: SingleLine = Field(min_length=2, max_length=200)
    contact_intro: MultiLine = Field(min_length=10, max_length=600)
    social: list[SocialLink] = Field(default_factory=list, max_length=6)
    principles: list[Principle] = Field(default_factory=list, max_length=8)


class ProfileUpdate(ProfileFields):
    # 0 creates the profile; otherwise the version the editor loaded.
    version: int = Field(ge=0)


class ProfileOut(ProfileFields):
    model_config = ConfigDict(from_attributes=True)

    version: int
    updated_at: datetime


# ------------------------------------------------------------------ skills


class SkillCategoryFields(_Strict):
    name: SingleLine = Field(min_length=2, max_length=80)


class SkillCategoryUpdate(SkillCategoryFields, _Versioned):
    pass


class SkillCategoryOut(SkillCategoryFields, _OutBase):
    pass


class SkillFields(_Strict):
    category_id: int = Field(ge=1)
    name: SingleLine = Field(min_length=1, max_length=80)
    visible: bool = True


class SkillUpdate(SkillFields, _Versioned):
    pass


class SkillOut(SkillFields, _OutBase):
    pass


# ------------------------------------------------------------------ experience and education


class ExperienceFields(_Strict):
    organization: SingleLine = Field(min_length=2, max_length=150)
    role: SingleLine = Field(min_length=2, max_length=150)
    location: OptionalLine = Field(default=None, max_length=120)
    start_month: Month
    end_month: OptionalMonth = None
    is_current: bool = False
    highlights: Lines300 = Field(default_factory=list, max_length=10)

    @model_validator(mode="after")
    def _dates(self) -> ExperienceFields:
        if self.is_current and self.end_month is not None:
            raise ValueError("A current role has no end date.")
        if self.end_month is not None and self.end_month < self.start_month:
            raise ValueError("The end date must not be before the start date.")
        return self


class ExperienceUpdate(ExperienceFields, _Versioned):
    pass


class ExperienceOut(ExperienceFields, _PublishableOut):
    pass


class EducationFields(_Strict):
    institution: SingleLine = Field(min_length=2, max_length=150)
    qualification: SingleLine = Field(min_length=2, max_length=150)
    location: OptionalLine = Field(default=None, max_length=120)
    status_label: OptionalLine = Field(default=None, max_length=80)
    start_month: OptionalMonth = None
    end_month: OptionalMonth = None
    coursework: Lines120 = Field(default_factory=list, max_length=12)

    @model_validator(mode="after")
    def _dates(self) -> EducationFields:
        if self.start_month and self.end_month and self.end_month < self.start_month:
            raise ValueError("The end date must not be before the start date.")
        return self


class EducationUpdate(EducationFields, _Versioned):
    pass


class EducationOut(EducationFields, _PublishableOut):
    pass


class CertificationFields(_Strict):
    name: SingleLine = Field(min_length=2, max_length=150)
    issuer: SingleLine = Field(min_length=2, max_length=150)
    issued_month: OptionalMonth = None
    credential_url: OptionalUrl = None


class CertificationUpdate(CertificationFields, _Versioned):
    pass


class CertificationOut(CertificationFields, _PublishableOut):
    pass


# ------------------------------------------------------------------ projects


class Decision(_Strict):
    title: SingleLine = Field(min_length=2, max_length=120)
    detail: SingleLine = Field(min_length=5, max_length=600)


class Challenge(_Strict):
    challenge: SingleLine = Field(min_length=5, max_length=600)
    solution: SingleLine = Field(min_length=5, max_length=600)


class Media(_Strict):
    src: AssetPath
    alt: SingleLine = Field(min_length=2, max_length=200)
    caption: OptionalLine = Field(default=None, max_length=200)
    width: int = Field(ge=16, le=8000)
    height: int = Field(ge=16, le=8000)


class ProjectFields(_Strict):
    slug: Slug
    title: SingleLine = Field(min_length=2, max_length=150)
    category: SingleLine = Field(min_length=2, max_length=80)
    summary: MultiLine = Field(min_length=10, max_length=600)
    tech: Lines40 = Field(default_factory=list, max_length=20)
    featured: bool = False
    repo_url: OptionalUrl = None
    live_url: OptionalUrl = None
    case_study_status: Status = "draft"
    overview: Paragraphs = Field(default_factory=list, max_length=6)
    problem: OptionalText = Field(default=None, max_length=2000)
    objectives: Lines300 = Field(default_factory=list, max_length=10)
    approach: OptionalText = Field(default=None, max_length=2000)
    architecture: Lines300 = Field(default_factory=list, max_length=12)
    decisions: list[Decision] = Field(default_factory=list, max_length=10)
    challenges: list[Challenge] = Field(default_factory=list, max_length=10)
    outcomes: Lines300 = Field(default_factory=list, max_length=10)
    scope_implemented: Lines300 = Field(default_factory=list, max_length=12)
    scope_not_yet: Lines300 = Field(default_factory=list, max_length=12)
    media: list[Media] = Field(default_factory=list, max_length=12)
    sources: Lines400 = Field(default_factory=list, max_length=10)


class ProjectUpdate(ProjectFields, _Versioned):
    pass


class ProjectOut(ProjectFields, _PublishableOut):
    pass


# ------------------------------------------------------------------ articles


class ArticleFields(_Strict):
    slug: Slug
    title: SingleLine = Field(min_length=2, max_length=200)
    summary: MultiLine = Field(min_length=10, max_length=600)
    category: SingleLine = Field(min_length=2, max_length=80)
    published_on: OptionalDate = None
    body: MultiLine = Field(default="", max_length=100_000)


class ArticleUpdate(ArticleFields, _Versioned):
    pass


class ArticleOut(ArticleFields, _PublishableOut):
    pass


class ReorderRequest(_Strict):
    ids: list[int] = Field(min_length=1, max_length=500)


# ------------------------------------------------------------------ dashboard and audit


class AuditEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
    action: str
    entity_type: str
    entity_id: int | None
    summary: str
    changed_fields: list[str]


class StatusCounts(BaseModel):
    draft: int = 0
    published: int = 0


class RecentMessage(BaseModel):
    id: int
    created_at: datetime
    name: str
    subject: str
    status: str


# ------------------------------------------------------------------ public API


class PublicExperience(BaseModel):
    organization: str
    role: str
    location: str | None
    start_month: date
    end_month: date | None
    is_current: bool
    highlights: list[str]


class PublicEducation(BaseModel):
    institution: str
    qualification: str
    location: str | None
    status_label: str | None
    start_month: date | None
    end_month: date | None
    coursework: list[str]


class PublicCertification(BaseModel):
    name: str
    issuer: str
    issued_month: date | None
    credential_url: str | None


class PublicSkillGroup(BaseModel):
    name: str
    skills: list[str]


class PublicMedia(BaseModel):
    src: str
    alt: str
    caption: str | None
    width: int
    height: int
    # Narrower WebP versions when the image is in the media library; empty otherwise.
    variants: list[MediaVariant] = []


class PublicCaseStudy(BaseModel):
    overview: list[str]
    problem: str | None
    objectives: list[str]
    approach: str | None
    architecture: list[str]
    decisions: list[Decision]
    challenges: list[Challenge]
    outcomes: list[str]
    scope_implemented: list[str]
    scope_not_yet: list[str]
    media: list[PublicMedia]


class PublicProject(BaseModel):
    slug: str
    title: str
    category: str
    summary: str
    tech: list[str]
    featured: bool
    repo_url: str | None
    live_url: str | None
    case_study: PublicCaseStudy | None


class PublicArticleSummary(BaseModel):
    slug: str
    title: str
    summary: str
    category: str
    published_on: date | None


class PublicArticle(PublicArticleSummary):
    body: str


class PublicPortfolio(BaseModel):
    profile: ProfileFields
    # Responsive versions of the portrait when it is a library image.
    portrait: PublicImage | None = None
    skill_groups: list[PublicSkillGroup]
    experience: list[PublicExperience]
    education: list[PublicEducation]
    certifications: list[PublicCertification]
    projects: list[PublicProject]
    articles: list[PublicArticleSummary]


class OwnerDashboard(BaseModel):
    """The Studio home: what needs attention and what changed recently."""

    messages: dict[str, int]
    content: dict[str, StatusCounts]
    recent_messages: list[RecentMessage]
    recent_activity: list[AuditEventOut]
