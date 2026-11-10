"""One error envelope for every failure: ``{"error": {"code", "message", "fields"?}}``.

The frontend client (``frontend/src/lib/api/client.ts``) parses exactly this shape. Messages
are safe to show to users; internal details (SQL, connection strings, stack traces) never
leave the server and are logged instead.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DBAPIError, OperationalError
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("app.errors")


class AppError(Exception):
    """An expected failure with a stable, machine-readable ``code``."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        *,
        fields: list[dict[str, str]] | None = None,
        headers: Mapping[str, str] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.fields = fields
        self.headers = dict(headers) if headers else None


def error_response(
    status_code: int,
    code: str,
    message: str,
    *,
    fields: list[dict[str, str]] | None = None,
    headers: Mapping[str, str] | None = None,
) -> JSONResponse:
    body: dict[str, Any] = {"code": code, "message": message}
    if fields:
        body["fields"] = fields
    final_headers = {"Cache-Control": "no-store", **(headers or {})}
    return JSONResponse({"error": body}, status_code=status_code, headers=final_headers)


_HTTP_CODES = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    413: "payload_too_large",
    415: "unsupported_media_type",
    429: "rate_limited",
}


def _field_name(loc: tuple[int | str, ...]) -> str:
    # ("body", "email") -> "email"; a body that is not an object at all -> "body".
    parts = [str(part) for part in loc if part != "body"]
    return ".".join(parts) or "body"


def _field_message(error: dict[str, Any]) -> str:
    kind = error.get("type", "")
    ctx = error.get("ctx") or {}
    if kind == "missing":
        return "This field is required."
    if kind == "string_too_short":
        value = error.get("input")
        if isinstance(value, str) and not value.strip():
            return "This field is required."
        return f"Must be at least {ctx.get('min_length')} characters."
    if kind == "string_too_long":
        return f"Must be at most {ctx.get('max_length')} characters."
    if kind == "value_error" and "email" in str(error.get("msg", "")).lower():
        return "Enter a valid email address."
    if kind == "extra_forbidden":
        return "Unexpected field."
    if kind in {"json_invalid", "model_attributes_type", "dict_type"}:
        return "The request body must be a JSON object."
    message = str(error.get("msg", "Invalid value."))
    return message.removeprefix("Value error, ")


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_: Request, exc: AppError) -> JSONResponse:
        return error_response(
            exc.status_code, exc.code, exc.message, fields=exc.fields, headers=exc.headers
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        fields: list[dict[str, str]] = []
        seen: set[str] = set()
        for error in exc.errors():
            name = _field_name(tuple(error.get("loc", ())))
            if name in seen:  # one message per field keeps the UI readable
                continue
            seen.add(name)
            fields.append({"field": name, "message": _field_message(error)})
        return error_response(422, "validation_error", "Some fields need attention.", fields=fields)

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = _HTTP_CODES.get(exc.status_code, "http_error")
        message = exc.detail if isinstance(exc.detail, str) else "Request failed."
        return error_response(exc.status_code, code, message, headers=exc.headers)

    @app.exception_handler(OperationalError)
    @app.exception_handler(DBAPIError)
    async def _database_error(_: Request, exc: DBAPIError) -> JSONResponse:
        # Connection refused, timeouts, pooler outages. Log the class, never the URL or SQL.
        logger.error("database error: %s", type(exc.orig).__name__ if exc.orig else type(exc))
        return error_response(
            503,
            "service_unavailable",
            "The service is temporarily unavailable. Please try again later.",
        )

    @app.exception_handler(Exception)
    async def _unexpected(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled error", exc_info=exc)
        return error_response(500, "internal_error", "Something went wrong on our side.")
