"""Resolve the client address used for rate limiting.

X-Forwarded-For is client-controlled except for the entries appended by proxies we run
behind. With ``trusted_proxy_count = n`` the address is the n-th entry from the right, which
is the one written by the outermost trusted proxy. With 0 the header is ignored.

Repeated header lines are one list (RFC 9110 section 5.3): ``X-Forwarded-For: a`` followed by
``X-Forwarded-For: b`` means ``a, b``. All lines are joined in order, as uvicorn does, so a
client-sent line can never stand in for the line a proxy added after it.
"""

from __future__ import annotations

from starlette.requests import Request


def client_address(request: Request, trusted_proxy_count: int) -> str:
    peer = request.client.host if request.client else "unknown"
    if trusted_proxy_count <= 0:
        return peer
    joined = ",".join(request.headers.getlist("x-forwarded-for"))
    forwarded = [part.strip() for part in joined.split(",") if part.strip()]
    if len(forwarded) < trusted_proxy_count:
        return peer
    return forwarded[-trusted_proxy_count]
