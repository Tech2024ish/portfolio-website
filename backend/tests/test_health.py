from __future__ import annotations

from fastapi.testclient import TestClient

from app import __version__
from app.main import create_app
from tests.conftest import SettingsFactory


def test_health_reports_ok_and_is_never_cached(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "version": __version__}
    assert response.headers["cache-control"] == "no-store"


def test_health_rejects_unsupported_methods(client: TestClient) -> None:
    assert client.post("/health").status_code == 405


def test_unknown_routes_return_404(client: TestClient) -> None:
    assert client.get("/api/v1/does-not-exist").status_code == 404


def test_cors_allows_only_listed_origins(client: TestClient) -> None:
    allowed = client.get("/health", headers={"Origin": "http://localhost:3000"})
    blocked = client.get("/health", headers={"Origin": "https://evil.example"})

    assert allowed.headers["access-control-allow-origin"] == "http://localhost:3000"
    assert allowed.headers["access-control-allow-credentials"] == "true"
    assert "access-control-allow-origin" not in blocked.headers


def test_api_docs_available_outside_production(client: TestClient) -> None:
    assert client.get("/api/v1/openapi.json").status_code == 200


def test_api_docs_hidden_when_disabled(make_settings: SettingsFactory) -> None:
    with TestClient(create_app(make_settings(enable_api_docs=False))) as test_client:
        assert test_client.get("/api/v1/openapi.json").status_code == 404
        assert test_client.get("/api/v1/docs").status_code == 404
