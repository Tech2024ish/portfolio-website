"""Website settings, privacy-preserving analytics and authentication auditing (real PostgreSQL)."""

from __future__ import annotations

import json
from collections.abc import Callable
from datetime import UTC, date, datetime, timedelta
from typing import Any

import psycopg
import pytest
from fastapi.testclient import TestClient

from app.cli.content import DEFAULT_FILE, import_content
from app.core.config import Settings
from app.database.session import Database
from tests.conftest import EMAIL, ORIGIN, csrf_headers, libpq_url, login, signed_in

pytestmark = pytest.mark.postgres

Query = Callable[..., list[tuple[Any, ...]]]
# Analytics days are UTC (the local date can differ, e.g. in Kigali after midnight).


def utc_today() -> date:
    return datetime.now(UTC).date()


BROWSER = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36"
PHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148"


@pytest.fixture
def seeded(make_auth_settings: Callable[..., Settings]) -> None:
    database = Database(make_auth_settings())
    with database.session() as db, db.begin():
        import_content(db, json.loads(DEFAULT_FILE.read_text(encoding="utf-8")))
    database.dispose()


@pytest.fixture
def execute(clean_database: str) -> Callable[[str], None]:
    def run(sql: str) -> None:
        with psycopg.connect(libpq_url(clean_database)) as conn:
            conn.execute(sql)

    return run


@pytest.fixture
def site(make_api: Callable[..., TestClient], owner: int) -> TestClient:
    return make_api()


def view(client: TestClient, path: str, ua: str = BROWSER, **headers: str) -> Any:
    return client.post(
        "/api/v1/analytics/pageview",
        json={"path": path, "referrer": headers.pop("referrer", None)},
        headers={"User-Agent": ua, **headers},
    )


SETTINGS = {
    "seo_title": "Jean Claude Ishimwe — Backend Engineer",
    "seo_description": (
        "Backend Software Engineer in Kigali building reliable APIs and data-driven systems."
    ),
    "show_skills": True,
    "show_experience": False,
    "show_contact_form": True,
    "show_cv_download": True,
    "home_project_count": 2,
}


# ------------------------------------------------------------------ settings


def test_settings_start_from_defaults_and_save_with_versions(
    site: TestClient, seeded: None
) -> None:
    headers = csrf_headers(signed_in(site))
    defaults = site.get("/api/v1/owner/settings").json()
    assert defaults["version"] == 0 and defaults["show_contact_form"] is True
    saved = site.put("/api/v1/owner/settings", json={**SETTINGS, "version": 0}, headers=headers)
    assert saved.status_code == 200 and saved.json()["version"] == 1
    stale = site.put("/api/v1/owner/settings", json={**SETTINGS, "version": 0}, headers=headers)
    assert stale.status_code == 409
    public = site.get("/api/v1/public/portfolio").json()["settings"]
    assert public["show_experience"] is False and public["home_project_count"] == 2
    events = site.get("/api/v1/owner/activity").json()
    assert events[0]["summary"] == "Edited the website settings"


def test_settings_are_validated(site: TestClient) -> None:
    headers = csrf_headers(signed_in(site))
    response = site.put(
        "/api/v1/owner/settings",
        json={**SETTINGS, "seo_title": "x", "home_project_count": 9, "version": 0},
        headers=headers,
    )
    assert response.status_code == 422
    assert {item["field"] for item in response.json()["error"]["fields"]} == {
        "seo_title",
        "home_project_count",
    }


def test_a_closed_contact_form_refuses_messages(site: TestClient, query: Query) -> None:
    headers = csrf_headers(signed_in(site))
    site.put(
        "/api/v1/owner/settings",
        json={**SETTINGS, "show_contact_form": False, "version": 0},
        headers=headers,
    )
    response = site.post(
        "/api/v1/contact",
        json={
            "name": "Ada",
            "email": "ada@example.com",
            "subject": "Hello there",
            "message": "A message long enough.",
        },
    )
    assert response.status_code == 403 and response.json()["error"]["code"] == "contact_closed"
    assert query("select count(*) from contact_messages") == [(0,)]


def test_settings_are_for_the_owner_only(site: TestClient) -> None:
    assert site.get("/api/v1/owner/settings").status_code == 401
    assert (
        site.put(
            "/api/v1/owner/settings", json={**SETTINGS, "version": 0}, headers={"Origin": ORIGIN}
        ).status_code
        == 401
    )


# ------------------------------------------------------------------ recording page views


def test_real_views_of_public_pages_are_recorded_without_personal_data(
    site: TestClient, seeded: None, query: Query
) -> None:
    assert view(site, "/").status_code == 204
    view(site, "/projects/mosaic", PHONE, referrer="https://www.linkedin.com/feed/")
    view(site, "/projects", referrer="http://localhost:3000/")  # internal navigation
    rows = query(
        "select path, referrer_host, device, length(visitor_hash) from page_views order by id"
    )
    assert rows == [
        ("/", None, "desktop", 64),
        ("/projects/mosaic", "www.linkedin.com", "mobile", 64),
        ("/projects", None, "desktop", 64),
    ]
    columns = {
        name
        for (name,) in query(
            "select column_name from information_schema.columns where table_name = 'page_views'"
        )
    }
    assert not columns & {"ip", "ip_address", "user_agent", "address"}


