"""Owner authentication against real PostgreSQL: sign-in, sessions, CSRF and abuse cases."""

from __future__ import annotations

import logging
import re
from collections.abc import Callable, Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.security import hash_password, token_digest
from app.main import create_app
from tests.conftest import SettingsFactory
from tests.test_security import v2_scrypt_hash

pytestmark = pytest.mark.postgres

Query = Callable[..., list[tuple[Any, ...]]]

ORIGIN = "http://localhost:3000"
EMAIL = "owner@example.com"
PASSWORD = "Correct-Horse-9-battery"
NEW_PASSWORD = "Another-Strong-7-phrase"
COOKIE = "owner_session"  # cookie_secure=False in these tests: TestClient talks plain HTTP


@pytest.fixture
def make_auth_settings(
    make_settings: SettingsFactory, clean_database: str
) -> Callable[..., Settings]:
    def factory(**overrides: Any) -> Settings:
        values: dict[str, Any] = {
            "database_url": clean_database,
            "cookie_secure": False,
            "public_site_url": ORIGIN,
            "cors_origins": [ORIGIN],
        }
        values.update(overrides)
        return make_settings(**values)

    return factory


@pytest.fixture
def make_api(make_auth_settings: Callable[..., Settings]) -> Iterator[Callable[..., TestClient]]:
    clients: list[TestClient] = []

    def factory(**overrides: Any) -> TestClient:
        client = TestClient(create_app(make_auth_settings(**overrides)))
        client.__enter__()
        clients.append(client)
        return client

    yield factory
    for client in clients:
        client.__exit__(None, None, None)


@pytest.fixture
def api(make_api: Callable[..., TestClient]) -> TestClient:
    return make_api()


@pytest.fixture
def owner(query: Query) -> int:
    rows = query(
        "insert into owner_users (email, display_name, password_hash) values (%s, %s, %s) "
        "returning id",
        EMAIL,
        "Jean Claude",
        hash_password(PASSWORD),
    )
    return int(rows[0][0])


def login(client: TestClient, email: str = EMAIL, password: str = PASSWORD, **headers: str) -> Any:
    return client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
        headers={"Origin": ORIGIN, **headers},
    )


def signed_in(client: TestClient) -> str:
    """Sign in and return the CSRF token."""
    response = login(client)
    assert response.status_code == 200, response.text
    return str(response.json()["csrf_token"])


def csrf_headers(token: str) -> dict[str, str]:
    return {"Origin": ORIGIN, "X-CSRF-Token": token}


# ------------------------------------------------------------------ sign-in


def test_sign_in_starts_a_session_in_an_httponly_strict_cookie(
    api: TestClient, owner: int, query: Query
) -> None:
    response = login(api, email="  Owner@Example.COM ")  # case and whitespace are ignored

    assert response.status_code == 200
    body = response.json()
    assert body["user"] == {"email": EMAIL, "display_name": "Jean Claude"}
    assert len(body["csrf_token"]) == 64
    assert response.headers["cache-control"] == "no-store"
    cookie = response.headers["set-cookie"]
    assert cookie.startswith(f"{COOKIE}=")
    for attribute in ("HttpOnly", "Path=/", "SameSite=strict", "Max-Age=43200"):
        assert attribute.lower() in cookie.lower(), attribute
    token = api.cookies[COOKIE]
    # Only the digest is stored, never the token.
    assert query("select token_hash from owner_sessions") == [(token_digest(token),)]
    assert api.get("/api/v1/auth/session").json()["user"]["email"] == EMAIL


def test_production_cookies_are_secure_and_host_prefixed(
    make_api: Callable[..., TestClient], owner: int
) -> None:
    client = make_api(cookie_secure=True)
    cookie = login(client).headers["set-cookie"]
    assert cookie.startswith("__Host-owner_session=")
    assert (
        "secure" in cookie.lower() and "path=/" in cookie.lower() and "domain" not in cookie.lower()
    )


