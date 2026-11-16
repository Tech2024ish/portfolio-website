"""Content management (owner) and the public content API, against real PostgreSQL."""

from __future__ import annotations

import hashlib
import hmac
import json
from collections.abc import Callable
from datetime import date
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.cli.content import DEFAULT_FILE, ImportFileError, import_content
from app.core.config import Settings
from app.database.session import Database
from app.integrations import revalidate
from tests.conftest import ORIGIN, csrf_headers, signed_in

pytestmark = pytest.mark.postgres

Query = Callable[..., list[tuple[Any, ...]]]

PROJECT = {
    "slug": "demo-api",
    "title": "Demo API",
    "category": "Backend API",
    "summary": "A demonstration API used only by these tests.",
    "tech": ["Python", "", "FastAPI"],
    "repo_url": "https://github.com/example/demo",
}


@pytest.fixture
def studio(make_api: Callable[..., TestClient], owner: int) -> tuple[TestClient, dict[str, str]]:
    """A signed-in owner client and the headers its state changes need."""
    client = make_api()
    return client, csrf_headers(signed_in(client))


@pytest.fixture
def seeded(make_auth_settings: Callable[..., Settings]) -> None:
    """The verified content, imported exactly as an operator would."""
    database = Database(make_auth_settings())
    with database.session() as db, db.begin():
        import_content(db, json.loads(DEFAULT_FILE.read_text(encoding="utf-8")))
    database.dispose()


def create_project(client: TestClient, headers: dict[str, str], **overrides: Any) -> dict[str, Any]:
    response = client.post("/api/v1/owner/projects", json={**PROJECT, **overrides}, headers=headers)
    assert response.status_code == 201, response.text
    return dict(response.json())


# ------------------------------------------------------------------ public API


def test_the_public_portfolio_is_404_before_any_content_exists(api: TestClient) -> None:
    response = api.get("/api/v1/public/portfolio")
    assert response.status_code == 404


def test_the_public_portfolio_shows_only_published_content(api: TestClient, seeded: None) -> None:
    response = api.get("/api/v1/public/portfolio")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "public, max-age=60"
    body = response.json()
    assert body["profile"]["name"] == "Jean Claude Ishimwe"
    assert [project["slug"] for project in body["projects"]] == ["mosaic", "buzhub-platform"]
    assert [job["organization"] for job in body["experience"]] == [
        "SilverLandTech"
    ]  # Techinika is a draft
    assert [cert["name"] for cert in body["certifications"]] == [
        "Python programming",
        "Data Structures and Algorithms",
    ]
    assert len(body["skill_groups"]) == 6
    mosaic, buzhub = body["projects"]
    assert mosaic["case_study"]["decisions"][0]["title"] == "Tenant-scoped data access"
    assert buzhub["case_study"] is None  # no published case study
    assert body["articles"] == []


def test_unpublished_and_unknown_slugs_answer_the_same_404(api: TestClient, seeded: None) -> None:
    published = api.get("/api/v1/public/projects/mosaic")
    assert published.status_code == 200
    draft = api.get("/api/v1/public/projects/school-management-system")
    unknown = api.get("/api/v1/public/projects/no-such-project")
    assert draft.status_code == unknown.status_code == 404
    assert draft.json() == unknown.json()


# ------------------------------------------------------------------ the publishing lifecycle


def test_a_project_is_public_only_while_published(
    studio: tuple[TestClient, dict[str, str]],
) -> None:
    client, headers = studio
    project = create_project(client, headers)
    assert project["status"] == "draft" and project["published_at"] is None
    assert project["tech"] == ["Python", "FastAPI"]  # blank lines dropped
    public = "/api/v1/public/projects/demo-api"
    assert client.get(public).status_code == 404

    published = client.post(f"/api/v1/owner/projects/{project['id']}/publish", headers=headers)
    assert published.json()["status"] == "published" and published.json()["published_at"]
    assert client.get(public).status_code == 200

    client.post(f"/api/v1/owner/projects/{project['id']}/unpublish", headers=headers)
    assert client.get(public).status_code == 404
    assert client.get(f"/api/v1/owner/projects/{project['id']}").json()["status"] == "draft"


