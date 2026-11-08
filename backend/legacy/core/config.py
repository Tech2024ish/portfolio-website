"""Centralised, environment-driven configuration for the v1 API.

Nothing secret has a default. Production refuses unsafe combinations at startup
instead of silently running with development behaviour.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


def _bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _list(name: str, default: str) -> list[str]:
    return [item.strip() for item in os.getenv(name, default).split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    environment: str = "development"
    database_url: str | None = None
    cors_origins: list[str] = field(default_factory=list)
    public_site_url: str = "https://goslish.vercel.app"

    session_cookie_name: str = "pf_session"
    session_ttl_hours: int = 12
    cookie_secure: bool = True

    storage_backend: str = "local"  # "supabase" or "local"
    supabase_url: str | None = None
    supabase_service_key: str | None = None
    media_bucket: str = "media"
    local_media_dir: str = "media_uploads"
    max_image_mb: int = 8
    max_document_mb: int = 10

    resend_api_key: str | None = None
    mail_from: str | None = None
    mail_reply_to: str | None = None

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def email_configured(self) -> bool:
        return bool(self.resend_api_key and self.mail_from)

    def validate(self) -> None:
        if not self.is_production:
            return
        problems = []
        if not self.cookie_secure:
            problems.append("COOKIE_SECURE must be true in production")
        if any(origin == "*" for origin in self.cors_origins):
            problems.append("CORS_ORIGINS must not contain a wildcard in production")
        if self.storage_backend == "local":
            problems.append("STORAGE_BACKEND=local is not durable on hosted platforms; use supabase")
        if self.storage_backend == "supabase" and not (self.supabase_url and self.supabase_service_key):
            problems.append("SUPABASE_URL and SUPABASE_SERVICE_KEY are required for supabase storage")
        if self.database_url and self.database_url.startswith("sqlite"):
            problems.append("SQLite is not supported in production")
        if problems:
            raise RuntimeError("Unsafe production configuration: " + "; ".join(problems))


def _normalise_db_url(url: str | None) -> str | None:
    if not url:
        return None
    # Supabase/Render hand out postgres:// URLs; SQLAlchemy needs an explicit driver.
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


@lru_cache
def get_settings() -> Settings:
    environment = os.getenv("ENVIRONMENT", "development").strip().lower()
    settings = Settings(
        environment=environment,
        database_url=_normalise_db_url(os.getenv("DATABASE_URL")),
        cors_origins=_list(
            "CORS_ORIGINS",
            "https://goslish.vercel.app,http://localhost:5173,http://127.0.0.1:5173",
        ),
        public_site_url=os.getenv("PUBLIC_SITE_URL", "https://goslish.vercel.app").rstrip("/"),
        session_ttl_hours=int(os.getenv("SESSION_TTL_HOURS", "12")),
        cookie_secure=_bool("COOKIE_SECURE", environment == "production"),
        storage_backend=os.getenv("STORAGE_BACKEND", "local").strip().lower(),
        supabase_url=(os.getenv("SUPABASE_URL") or "").rstrip("/") or None,
        supabase_service_key=os.getenv("SUPABASE_SERVICE_KEY") or None,
        media_bucket=os.getenv("MEDIA_BUCKET", "media"),
        local_media_dir=os.getenv("LOCAL_MEDIA_DIR", "media_uploads"),
        max_image_mb=int(os.getenv("MAX_IMAGE_MB", "8")),
        max_document_mb=int(os.getenv("MAX_DOCUMENT_MB", "10")),
        resend_api_key=os.getenv("RESEND_API_KEY") or None,
        mail_from=os.getenv("MAIL_FROM") or None,
        mail_reply_to=os.getenv("MAIL_REPLY_TO") or None,
    )
    settings.validate()
    return settings
