"""Engine, session factory and the request-scoped transaction boundary.

- The engine is created lazily per application, from that application's settings, so tests
  can point an app at any database without global state.
- ``get_session`` gives each request one session and rolls back on any exception.
  Endpoints that write commit explicitly before returning, because dependency teardown may
  run after the response is sent; the teardown commit only covers read-only paths.
  Services never commit.
- Schema changes happen only through Alembic migrations, never ``create_all()``.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool

from app.core.config import Settings
from app.core.errors import AppError


class Database:
    def __init__(self, settings: Settings) -> None:
        self._url = settings.database_url
        self._engine: Engine | None = None
        self._readiness_engine: Engine | None = None
        self._factory: sessionmaker[Session] | None = None

    @property
    def configured(self) -> bool:
        return self._url is not None

    def _url_or_unavailable(self) -> str:
        if self._url is None:
            raise AppError(
                503,
                "service_unavailable",
                "The service is temporarily unavailable. Please try again later.",
            )
        return self._url.get_secret_value()

    @property
    def engine(self) -> Engine:
        url = self._url_or_unavailable()
        if self._engine is None:
            self._engine = create_engine(
                url,
                pool_pre_ping=True,  # survive pooler restarts and idle disconnects
                pool_size=5,
                max_overflow=5,
                pool_timeout=10,
                connect_args={"connect_timeout": 5},
            )
        return self._engine

    @property
    def readiness_engine(self) -> Engine:
        """A separate, pool-less engine for readiness checks.

        It never queues behind the application's pool (so a busy pool is not reported as an
        outage after a 10 s checkout wait) and never takes connections from request handlers.
        The readiness cache allows at most one check per process at a time, so this opens at
        most one short-lived connection per cache period.
        """
        url = self._url_or_unavailable()
        if self._readiness_engine is None:
            self._readiness_engine = create_engine(
                url,
                poolclass=NullPool,
                connect_args={"connect_timeout": 3},
            )
        return self._readiness_engine

    def session(self) -> Session:
        if self._factory is None:
            self._factory = sessionmaker(self.engine, expire_on_commit=False)
        return self._factory()

    def dispose(self) -> None:
        if self._engine is not None:
            self._engine.dispose()
            self._engine = None
            self._factory = None
        if self._readiness_engine is not None:
            self._readiness_engine.dispose()
            self._readiness_engine = None


def get_session(request: Request) -> Iterator[Session]:
    database: Database = request.app.state.database
    session = database.session()
    try:
        yield session
        session.commit()
    except BaseException:
        session.rollback()
        raise
    finally:
        session.close()


DbSession = Annotated[Session, Depends(get_session)]
