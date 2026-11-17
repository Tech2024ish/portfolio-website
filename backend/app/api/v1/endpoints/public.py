"""``/api/v1/public``: published portfolio content for the public site. No authentication.

Every route reads through ``app.repositories.content``, which only returns published,
undeleted content; a project's case study is included only when it is published too. Unknown
and unpublished slugs get the same 404, so a draft's existence is never revealed.
"""

from __future__ import annotations

from fastapi import APIRouter, Response

from app.core.errors import AppError
from app.database.session import DbSession
from app.models.content import Article, Certification, ContentStatus, Education, Experience, Project
from app.models.media import MediaAsset
from app.repositories import content as repository
from app.schemas.content import (
    ProfileFields,
    PublicArticle,
    PublicArticleSummary,
    PublicCaseStudy,
    PublicCertification,
    PublicEducation,
    PublicExperience,
    PublicMedia,
    PublicPortfolio,
    PublicProject,
    PublicSkillGroup,
)
from app.schemas.media import MediaVariant, PublicImage
from app.services import media as media_service
from app.services import site as site_service

router = APIRouter(prefix="/public", tags=["public content"])

# Browsers and CDNs may keep a copy briefly; the Next.js site caches it by tag and is told to
# refresh when the owner changes content.
_CACHE = {"Cache-Control": "public, max-age=60"}


def _not_found(label: str) -> AppError:
    return AppError(404, "not_found", f"{label} not found.")


def _variants(asset: MediaAsset | None) -> list[MediaVariant]:
    if asset is None:
        return []
    return [
        MediaVariant(width=v["width"], height=v["height"], url=v["url"]) for v in asset.variants
    ]


def _project(project: Project, library: dict[str, MediaAsset]) -> PublicProject:
    case_study = None
    if project.case_study_status == ContentStatus.PUBLISHED.value:
        case_study = PublicCaseStudy(
            overview=project.overview,
            problem=project.problem,
            objectives=project.objectives,
            approach=project.approach,
            architecture=project.architecture,
            decisions=project.decisions,  # type: ignore[arg-type]
            challenges=project.challenges,  # type: ignore[arg-type]
            outcomes=project.outcomes,
            scope_implemented=project.scope_implemented,
            scope_not_yet=project.scope_not_yet,
            media=[
                PublicMedia(
                    src=item["src"],
                    alt=item["alt"],
                    caption=item.get("caption"),
                    width=item["width"],
                    height=item["height"],
                    variants=_variants(library.get(item["src"])),
                )
                for item in project.media
            ],
        )
    return PublicProject(
        slug=project.slug,
        title=project.title,
        category=project.category,
        summary=project.summary,
        tech=project.tech,
        featured=project.featured,
        repo_url=project.repo_url,
        live_url=project.live_url,
        case_study=case_study,
    )


def _article_summary(article: Article) -> PublicArticleSummary:
    return PublicArticleSummary(
        slug=article.slug,
        title=article.title,
        summary=article.summary,
        category=article.category,
        published_on=article.published_on,
    )


@router.get("/portfolio", response_model=PublicPortfolio, summary="Everything the home page shows")
def portfolio(session: DbSession, response: Response) -> PublicPortfolio:
    profile = repository.profile(session)
    if profile is None:
        raise AppError(404, "not_found", "The portfolio content has not been set up yet.")
    response.headers.update(_CACHE)
    projects = repository.published(session, Project)
    library = media_service.by_url(
        session,
        {profile.portrait_src} | {item["src"] for project in projects for item in project.media},
    )
    portrait = library.get(profile.portrait_src)
    return PublicPortfolio(
        profile=ProfileFields.model_validate(profile, from_attributes=True),
        settings=site_service.current(session),
        portrait=PublicImage(
            width=portrait.width, height=portrait.height, variants=_variants(portrait)
        )
        if portrait
        else None,
        skill_groups=[
            PublicSkillGroup(name=name, skills=skills)
            for name, skills in repository.skill_groups(session)
        ],
        experience=[
            PublicExperience.model_validate(row, from_attributes=True)
            for row in repository.published(session, Experience)
        ],
        education=[
            PublicEducation.model_validate(row, from_attributes=True)
            for row in repository.published(session, Education)
        ],
        certifications=[
            PublicCertification.model_validate(row, from_attributes=True)
            for row in repository.published(session, Certification)
        ],
        projects=[_project(row, library) for row in projects],
        articles=[_article_summary(row) for row in repository.published(session, Article)],
    )


@router.get("/projects/{slug}", response_model=PublicProject, summary="One published project")
def project(slug: str, session: DbSession, response: Response) -> PublicProject:
    row = repository.published_project(session, slug)
    if row is None:
        raise _not_found("Project")
    response.headers.update(_CACHE)
    return _project(row, media_service.by_url(session, {item["src"] for item in row.media}))


@router.get("/articles", response_model=list[PublicArticleSummary], summary="Published notes")
def articles(session: DbSession, response: Response) -> list[PublicArticleSummary]:
    response.headers.update(_CACHE)
    return [_article_summary(row) for row in repository.published(session, Article)]


@router.get("/articles/{slug}", response_model=PublicArticle, summary="One published note")
def article(slug: str, session: DbSession, response: Response) -> PublicArticle:
    row = repository.published_article(session, slug)
    if row is None:
        raise _not_found("Article")
    response.headers.update(_CACHE)
    return PublicArticle(**_article_summary(row).model_dump(), body=row.body)
