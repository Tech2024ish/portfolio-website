"""Owner-only content management. Every route depends on require_owner."""


from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from core.db import get_db
from models.entities import (
    Article,
    Certification,
    Education,
    Experience,
    Project,
    ProjectImage,
    SiteProfile,
    SkillCategory,
    SkillItem,
    utcnow,
)
from models.v1 import (
    ArticleIn,
    ArticlePatch,
    CertificationIn,
    CertificationPatch,
    EducationIn,
    EducationPatch,
    ExperienceIn,
    ExperiencePatch,
    ProfileUpdate,
    ProjectIn,
    ProjectPatch,
    ReorderIn,
    SkillCategoryIn,
    SkillCategoryPatch,
    SkillIn,
    SkillPatch,
)
from routers.v1.common import (
    apply_patch,
    ensure_media,
    get_or_404,
    next_position,
    project_out,
    reorder,
    row_out,
    search_filter,
)
from services import activity
from services.auth import OwnerContext, require_owner

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_owner)])


def _unique_slug(db: Session, model, slug: str, exclude_id: int | None = None) -> None:
    stmt = select(model.id).where(model.slug == slug)
    if exclude_id is not None:
        stmt = stmt.where(model.id != exclude_id)
    if db.scalar(stmt) is not None:
        raise HTTPException(status_code=409, detail="That URL slug is already used. Choose another.")


# ------------------------------------------------------------------ profile


def _profile_out(profile: SiteProfile) -> dict:
    return row_out(profile, media=("photo", "resume", "og_image"))


@router.get("/profile")
def get_profile(db: Session = Depends(get_db)):
    return _profile_out(get_or_404(db, SiteProfile, 1, "Profile"))


@router.patch("/profile")
def update_profile(body: ProfileUpdate, owner: OwnerContext = Depends(require_owner), db: Session = Depends(get_db)):
    profile = get_or_404(db, SiteProfile, 1, "Profile")
    ensure_media(db, body.photo_id, "image", "Profile photo")
    ensure_media(db, body.og_image_id, "image", "Social image")
    data = body.model_dump(exclude_unset=True)
    for key in ("engineering_principles", "social_links"):
        if key in data and data[key] is None:
            raise HTTPException(status_code=422, detail=f"{key} cannot be empty.")
    changes = apply_patch(profile, body)
    if changes:
        activity.record(db, owner, "update", "profile", "Updated profile: " + ", ".join(sorted(changes)), 1)
    db.flush()
    return _profile_out(profile)


# ------------------------------------------------------------------ skills


def _category_out(category: SkillCategory) -> dict:
    return {**row_out(category), "skills": [row_out(skill) for skill in category.skills]}


@router.get("/skill-categories")
def list_skill_categories(db: Session = Depends(get_db)):
    categories = db.scalars(
        select(SkillCategory).options(selectinload(SkillCategory.skills)).order_by(SkillCategory.position)
    )
    return [_category_out(category) for category in categories]


@router.post("/skill-categories", status_code=201)
def create_skill_category(body: SkillCategoryIn, owner: OwnerContext = Depends(require_owner), db: Session = Depends(get_db)):
    category = SkillCategory(**body.model_dump(), position=next_position(db, SkillCategory))
    db.add(category)
    db.flush()
    activity.record(db, owner, "create", "skill_category", f"Added skill category {category.name}", category.id)
    return _category_out(category)


@router.patch("/skill-categories/{item_id}")
def update_skill_category(
    item_id: int, body: SkillCategoryPatch, owner: OwnerContext = Depends(require_owner), db: Session = Depends(get_db)
):
    category = get_or_404(db, SkillCategory, item_id, "Skill category")
    apply_patch(category, body)
    db.flush()
    activity.record(db, owner, "update", "skill_category", f"Updated skill category {category.name}", category.id)
    return _category_out(category)


@router.delete("/skill-categories/{item_id}", status_code=204)
def delete_skill_category(item_id: int, owner: OwnerContext = Depends(require_owner), db: Session = Depends(get_db)):
    category = get_or_404(db, SkillCategory, item_id, "Skill category")
    activity.record(db, owner, "delete", "skill_category", f"Deleted skill category {category.name}", category.id)
    db.delete(category)


