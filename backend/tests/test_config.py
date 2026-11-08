from __future__ import annotations

from typing import Any

import pytest
from pydantic import ValidationError

from app.core.config import Environment, StorageBackend, normalise_database_url
from tests.conftest import SettingsFactory

FAKE_SECRET = "service-role-placeholder-not-real"

SAFE_PRODUCTION: dict[str, Any] = {
    "environment": Environment.PRODUCTION,
    "database_url": "postgresql://user:pw@db.example.com:5432/postgres",
    "cors_origins": "https://goslish.vercel.app",
    "public_site_url": "https://goslish.vercel.app",
    "cookie_secure": True,
    "storage_backend": StorageBackend.SUPABASE,
    "supabase_url": "https://project.supabase.co",
    "supabase_service_key": FAKE_SECRET,
}


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("postgres://u:p@h:5432/d", "postgresql+psycopg://u:p@h:5432/d"),
        ("postgresql://u:p@h:5432/d", "postgresql+psycopg://u:p@h:5432/d"),
        ("postgresql+psycopg://u:p@h/d", "postgresql+psycopg://u:p@h/d"),
    ],
)
def test_database_url_gets_explicit_driver(raw: str, expected: str) -> None:
    assert normalise_database_url(raw) == expected


def test_cors_origins_parse_from_comma_separated_env(make_settings: SettingsFactory) -> None:
    settings = make_settings(cors_origins=" https://a.example/, https://b.example ,, ")
    assert settings.cors_origins == ["https://a.example", "https://b.example"]


def test_blank_secrets_are_treated_as_missing(make_settings: SettingsFactory) -> None:
    settings = make_settings(supabase_service_key="  ", resend_api_key="")
    assert settings.supabase_service_key is None
    assert settings.resend_api_key is None
    assert settings.email_configured is False


def test_secrets_never_appear_in_repr(make_settings: SettingsFactory) -> None:
    settings = make_settings(**SAFE_PRODUCTION)
    rendered = repr(settings) + str(settings.model_dump())
    assert FAKE_SECRET not in rendered
    assert "pw@" not in rendered


def test_safe_production_configuration_is_accepted(make_settings: SettingsFactory) -> None:
    settings = make_settings(**SAFE_PRODUCTION)
    assert settings.is_production
    assert settings.api_docs_enabled is False


@pytest.mark.parametrize(
    ("override", "message"),
    [
        ({"database_url": None}, "DATABASE_URL is required"),
        ({"database_url": "sqlite:///x.db"}, "must be a PostgreSQL URL"),
        ({"cookie_secure": False}, "COOKIE_SECURE must be true"),
        ({"cors_origins": ""}, "CORS_ORIGINS must list"),
        ({"cors_origins": "*"}, "explicit https:// origin"),
        ({"cors_origins": "http://goslish.vercel.app"}, "explicit https:// origin"),
        ({"public_site_url": "http://goslish.vercel.app"}, "PUBLIC_SITE_URL must use https"),
        ({"storage_backend": StorageBackend.LOCAL}, "not durable on Render"),
        ({"supabase_service_key": None}, "SUPABASE_SERVICE_KEY are required"),
    ],
)
def test_unsafe_production_configuration_is_refused(
    make_settings: SettingsFactory, override: dict[str, Any], message: str
) -> None:
    with pytest.raises(ValidationError, match=message):
        make_settings(**{**SAFE_PRODUCTION, **override})


def test_refusal_message_never_contains_secret_values(make_settings: SettingsFactory) -> None:
    with pytest.raises(ValidationError) as caught:
        make_settings(**{**SAFE_PRODUCTION, "cookie_secure": False})
    assert FAKE_SECRET not in str(caught.value)
    assert "pw@" not in str(caught.value)


def test_development_tolerates_local_defaults(make_settings: SettingsFactory) -> None:
    settings = make_settings(environment=Environment.DEVELOPMENT, cookie_secure=False)
    assert settings.storage_backend is StorageBackend.LOCAL
    assert settings.api_docs_enabled is True


@pytest.mark.parametrize("hours", [0, 73])
def test_session_ttl_is_bounded(make_settings: SettingsFactory, hours: int) -> None:
    with pytest.raises(ValidationError):
        make_settings(session_ttl_hours=hours)
