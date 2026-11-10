"""``POST /api/v1/contact`` against real PostgreSQL, migrated by Alembic."""

from __future__ import annotations

import json
from collections.abc import Callable, Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.main import create_app
from tests.conftest import SettingsFactory

pytestmark = pytest.mark.postgres

Query = Callable[..., list[tuple[Any, ...]]]

VALID = {
    "name": "  Ada   Lovelace ",
    "email": "Ada@Example.COM",
    "subject": "Backend   role",
    "message": "Hello,\r\nI would like to talk about a backend role.  ",
}


def post(client: TestClient, payload: dict[str, Any], **headers: str) -> Any:
    return client.post("/api/v1/contact", json=payload, headers=headers)


def fields(response: Any) -> dict[str, str]:
    return {item["field"]: item["message"] for item in response.json()["error"]["fields"]}


# ------------------------------------------------------------------ success and persistence


def test_valid_submission_is_stored_normalised_with_status_new(
    db_client: TestClient, query: Query
) -> None:
    response = post(db_client, VALID)

    assert response.status_code == 201
    assert response.json() == {"status": "received"}
    assert response.headers["cache-control"] == "no-store"
    rows = query("select name, email, subject, message, status, created_at from contact_messages")
    assert len(rows) == 1
    name, email, subject, message, status, created_at = rows[0]
    assert name == "Ada Lovelace"
    assert email == "Ada@example.com"  # domain normalised; local part preserved
    assert subject == "Backend role"
    assert message == "Hello,\nI would like to talk about a backend role."
    assert status == "new"
    assert created_at is not None and created_at.tzinfo is not None


def test_message_keeps_line_breaks_and_unicode(db_client: TestClient, query: Query) -> None:
    payload = {**VALID, "name": "Jean-Claude Ishimwe", "message": "Muraho!\n\nLine two — ✓"}
    assert post(db_client, payload).status_code == 201
    assert query("select name, message from contact_messages") == [
        ("Jean-Claude Ishimwe", "Muraho!\n\nLine two — ✓")
    ]


# ------------------------------------------------------------------ validation


def test_missing_fields_are_each_reported_and_nothing_is_stored(
    db_client: TestClient, query: Query
) -> None:
    response = post(db_client, {})

    assert response.status_code == 422
    body = response.json()["error"]
    assert body["code"] == "validation_error"
    assert fields(response) == {
        "name": "This field is required.",
        "email": "This field is required.",
        "subject": "This field is required.",
        "message": "This field is required.",
    }
    assert query("select count(*) from contact_messages") == [(0,)]


def test_whitespace_only_values_count_as_missing(db_client: TestClient) -> None:
    response = post(db_client, {**VALID, "name": "   ", "subject": "\t\n "})
    assert response.status_code == 422
    assert fields(response) == {
        "name": "This field is required.",
        "subject": "This field is required.",
    }


@pytest.mark.parametrize("email", ["not-an-email", "a@b", "ada@@example.com", "ada@example..com"])
def test_invalid_email_is_rejected(db_client: TestClient, query: Query, email: str) -> None:
    response = post(db_client, {**VALID, "email": email})
    assert response.status_code == 422
    assert fields(response) == {"email": "Enter a valid email address."}
    assert query("select count(*) from contact_messages") == [(0,)]


@pytest.mark.parametrize(
    ("field", "limit"), [("name", 100), ("subject", 150), ("message", 5000), ("email", 254)]
)
def test_excessively_long_input_is_rejected(
    db_client: TestClient, query: Query, field: str, limit: int
) -> None:
    value = ("a" * (limit - 11) + "@example.com") if field == "email" else "a" * (limit + 1)
    response = post(db_client, {**VALID, field: value})
    assert response.status_code == 422
    assert field in fields(response)
    assert query("select count(*) from contact_messages") == [(0,)]


def test_values_at_the_limits_are_accepted(db_client: TestClient) -> None:
    payload = {**VALID, "name": "n" * 100, "subject": "s" * 150, "message": "m" * 5000}
    assert post(db_client, payload).status_code == 201


def test_too_short_values_are_rejected(db_client: TestClient) -> None:
    response = post(db_client, {**VALID, "name": "A", "subject": "Hi", "message": "short"})
    assert response.status_code == 422
    assert fields(response) == {
        "name": "Must be at least 2 characters.",
        "subject": "Must be at least 3 characters.",
        "message": "Must be at least 10 characters.",
    }


def test_control_characters_are_rejected(db_client: TestClient, query: Query) -> None:
    response = post(db_client, {**VALID, "message": "Hello\x00 there, this is a test"})
    assert response.status_code == 422
    assert fields(response) == {"message": "Contains characters that are not allowed."}
    assert query("select count(*) from contact_messages") == [(0,)]


