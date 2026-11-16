"""``/api/v1/owner/messages``: the owner's inbox, replies and email delivery. Included in the owner
router, whose guard requires the owner session (and the CSRF token for changes)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Query, Request, Response, status

from app.api.owner_access import Owner, settings_of
from app.database.session import DbSession
from app.schemas.inbox import (
    DeliveryOut,
    MessageDetail,
    MessagePage,
    MessageSummary,
    ReplyRequest,
    StatusUpdate,
)
from app.services import inbox, mail

router = APIRouter(tags=["owner inbox"])
_NO_STORE = {"Cache-Control": "no-store"}
SNIPPET = 160


def _send_soon(request: Request, tasks: BackgroundTasks) -> None:
    tasks.add_task(mail.process_due, request.app.state.database, settings_of(request))


def _detail(request: Request, session: DbSession, message_id: int) -> MessageDetail:
    message = inbox.get_message(session, message_id)
    return MessageDetail(
        id=message.id,
        created_at=message.created_at,
        name=message.name,
        email=message.email,
        subject=message.subject,
        message=message.message,
        status=message.status,  # type: ignore[arg-type]
        spam_reason=message.spam_reason,
        read_at=message.read_at,
        deliveries=[
            DeliveryOut.model_validate(row) for row in inbox.deliveries(session, message.id)
        ],
        email_configured=settings_of(request).email_configured,
    )


@router.get("/messages", response_model=MessagePage, summary="A page of messages, newest first")
def list_messages(
    session: DbSession,
    response: Response,
    view: Annotated[str, Query(alias="status")] = "inbox",
    q: Annotated[str | None, Query(max_length=100)] = None,
    page: Annotated[int, Query(ge=1, le=10_000)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> MessagePage:
    response.headers.update(_NO_STORE)
    rows, total, notified = inbox.list_messages(
        session, view=view, q=(q or "").strip() or None, page=page, page_size=page_size
    )
    return MessagePage(
        items=[
            MessageSummary(
                id=row.id,
                created_at=row.created_at,
                name=row.name,
                email=row.email,
                subject=row.subject,
                snippet=" ".join(row.message.split())[:SNIPPET],
                status=row.status,  # type: ignore[arg-type]
                notification=notified.get(row.id),  # type: ignore[arg-type]
            )
            for row in rows
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/messages/{message_id}", response_model=MessageDetail)
def get_message(
    message_id: int, request: Request, session: DbSession, response: Response
) -> MessageDetail:
    response.headers.update(_NO_STORE)
    return _detail(request, session, message_id)


@router.patch("/messages/{message_id}", response_model=MessageDetail, summary="Change the status")
def update_message(
    message_id: int, body: StatusUpdate, owner: Owner, request: Request, session: DbSession
) -> MessageDetail:
    inbox.set_status(session, owner, message_id, body.status)
    session.commit()
    return _detail(request, session, message_id)


@router.delete("/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_message(message_id: int, owner: Owner, session: DbSession) -> Response:
    inbox.delete_message(session, owner, message_id)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT, headers=_NO_STORE)


@router.post(
    "/messages/{message_id}/reply",
    response_model=DeliveryOut,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Reply by email; the result is tracked on the delivery",
)
def reply(
    message_id: int,
    body: ReplyRequest,
    owner: Owner,
    request: Request,
    tasks: BackgroundTasks,
    session: DbSession,
) -> DeliveryOut:
    message = inbox.get_message(session, message_id)
    delivery = mail.queue_reply(session, owner, message, body.body, settings_of(request))
    session.commit()
    _send_soon(request, tasks)
    # 202: queued. The delivery's status says whether the provider accepted it.
    return DeliveryOut.model_validate(delivery)


@router.post(
    "/deliveries/{delivery_id}/retry",
    response_model=DeliveryOut,
    status_code=status.HTTP_202_ACCEPTED,
)
def retry_delivery(
    delivery_id: int, owner: Owner, request: Request, tasks: BackgroundTasks, session: DbSession
) -> DeliveryOut:
    delivery = mail.retry(session, owner, delivery_id, settings_of(request))
    session.commit()
    _send_soon(request, tasks)
    return DeliveryOut.model_validate(delivery)
