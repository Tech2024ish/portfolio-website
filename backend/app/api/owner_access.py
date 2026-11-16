"""Server-side authentication and authorisation for owner endpoints.

``require_owner`` is the single gate: it resolves the session cookie to an active owner
session and, for state-changing methods, also verifies the request (CSRF):

- The ``X-CSRF-Token`` header must equal the token derived from the session cookie. Another site
  cannot read that token, and browsers will not attach a custom header to a cross-site request
  without a CORS preflight, which only the configured origins pass.
- An ``Origin`` header, when present, must be one of the site's own origins.

The session cookie is HttpOnly, Secure (``__Host-`` prefix in production) and SameSite=Strict,
so it is never sent with requests that start on another site.

Sign-in has no session yet; ``require_trusted_origin`` checks the Origin and requires a JSON
body, which cannot be sent cross-site without a preflight.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Request, Response

from app.core.config import Settings
from app.core.errors import AppError
from app.core.security import csrf_token_matches
from app.database.session import DbSession
from app.services.auth import OwnerContext, authenticate

SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})
CSRF_HEADER = "X-CSRF-Token"

_UNVERIFIED = "This request could not be verified. Reload the page and try again."


def settings_of(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


def _check_origin(request: Request, settings: Settings) -> None:
    origin = request.headers.get("origin")
    if origin is not None and origin.rstrip("/") not in settings.allowed_origins:
        raise AppError(403, "forbidden", _UNVERIFIED)


def require_trusted_origin(request: Request) -> None:
    """For sign-in: an allowed Origin (when sent) and a JSON body."""
    _check_origin(request, settings_of(request))
    content_type = request.headers.get("content-type", "")
    if content_type.split(";")[0].strip().lower() != "application/json":
        raise AppError(415, "unsupported_media_type", "Send the request as JSON.")


def session_token(request: Request) -> str | None:
    return request.cookies.get(settings_of(request).session_cookie_name)


def require_owner(request: Request, session: DbSession) -> OwnerContext:
    settings = settings_of(request)
    owner = authenticate(session, session_token(request), settings)
    if owner is None:
        raise AppError(401, "unauthorized", "Sign in to continue.")
    if request.method not in SAFE_METHODS:
        _check_origin(request, settings)
        if not csrf_token_matches(owner.token, request.headers.get(CSRF_HEADER)):
            raise AppError(403, "forbidden", _UNVERIFIED)
    return owner


Owner = Annotated[OwnerContext, Depends(require_owner)]


def set_session_cookie(response: Response, token: str, settings: Settings) -> None:
    response.set_cookie(
        settings.session_cookie_name,
        token,
        max_age=settings.session_ttl_hours * 3600,
        path="/",
        secure=settings.cookie_secure,
        httponly=True,
        samesite="strict",
    )


def clear_session_cookie(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        settings.session_cookie_name,
        path="/",
        secure=settings.cookie_secure,
        httponly=True,
        samesite="strict",
    )
