"""Resolve the client address used for rate limiting and analytics.

X-Forwarded-For is client-controlled except for the entries appended by proxies we run
behind. With ``trusted_proxy_count = n`` the address is the n-th entry from the right, which
is the one written by the outermost trusted proxy. With 0 the header is ignored.

That position is only right for requests that took the expected path. The API's own URL is also
public, and a request sent straight to it passes through fewer proxies, so its n-th entry from
the right can be text the caller wrote. When ``TRUSTED_PROXY_SECRET`` is set, the header is
therefore used only on requests carrying that secret, which the site's proxy adds; any other
request is identified by its TCP peer.

Repeated header lines are one list (RFC 9110 section 5.3): ``X-Forwarded-For: a`` followed by
``X-Forwarded-For: b`` means ``a, b``. All lines are joined in order, as uvicorn does, so a
client-sent line can never stand in for the line a proxy added after it.
"""

from __future__ import annotations

import hmac
from typing import Literal

from starlette.requests import Request

from app.core.config import Settings

PROXY_SECRET_HEADER = "x-trusted-proxy-secret"  # noqa: S105 - a header name

ProxySecretStatus = Literal["not_configured", "verified", "rejected"]


def _peer(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def client_address(request: Request, trusted_proxy_count: int) -> str:
    """The address at this position of the chain, without checking how the request arrived."""
    peer = _peer(request)
    if trusted_proxy_count <= 0:
        return peer
    joined = ",".join(request.headers.getlist("x-forwarded-for"))
    forwarded = [part.strip() for part in joined.split(",") if part.strip()]
    if len(forwarded) < trusted_proxy_count:
        return peer
    return forwarded[-trusted_proxy_count]


def proxy_secret_status(request: Request, settings: Settings) -> ProxySecretStatus:
    expected = settings.trusted_proxy_secret
    if expected is None:
        return "not_configured"
    received = request.headers.get(PROXY_SECRET_HEADER, "")
    matches = hmac.compare_digest(received.encode(), expected.get_secret_value().encode())
    return "verified" if matches else "rejected"


def resolve_client_address(request: Request, settings: Settings) -> str:
    """The address to use for this request: forwarded only if it came through the trusted path."""
    if proxy_secret_status(request, settings) == "rejected":
        return _peer(request)
    return client_address(request, settings.trusted_proxy_count)
