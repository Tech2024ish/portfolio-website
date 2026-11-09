"""SQLAlchemy engine and request-scoped sessions.

The engine is created lazily so the legacy /api routes keep working on a
deployment that has not configured DATABASE_URL yet; v1 routes answer 503.
"""

from __future__ import annotations

from collections.abc import Iterator

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from core.config import get_settings


class Base(DeclarativeBase):
    pass


_engine: Engine | None = None
_session_factory: sessionmaker[Session] | None = None


def configure_engine(url: str) -> Engine:
    """(Re)configure the engine. Used at startup and by tests."""
    global _engine, _session_factory
    kwargs: dict = {"pool_pre_ping": True}
    if url.startswith("sqlite"):
        kwargs = {"connect_args": {"check_same_thread": False}}
    else:
        # Supabase's pooler closes idle connections; keep the pool small and fresh.
        kwargs.update(pool_size=5, max_overflow=5, pool_recycle=300)
    _engine = create_engine(url, **kwargs)
    _session_factory = sessionmaker(bind=_engine, expire_on_commit=False, autoflush=False)
    return _engine


def get_engine() -> Engine | None:
    if _engine is None:
        url = get_settings().database_url
        if url:
            configure_engine(url)
    return _engine


def get_db() -> Iterator[Session]:
    """One transaction per request: commit on success, roll back on any error."""
    if get_engine() is None or _session_factory is None:
        raise HTTPException(status_code=503, detail="Content database is not configured.")
    session = _session_factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