def test_wrong_password_and_unknown_email_get_the_same_answer(api: TestClient, owner: int) -> None:
    wrong_password = login(api, password="Wrong-password-1")
    unknown_email = login(api, email="nobody@example.com")
    for response in (wrong_password, unknown_email):
        assert response.status_code == 401
        assert response.json() == {
            "error": {
                "code": "invalid_credentials",
                "message": "The email or password is incorrect.",
            }
        }
        assert "set-cookie" not in response.headers


def test_sign_in_rejects_other_origins_and_non_json_bodies(api: TestClient, owner: int) -> None:
    assert login(api, Origin="https://evil.example").status_code == 403
    form = api.post(
        "/api/v1/auth/login",
        content=f"email={EMAIL}&password={PASSWORD}",
        headers={"Origin": ORIGIN, "Content-Type": "application/x-www-form-urlencoded"},
    )
    assert form.status_code == 415


def test_oversized_sign_in_bodies_are_rejected_before_parsing(api: TestClient, owner: int) -> None:
    response = api.post(
        "/api/v1/auth/login",
        json={"email": EMAIL, "password": "x" * 20_000},
        headers={"Origin": ORIGIN},
    )
    assert response.status_code == 413


def test_legacy_scrypt_password_signs_in_and_is_upgraded_to_argon2id(
    api: TestClient, query: Query
) -> None:
    query(
        "insert into owner_users (email, password_hash) values (%s, %s) returning id",
        EMAIL,
        v2_scrypt_hash(PASSWORD),
    )
    assert login(api).status_code == 200
    ((stored,),) = query("select password_hash from owner_users")
    assert stored.startswith("$argon2id$")
    api.cookies.clear()
    assert login(api).status_code == 200  # the upgraded hash works
    assert login(api, password="Wrong-password-1").status_code == 401


# ------------------------------------------------------------------ brute-force protection


def test_too_many_attempts_from_one_address_are_refused(
    make_api: Callable[..., TestClient], owner: int
) -> None:
    client = make_api(login_ip_attempts=3, login_account_failures=100)
    for _ in range(3):
        assert login(client, password="Wrong-password-1").status_code == 401
    refused = login(client)  # even the right password
    assert refused.status_code == 429
    assert refused.headers["retry-after"] == str(15 * 60)
    assert refused.json()["error"]["code"] == "rate_limited"


def test_too_many_failures_for_one_account_are_refused_from_any_address(
    make_api: Callable[..., TestClient], owner: int
) -> None:
    client = make_api(login_ip_attempts=100, login_account_failures=2)
    for _ in range(2):
        assert login(client, password="Wrong-password-1").status_code == 401
    assert login(client).status_code == 429


def test_the_account_limit_reveals_nothing_about_unknown_emails(
    make_api: Callable[..., TestClient], owner: int
) -> None:
    client = make_api(login_ip_attempts=100, login_account_failures=2)
    for _ in range(2):
        assert login(client, email="nobody@example.com").status_code == 401
    assert login(client, email="nobody@example.com").status_code == 429


def test_successful_sign_ins_never_lock_the_owner_out(
    make_api: Callable[..., TestClient], owner: int
) -> None:
    client = make_api(login_ip_attempts=100, login_account_failures=2)
    for _ in range(5):
        assert login(client).status_code == 200


# ------------------------------------------------------------------ sessions


def test_protected_endpoints_reject_requests_without_a_session(api: TestClient) -> None:
    for method, path in (
        ("GET", "/api/v1/auth/session"),
        ("GET", "/api/v1/auth/sessions"),
        ("POST", "/api/v1/auth/logout"),
        ("POST", "/api/v1/auth/password"),
        ("POST", "/api/v1/auth/sessions/revoke-others"),
        ("DELETE", "/api/v1/auth/sessions/1"),
        ("GET", "/api/v1/owner/overview"),
    ):
        response = api.request(method, path, headers={"Origin": ORIGIN})
        assert response.status_code == 401, (method, path)
        assert response.json()["error"]["code"] == "unauthorized"