def test_a_draft_case_study_stays_private_on_a_published_project(
    studio: tuple[TestClient, dict[str, str]],
) -> None:
    client, headers = studio
    project = create_project(client, headers, problem="A private draft problem statement.")
    client.post(f"/api/v1/owner/projects/{project['id']}/publish", headers=headers)
    body = client.get("/api/v1/public/projects/demo-api").json()
    assert body["case_study"] is None
    assert "private draft" not in json.dumps(body)


def test_stale_edits_are_refused_instead_of_overwriting(
    studio: tuple[TestClient, dict[str, str]],
) -> None:
    client, headers = studio
    project = create_project(client, headers)
    first = client.put(
        f"/api/v1/owner/projects/{project['id']}",
        json={**PROJECT, "title": "First edit", "version": project["version"]},
        headers=headers,
    )
    assert first.status_code == 200 and first.json()["version"] == project["version"] + 1
    stale = client.put(
        f"/api/v1/owner/projects/{project['id']}",
        json={**PROJECT, "title": "Stale edit", "version": project["version"]},
        headers=headers,
    )
    assert stale.status_code == 409
    assert stale.json()["error"]["code"] == "conflict"
    assert client.get(f"/api/v1/owner/projects/{project['id']}").json()["title"] == "First edit"


def test_slugs_are_unique_among_live_projects_and_reusable_after_delete(
    studio: tuple[TestClient, dict[str, str]],
) -> None:
    client, headers = studio
    project = create_project(client, headers)
    taken = client.post("/api/v1/owner/projects", json=PROJECT, headers=headers)
    assert taken.status_code == 409
    assert taken.json()["error"]["fields"][0]["field"] == "slug"

    assert (
        client.delete(f"/api/v1/owner/projects/{project['id']}", headers=headers).status_code == 204
    )
    assert client.get(f"/api/v1/owner/projects/{project['id']}").status_code == 404
    create_project(client, headers)  # the slug is free again


def test_deleted_items_disappear_from_the_public_site(
    studio: tuple[TestClient, dict[str, str]],
) -> None:
    client, headers = studio
    project = create_project(client, headers)
    client.post(f"/api/v1/owner/projects/{project['id']}/publish", headers=headers)
    client.delete(f"/api/v1/owner/projects/{project['id']}", headers=headers)
    assert client.get("/api/v1/public/projects/demo-api").status_code == 404


@pytest.mark.parametrize(
    ("path", "payload", "field"),
    [
        ("projects", {**PROJECT, "slug": "Not A Slug"}, "slug"),
        ("projects", {**PROJECT, "repo_url": "javascript:alert(1)"}, "repo_url"),
        (
            "projects",
            {
                **PROJECT,
                "media": [{"src": "../etc/passwd", "alt": "x y", "width": 100, "height": 100}],
            },
            "media.0.src",
        ),
        (
            "experiences",
            {
                "organization": "Acme",
                "role": "Engineer",
                "start_month": "2026-05",
                "end_month": "2026-01",
            },
            "body",
        ),
        (
            "experiences",
            {
                "organization": "Acme",
                "role": "Engineer",
                "start_month": "2026-05",
                "is_current": True,
                "end_month": "2026-06",
            },
            "body",
        ),
        ("skills", {"category_id": 999999, "name": "Go"}, "category_id"),
    ],
)
def test_invalid_content_is_rejected_with_field_errors(
    studio: tuple[TestClient, dict[str, str]], path: str, payload: dict[str, Any], field: str
) -> None:
    client, headers = studio
    response = client.post(f"/api/v1/owner/{path}", json=payload, headers=headers)
    assert response.status_code == 422, response.text
    assert field in [item["field"] for item in response.json()["error"]["fields"]]


