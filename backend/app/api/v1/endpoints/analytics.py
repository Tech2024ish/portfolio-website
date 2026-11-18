"""``POST /api/v1/analytics/pageview``: the public site reports a page view.

Always answers 204, whether or not the view was counted, so the response reveals nothing (for
example whether a slug exists or a visitor was excluded). What counts is decided in
``app.services.analytics``. The body is capped before parsing and each address is rate limited.
"""

from __future__ import annotations

from datetime import timedelta
from urllib.parse import urlsplit

from fastapi import APIRouter, Request, Response, status

from app.api.owner_access import settings_of
from app.core.client_ip import resolve_client_address
from app.database.session import DbSession
from app.repositories import rate_limit
from app.schemas.site import PageViewIn
from app.services import analytics

router = APIRouter(prefix="/analytics", tags=["analytics"])

MAX_BODY_BYTES = 4 * 1024
RATE_LIMIT_BUCKET = "pageview"
RATE_LIMIT = 120  # views per address per hour: generous for a person, a ceiling for scripts


@router.post("/pageview", status_code=status.HTTP_204_NO_CONTENT, include_in_schema=False)
def page_view(body: PageViewIn, request: Request, session: DbSession) -> Response:
    settings = settings_of(request)
    address = resolve_client_address(request, settings)
    key = rate_limit.client_key(RATE_LIMIT_BUCKET, address)
    if rate_limit.acquire(session, RATE_LIMIT_BUCKET, key, RATE_LIMIT, timedelta(hours=1)):
        headers = request.headers
        analytics.record_view(
            session,
            path=body.path,
            referrer=body.referrer,
            user_agent=headers.get("user-agent"),
            client_address=address,
            is_owner=settings.session_cookie_name in request.cookies,
            opted_out=headers.get("dnt") == "1" or headers.get("sec-gpc") == "1",
            own_host=(urlsplit(settings.public_site_url).hostname or "").lower(),
        )
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT, headers={"Cache-Control": "no-store"})
