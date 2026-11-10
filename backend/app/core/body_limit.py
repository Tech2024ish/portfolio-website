"""Reject oversized request bodies before they are read or parsed.

FastAPI reads and parses a whole JSON body before any length validation runs, so without a
cap a client could make the API buffer an arbitrarily large payload. This ASGI middleware
enforces a byte limit per (method, path):

- A declared ``Content-Length`` above the limit is answered with 413 immediately; the
  application is never called and the body is never read.
- Bodies without a usable ``Content-Length`` (for example chunked uploads) are counted as
  they arrive; reading stops with 413 as soon as the limit is passed, before any parsing.
  FastAPI re-raises Starlette's ``HTTPException`` from body reading, so the normal error
  envelope is returned.
"""

from __future__ import annotations

from collections.abc import Mapping

from starlette.datastructures import Headers
from starlette.exceptions import HTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.errors import error_response

_MESSAGE = "The request body is too large."


class BodySizeLimitMiddleware:
    def __init__(self, app: ASGIApp, limits: Mapping[tuple[str, str], int]) -> None:
        self.app = app
        self.limits = dict(limits)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        limit = self.limits.get((scope["method"], scope["path"]))
        if limit is None:
            await self.app(scope, receive, send)
            return

        declared = Headers(scope=scope).get("content-length")
        if declared is not None and declared.isdigit() and int(declared) > limit:
            response = error_response(413, "payload_too_large", _MESSAGE)
            await response(scope, receive, send)
            return

        received = 0

        async def limited_receive() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    raise HTTPException(413, _MESSAGE)
            return message

        await self.app(scope, limited_receive, send)