def test_content_changes_need_the_csrf_token(studio: tuple[TestClient, dict[str, str]]) -> None:
    client, _ = studio
    response = client.post("/api/v1/owner/projects", json=PROJECT, headers={"Origin": ORIGIN})
    assert response.status_code == 403


def test_reordering_changes_the_public_order(
    studio: tuple[TestClient, dict[str, str]],
) -> None:
    client, headers = studio
    first = create_project(client, headers, slug="first", title="First")
    second = create_project(client, headers, slug="second", title="Second")
    for project in (first, second):
        client.post(f"/api/v1/owner/projects/{project['id']}/publish", headers=headers)
    client.put(
        "/api/v1/owner/profile",
        json={**json.loads(DEFAULT_FILE.read_text(encoding="utf-8"))["profile"], "version": 0},
        headers=headers,
    )

    def order() -> list[str]:
        return [p["slug"] for p in client.get("/api/v1/public/portfolio").json()["projects"]]

    assert order() == ["first", "second"]
    response = client.post(
        "/api/v1/owner/projects/reorder", json={"ids": [second["id"], first["id"]]}, headers=headers
    )
    assert response.status_code == 204
    assert order() == ["second", "first"]
    incomplete = client.post(
        "/api/v1/owner/projects/reorder", json={"ids": [first["id"]]}, headers=headers
    )
    assert incomplete.status_code == 422


def test_hidden_skills_and_deleted_categories_never_appear(
    studio: tuple[TestClient, dict[str, str]], seeded: None
) -> None:
    client, headers = studio
    categories = client.get("/api/v1/owner/skill-categories").json()
    skills = client.get("/api/v1/owner/skills").json()
    skill = next(item for item in skills if item["name"] == "Docker")
    client.put(
        f"/api/v1/owner/skills/{skill['id']}",
        json={
            "category_id": skill["category_id"],
            "name": "Docker",
            "visible": False,
            "version": skill["version"],
        },
        headers=headers,
    )
    tools = next(
        group
        for group in client.get("/api/v1/public/portfolio").json()["skill_groups"]
        if group["name"] == "Tools"
    )
    assert "Docker" not in tools["skills"]

    practices = next(item for item in categories if item["name"] == "Practices")
    client.delete(f"/api/v1/owner/skill-categories/{practices['id']}", headers=headers)
    names = [
        group["name"] for group in client.get("/api/v1/public/portfolio").json()["skill_groups"]
    ]
    assert "Practices" not in names
    assert all(
        item["category_id"] != practices["id"] for item in client.get("/api/v1/owner/skills").json()
    )


def test_the_profile_is_created_once_then_edited_with_versions(
    studio: tuple[TestClient, dict[str, str]],
) -> None:
    client, headers = studio
    assert client.get("/api/v1/owner/profile").status_code == 404
    profile = json.loads(DEFAULT_FILE.read_text(encoding="utf-8"))["profile"]
    created = client.put("/api/v1/owner/profile", json={**profile, "version": 0}, headers=headers)
    assert created.status_code == 200 and created.json()["version"] == 1
    assert (
        client.put(
            "/api/v1/owner/profile", json={**profile, "version": 0}, headers=headers
        ).status_code
        == 409
    )
    edited = client.put(
        "/api/v1/owner/profile",
        json={**profile, "headline": "A new headline for the site.", "version": 1},
        headers=headers,
    )
    assert edited.json()["version"] == 2
    assert (
        client.get("/api/v1/public/portfolio").json()["profile"]["headline"]
        == "A new headline for the site."
    )


def test_publishing_an_article_dates_it(studio: tuple[TestClient, dict[str, str]]) -> None:
    client, headers = studio
    article = client.post(
        "/api/v1/owner/articles",
        json={
            "slug": "first-note",
            "title": "First note",
            "summary": "A first engineering note.",
            "category": "API",
            "body": "## Heading\n\nText.",
        },
        headers=headers,
    ).json()
    assert client.get("/api/v1/public/articles").json() == []
    published = client.post(
        f"/api/v1/owner/articles/{article['id']}/publish", headers=headers
    ).json()
    assert published["published_on"] == date.today().isoformat()
    public = client.get("/api/v1/public/articles/first-note").json()
    assert public["body"] == "## Heading\n\nText."


