from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from core.config import get_settings
from core.db import get_db
from models.entities import ActivityLog, Article, ContactMessage, Project
from routers.v1.common import row_out
from services.auth import OwnerContext, require_owner

router = APIRouter(prefix="/admin", tags=["admin"])


def _visit_count() -> int | None:
    """Real visit counter from the existing /api/visits store, or None if unavailable."""
    try:
        from routers.visits import _supabase_count

        return _supabase_count()
    except Exception:
        return None


def _counts(db: Session, model, column) -> dict[str, int]:
    return {status: count for status, count in db.execute(select(column, func.count()).select_from(model).group_by(column))}


def build_overview(db: Session) -> dict:
    projects = _counts(db, Project, Project.status)
    articles = _counts(db, Article, Article.status)
    unread = db.scalar(select(func.count()).where(ContactMessage.is_read.is_(False), ContactMessage.archived_at.is_(None)))
    recent_messages = db.scalars(
        select(ContactMessage).where(ContactMessage.archived_at.is_(None)).order_by(ContactMessage.created_at.desc()).limit(5)
    )
    activity = db.scalars(select(ActivityLog).order_by(ActivityLog.created_at.desc(), ActivityLog.id.desc()).limit(8))
    return {
        "projects": {"published": projects.get("published", 0), "draft": projects.get("draft", 0)},
        "articles": {"published": articles.get("published", 0), "draft": articles.get("draft", 0)},
        "messages": {"unread": unread},
        "recent_messages": [row_out(m) for m in recent_messages],
        "recent_activity": [row_out(a) for a in activity],
        "visits": {"total": _visit_count(), "source": "Site visit counter (counts page loads, not unique visitors)"},
    }


def system_status() -> dict:
    settings = get_settings()
    return {
        "environment": settings.environment,
        "email": {"configured": settings.email_configured, "provider": "Resend" if settings.email_configured else None},
        "storage": {"backend": settings.storage_backend},
        "session_ttl_hours": settings.session_ttl_hours,
    }


def list_activity(db: Session, limit: int) -> list[dict]:
    limit = min(max(limit, 1), 200)
    return [row_out(a) for a in db.scalars(select(ActivityLog).order_by(ActivityLog.created_at.desc(), ActivityLog.id.desc()).limit(limit))]


# ------------------------------------------------------------------ routes (all owner-only)


@router.get("/overview")
def overview(_: OwnerContext = Depends(require_owner), db: Session = Depends(get_db)):
    return build_overview(db)


@router.get("/activity")
def activity_history(limit: int = 50, _: OwnerContext = Depends(require_owner), db: Session = Depends(get_db)):
    return list_activity(db, limit)


@router.get("/system")
def system(_: OwnerContext = Depends(require_owner)):
    return system_status()