@router.post("/skill-categories/reorder")
def reorder_skill_categories(body: ReorderIn, owner: OwnerContext = Depends(require_owner), db: Session = Depends(get_db)):
    reorder(db, SkillCategory, body.ids)
    activity.record(db, owner, "reorder", "skill_category", "Reordered skill categories")
    return {"success": True}


@router.post("/skills", status_code=201)
def create_skill(body: SkillIn, owner: OwnerContext = Depends(require_owner), db: Session = Depends(get_db)):
    get_or_404(db, SkillCategory, body.category_id, "Skill category")
    skill = SkillItem(**body.model_dump(), position=next_position(db, SkillItem, SkillItem.category_id == body.category_id))
    db.add(skill)
    db.flush()
    activity.record(db, owner, "create", "skill", f"Added skill {skill.name}", skill.id)
    return row_out(skill)


@router.patch("/skills/{item_id}")
def update_skill(item_id: int, body: SkillPatch, owner: OwnerContext = Depends(require_owner), db: Session = Depends(get_db)):
    skill = get_or_404(db, SkillItem, item_id, "Skill")
    if body.category_id is not None and body.category_id != skill.category_id:
        get_or_404(db, SkillCategory, body.category_id, "Skill category")
        skill.position = next_position(db, SkillItem, SkillItem.category_id == body.category_id)
    apply_patch(skill, body)
    db.flush()
    activity.record(db, owner, "update", "skill", f"Updated skill {skill.name}", skill.id)
    return row_out(skill)


@router.delete("/skills/{item_id}", status_code=204)
def delete_skill(item_id: int, owner: OwnerContext = Depends(require_owner), db: Session = Depends(get_db)):
    skill = get_or_404(db, SkillItem, item_id, "Skill")
    activity.record(db, owner, "delete", "skill", f"Deleted skill {skill.name}", skill.id)
    db.delete(skill)


@router.post("/skill-categories/{item_id}/skills/reorder")
def reorder_skills(item_id: int, body: ReorderIn, owner: OwnerContext = Depends(require_owner), db: Session = Depends(get_db)):
    get_or_404(db, SkillCategory, item_id, "Skill category")
    reorder(db, SkillItem, body.ids, SkillItem.category_id == item_id)
    activity.record(db, owner, "reorder", "skill", "Reordered skills", item_id)
    return {"success": True}


# ------------------------------------------------------------------ simple ordered collections


def register_collection(
    path: str,
    model,
    create_schema: type[BaseModel],
    patch_schema: type[BaseModel],
    label: str,
    title_field: str,
    media_fields: dict[str, tuple[str, str]],
):
    """CRUD + reorder for experiences, education and certifications.

    media_fields maps the FK field to (relationship name, required media kind).
    """
    rels = tuple(rel for rel, _ in media_fields.values())

    def check_media(db: Session, body: BaseModel, is_create: bool) -> None:
        for field, (_, kind) in media_fields.items():
            if is_create or field in body.model_fields_set:
                ensure_media(db, getattr(body, field), kind or None, field)

    @router.get(f"/{path}", name=f"list_{path}")
    def list_items(db: Session = Depends(get_db)):
        return [row_out(item, media=rels) for item in db.scalars(select(model).order_by(model.position))]

    @router.post(f"/{path}", status_code=201, name=f"create_{path}")
    def create_item(body: create_schema, owner: OwnerContext = Depends(require_owner), db: Session = Depends(get_db)):  # type: ignore[valid-type]
        check_media(db, body, True)
        item = model(**body.model_dump(), position=next_position(db, model))
        db.add(item)
        db.flush()
        activity.record(db, owner, "create", path, f"Added {label}: {getattr(item, title_field)}", item.id)
        return row_out(item, media=rels)

    @router.patch(f"/{path}/{{item_id}}", name=f"update_{path}")
    def update_item(
        item_id: int, body: patch_schema, owner: OwnerContext = Depends(require_owner), db: Session = Depends(get_db)  # type: ignore[valid-type]
    ):
        item = get_or_404(db, model, item_id, label.capitalize())
        check_media(db, body, False)
        apply_patch(item, body)
        db.flush()
        db.refresh(item)
        activity.record(db, owner, "update", path, f"Updated {label}: {getattr(item, title_field)}", item.id)
        return row_out(item, media=rels)

    @router.delete(f"/{path}/{{item_id}}", status_code=204, name=f"delete_{path}")
    def delete_item(item_id: int, owner: OwnerContext = Depends(require_owner), db: Session = Depends(get_db)):
        item = get_or_404(db, model, item_id, label.capitalize())
        activity.record(db, owner, "delete", path, f"Deleted {label}: {getattr(item, title_field)}", item.id)
        db.delete(item)

    @router.post(f"/{path}/reorder", name=f"reorder_{path}")
    def reorder_items(body: ReorderIn, owner: OwnerContext = Depends(require_owner), db: Session = Depends(get_db)):
        reorder(db, model, body.ids)
        activity.record(db, owner, "reorder", path, f"Reordered {path}")
        return {"success": True}


