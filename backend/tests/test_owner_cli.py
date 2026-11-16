"""The owner CLI against real PostgreSQL. Passwords come from a fake prompt, never arguments."""

from __future__ import annotations

import io
from collections.abc import Callable, Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.cli.owner import run
from app.core.config import Settings
from app.core.security import verify_password
from app.main import create_app
from tests.conftest import SettingsFactory
from tests.test_security import v2_scrypt_hash

pytestmark = pytest.mark.postgres

Query = Callable[..., list[tuple[Any, ...]]]

EMAIL = "owner@example.com"
PASSWORD = "Correct-Horse-9-battery"
ORIGIN = "http://localhost:3000"


def prompt_with(*answers: str) -> Callable[[str], str]:
    replies = iter(answers)
    return lambda _label: next(replies)


@pytest.fixture
def settings(make_settings: SettingsFactory, clean_database: str) -> Settings:
    return make_settings(
        database_url=clean_database,
        cookie_secure=False,
        public_site_url=ORIGIN,
        cors_origins=[ORIGIN],
    )


@pytest.fixture
def api(settings: Settings) -> Iterator[TestClient]:
    with TestClient(create_app(settings)) as client:
        yield client


def sign_in(client: TestClient, password: str = PASSWORD) -> int:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": EMAIL, "password": password},
        headers={"Origin": ORIGIN},
    )
    return int(response.status_code)


def test_create_stores_an_argon2id_hash_never_the_password(
    settings: Settings, query: Query
) -> None:
    code = run(
        ["create", "Owner@Example.com", "--name", "Jean Claude"],
        settings=settings,
        prompt=prompt_with(PASSWORD, PASSWORD),
    )
    assert code == 0
    ((email, name, stored),) = query("select email, display_name, password_hash from owner_users")
    assert (email, name) == (EMAIL, "Jean Claude")
    assert stored.startswith("$argon2id$") and PASSWORD not in stored
    assert verify_password(PASSWORD, stored)


def test_create_refuses_weak_or_mismatched_passwords_and_a_second_owner(
    settings: Settings, query: Query, capsys: pytest.CaptureFixture[str]
) -> None:
    assert run(["create", EMAIL], settings=settings, prompt=prompt_with("weak")) == 1
    assert (
        run(["create", EMAIL], settings=settings, prompt=prompt_with(PASSWORD, PASSWORD + "x")) == 1
    )
    assert query("select count(*) from owner_users") == [(0,)]

    assert run(["create", EMAIL], settings=settings, prompt=prompt_with(PASSWORD, PASSWORD)) == 0
    assert (
        run(
            ["create", "second@example.com"],
            settings=settings,
            prompt=prompt_with(PASSWORD, PASSWORD),
        )
        == 1
    )
    assert query("select count(*) from owner_users") == [(1,)]
    assert PASSWORD not in capsys.readouterr().out  # never echoed


def test_set_password_ends_every_session(settings: Settings, api: TestClient) -> None:
    run(["create", EMAIL], settings=settings, prompt=prompt_with(PASSWORD, PASSWORD))
    assert sign_in(api) == 200
    new = "Another-Strong-7-phrase"
    assert run(["set-password", EMAIL], settings=settings, prompt=prompt_with(new, new)) == 0
    assert api.get("/api/v1/auth/session").status_code == 401
    api.cookies.clear()
    assert sign_in(api) == 401
    assert sign_in(api, new) == 200


def test_revoke_sessions_signs_the_owner_out_everywhere(
    settings: Settings, api: TestClient
) -> None:
    run(["create", EMAIL], settings=settings, prompt=prompt_with(PASSWORD, PASSWORD))
    sign_in(api)
    assert run(["revoke-sessions", EMAIL], settings=settings) == 0
    assert api.get("/api/v1/auth/session").status_code == 401


def test_commands_for_an_unknown_owner_fail_without_changes(
    settings: Settings, query: Query
) -> None:
    assert (
        run(["set-password", EMAIL], settings=settings, prompt=prompt_with(PASSWORD, PASSWORD)) == 1
    )
    assert run(["revoke-sessions", EMAIL], settings=settings) == 1
    assert run(["create", "not-an-email"], settings=settings) == 2
    assert query("select count(*) from owner_users") == [(0,)]


def test_a_legacy_v2_hash_keeps_access_and_is_upgraded_at_sign_in(
    settings: Settings, api: TestClient, query: Query
) -> None:
    """Roadmap 5.4: preserve owner access during migration, then re-hash with Argon2id."""
    legacy = v2_scrypt_hash(PASSWORD)
    code = run(["import-legacy-hash", EMAIL], settings=settings, stdin=io.StringIO(legacy + "\n"))
    assert code == 0
    assert query("select password_hash from owner_users") == [(legacy,)]

    assert sign_in(api) == 200
    ((upgraded,),) = query("select password_hash from owner_users")
    assert upgraded.startswith("$argon2id$")


def test_import_rejects_anything_but_a_v2_hash(settings: Settings, query: Query) -> None:
    for value in ("", "plain-password", "$argon2id$v=19$m=1,t=1,p=1$x$y", "scrypt$1$2$3"):
        assert run(["import-legacy-hash", EMAIL], settings=settings, stdin=io.StringIO(value)) == 1
    assert query("select count(*) from owner_users") == [(0,)]


def test_without_a_database_nothing_runs(make_settings: SettingsFactory) -> None:
    assert run(["revoke-sessions", EMAIL], settings=make_settings(database_url=None)) == 1
