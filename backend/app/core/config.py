"""Typed, validated, environment-driven settings.

Rules:
- Nothing secret has a default.
- Secrets are ``SecretStr`` so they never appear in ``repr()``, logs or tracebacks.
- Production refuses unsafe combinations at startup instead of silently running
  with development behaviour.

Variable names match the V2 deployment so existing Render configuration carries over.
"""

from __future__ import annotations

from enum import StrEnum
from functools import lru_cache
from typing import Annotated, Literal, Self

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Environment(StrEnum):
    DEVELOPMENT = "development"
    TEST = "test"
    PRODUCTION = "production"


class StorageBackend(StrEnum):
    LOCAL = "local"
    SUPABASE = "supabase"


def normalise_database_url(url: str) -> str:
    """Supabase and Render hand out ``postgres://`` URLs; SQLAlchemy needs an explicit driver."""
    if url.startswith("postgres://"):
        url = "postgresql://" + url.removeprefix("postgres://")
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url.removeprefix("postgresql://")
    return url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",  # the shared .env also carries legacy V2 keys
        case_sensitive=False,
        frozen=True,
    )

    # ---- runtime
    environment: Environment = Environment.DEVELOPMENT
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    enable_api_docs: bool | None = None  # default: on outside production

    # ---- database
    database_url: SecretStr | None = None

    # ---- HTTP boundary
    cors_origins: Annotated[list[str], NoDecode] = Field(default_factory=list)
    public_site_url: str = "http://localhost:3000"

    # ---- owner sessions
    session_ttl_hours: int = Field(default=12, ge=1, le=72)
    session_idle_minutes: int = Field(default=120, ge=5, le=24 * 60)
    cookie_secure: bool = True

    # ---- file storage
    storage_backend: StorageBackend = StorageBackend.LOCAL
    supabase_url: str | None = None
    supabase_service_key: SecretStr | None = None
    media_bucket: str = "media"
    local_media_dir: str = "media_uploads"
    max_image_mb: int = Field(default=8, ge=1, le=50)
    max_document_mb: int = Field(default=10, ge=1, le=50)

    # ---- email (provider-agnostic; Resend adapter first)
    resend_api_key: SecretStr | None = None
    mail_from: str | None = None
    mail_reply_to: str | None = None

    # ------------------------------------------------------------------ parsing

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip().rstrip("/") for item in value.split(",") if item.strip()]
        return value

    @field_validator("public_site_url", "supabase_url")
    @classmethod
    def _strip_trailing_slash(cls, value: str | None) -> str | None:
        return value.rstrip("/") if value else value

    @field_validator("database_url", mode="before")
    @classmethod
    def _normalise_db(cls, value: object) -> object:
        if isinstance(value, str):
            return normalise_database_url(value.strip()) if value.strip() else None
        return value

    @field_validator("supabase_service_key", "resend_api_key", mode="before")
    @classmethod
    def _blank_secret_is_none(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return None
        return value

    # ------------------------------------------------------------------ safety

    @model_validator(mode="after")
    def _refuse_unsafe_production(self) -> Self:
        if self.environment is not Environment.PRODUCTION:
            return self
        problems: list[str] = []
        db = self.database_url.get_secret_value() if self.database_url else ""
        if not db:
            problems.append("DATABASE_URL is required")
        elif not db.startswith("postgresql+psycopg://"):
            problems.append("DATABASE_URL must be a PostgreSQL URL")
        if not self.cookie_secure:
            problems.append("COOKIE_SECURE must be true")
        if not self.cors_origins:
            problems.append("CORS_ORIGINS must list the frontend origin(s)")
        for origin in self.cors_origins:
            if origin == "*" or not origin.startswith("https://"):
                problems.append(f"CORS origin {origin!r} must be an explicit https:// origin")
        if not self.public_site_url.startswith("https://"):
            problems.append("PUBLIC_SITE_URL must use https://")
        if self.storage_backend is StorageBackend.LOCAL:
            problems.append("STORAGE_BACKEND=local is not durable on Render; use supabase")
        if self.storage_backend is StorageBackend.SUPABASE and not (
            self.supabase_url and self.supabase_service_key
        ):
            problems.append(
                "SUPABASE_URL and SUPABASE_SERVICE_KEY are required for supabase storage"
            )
        if problems:
            # Messages name variables only, never their values.
            raise ValueError("Unsafe production configuration: " + "; ".join(problems))
        return self

    # ------------------------------------------------------------------ helpers

    @property
    def is_production(self) -> bool:
        return self.environment is Environment.PRODUCTION

    @property
    def api_docs_enabled(self) -> bool:
        if self.enable_api_docs is not None:
            return self.enable_api_docs
        return not self.is_production

    @property
    def email_configured(self) -> bool:
        return bool(self.resend_api_key and self.mail_from)


@lru_cache
def get_settings() -> Settings:
    return Settings()
