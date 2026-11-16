"""Public reads of Studio-managed content.

The only queries the public API uses. Every one of them returns published, undeleted rows only
(hidden skills, skills of deleted categories and draft case studies are excluded too), so a
draft can never reach a public page through a forgotten filter elsewhere.
"""

from __future__ import annotations

from sqlalchemy import Select, select
from sqlalchemy.orm import Session

from app.models.content import (
    Article,
    Certification,
    ContentStatus,
    Education,
    Experience,
    Profile,
    Project,
    Skill,
    SkillCategory,
)


def _published[P: (Experience, Education, Certification, Project, Article)](
    model: type[P],
) -> Select[P]:
    return (
        select(model)
        .where(model.status == ContentStatus.PUBLISHED.value, model.deleted_at.is_(None))
        .order_by(model.position, model.id)
    )


def published[P: (Experience, Education, Certification, Project, Article)](
    session: Session, model: type[P]
) -> list[P]:
    return list(session.scalars(_published(model)))


def profile(session: Session) -> Profile | None:
    return session.get(Profile, 1)


def skill_groups(session: Session) -> list[tuple[str, list[str]]]:
    """Visible skills by category, in order. Categories without a visible skill are omitted."""
    rows = session.execute(
        select(SkillCategory.name, Skill.name)
        .join(Skill, Skill.category_id == SkillCategory.id)
        .where(
            SkillCategory.deleted_at.is_(None),
            Skill.deleted_at.is_(None),
            Skill.visible.is_(True),
        )
        .order_by(SkillCategory.position, SkillCategory.id, Skill.position, Skill.id)
    ).all()
    groups: dict[str, list[str]] = {}
    for category, skill in rows:
        groups.setdefault(category, []).append(skill)
    return list(groups.items())


def published_project(session: Session, slug: str) -> Project | None:
    return session.scalar(_published(Project).where(Project.slug == slug))


def published_article(session: Session, slug: str) -> Article | None:
    return session.scalar(_published(Article).where(Article.slug == slug))