@pytest.mark.parametrize(
    ("path", "ua", "headers"),
    [
        ("/", "Googlebot/2.1 (+http://www.google.com/bot.html)", {}),
        ("/", "curl/8.5.0", {}),
        ("/", BROWSER, {"DNT": "1"}),
        ("/", BROWSER, {"Sec-GPC": "1"}),
        ("/owner", BROWSER, {}),
        ("/no-such-page", BROWSER, {}),
        ("/projects/school-management-system", BROWSER, {}),  # a draft
        ("/projects/../owner", BROWSER, {}),
        ("https://evil.example/", BROWSER, {}),
    ],
)
def test_what_is_never_counted(
    site: TestClient, seeded: None, query: Query, path: str, ua: str, headers: dict[str, str]
) -> None:
    assert view(site, path, ua, **headers).status_code == 204  # same answer either way
    assert query("select count(*) from page_views") == [(0,)]


def test_the_owner_s_own_visits_are_not_counted(
    site: TestClient, seeded: None, query: Query
) -> None:
    signed_in(site)
    view(site, "/")
    assert query("select count(*) from page_views") == [(0,)]


def test_visitors_are_counted_per_day_and_keys_expire(
    site: TestClient, seeded: None, query: Query, execute: Callable[[str], None]
) -> None:
    execute(
        "insert into analytics_keys (day, secret) "
        "values ((now() at time zone 'utc')::date - 5, 'x')"
    )
    for _ in range(3):
        view(site, "/")
    view(site, "/", PHONE)
    assert query("select count(distinct visitor_hash) from page_views") == [(2,)]
    assert query("select day from analytics_keys") == [(utc_today(),)]  # older keys are deleted


# ------------------------------------------------------------------ the summary


def test_the_summary_reports_only_recorded_views(
    site: TestClient, seeded: None, execute: Callable[[str], None]
) -> None:
    yesterday = (utc_today() - timedelta(days=1)).isoformat()
    execute(
        "insert into page_views (day, path, referrer_host, device, visitor_hash) values "
        "((now() at time zone 'utc')::date - 1, '/', 'www.google.com', 'mobile', 'a'),"
        "((now() at time zone 'utc')::date - 1, '/projects/mosaic', null, 'mobile', 'a'),"
        "((now() at time zone 'utc')::date - 1, '/projects/mosaic', null, 'desktop', 'b')"
    )
    view(site, "/projects/mosaic")
    signed_in(site)
    start = (utc_today() - timedelta(days=6)).isoformat()
    summary = site.get("/api/v1/owner/analytics", params={"start": start}).json()
    assert summary["views"] == 4
    assert summary["visitors"] == 3  # a and b yesterday, one visitor today
    assert summary["recording_since"] == yesterday
    assert len(summary["daily"]) == 7 and summary["daily"][0]["views"] == 0
    assert summary["daily"][-2] == {"day": yesterday, "views": 3, "visitors": 2}
    assert summary["pages"][0] == {"label": "/projects/mosaic", "views": 3, "visitors": 3}
    assert summary["projects"] == [{"label": "MOSAIC", "views": 3, "visitors": 3}]
    assert {item["label"] for item in summary["referrers"]} == {
        "www.google.com",
        "Direct or unknown",
    }
    assert {item["label"]: item["views"] for item in summary["devices"]} == {
        "mobile": 2,
        "desktop": 2,
    }


def test_date_ranges_are_validated_and_owner_only(site: TestClient) -> None:
    assert site.get("/api/v1/owner/analytics").status_code == 401
    signed_in(site)
    today = utc_today()
    assert (
        site.get(
            "/api/v1/owner/analytics",
            params={"start": today.isoformat(), "end": (today - timedelta(days=1)).isoformat()},
        ).status_code
        == 422
    )
    assert (
        site.get(
            "/api/v1/owner/analytics", params={"start": (today - timedelta(days=400)).isoformat()}
        ).status_code
        == 422
    )
    empty = site.get("/api/v1/owner/analytics").json()
    assert empty["views"] == 0 and empty["recording_since"] is None and len(empty["daily"]) == 30


# ------------------------------------------------------------------ authentication audit


def test_sign_in_events_are_audited_without_credentials(site: TestClient, query: Query) -> None:
    login(site, password="not-the-password")
    signed_in(site)
    rows = query(
        "select action, summary, owner_id is null from audit_events "
        "where entity_type = 'auth' order by id"
    )
    assert rows == [
        ("sign_in_failed", "Failed sign-in attempt", True),
        ("sign_in", "Signed in", False),
    ]
    everything = json.dumps(query("select * from audit_events"), default=str)
    assert EMAIL not in everything and "not-the-password" not in everything


def test_activity_can_be_filtered_by_kind(site: TestClient, seeded: None) -> None:
    headers = csrf_headers(signed_in(site))
    site.put("/api/v1/owner/settings", json={**SETTINGS, "version": 0}, headers=headers)
    auth = site.get("/api/v1/owner/activity", params={"kind": "auth"}).json()
    assert [event["action"] for event in auth] == ["sign_in"]
    settings = site.get("/api/v1/owner/activity", params={"kind": "settings"}).json()
    assert [event["summary"] for event in settings] == ["Edited the website settings"]
    content = site.get("/api/v1/owner/activity", params={"kind": "content"}).json()
    assert [event["action"] for event in content] == ["import"]
    assert site.get("/api/v1/owner/activity", params={"kind": "nope"}).status_code == 422
