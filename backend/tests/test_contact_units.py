"""Unit tests that need no database: schema normalisation, client address, error envelope."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from starlette.requests import Request

from app.core.client_ip import client_address
from app.schemas.contact import ContactSubmission


def _request(peer: str, *forwarded_lines: str) -> Request:
    """A request whose X-Forwarded-For arrives as one header line per argument."""
    headers = [(b"x-forwarded-for", line.encode()) for line in forwarded_lines]
    return Request({"type": "http", "headers": headers, "client": (peer, 1234)})


def test_submission_normalises_whitespace_and_line_endings() -> None:
    submission = ContactSubmission(
        name=" Ada \t Lovelace ",
        email="ada@EXAMPLE.com",
        subject="  Hello   there ",
        message="  First line\r\nSecond line\rThird  ",
    )
    assert submission.name == "Ada Lovelace"
    assert submission.subject == "Hello there"
    assert submission.message == "First line\nSecond line\nThird"
    assert str(submission.email) == "ada@example.com"
    assert submission.website == ""


def test_submission_rejects_control_characters_in_single_line_fields() -> None:
    with pytest.raises(ValidationError):
        ContactSubmission(
            name="Ada\x07", email="ada@example.com", subject="Hello", message="A long message"
        )


PEER = "10.0.0.1"


@pytest.mark.parametrize(
    ("count", "lines", "expected"),
    [
        # Untrusted (count 0): forwarded headers are ignored however they are sent.
        (0, (), PEER),
        (0, ("198.51.100.7",), PEER),
        (0, ("6.6.6.6", "198.51.100.7"), PEER),
        (0, ("6.6.6.6, 7.7.7.7, 198.51.100.7",), PEER),
        # Comma-separated values in a single line.
        (1, ("198.51.100.7",), "198.51.100.7"),
        (1, ("spoofed, 198.51.100.7",), "198.51.100.7"),
        (1, (" 6.6.6.6 ,198.51.100.7 ",), "198.51.100.7"),
        (2, ("198.51.100.7, 10.1.1.1",), "198.51.100.7"),
        (2, ("6.6.6.6, 198.51.100.7, 10.1.1.1",), "198.51.100.7"),
        # Repeated header lines: a client-sent first line cannot replace the proxy's line.
        (1, ("6.6.6.6", "198.51.100.7"), "198.51.100.7"),
        (1, ("6.6.6.6, 7.7.7.7", "198.51.100.7"), "198.51.100.7"),
        (2, ("6.6.6.6", "198.51.100.7", "10.1.1.1"), "198.51.100.7"),
        (2, ("6.6.6.6, 198.51.100.7", "10.1.1.1"), "198.51.100.7"),
        # Empty items are skipped rather than counted as hops.
        (1, ("198.51.100.7, ",), "198.51.100.7"),
        (1, ("198.51.100.7", ""), "198.51.100.7"),
        # Fewer entries than trusted proxies: fall back to the TCP peer, never guess.
        (2, ("198.51.100.7",), PEER),
        (3, ("6.6.6.6", "198.51.100.7"), PEER),
        (1, (), PEER),
    ],
)
def test_client_address(count: int, lines: tuple[str, ...], expected: str) -> None:
    assert client_address(_request(PEER, *lines), count) == expected


def test_spoofed_entries_never_change_the_identity_behind_one_trusted_proxy() -> None:
    real = "198.51.100.7"
    for spoof in ("1.1.1.1", "2.2.2.2", "unknown", "::1", "203.0.113.200, 203.0.113.201"):
        assert client_address(_request(PEER, spoof, real), 1) == real
        assert client_address(_request(PEER, f"{spoof}, {real}"), 1) == real


def test_errors_use_the_shared_envelope(client: TestClient) -> None:
    not_found = client.get("/api/v1/does-not-exist")
    assert not_found.json() == {"error": {"code": "not_found", "message": "Not Found"}}
    assert not_found.headers["cache-control"] == "no-store"

    wrong_method = client.get("/api/v1/contact")
    assert wrong_method.status_code == 405
    assert wrong_method.json()["error"]["code"] == "method_not_allowed"
