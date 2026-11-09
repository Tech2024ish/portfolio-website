"""Application factory.

``create_app()`` builds a fresh app from explicit settings, so tests never share global
state. ``app`` is the module-level instance that uvicorn serves.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.health import router as health_router
from app.api.v1.router import api_router
from app.core.config import Settings, get_settings


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    docs = settings.api_docs_enabled

    application = FastAPI(
        title="Portfolio API",
        version=__version__,
        openapi_url="/api/v1/openapi.json" if docs else None,
        docs_url="/api/v1/docs" if docs else None,
        redoc_url=None,
    )
    application.state.settings = settings

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