def test_unknown_fields_and_non_object_bodies_are_rejected(db_client: TestClient) -> None:
    extra = post(db_client, {**VALID, "status": "read"})
    assert extra.status_code == 422
    assert fields(extra) == {"status": "Unexpected field."}

    not_json = db_client.post(
        "/api/v1/contact", content="hello", headers={"Content-Type": "application/json"}
    )
    assert not_json.status_code == 422
    assert not_json.json()["error"]["code"] == "validation_error"


# ------------------------------------------------------------------ request-body size limit

LIMIT_BYTES = 64 * 1024


def _json_body(size: int) -> bytes:
    """A syntactically valid JSON body of exactly ``size`` bytes."""
    prefix, suffix = (
        b'{"name":"Ada","email":"ada@example.com","subject":"Hi there","message":"',
        b'"}',
    )
    return prefix + b"m" * (size - len(prefix) - len(suffix)) + suffix


def _chunks(body: bytes, size: int = 8192) -> Iterator[bytes]:
    for start in range(0, len(body), size):
        yield body[start : start + size]


def test_body_over_the_limit_is_rejected_with_413_before_the_endpoint_runs(
    db_client: TestClient, query: Query
) -> None:
    body = _json_body(LIMIT_BYTES + 1)
    response = db_client.post(
        "/api/v1/contact", content=body, headers={"Content-Type": "application/json"}
    )
    assert response.status_code == 413
    assert response.json() == {
        "error": {"code": "payload_too_large", "message": "The request body is too large."}
    }
    assert response.headers["cache-control"] == "no-store"
    # Nothing ran: no message and not even a rate-limit event was recorded.
    assert query("select count(*) from contact_messages") == [(0,)]
    assert query("select count(*) from rate_limit_events") == [(0,)]


def test_body_exactly_at_the_limit_is_not_rejected_for_size(db_client: TestClient) -> None:
    body = _json_body(LIMIT_BYTES)
    assert len(body) == LIMIT_BYTES
    response = db_client.post(
        "/api/v1/contact", content=body, headers={"Content-Type": "application/json"}
    )
    # Parsed and validated normally: the message field is simply too long.
    assert response.status_code == 422
    assert fields(response) == {"message": "Must be at most 5000 characters."}


