from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from core.config import get_settings
from core.db import get_db
from models.entities import ContactMessage, MessageReply, SiteProfile, utcnow
from models.v1 import MessagePatch, ReplyIn
from routers.v1.common import get_or_404, row_out, search_filter
from services import activity
from services.auth import OwnerContext, require_owner
from services.email import get_sender

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_owner)])


def _message_out(message: ContactMessage, with_replies: bool = False) -> dict:
    out = row_out(message)
    out["reply_count"] = len(message.replies)
    statuses = [reply.status for reply in message.replies]
    out["last_reply_status"] = statuses[-1] if statuses else None
    if with_replies:
        out["replies"] = [row_out(reply) for reply in message.replies]
    return out


@router.get("/messages")
def list_messages(
    q: str | None = None,
    folder: str = "inbox",
    db: Session = Depends(get_db),
):
    stmt = select(ContactMessage).options(selectinload(ContactMessage.replies)).order_by(ContactMessage.created_at.desc())
    if folder == "archived":
        stmt = stmt.where(ContactMessage.archived_at.is_not(None))
    else:
        stmt = stmt.where(ContactMessage.archived_at.is_(None))
        if folder == "unread":
            stmt = stmt.where(ContactMessage.is_read.is_(False))
    condition = search_filter([ContactMessage.name, ContactMessage.email, ContactMessage.subject, ContactMessage.message], q)
    if condition is not None:
        stmt = stmt.where(condition)
    unread = db.scalar(
        select(func.count()).where(ContactMessage.is_read.is_(False), ContactMessage.archived_at.is_(None))
    )
    return {"items": [_message_out(m) for m in db.scalars(stmt.limit(200))], "unread": unread}


@router.get("/messages/{item_id}")
def get_message(item_id: int, db: Session = Depends(get_db)):
    message = get_or_404(db, ContactMessage, item_id, "Message")
    return _message_out(message, with_replies=True)


@router.patch("/messages/{item_id}")
def update_message(item_id: int, body: MessagePatch, owner: OwnerContext = Depends(require_owner), db: Session = Depends(get_db)):
    message = get_or_404(db, ContactMessage, item_id, "Message")
    if body.is_read is not None:
        message.is_read = body.is_read
    if body.archived is not None:
        message.archived_at = utcnow() if body.archived else None
        activity.record(
            db, owner, "archive" if body.archived else "unarchive", "message", f"{'Archived' if body.archived else 'Restored'} message from {message.name}", message.id
        )
    db.flush()
    return _message_out(message, with_replies=True)


def _deliver(db: Session, message: ContactMessage, reply: MessageReply) -> None:
    profile = db.get(SiteProfile, 1)
    reply_to = get_settings().mail_reply_to or (profile.email if profile else None)
    reply.attempts += 1
    quoted = "\n".join(f"> {line}" for line in message.message.splitlines())
    text = f"{reply.body}\n\n---\nOn {message.created_at:%d %b %Y}, {message.name} wrote:\n{quoted}"
    result = get_sender().send(to=message.email, subject=reply.subject, text=text, reply_to=reply_to)
    reply.status = result.status
    reply.error = result.error
    reply.provider_message_id = result.provider_message_id
    reply.sent_at = utcnow() if result.status == "sent" else None


@router.post("/messages/{item_id}/replies", status_code=201)
def reply_to_message(item_id: int, body: ReplyIn, owner: OwnerContext = Depends(require_owner), db: Session = Depends(get_db)):
    message = get_or_404(db, ContactMessage, item_id, "Message")
    reply = MessageReply(message_id=message.id, subject=body.subject, body=body.body, status="sending")
    db.add(reply)
    db.flush()
    # Persist the draft before calling the provider so a crash never loses the text.
    db.commit()
    _deliver(db, message, reply)
    message.is_read = True
    activity.record(db, owner, "reply", "message", f"Reply to {message.email}: {reply.status}", message.id)
    db.flush()
    db.refresh(message)
    return {"reply": row_out(reply), "message": _message_out(message, with_replies=True)}


@router.post("/replies/{reply_id}/retry")
def retry_reply(reply_id: int, owner: OwnerContext = Depends(require_owner), db: Session = Depends(get_db)):
    reply = get_or_404(db, MessageReply, reply_id, "Reply")
    if reply.status == "sent":
        raise HTTPException(status_code=409, detail="This reply was already sent.")
    _deliver(db, reply.message, reply)
    activity.record(db, owner, "reply_retry", "message", f"Retried reply to {reply.message.email}: {reply.status}", reply.message_id)
    db.flush()
    return {"reply": row_out(reply)}
