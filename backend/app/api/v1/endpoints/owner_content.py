"""Owner content management: profile, every content collection, the dashboard and activity.

These routers are included in the owner router (``app.api.v1.endpoints.owner``), whose
router-level guard requires the owner session (and the CSRF token for state changes) on every
route here.

Each collection gets the same routes from ``collection_router``:
    GET    /owner/{collection}                 list (drafts included)
    POST   /owner/{collection}                 create (as a draft)
    POST   /owner/{collection}/reorder         set the order
    GET    /owner/{collection}/{id}            one item, for editing or preview
    PUT    /owner/{collection}/{id}            update; body includes the loaded ``version``
    DELETE /owner/{collection}/{id}            soft delete
    POST   /owner/{collection}/{id}/publish    publishable collections only
    POST   /owner/{collection}/{id}/unpublish  publishable collections only

This module deliberately has no ``from __future__ import annotations``: route signatures use
the collection's schema classes, which FastAPI must see as real classes, not strings.
"""

from typing import Any

from fastapi import APIRouter, BackgroundTasks, Query, Request, Response, status

from app.api.owner_access import Owner, settings_of
from app.database.session import DbSession
from app.integrations.revalidate import notify_content_changed
from app.schemas.content import (
    AuditEventOut,
    OwnerDashboard,
    ProfileOut,
    ProfileUpdate,
    RecentMessage,
    ReorderRequest,
    StatusCounts,
)
from app.services import audit
from app.services import auth as auth_service
from app.services import content as service
from app.services.content import COLLECTIONS, CollectionSpec

_NO_STORE = {"Cache-Control": "no-store"}


def _changed(request: Request, tasks: BackgroundTasks) -> None:
    """After a committed change: let the public site refresh, once the response is sent."""
    tasks.add_task(notify_content_changed, settings_of(request))


def collection_router(spec: CollectionSpec) -> APIRouter:
    router = APIRouter(prefix=f"/{spec.key}", tags=["owner content"])
    fields = spec.fields
    update = spec.update
    out = spec.out

    @router.get("", response_model=list[out], summary=f"All {spec.label.lower()} items")  # type: ignore[valid-type]
    def list_items(session: DbSession, response: Response) -> list[Any]:
        response.headers.update(_NO_STORE)
        return service.list_items(session, spec)

    @router.post("", response_model=out, status_code=status.HTTP_201_CREATED)
    def create_item(
        body: fields,  # type: ignore[valid-type]
        owner: Owner,
        request: Request,
        tasks: BackgroundTasks,
        session: DbSession,
    ) -> Any:
        item = service.create_item(session, owner, spec, body)
        session.commit()
        _changed(request, tasks)
        return item

    @router.post("/reorder", status_code=status.HTTP_204_NO_CONTENT)
    def reorder(
        body: ReorderRequest,
        owner: Owner,
        request: Request,
        tasks: BackgroundTasks,
        session: DbSession,
    ) -> Response:
        service.reorder(session, owner, spec, body.ids)
        session.commit()
        _changed(request, tasks)
        return Response(status_code=status.HTTP_204_NO_CONTENT, headers=_NO_STORE)

    @router.get("/{item_id}", response_model=out)
    def get_item(item_id: int, session: DbSession, response: Response) -> Any:
        response.headers.update(_NO_STORE)
        return service.get_item(session, spec, item_id)

    @router.put("/{item_id}", response_model=out)
    def update_item(
        item_id: int,
        body: update,  # type: ignore[valid-type]
        owner: Owner,
        request: Request,
        tasks: BackgroundTasks,
        session: DbSession,
    ) -> Any:
        item = service.update_item(session, owner, spec, item_id, body)
        session.commit()
        _changed(request, tasks)
        return item

    @router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_item(
        item_id: int,
        owner: Owner,
        request: Request,
        tasks: BackgroundTasks,
        session: DbSession,
    ) -> Response:
        service.delete_item(session, owner, spec, item_id)
        session.commit()
        _changed(request, tasks)
        return Response(status_code=status.HTTP_204_NO_CONTENT, headers=_NO_STORE)

    if spec.publishable:

        @router.post("/{item_id}/publish", response_model=out)
        def publish(
            item_id: int,
            owner: Owner,
            request: Request,
            tasks: BackgroundTasks,
            session: DbSession,
        ) -> Any:
            item = service.set_published(session, owner, spec, item_id, published=True)
            session.commit()
            _changed(request, tasks)
            return item

        @router.post("/{item_id}/unpublish", response_model=out)
        def unpublish(
            item_id: int,
            owner: Owner,
            request: Request,
            tasks: BackgroundTasks,
            session: DbSession,
        ) -> Any:
            item = service.set_published(session, owner, spec, item_id, published=False)
            session.commit()
            _changed(request, tasks)
            return item

    return router


router = APIRouter()
for _spec in COLLECTIONS.values():
    router.include_router(collection_router(_spec))


@router.get("/profile", response_model=ProfileOut, tags=["owner content"], summary="The profile")
def get_profile(session: DbSession, response: Response) -> Any:
    response.headers.update(_NO_STORE)
    return service.get_profile(session)


@router.put(
    "/profile", response_model=ProfileOut, tags=["owner content"], summary="Save the profile"
)
def save_profile(
    body: ProfileUpdate,
    owner: Owner,
    request: Request,
    tasks: BackgroundTasks,
    session: DbSession,
) -> Any:
    profile = service.save_profile(session, owner, body)
    session.commit()
    _changed(request, tasks)
    return profile


@router.get("/activity", response_model=list[AuditEventOut], tags=["owner content"])
def activity(
    session: DbSession,
    response: Response,
    limit: int = Query(default=50, ge=1, le=200),
) -> Any:
    response.headers.update(_NO_STORE)
    return audit.recent(session, limit)


@router.get("/dashboard", response_model=OwnerDashboard, tags=["owner content"])
def dashboard(session: DbSession, response: Response) -> OwnerDashboard:
    response.headers.update(_NO_STORE)
    content = {
        spec.key: StatusCounts(**service.status_counts(session, spec))
        for spec in COLLECTIONS.values()
        if spec.publishable
    }
    return OwnerDashboard(
        messages=auth_service.message_counts(session),
        content=content,
        recent_messages=[
            RecentMessage(
                id=message.id,
                created_at=message.created_at,
                name=message.name,
                subject=message.subject,
                status=message.status,
            )
            for message in service.recent_messages(session)
        ],
        recent_activity=[AuditEventOut.model_validate(event) for event in audit.recent(session, 8)],
    )