register_collection("experiences", Experience, ExperienceIn, ExperiencePatch, "experience", "organization", {"logo_id": ("logo", "image")})
register_collection("education", Education, EducationIn, EducationPatch, "education", "institution", {"logo_id": ("logo", "image")})
register_collection(
    "certifications",
    Certification,
    CertificationIn,
    CertificationPatch,
    "certification",
    "name",
    {"certificate_id": ("certificate", "")},
)


# ------------------------------------------------------------------ projects


@router.get("/projects")
def list_projects(q: str | None = None, status: str | None = None, db: Session = Depends(get_db)):
    stmt = select(Project).options(selectinload(Project.images)).order_by(Project.position)
    condition = search_filter([Project.title, Project.summary, Project.category], q)
    if condition is not None:
        stmt = stmt.where(condition)
    if status in {"draft", "published"}:
        stmt = stmt.where(Project.status == status)
    return [project_out(project) for project in db.scalars(stmt)]


@router.get("/projects/{item_id}")
def get_project(item_id: int, db: Session = Depends(get_db)):
    return project_out(get_or_404(db, Project, item_id, "Project"))


@router.post("/projects", status_code=201)
def create_project(body: ProjectIn, owner: OwnerContext = Depends(require_owner), db: Session = Depends(get_db)):
    _unique_slug(db, Project, body.slug)
    ensure_media(db, body.thumbnail_id, "image", "Thumbnail")
    project = Project(**body.model_dump(), status="draft", position=next_position(db, Project))
    db.add(project)
    db.flush()
    activity.record(db, owner, "create", "project", f"Created project draft {project.title}", project.id)
    return project_out(project)


@router.patch("/projects/{item_id}")
def update_project(item_id: int, body: ProjectPatch, owner: OwnerContext = Depends(require_owner), db: Session = Depends(get_db)):
    project = get_or_404(db, Project, item_id, "Project")
    if body.slug is not None:
        _unique_slug(db, Project, body.slug, exclude_id=project.id)
    if "thumbnail_id" in body.model_fields_set:
        ensure_media(db, body.thumbnail_id, "image", "Thumbnail")
    apply_patch(project, body, skip={"images"})
    if body.images is not None:
        if len({image.media_id for image in body.images}) != len(body.images):
            raise HTTPException(status_code=422, detail="Each screenshot can be added once.")
        for image in body.images:
            ensure_media(db, image.media_id, "image", "Screenshot")
        project.images.clear()
        db.flush()
        project.images.extend(
            ProjectImage(media_id=image.media_id, caption=image.caption, position=index)
            for index, image in enumerate(body.images)
        )
    db.flush()
    db.refresh(project)
    activity.record(db, owner, "update", "project", f"Updated project {project.title}", project.id)
    return project_out(project)


@router.post("/projects/{item_id}/publish")
def publish_project(item_id: int, owner: OwnerContext = Depends(require_owner), db: Session = Depends(get_db)):
    project = get_or_404(db, Project, item_id, "Project")
    missing = [field for field in ("title", "summary") if not getattr(project, field).strip()]
    if missing:
        raise HTTPException(status_code=422, detail="Add a " + " and ".join(missing) + " before publishing.")
    project.status = "published"
    project.published_at = project.published_at or utcnow()
    activity.record(db, owner, "publish", "project", f"Published project {project.title}", project.id)
    db.flush()
    return project_out(project)


