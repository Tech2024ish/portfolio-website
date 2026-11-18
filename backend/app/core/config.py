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
    # No file storage. The default: nothing in the API stores files yet, so production must
    # not be forced to hold storage credentials it does not use.
    DISABLED = "disabled"
    LOCAL = "local"  # development only; not durable on Render
    SUPABASE = "supabase"


class MailProvider(StrEnum):
    DISABLED = "disabled"  # messages are stored; nothing is sent (deliveries are "skipped")
    RESEND = "resend"  # production
    SMTP = (
        "smtp"  # controlled testing only (e.g. Gmail with an app password); refused in production
    )


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

    # Number of reverse proxies in front of the API that append to X-Forwarded-For
    # (for example Vercel's rewrite + Render's router). 0 trusts no forwarded header and uses
    # the TCP peer address. Never set it higher than the real proxy count: the header is
    # otherwise client-controlled and rate limits could be bypassed by spoofing it.
    trusted_proxy_count: int = Field(default=0, ge=0, le=5)
    # Sent by the site's proxy. When set, X-Forwarded-For is used only on requests carrying it, so
    # a caller reaching the API's own URL directly cannot choose its address.
    trusted_proxy_secret: SecretStr | None = None

    # ---- public contact form
    contact_rate_limit: int = Field(default=5, ge=1, le=100)
    contact_rate_window_minutes: int = Field(default=60, ge=1, le=24 * 60)

    # ---- owner sessions
    session_ttl_hours: int = Field(default=12, ge=1, le=72)
    session_idle_minutes: int = Field(default=120, ge=5, le=24 * 60)
    cookie_secure: bool = True

    # ---- owner sign-in throttling (brute-force protection)
    # Every attempt from one client address counts toward the address limit; only failed
    # attempts count toward the account limit, so the owner is never locked out by signing in.
    login_ip_attempts: int = Field(default=10, ge=1, le=1000)
    login_ip_window_minutes: int = Field(default=15, ge=1, le=24 * 60)
    login_account_failures: int = Field(default=10, ge=1, le=1000)
    login_account_window_minutes: int = Field(default=60, ge=1, le=24 * 60)

    # ---- public-site cache invalidation (Next.js /api/revalidate)
    # When set, content changes ask the public site to refresh its cached pages. Requests are
    # signed with REVALIDATE_SIGNING_SECRET, which the frontend shares (server-side only).
    revalidate_url: str | None = None
    revalidate_signing_secret: SecretStr | None = None

    # ---- file storage
    storage_backend: StorageBackend = StorageBackend.DISABLED
    supabase_url: str | None = None
    supabase_service_key: SecretStr | None = None
    media_bucket: str = "media"
    local_media_dir: str = "media_uploads"
    max_image_mb: int = Field(default=8, ge=1, le=50)
    max_document_mb: int = Field(default=10, ge=1, le=50)

    # ---- email: new-message notifications to the owner and replies to visitors
    mail_provider: MailProvider = MailProvider.DISABLED
    mail_from: str | None = None  # e.g. "Jean Claude Ishimwe <hello@your-domain.com>"
    mail_reply_to: str | None = None  # where visitors' answers to replies go
    contact_notify_email: str | None = None  # the owner's inbox for new-message notifications
    resend_api_key: SecretStr | None = None
    smtp_host: str | None = None
    smtp_port: int = Field(default=587, ge=1, le=65535)
    smtp_username: str | None = None
    smtp_password: SecretStr | None = None
    mail_max_attempts: int = Field(default=5, ge=1, le=10)
    # Identical messages (same email, subject and text) within this window are accepted once.
    contact_duplicate_window_minutes: int = Field(default=10, ge=1, le=24 * 60)

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

    @field_validator(
        "supabase_service_key",
        "resend_api_key",
        "smtp_password",
        "revalidate_signing_secret",
        "trusted_proxy_secret",
        mode="before",
    )
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
        # Storage is validated only when it is enabled. DISABLED needs no credentials; the
        # feature that first stores files must require an enabled backend where it is used.
        if self.storage_backend is StorageBackend.LOCAL:
            problems.append("STORAGE_BACKEND=local is not durable on Render; use supabase")
        if self.storage_backend is StorageBackend.SUPABASE and not (
            self.supabase_url and self.supabase_service_key
        ):
            problems.append(
                "SUPABASE_URL and SUPABASE_SERVICE_KEY are required for supabase storage"
            )
        if self.revalidate_url:
            if not self.revalidate_url.startswith("https://"):
                problems.append("REVALIDATE_URL must use https://")
            secret = self.revalidate_signing_secret
            if secret is None or len(secret.get_secret_value()) < 32:
                problems.append("REVALIDATE_SIGNING_SECRET of at least 32 characters is required")
        proxy_secret = self.trusted_proxy_secret
        if proxy_secret is not None and len(proxy_secret.get_secret_value()) < 32:
            problems.append("TRUSTED_PROXY_SECRET must have at least 32 characters")
        if self.mail_provider is MailProvider.SMTP:
            problems.append("MAIL_PROVIDER=smtp is for controlled testing only; use resend")
        if self.mail_provider is MailProvider.RESEND and not (
            self.resend_api_key and self.mail_from and self.contact_notify_email
        ):
            problems.append(
                "RESEND_API_KEY, MAIL_FROM and CONTACT_NOTIFY_EMAIL are required for resend"
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
        """Whether email can be sent at all (a provider with its credentials and a sender)."""
        if not self.mail_from:
            return False
        if self.mail_provider is MailProvider.RESEND:
            return self.resend_api_key is not None
        if self.mail_provider is MailProvider.SMTP:
            return bool(self.smtp_host and self.smtp_username and self.smtp_password)
        return False

    @property
    def session_cookie_name(self) -> str:
        # The __Host- prefix makes browsers refuse the cookie unless it is Secure, has Path=/
        # and no Domain, so no subdomain or plain-HTTP page can set or overwrite it. Browsers
        # also refuse a __Host- cookie without Secure, so local HTTP development uses a plain name.
        return "__Host-owner_session" if self.cookie_secure else "owner_session"

    @property
    def allowed_origins(self) -> frozenset[str]:
        """Origins allowed to send state-changing owner requests (the site itself and CORS)."""
        return frozenset({self.public_site_url, *self.cors_origins})


@lru_cache
def get_settings() -> Settings:
    return Settings()
