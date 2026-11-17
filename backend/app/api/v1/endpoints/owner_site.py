"""``/api/v1/owner/settings`` and ``/api/v1/owner/analytics``. Included in the owner router, whose
guard requires the owner session (and the CSRF token for changes)."""

from __future__ import annotations

from datetime import date
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Query, Request, Response

from app.api.owner_access import Owner, settings_of
from app.database.session import DbSession
from app.integrations.revalidate import notify_content_changed
from app.schemas.site import AnalyticsSummary, SettingsOut, SettingsUpdate
from app.services import analytics
from app.services import site as service

router = APIRouter(tags=["owner settings"])
_NO_STORE = {"Cache-Control": "no-store"}


@router.get("/settings", response_model=SettingsOut, summary="The website settings")
def get_settings(session: DbSession, response: Response) -> SettingsOut:
    response.headers.update(_NO_STORE)
    return service.read(session)


@router.put("/settings", response_model=SettingsOut, summary="Save the website settings")
def save_settings(
    body: SettingsUpdate, owner: Owner, request: Request, tasks: BackgroundTasks, session: DbSession
) -> SettingsOut:
    saved = service.save(session, owner, body)
    session.commit()
    tasks.add_task(notify_content_changed, settings_of(request))  # the public pages use them
    return saved


@router.get("/analytics", response_model=AnalyticsSummary, summary="Page views in a date range")
def get_analytics(
    session: DbSession,
    response: Response,
    start: Annotated[date | None, Query()] = None,
    end: Annotated[date | None, Query()] = None,
) -> AnalyticsSummary:
    response.headers.update(_NO_STORE)
    return analytics.summary(session, start, end)
