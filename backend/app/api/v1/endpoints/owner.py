"""``/api/v1/owner``: the Owner Studio API.

Authentication is attached to the router, not to each endpoint, so every route added here is
owner-only (and CSRF-checked for state-changing methods) by construction.
``tests/test_owner_api.py`` fails if any route under this prefix answers without a session.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response

from app.api.owner_access import require_owner
from app.api.v1.endpoints import owner_content, owner_media, owner_messages
from app.database.session import DbSession
from app.schemas.auth import MessageCounts, OwnerOverview
from app.services import auth as auth_service

router = APIRouter(prefix="/owner", tags=["owner studio"], dependencies=[Depends(require_owner)])


@router.get("/overview", response_model=OwnerOverview, summary="Studio overview")
def overview(response: Response, session: DbSession) -> OwnerOverview:
    counts = auth_service.message_counts(session)
    response.headers["Cache-Control"] = "no-store"
    return OwnerOverview(messages=MessageCounts(**counts))


# Content management, dashboard and activity: protected by this router's guard.
router.include_router(owner_content.router)
router.include_router(owner_media.router)
router.include_router(owner_messages.router)
