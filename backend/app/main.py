"""Application factory.

``create_app()`` builds a fresh app from explicit settings, so tests never share global
state. ``app`` is the module-level instance that uvicorn serves.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.health import router as health_router
from app.api.v1.endpoints import contact
from app.api.v1.router import api_router
from app.core.body_limit import BodySizeLimitMiddleware
from app.core.config import Settings, get_settings
from app.core.errors import install_error_handlers
from app.database.readiness import ReadinessCache
from app.database.session import Database


@asynccontextmanager
async def _lifespan(application: FastAPI) -> AsyncIterator[None]:
    yield
    application.state.database.dispose()  # close pooled connections on shutdown


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    docs = settings.api_docs_enabled

    application = FastAPI(
        title="Portfolio API",
        version=__version__,
        openapi_url="/api/v1/openapi.json" if docs else None,
        docs_url="/api/v1/docs" if docs else None,
        redoc_url=None,
        lifespan=_lifespan,
    )
    application.state.settings = settings
    application.state.database = Database(settings)
    application.state.readiness_cache = ReadinessCache()
    install_error_handlers(application)

    # Added before CORS so CORS stays outermost and 413 responses still carry CORS headers.
    application.add_middleware(
        BodySizeLimitMiddleware,
        limits={("POST", "/api/v1/contact"): contact.MAX_BODY_BYTES},
    )
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Content-Type", "X-CSRF-Token", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
        max_age=600,
    )

    application.include_router(health_router)
    application.include_router(api_router)
    return application


app = create_app()
