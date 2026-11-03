from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from core.db import get_db
from core.security import hash_password, password_problems, verify_password
from models.entities import OwnerSession, utcnow
from models.v1 import LoginIn, PasswordChangeIn
from routers.v1.common import _value
from services import activity
from services.auth import (
    OwnerContext,
    _aware,
    authenticate,
    clear_cookie,
    client_ip,
    login_throttle,
    require_csrf,
    require_owner,
    revoke_sessions,
    start_session,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _user_out(owner: OwnerContext) -> dict:
    return {"email": owner.user.email, "display_name": owner.user.display_name}


@router.post("/login", dependencies=[Depends(require_csrf)])
def login(body: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    ip = client_ip(request)
    email = str(body.email).lower()
    login_throttle.check(f"ip:{ip}", f"email:{email}")
    user = authenticate(db, email, body.password)
    if user is None:
        login_throttle.fail(f"ip:{ip}", f"email:{email}")
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")
    login_throttle.reset(f"email:{email}")
    session = start_session(db, user, request, response)
    owner = OwnerContext(user=user, session=session, ip=ip)
    activity.record(db, owner, "sign_in", "session", "Signed in", session.id)
    return {"user": _user_out(owner)}


@router.post("/logout")
def logout(response: Response, owner: OwnerContext = Depends(require_owner), db: Session = Depends(get_db)):
    owner.session.revoked_at = utcnow()
    activity.record(db, owner, "sign_out", "session", "Signed out", owner.session.id)
    clear_cookie(response)
    return {"success": True}


@router.get("/me")
def me(owner: OwnerContext = Depends(require_owner)):
    return {"user": _user_out(owner)}


@router.post("/password")
def change_password(body: PasswordChangeIn, owner: OwnerContext = Depends(require_owner), db: Session = Depends(get_db)):
    if not verify_password(body.current_password, owner.user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    problems = password_problems(body.new_password)
    if problems:
        raise HTTPException(status_code=422, detail=" ".join(problems))
    if verify_password(body.new_password, owner.user.password_hash):
        raise HTTPException(status_code=422, detail="Choose a password you have not just used.")
    owner.user.password_hash = hash_password(body.new_password)
    owner.user.password_changed_at = utcnow()
    revoke_sessions(db, owner.user.id, except_id=owner.session.id)
    activity.record(db, owner, "password_change", "account", "Changed password and signed out other sessions")
    return {"success": True}


@router.get("/sessions")
def list_sessions(owner: OwnerContext = Depends(require_owner), db: Session = Depends(get_db)):
    now = utcnow()
    sessions = db.scalars(
        select(OwnerSession)
        .where(OwnerSession.user_id == owner.user.id, OwnerSession.revoked_at.is_(None))
        .order_by(OwnerSession.last_seen_at.desc())
    )
    return [
        {
            "id": s.id,
            "created_at": _value(s.created_at),
            "last_seen_at": _value(s.last_seen_at),
            "expires_at": _value(s.expires_at),
            "ip_address": s.ip_address,
            "user_agent": s.user_agent,
            "current": s.id == owner.session.id,
        }
        for s in sessions
        if _aware(s.expires_at) > now
    ]


@router.delete("/sessions/{session_id}")
def revoke_session(session_id: int, owner: OwnerContext = Depends(require_owner), db: Session = Depends(get_db)):
    session = db.get(OwnerSession, session_id)
    if session is None or session.user_id != owner.user.id:
        raise HTTPException(status_code=404, detail="Session not found.")
    session.revoked_at = utcnow()
    activity.record(db, owner, "revoke_session", "session", f"Revoked session {session_id}", session_id)
    return {"success": True}
