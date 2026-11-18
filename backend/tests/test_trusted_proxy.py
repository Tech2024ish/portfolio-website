"""X-Forwarded-For is believed only on requests that came through the site's proxy."""

from __future__ import annotations

from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient
from starlette.requests import Request

from app.core.client_ip import (
    PROXY_SECRET_HEADER,
    proxy_secret_status,
    resolve_client_address,
)
from tests.conftest import SettingsFactory, signed_in

SECRET = "a-long-random-proxy-secret-for-the-tests-0123456789"
PEER = "10.0.0.1"
# Through the site: the visitor, then three proxies.
CHAIN = "198.51.100.7, 76.76.21.1, 172.70.1.1, 10.1.1.1"
# Straight to the API: the caller wrote the first two entries, two proxies added the rest.
FORGED_CHAIN = "203.0.113.66, 203.0.113.67, 192.0.2.10, 172.70.1.1"
DIAGNOSTICS = "/api/v1/owner/diagnostics/client-address"


def _request(forwarded: str, secret: str | None = None) -> Request:
    headers = [(b"x-forwarded-for", forwarded.encode())]
    if secret is not None:
        headers.append((PROXY_SECRET_HEADER.encode(), secret.encode()))
    return Request({"type": "http", "headers": headers, "client": (PEER, 1234)})


def test_requests_with_the_secret_use_the_forwarded_address(
    make_settings: SettingsFactory,
) -> None:
    settings = make_settings(trusted_proxy_count=4, trusted_proxy_secret=SECRET)
    request = _request(CHAIN, SECRET)
    assert proxy_secret_status(request, settings) == "verified"
    assert resolve_client_address(request, settings) == "198.51.100.7"


@pytest.mark.parametrize("sent", [None, "", "wrong", SECRET[:-1], SECRET + "x", "é"])
def test_a_forged_chain_without_the_secret_cannot_choose_the_address(
    make_settings: SettingsFactory, sent: str | None
) -> None:
    settings = make_settings(trusted_proxy_count=4, trusted_proxy_secret=SECRET)
    request = _request(FORGED_CHAIN, sent)
    assert proxy_secret_status(request, settings) == "rejected"
    assert resolve_client_address(request, settings) == PEER


def test_without_a_configured_secret_the_position_rule_still_applies(
    make_settings: SettingsFactory,
) -> None:
    """Lets the site start sending the secret before the API starts requiring it."""
    settings = make_settings(trusted_proxy_count=4)
    request = _request(CHAIN, "anything")
    assert proxy_secret_status(request, settings) == "not_configured"
    assert resolve_client_address(request, settings) == "198.51.100.7"


@pytest.mark.postgres
def test_the_diagnostics_report_the_secret_without_revealing_it(
    make_api: Callable[..., TestClient], owner: int
) -> None:
    client = make_api(trusted_proxy_count=4, trusted_proxy_secret=SECRET)
    signed_in(client)

    forged = client.get(DIAGNOSTICS, headers={"X-Forwarded-For": FORGED_CHAIN})
    assert forged.json()["proxy_secret"] == "rejected"
    assert forged.json()["proxy_secret_received"] is False
    assert forged.json()["resolved"] == "testclient"

    through_site = client.get(
        DIAGNOSTICS, headers={"X-Forwarded-For": CHAIN, PROXY_SECRET_HEADER: SECRET}
    )
    assert through_site.json()["proxy_secret"] == "verified"
    assert through_site.json()["proxy_secret_received"] is True
    assert through_site.json()["resolved"] == "198.51.100.7"
    assert SECRET not in through_site.text
