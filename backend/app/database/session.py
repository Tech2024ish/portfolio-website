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

from app.core.config import Settings
from app.core.errors import AppError


class Database:
    def __init__(self, settings: Settings) -> None:
        self._url = settings.database_url
        self._engine: Engine | None = None
        self._factory: sessionmaker[Session] | None = None

    @property
    def configured(self) -> bool:
        return self._url is not None

    @property
    def engine(self) -> Engine:
        if self._url is None:
            raise AppError(
                503,
                "service_unavailable",
                "The service is temporarily unavailable. Please try again later.",
            )
        if self._engine is None:
            self._engine = create_engine(
                self._url.get_secret_value(),
                pool_pre_ping=True,  # survive pooler restarts and idle disconnects
                pool_size=5,
                max_overflow=5,
                pool_timeout=10,
                connect_args={"connect_timeout": 5},
            )
        return self._engine

    def session(self) -> Session:
        if self._factory is None:
            self._factory = sessionmaker(self.engine, expire_on_commit=False)
        return self._factory()

    def dispose(self) -> None:
        if self._engine is not None:
            self._engine.dispose()
            self._engine = None
            self._factory = None


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