def test_chunked_body_without_content_length_is_cut_off_at_the_limit(
    db_client: TestClient, query: Query
) -> None:
    response = db_client.post(
        "/api/v1/contact",
        content=_chunks(_json_body(LIMIT_BYTES * 4)),
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "payload_too_large"
    assert query("select count(*) from contact_messages") == [(0,)]
    assert query("select count(*) from rate_limit_events") == [(0,)]


def test_small_chunked_body_is_accepted(db_client: TestClient, query: Query) -> None:
    body = json.dumps(VALID).encode()
    response = db_client.post(
        "/api/v1/contact", content=_chunks(body, 16), headers={"Content-Type": "application/json"}
    )
    assert response.status_code == 201
    assert query("select count(*) from contact_messages") == [(1,)]


def test_largest_valid_submission_fits_well_inside_the_limit(
    db_client: TestClient, query: Query
) -> None:
    # Every field at its maximum length, using 4-byte UTF-8 characters where text is free-form.
    payload = {
        "name": "😀" * 100,
        "email": ("a" * 64) + "@" + ("b" * 63) + "." + ("c" * 63) + "." + ("d" * 57) + ".com",
        "subject": "😀" * 150,
        "message": "😀" * 5000,
    }
    body = json.dumps(payload, ensure_ascii=False).encode()
    assert len(body) < LIMIT_BYTES / 2
    response = db_client.post(
        "/api/v1/contact", content=body, headers={"Content-Type": "application/json"}
    )
    assert response.status_code == 201
    assert query("select char_length(message), char_length(email) from contact_messages") == [
        (5000, 254)
    ]


def test_size_limit_applies_only_to_the_contact_endpoint(db_client: TestClient) -> None:
    big = _json_body(LIMIT_BYTES * 2)
    other = db_client.post(
        "/api/v1/not-a-route", content=big, headers={"Content-Type": "application/json"}
    )
    assert other.status_code == 404
    assert db_client.get("/health").status_code == 200


# ------------------------------------------------------------------ spam protection


def test_honeypot_submission_looks_successful_but_is_not_stored(
    db_client: TestClient, query: Query
) -> None:
    response = post(db_client, {**VALID, "website": "https://spam.example"})

    assert response.status_code == 201
    assert response.json() == {"status": "received"}
    assert query("select count(*) from contact_messages") == [(0,)]
    assert query("select count(*) from rate_limit_events") == [(1,)]  # still counted


def _limited_client(make_settings: SettingsFactory, url: str, **overrides: Any) -> TestClient:
    settings = make_settings(database_url=url, contact_rate_limit=2, **overrides)
    return TestClient(create_app(settings))


def test_rate_limit_blocks_after_the_limit_with_retry_after(
    make_settings: SettingsFactory, clean_database: str, query: Query
) -> None:
    with _limited_client(make_settings, clean_database) as client:
        assert post(client, VALID).status_code == 201
        assert post(client, {**VALID, "website": "x"}).status_code == 201  # honeypot counts
        blocked = post(client, VALID)

    assert blocked.status_code == 429
    assert blocked.json()["error"]["code"] == "rate_limited"
    assert blocked.headers["retry-after"] == "3600"
    assert query("select count(*) from contact_messages") == [(1,)]


def test_rate_limit_ignores_spoofed_forwarded_headers_by_default(
    make_settings: SettingsFactory, clean_database: str
) -> None:
    with _limited_client(make_settings, clean_database) as client:
        for n in range(2):
            assert post(client, VALID, **{"X-Forwarded-For": f"10.0.0.{n}"}).status_code == 201
        assert post(client, VALID, **{"X-Forwarded-For": "10.0.0.99"}).status_code == 429


def test_rate_limit_is_per_client_behind_trusted_proxies(
    make_settings: SettingsFactory, clean_database: str
) -> None:
    with _limited_client(make_settings, clean_database, trusted_proxy_count=1) as client:
        a = {"X-Forwarded-For": "203.0.113.1"}
        b = {"X-Forwarded-For": "spoofed, 203.0.113.2"}  # only the proxy-written entry counts
        assert post(client, VALID, **a).status_code == 201
        assert post(client, VALID, **a).status_code == 201
        assert post(client, VALID, **a).status_code == 429
        assert post(client, VALID, **b).status_code == 201


def test_rate_limit_identity_uses_all_repeated_forwarded_lines(
    make_settings: SettingsFactory, clean_database: str
) -> None:
    """Over real HTTP: a client-sent X-Forwarded-For line cannot pick the rate-limit identity
    when the trusted proxy adds its own line after it."""
    with _limited_client(make_settings, clean_database, trusted_proxy_count=1) as client:

        def send(spoof: str) -> int:
            headers = [("x-forwarded-for", spoof), ("x-forwarded-for", "203.0.113.5")]
            response = client.post("/api/v1/contact", json=VALID, headers=headers)
            return int(response.status_code)

        assert [send("6.6.6.1"), send("6.6.6.2"), send("6.6.6.3")] == [201, 201, 429]


def test_expired_rate_limit_events_are_not_counted_and_are_purged(
    make_settings: SettingsFactory, clean_database: str, query: Query
) -> None:
    query(
        "insert into rate_limit_events (bucket, client_key, created_at) "
        "select 'contact', 'k' || g, now() - interval '3 hours' from generate_series(1, 5) g "
        "returning id"
    )
    with _limited_client(make_settings, clean_database) as client:
        assert post(client, VALID).status_code == 201
    assert query("select count(*) from rate_limit_events") == [(1,)]


def test_no_raw_ip_address_is_stored(db_client: TestClient, query: Query) -> None:
    assert post(db_client, VALID).status_code == 201
    [(key,)] = query("select client_key from rate_limit_events")
    assert len(key) == 64 and "testclient" not in key


# ------------------------------------------------------------------ database failures


def test_unconfigured_database_returns_503_without_storing(
    make_settings: SettingsFactory,
) -> None:
    with TestClient(create_app(make_settings())) as client:
        response = post(client, VALID)
    assert response.status_code == 503
    assert response.json() == {
        "error": {
            "code": "service_unavailable",
            "message": "The service is temporarily unavailable. Please try again later.",
        }
    }


def test_unreachable_database_returns_503_and_leaks_nothing(
    make_settings: SettingsFactory,
) -> None:
    url = "postgresql://portfolio:s3cret-pw@127.0.0.1:1/portfolio"
    with TestClient(create_app(make_settings(database_url=url))) as client:
        response = post(client, VALID)
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "service_unavailable"
    assert "s3cret" not in response.text and "127.0.0.1" not in response.text


def test_failure_after_rate_limit_rolls_back_the_whole_request(
    db_client: TestClient, query: Query, monkeypatch: pytest.MonkeyPatch
) -> None:
    from app.api.v1.endpoints import contact as endpoint
    from app.services.contact import submit_contact_message as real

    def fail_after_insert(*args: Any, **kwargs: Any) -> Any:
        real(*args, **kwargs)
        raise OperationalError("insert", {}, Exception("connection lost"))

    monkeypatch.setattr(endpoint, "submit_contact_message", fail_after_insert)

    response = post(db_client, VALID)

    assert response.status_code == 503
    assert query("select count(*) from contact_messages") == [(0,)]
    assert query("select count(*) from rate_limit_events") == [(0,)]