# ------------------------------------------------------------------ audit trail and dashboard


def test_every_change_is_audited_without_its_content(
    studio: tuple[TestClient, dict[str, str]],
) -> None:
    client, headers = studio
    project = create_project(client, headers)
    client.put(
        f"/api/v1/owner/projects/{project['id']}",
        json={
            **PROJECT,
            "summary": "A changed and secret-looking summary text.",
            "version": project["version"],
        },
        headers=headers,
    )
    client.post(f"/api/v1/owner/projects/{project['id']}/publish", headers=headers)
    events = client.get("/api/v1/owner/activity").json()
    assert [event["action"] for event in events[:3]] == ["publish", "update", "create"]
    assert events[1]["changed_fields"] == ["summary"]
    assert "secret-looking" not in json.dumps(events)


def test_the_dashboard_counts_content_and_shows_recent_activity(
    studio: tuple[TestClient, dict[str, str]], seeded: None
) -> None:
    client, _ = studio
    dashboard = client.get("/api/v1/owner/dashboard").json()
    assert dashboard["content"]["projects"] == {"draft": 2, "published": 2}
    assert dashboard["content"]["experiences"] == {"draft": 1, "published": 1}
    assert dashboard["messages"] == {"new": 0, "read": 0, "archived": 0, "spam": 0}
    assert dashboard["recent_activity"][0]["action"] == "import"


# ------------------------------------------------------------------ revalidation


def test_changes_ask_the_public_site_to_refresh_with_a_signed_request(
    make_api: Callable[..., TestClient], owner: int, monkeypatch: pytest.MonkeyPatch
) -> None:
    secret = "s" * 40
    calls: list[tuple[bytes, str]] = []

    class Answer:
        status_code = 200

    def fake_post(url: str, *, content: bytes, headers: dict[str, str], timeout: float) -> Answer:
        calls.append((content, headers[revalidate.SIGNATURE_HEADER]))
        return Answer()

    monkeypatch.setattr(httpx, "post", fake_post)
    client = make_api(
        revalidate_url="https://site.example/api/revalidate", revalidate_signing_secret=secret
    )
    headers = csrf_headers(signed_in(client))
    create_project(client, headers)

    assert len(calls) == 1
    body, signature = calls[0]
    assert signature == "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    assert json.loads(body)["tags"] == ["content"]


def test_an_unreachable_public_site_never_fails_a_save(
    make_api: Callable[..., TestClient], owner: int, monkeypatch: pytest.MonkeyPatch
) -> None:
    def broken(*_args: Any, **_kwargs: Any) -> None:
        raise httpx.ConnectError("unreachable")

    monkeypatch.setattr(httpx, "post", broken)
    client = make_api(
        revalidate_url="https://site.example/api/revalidate", revalidate_signing_secret="s" * 40
    )
    headers = csrf_headers(signed_in(client))
    create_project(client, headers)  # still 201


# ------------------------------------------------------------------ import


def test_the_import_never_overwrites_existing_content(
    make_auth_settings: Callable[..., Settings], seeded: None
) -> None:
    database = Database(make_auth_settings())
    with (
        database.session() as db,
        pytest.raises(ImportFileError, match="already exists"),
        db.begin(),
    ):
        import_content(db, json.loads(DEFAULT_FILE.read_text(encoding="utf-8")))
    database.dispose()


def test_an_invalid_import_file_imports_nothing(
    make_auth_settings: Callable[..., Settings], query: Query
) -> None:
    data = json.loads(DEFAULT_FILE.read_text(encoding="utf-8"))
    data["projects"][0]["slug"] = "Not A Slug"
    database = Database(make_auth_settings())
    session: Session
    with (
        database.session() as session,
        pytest.raises(ImportFileError, match="projects"),
        session.begin(),
    ):
        import_content(session, data)
    database.dispose()
    assert query("select count(*) from profile") == [(0,)]