def test_forged_or_unknown_session_cookies_are_rejected(api: TestClient, owner: int) -> None:
    api.cookies.set(COOKIE, "forged-token")
    assert api.get("/api/v1/auth/session").status_code == 401


@pytest.mark.parametrize(
    "end_session",
    [
        # Past its absolute lifetime.
        "update owner_sessions set expires_at = now() - interval '1 minute' returning id",
        # Idle for longer than the 120-minute idle timeout.
        "update owner_sessions set last_seen_at = now() - interval '3 hours' returning id",
        # Revoked.
        "update owner_sessions set revoked_at = now() returning id",
    ],
    ids=["expired", "idle", "revoked"],
)
def test_ended_sessions_are_rejected(
    api: TestClient, owner: int, query: Query, end_session: str
) -> None:
    signed_in(api)
    query(end_session)
    assert api.get("/api/v1/auth/session").status_code == 401


def test_sign_out_ends_the_session_and_clears_the_cookie(
    api: TestClient, owner: int, query: Query
) -> None:
    csrf = signed_in(api)
    response = api.post("/api/v1/auth/logout", headers=csrf_headers(csrf))
    assert response.status_code == 204
    assert (
        f'{COOKIE}=""' in response.headers["set-cookie"]
        or "max-age=0" in response.headers["set-cookie"].lower()
    )
    assert query("select revoked_at is not null from owner_sessions") == [(True,)]
    assert api.get("/api/v1/auth/session").status_code == 401


def test_sessions_can_be_listed_and_revoked(
    make_api: Callable[..., TestClient], owner: int
) -> None:
    first, second = make_api(), make_api()
    csrf = signed_in(first)
    signed_in(second)

    sessions = first.get("/api/v1/auth/sessions").json()
    assert len(sessions) == 2
    assert [item["current"] for item in sessions].count(True) == 1
    other = next(item for item in sessions if not item["current"])

    assert (
        first.delete(f"/api/v1/auth/sessions/{other['id']}", headers=csrf_headers(csrf)).status_code
        == 204
    )
    assert second.get("/api/v1/auth/session").status_code == 401
    assert first.get("/api/v1/auth/session").status_code == 200
    # Already revoked, or unknown: 404, never a hint about other sessions.
    assert (
        first.delete(f"/api/v1/auth/sessions/{other['id']}", headers=csrf_headers(csrf)).status_code
        == 404
    )
    assert (
        first.delete("/api/v1/auth/sessions/999999", headers=csrf_headers(csrf)).status_code == 404
    )


def test_revoke_others_keeps_only_the_current_session(
    make_api: Callable[..., TestClient], owner: int
) -> None:
    clients = [make_api() for _ in range(3)]
    csrf = signed_in(clients[0])
    for client in clients[1:]:
        signed_in(client)
    response = clients[0].post("/api/v1/auth/sessions/revoke-others", headers=csrf_headers(csrf))
    assert response.json() == {"revoked": 2}
    assert [client.get("/api/v1/auth/session").status_code for client in clients] == [200, 401, 401]


# ------------------------------------------------------------------ CSRF


@pytest.mark.parametrize(
    "headers",
    [
        {"Origin": ORIGIN},  # no token
        {"Origin": ORIGIN, "X-CSRF-Token": "0" * 64},  # wrong token
        {"Origin": "https://evil.example", "X-CSRF-Token": "<valid>"},  # foreign origin
    ],
)
def test_state_changes_need_the_csrf_token_and_an_allowed_origin(
    api: TestClient, owner: int, headers: dict[str, str]
) -> None:
    csrf = signed_in(api)
    headers = {key: csrf if value == "<valid>" else value for key, value in headers.items()}
    response = api.post("/api/v1/auth/logout", headers=headers)
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "forbidden"
    assert api.get("/api/v1/auth/session").status_code == 200  # nothing changed