@router.post("/projects/{item_id}/unpublish")
def unpublish_project(item_id: int, owner: OwnerContext = Depends(require_owner), db: Session = Depends(get_db)):
    project = get_or_404(db, Project, item_id, "Project")
    project.status = "draft"
    activity.record(db, owner, "unpublish", "project", f"Unpublished project {project.title}", project.id)
    db.flush()
    return project_out(project)


@router.delete("/projects/{item_id}", status_code=204)
def delete_project(item_id: int, owner: OwnerContext = Depends(require_owner), db: Session = Depends(get_db)):
    project = get_or_404(db, Project, item_id, "Project")
    activity.record(db, owner, "delete", "project", f"Deleted project {project.title}", project.id)
    db.delete(project)


@router.post("/projects/reorder")
def reorder_projects(body: ReorderIn, owner: OwnerContext = Depends(require_owner), db: Session = Depends(get_db)):
    reorder(db, Project, body.ids)
    activity.record(db, owner, "reorder", "project", "Reordered projects")
    return {"success": True}


# ------------------------------------------------------------------ articles


def _article_out(article: Article) -> dict:
    out = row_out(article, media=("cover",))
    out["reading_minutes"] = max(1, round(len(article.body.split()) / 220))
    return out


@router.get("/articles")
def list_articles(q: str | None = None, status: str | None = None, db: Session = Depends(get_db)):
    stmt = select(Article).order_by(Article.updated_at.desc())
    condition = search_filter([Article.title, Article.excerpt, Article.category], q)
    if condition is not None:
        stmt = stmt.where(condition)
    if status in {"draft", "published"}:
        stmt = stmt.where(Article.status == status)
    return [_article_out(article) for article in db.scalars(stmt)]


@router.get("/articles/{item_id}")
def get_article(item_id: int, db: Session = Depends(get_db)):
    return _article_out(get_or_404(db, Article, item_id, "Article"))


@router.post("/articles", status_code=201)
def create_article(body: ArticleIn, owner: OwnerContext = Depends(require_owner), db: Session = Depends(get_db)):
    _unique_slug(db, Article, body.slug)
    ensure_media(db, body.cover_id, "image", "Cover image")
    article = Article(**body.model_dump(), status="draft")
    db.add(article)
    db.flush()
    activity.record(db, owner, "create", "article", f"Created article draft {article.title}", article.id)
    return _article_out(article)


@router.patch("/articles/{item_id}")
def update_article(item_id: int, body: ArticlePatch, owner: OwnerContext = Depends(require_owner), db: Session = Depends(get_db)):
    article = get_or_404(db, Article, item_id, "Article")
    if body.slug is not None:
        _unique_slug(db, Article, body.slug, exclude_id=article.id)
    if "cover_id" in body.model_fields_set:
        ensure_media(db, body.cover_id, "image", "Cover image")
    apply_patch(article, body)
    db.flush()
    db.refresh(article)
    activity.record(db, owner, "update", "article", f"Updated article {article.title}", article.id)
    return _article_out(article)


@router.post("/articles/{item_id}/publish")
def publish_article(item_id: int, owner: OwnerContext = Depends(require_owner), db: Session = Depends(get_db)):
    article = get_or_404(db, Article, item_id, "Article")
    missing = [label for field, label in (("body", "body"), ("excerpt", "excerpt")) if not getattr(article, field).strip()]
    if missing:
        raise HTTPException(status_code=422, detail="Add an " + " and ".join(missing) + " before publishing.")
    article.status = "published"
    article.published_at = article.published_at or utcnow()
    activity.record(db, owner, "publish", "article", f"Published article {article.title}", article.id)
    db.flush()
    return _article_out(article)


@router.post("/articles/{item_id}/unpublish")
def unpublish_article(item_id: int, owner: OwnerContext = Depends(require_owner), db: Session = Depends(get_db)):
    article = get_or_404(db, Article, item_id, "Article")
    article.status = "draft"
    activity.record(db, owner, "unpublish", "article", f"Unpublished article {article.title}", article.id)
    db.flush()
    return _article_out(article)


@router.delete("/articles/{item_id}", status_code=204)
def delete_article(item_id: int, owner: OwnerContext = Depends(require_owner), db: Session = Depends(get_db)):
    article = get_or_404(db, Article, item_id, "Article")
    activity.record(db, owner, "delete", "article", f"Deleted article {article.title}", article.id)
    db.delete(article)
