"""Public, read-only content and the contact form. Only published/visible rows."""

from __future__ import annotations

from collections import defaultdict, deque
from threading import Lock
from time import monotonic

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from core.db import get_db
from models.entities import (
    Article,
    Certification,
    ContactMessage,
    Education,
    Experience,
    Project,
    SiteProfile,
    SkillCategory,
)
from models.v1 import ContactIn
from routers.v1.common import media_out, project_out, row_out
from services.auth import client_ip

router = APIRouter(tags=["public"])

PUBLIC_PROFILE_EXCLUDE = ("photo_id", "resume_id", "og_image_id")


def _profile(db: Session) -> SiteProfile:
    profile = db.get(SiteProfile, 1)
    if profile is None:
        raise HTTPException(status_code=404, detail="Site content has not been set up yet.")
    return profile


def _article_summary(article: Article) -> dict:
    out = row_out(article, media=("cover",), exclude=("body",))
    out["reading_minutes"] = max(1, round(len(article.body.split()) / 220))
    return out


@router.get("/public/site")
def public_site(db: Session = Depends(get_db)):
    profile = _profile(db)
    categories = db.scalars(
        select(SkillCategory)
        .where(SkillCategory.is_visible.is_(True))
        .options(selectinload(SkillCategory.skills))
        .order_by(SkillCategory.position)
    ).all()
    projects = db.scalars(
        select(Project)
        .where(Project.status == "published")
        .options(selectinload(Project.images))
        .order_by(Project.is_featured.desc(), Project.position)
    ).all()
    articles = db.scalars(
        select(Article).where(Article.status == "published").order_by(Article.published_at.desc()).limit(3)
    ).all()

    profile_out = row_out(profile, media=("photo", "og_image"), exclude=PUBLIC_PROFILE_EXCLUDE)
    profile_out["resume_url"] = profile.resume.url if profile.resume else None
    return {
        "profile": profile_out,
        "skills": [
            {
                **row_out(category),
                "skills": [row_out(skill) for skill in category.skills if skill.is_visible],
            }
            for category in categories
        ],
        "experience": [
            row_out(item, media=("logo",))
            for item in db.scalars(select(Experience).where(Experience.is_visible.is_(True)).order_by(Experience.position))
        ],
        "education": [
            row_out(item, media=("logo",))
            for item in db.scalars(select(Education).where(Education.is_visible.is_(True)).order_by(Education.position))
        ],
        "certifications": [
            row_out(item, media=("certificate",))
            for item in db.scalars(
                select(Certification).where(Certification.is_visible.is_(True)).order_by(Certification.position)
            )
        ],
        "projects": [project_out(project) for project in projects],
        "articles": [_article_summary(article) for article in articles],
    }


@router.get("/public/projects/{slug}")
def public_project(slug: str, db: Session = Depends(get_db)):
    project = db.scalar(select(Project).where(Project.slug == slug, Project.status == "published"))
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    return project_out(project)


@router.get("/public/articles")
def public_articles(db: Session = Depends(get_db)):
    articles = db.scalars(select(Article).where(Article.status == "published").order_by(Article.published_at.desc()))
    return [_article_summary(article) for article in articles]


@router.get("/public/articles/{slug}")
def public_article(slug: str, db: Session = Depends(get_db)):
    article = db.scalar(select(Article).where(Article.slug == slug, Article.status == "published"))
    if article is None:
        raise HTTPException(status_code=404, detail="Article not found.")
    out = _article_summary(article)
    out["body"] = article.body
    return out


@router.get("/public/resume")
def public_resume(db: Session = Depends(get_db)):
    profile = _profile(db)
    if profile.resume is None:
        raise HTTPException(status_code=404, detail="No resume has been published.")
    return RedirectResponse(profile.resume.url, status_code=307)


@router.get("/public/resume/meta")
def public_resume_meta(db: Session = Depends(get_db)):
    profile = _profile(db)
    return {"resume": media_out(profile.resume)}


# ------------------------------------------------------------------ contact


class ContactThrottle:
    def __init__(self, limit: int = 5, window: int = 15 * 60):
        self.limit, self.window = limit, window
        self.hits: dict[str, deque[float]] = defaultdict(deque)
        self.lock = Lock()

    def hit(self, key: str) -> None:
        with self.lock:
            bucket, now = self.hits[key], monotonic()
            while bucket and now - bucket[0] > self.window:
                bucket.popleft()
            if len(bucket) >= self.limit:
                raise HTTPException(status_code=429, detail="Too many messages. Please try again later.")
            bucket.append(now)


contact_throttle = ContactThrottle()


@router.post("/contact", status_code=201)
def submit_contact(body: ContactIn, request: Request, db: Session = Depends(get_db)):
    if body.website:
        raise HTTPException(status_code=400, detail="Invalid submission.")
    contact_throttle.hit(client_ip(request))
    message = ContactMessage(name=body.name, email=str(body.email), subject=body.subject, message=body.message)
    db.add(message)
    db.flush()
    return {"success": True, "message": "Message received. I'll get back to you soon."}