def test_a_csrf_token_from_another_session_is_refused(
    make_api: Callable[..., TestClient], owner: int
) -> None:
    first, second = make_api(), make_api()
    signed_in(first)
    other_csrf = signed_in(second)
    assert first.post("/api/v1/auth/logout", headers=csrf_headers(other_csrf)).status_code == 403


# ------------------------------------------------------------------ password change


def change(client: TestClient, csrf: str, current: str, new: str) -> Any:
    return client.post(
        "/api/v1/auth/password",
        json={"current_password": current, "new_password": new},
        headers=csrf_headers(csrf),
    )


def test_password_change_needs_the_current_password_and_a_strong_new_one(
    api: TestClient, owner: int
) -> None:
    csrf = signed_in(api)
    wrong = change(api, csrf, "Wrong-password-1", NEW_PASSWORD)
    assert wrong.status_code == 400
    assert wrong.json()["error"]["fields"][0]["field"] == "current_password"
    weak = change(api, csrf, PASSWORD, "short")
    assert weak.status_code == 422
    assert weak.json()["error"]["fields"][0]["field"] == "new_password"
    assert change(api, csrf, PASSWORD, PASSWORD).status_code == 422  # unchanged


def test_password_change_ends_every_other_session(
    make_api: Callable[..., TestClient], owner: int, query: Query
) -> None:
    current, other = make_api(), make_api()
    csrf = signed_in(current)
    signed_in(other)

    assert change(current, csrf, PASSWORD, NEW_PASSWORD).status_code == 204
    assert other.get("/api/v1/auth/session").status_code == 401
    assert current.get("/api/v1/auth/session").status_code == 200
    ((stored,),) = query("select password_hash from owner_users")
    assert stored.startswith("$argon2id$") and NEW_PASSWORD not in stored

    fresh = make_api()
    assert login(fresh, password=PASSWORD).status_code == 401
    assert login(fresh, password=NEW_PASSWORD).status_code == 200


# ------------------------------------------------------------------ owner API


def test_every_owner_route_requires_a_session(api: TestClient) -> None:
    """Fails if any route under /api/v1/owner is added without the router-level guard.

    Routes are read from the OpenAPI schema, which lists every endpoint the app serves.
    """
    paths: dict[str, dict[str, Any]] = api.get("/api/v1/openapi.json").json()["paths"]
    owner_routes = [
        (method.upper(), path)
        for path, operations in paths.items()
        if path.startswith("/api/v1/owner")
        for method in operations
    ]
    assert owner_routes, "expected at least one owner route"
    for method, path in owner_routes:
        concrete = re.sub(r"\{[^}]+\}", "1", path)
        response = api.request(method, concrete, headers={"Origin": ORIGIN})
        assert response.status_code == 401, (method, path)


def test_the_overview_counts_messages_for_the_owner(
    api: TestClient, owner: int, query: Query
) -> None:
    query(
        "insert into contact_messages (name, email, subject, message, status) values "
        "('A', 'a@example.com', 'S1', 'Message one.', 'new'), "
        "('B', 'b@example.com', 'S2', 'Message two.', 'read') returning id"
    )
    signed_in(api)
    response = api.get("/api/v1/owner/overview")
    assert response.status_code == 200
    assert response.json() == {"messages": {"new": 1, "read": 1, "archived": 0}}
    assert response.headers["cache-control"] == "no-store"


# ------------------------------------------------------------------ logging


def test_logs_never_contain_credentials_tokens_or_the_email(
    api: TestClient, owner: int, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.DEBUG)
    login(api, password="Wrong-password-1")
    csrf = signed_in(api)
    token = api.cookies[COOKIE]
    api.post("/api/v1/auth/logout", headers=csrf_headers(csrf))

    text = caplog.text
    assert "owner sign-in failed" in text and "owner signed in" in text
    for secret in (PASSWORD, "Wrong-password-1", token, csrf, EMAIL):
        assert secret not in text
