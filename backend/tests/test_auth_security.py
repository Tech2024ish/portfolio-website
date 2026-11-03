from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from main import app
from models.entities import OwnerSession, utcnow
from tests.conftest import CSRF, OWNER_EMAIL, OWNER_PASSWORD, login

PUBLIC_V1 = {"/api/v1/public", "/api/v1/contact", "/api/v1/auth/login", "/api/v1/health", "/api/v1/media-files"}


def protected_routes():
    # The OpenAPI schema lists every mounted route regardless of router nesting.
    for path, operations in app.openapi()["paths"].items():
        if not path.startswith("/api/v1") or any(path.startswith(prefix) for prefix in PUBLIC_V1):
            continue
        for method in operations:
            yield method.upper(), path.replace("{item_id}", "1").replace("{reply_id}", "1").replace("{session_id}", "1")


ROUTES = sorted(set(protected_routes()))


def test_route_inventory_is_not_empty():
    assert len(ROUTES) > 40


@pytest.mark.parametrize("method,path", ROUTES)
def test_every_protected_route_rejects_anonymous(client, method, path):
    response = client.request(method, path, headers=CSRF, json={})
    assert response.status_code == 401, f"{method} {path} -> {response.status_code}"
    assert response.json()["error"]["code"] == "unauthenticated"


def test_login_sets_httponly_strict_cookie(client):
    response = client.post("/api/v1/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD}, headers=CSRF)
    cookie = response.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=strict" in cookie and "path=/api" in cookie
    assert response.json()["user"]["email"] == OWNER_EMAIL
    assert "password" not in response.text


def test_login_requires_csrf_header(client):
    response = client.post("/api/v1/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD})
    assert response.status_code == 403


def test_wrong_password_and_unknown_user_look_the_same(client):
    a = client.post("/api/v1/auth/login", json={"email": OWNER_EMAIL, "password": "nope"}, headers=CSRF)
    b = client.post("/api/v1/auth/login", json={"email": "who@example.com", "password": "nope"}, headers=CSRF)
    assert a.status_code == b.status_code == 401
    assert a.json() == b.json()


def test_login_throttles_after_repeated_failures(client):
    for _ in range(5):
        client.post("/api/v1/auth/login", json={"email": OWNER_EMAIL, "password": "bad"}, headers=CSRF)
    blocked = client.post("/api/v1/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD}, headers=CSRF)
    assert blocked.status_code == 429


def test_mutation_without_csrf_header_is_rejected(owner):
    owner.headers.pop("X-Requested-With")
    assert owner.get("/api/v1/admin/profile").status_code == 200  # reads are fine
    assert owner.patch("/api/v1/admin/profile", json={"location": "Kigali"}).status_code == 403


def test_mutation_from_foreign_origin_is_rejected(owner):
    response = owner.patch("/api/v1/admin/profile", json={"location": "x"}, headers={"Origin": "https://evil.example"})
    assert response.status_code == 403


def test_logout_ends_session(owner):
    assert owner.post("/api/v1/auth/logout").status_code == 200
    assert owner.get("/api/v1/auth/me").status_code == 401


def test_expired_and_idle_sessions_are_rejected(owner, db_session):
    session = db_session.scalar(select(OwnerSession))
    session.last_seen_at = utcnow() - timedelta(hours=3)
    db_session.commit()
    assert owner.get("/api/v1/auth/me").status_code == 401


def test_password_change_rules_and_other_sessions_revoked(owner):
    other = login(TestClient(app))
    weak = owner.post("/api/v1/auth/password", json={"current_password": OWNER_PASSWORD, "new_password": "short"})
    assert weak.status_code == 422
    wrong = owner.post("/api/v1/auth/password", json={"current_password": "bad", "new_password": "Another-Strong-99"})
    assert wrong.status_code == 400
    ok = owner.post("/api/v1/auth/password", json={"current_password": OWNER_PASSWORD, "new_password": "Another-Strong-99"})
    assert ok.status_code == 200
    assert owner.get("/api/v1/auth/me").status_code == 200
    assert other.get("/api/v1/auth/me").status_code == 401


def test_sessions_list_and_revoke(owner):
    other = login(TestClient(app))
    sessions = owner.get("/api/v1/auth/sessions").json()
    assert len(sessions) == 2 and sum(s["current"] for s in sessions) == 1
    target = next(s for s in sessions if not s["current"])
    assert owner.delete(f"/api/v1/auth/sessions/{target['id']}").status_code == 200
    assert other.get("/api/v1/auth/me").status_code == 401


def test_actions_are_recorded_in_activity_history(owner):
    owner.patch("/api/v1/admin/profile", json={"location": "Kigali, Rwanda"})
    actions = [entry["action"] for entry in owner.get("/api/v1/admin/activity").json()]
    assert "sign_in" in actions and "update" in actions


def test_security_headers_present(client):
    response = client.get("/api/v1/public/site")
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["x-frame-options"] == "DENY"
