"""A request id on every response (``X-Request-ID``) and in the logs of that request.

A well-formed id sent by the caller (8-64 letters, digits, ``-`` or ``_``, as a proxy might set)
is kept, so one id can follow a request across services; anything else is replaced with a fresh
random id, so a client cannot inject log content. Error logs include it (``current_request_id()``).
"""

from __future__ import annotations

import re
import uuid
from contextvars import ContextVar

from starlette.types import ASGIApp, Message, Receive, Scope, Send

HEADER = "x-request-id"
_VALID = re.compile(r"^[A-Za-z0-9_-]{8,64}$")
_current: ContextVar[str] = ContextVar("request_id", default="-")


def current_request_id() -> str:
    return _current.get()


class RequestIdMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        incoming = dict(scope.get("headers") or []).get(HEADER.encode(), b"").decode("latin-1")
        request_id = incoming if _VALID.match(incoming) else uuid.uuid4().hex
        token = _current.set(request_id)

        async def send_with_id(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = [
                    (k, v) for k, v in message.get("headers", []) if k.lower() != HEADER.encode()
                ]
                headers.append((HEADER.encode(), request_id.encode()))
                message["headers"] = headers
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        finally:
            _current.reset(token)
