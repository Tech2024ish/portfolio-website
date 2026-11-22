"""French and Kinyarwanda content: validation, the public API in each language, the Studio round
trip and adding translations to existing content, against real PostgreSQL."""

from __future__ import annotations

import json
from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.cli.content import DEFAULT_FILE, add_translations, import_content
from app.core.config import Settings
from app.database.session import Database
from app.models.content import Profile, Project
from app.schemas.content import ProjectFields
from tests.conftest import csrf_headers, signed_in

PROJECT = {
    "slug": "demo-api",
    "title": "Demo API",
    "category": "Backend API",
    "summary": "A demonstration API used only by these tests.",
    "tech": ["Python"],
}
FR = {"category": "API backend", "summary": "Une API de démonstration utilisée par ces tests."}


# ------------------------------------------------------------------ validation (no database)


def test_translations_are_checked_with_the_english_field_rules() -> None:
    ok = ProjectFields.model_validate(
        {**PROJECT, "translations": {"fr": FR, "rw": {"summary": " "}}}
    )
    assert ok.translations == {"fr": FR}  # blank values mean "show the English": dropped

    with pytest.raises(ValidationError, match="French “summary”"):
        ProjectFields.model_validate({**PROJECT, "translations": {"fr": {"summary": "short"}}})
    with pytest.raises(ValidationError, match="cannot be translated"):
        ProjectFields.model_validate({**PROJECT, "translations": {"fr": {"slug": "demo-fr"}}})
    with pytest.raises(ValidationError):
        ProjectFields.model_validate(
            {**PROJECT, "translations": {"de": {"summary": FR["summary"]}}}
        )


# ------------------------------------------------------------------ Studio and public API

pytestmark_db = pytest.mark.postgres


@pytest.fixture
def studio(make_api: Callable[..., TestClient], owner: int) -> tuple[TestClient, dict[str, str]]:
    client = make_api()
    return client, csrf_headers(signed_in(client))


@pytest.fixture
def seeded(make_auth_settings: Callable[..., Settings]) -> None:
    database = Database(make_auth_settings())
    with database.session() as db, db.begin():
        import_content(db, json.loads(DEFAULT_FILE.read_text(encoding="utf-8")))
    database.dispose()


@pytestmark_db
def test_the_public_api_answers_in_the_requested_language_with_english_fallback(
    studio: tuple[TestClient, dict[str, str]], seeded: None
) -> None:
    client, headers = studio
    created = client.post(
        "/api/v1/owner/projects",
        json={**PROJECT, "translations": {"fr": {"summary": FR["summary"]}}},
        headers=headers,
    ).json()
    assert created["translations"] == {"fr": {"summary": FR["summary"]}}
    client.post(f"/api/v1/owner/projects/{created['id']}/publish", headers=headers)

    english = client.get("/api/v1/public/projects/demo-api").json()
    french = client.get("/api/v1/public/projects/demo-api?lang=fr").json()
    kinyarwanda = client.get("/api/v1/public/projects/demo-api?lang=rw").json()
    assert english["summary"] == PROJECT["summary"]
    assert french["summary"] == FR["summary"]
    assert french["category"] == PROJECT["category"]  # not translated: English, field by field
    assert kinyarwanda["summary"] == PROJECT["summary"]  # no Kinyarwanda yet: English
    assert "translations" not in french
    assert client.get("/api/v1/public/projects/demo-api?lang=de").status_code == 422


@pytestmark_db
def test_the_portfolio_is_translated_everywhere_the_site_shows_text(
    studio: tuple[TestClient, dict[str, str]], seeded: None
) -> None:
    client, headers = studio
    profile = client.get("/api/v1/owner/profile").json()
    update = {k: v for k, v in profile.items() if k not in ("updated_at",)}
    update["translations"] = {"fr": {"headline": "Construire des systèmes backend fiables."}}
    saved = client.put("/api/v1/owner/profile", json=update, headers=headers)
    assert saved.status_code == 200, saved.text

    settings = client.get("/api/v1/owner/settings").json()
    settings_update = {k: v for k, v in settings.items() if k != "updated_at"}
    settings_update["translations"] = {"rw": {"seo_title": "Jean Claude Ishimwe — Injeniyeri"}}
    assert (
        client.put("/api/v1/owner/settings", json=settings_update, headers=headers).status_code
        == 200
    )

    groups = client.get("/api/v1/owner/skill-categories").json()
    first = groups[0]
    renamed = {
        "name": first["name"],
        "version": first["version"],
        "translations": {"fr": {"name": "Langages de programmation"}},
    }
    assert (
        client.put(
            f"/api/v1/owner/skill-categories/{first['id']}", json=renamed, headers=headers
        ).status_code
        == 200
    )

    fr = client.get("/api/v1/public/portfolio?lang=fr").json()
    rw = client.get("/api/v1/public/portfolio?lang=rw").json()
    en = client.get("/api/v1/public/portfolio").json()
    assert fr["profile"]["headline"] == "Construire des systèmes backend fiables."
    assert en["profile"]["headline"] == profile["headline"]
    assert fr["profile"]["translations"] == {}  # the visitor gets one language, not all of them
    assert fr["skill_groups"][0]["name"] == "Langages de programmation"
    assert fr["skill_groups"][0]["skills"] == en["skill_groups"][0]["skills"]  # technologies
    assert rw["settings"]["seo_title"] == "Jean Claude Ishimwe — Injeniyeri"
    assert rw["settings"]["translations"] == {}


@pytestmark_db
def test_invalid_translations_are_refused_by_the_studio_api(
    studio: tuple[TestClient, dict[str, str]],
) -> None:
    client, headers = studio
    response = client.post(
        "/api/v1/owner/projects",
        json={**PROJECT, "translations": {"fr": {"summary": "short"}}},
        headers=headers,
    )
    assert response.status_code == 422
    assert "French" in response.text


# ------------------------------------------------------------------ existing content


@pytestmark_db
def test_translations_are_added_to_existing_content_without_overwriting(
    make_auth_settings: Callable[..., Settings], seeded: None
) -> None:
    data: dict[str, Any] = json.loads(DEFAULT_FILE.read_text(encoding="utf-8"))
    # The content was imported before translations existed.
    database = Database(make_auth_settings())
    with database.session() as db, db.begin():
        for row in db.query(Project).all():
            row.translations = {}
        profile = db.get(Profile, 1)
        assert profile is not None
        profile.translations = {"fr": {"headline": "Titre choisi dans le Studio."}}

    slug = next(p["slug"] for p in data["projects"] if p.get("translations"))
    with database.session() as db, db.begin():
        dry = add_translations(db, data, apply=False)
        db.rollback()
    assert any(slug in line and "to add" in line for line in dry)
    with database.session() as db:
        project = db.query(Project).filter_by(slug=slug).one()
        assert project.translations == {}  # a dry run writes nothing

    with database.session() as db, db.begin():
        add_translations(db, data, apply=True)
    with database.session() as db:
        project = db.query(Project).filter_by(slug=slug).one()
        assert project.translations.get("fr")
        profile = db.get(Profile, 1)
        assert profile is not None
        assert profile.translations["fr"]["headline"] == "Titre choisi dans le Studio."  # kept
        assert "summary" in profile.translations["fr"]

    with database.session() as db, db.begin():
        again = add_translations(db, data, apply=True)
    assert all("nothing to add" in line or "skipped" in line for line in again)
    database.dispose()
