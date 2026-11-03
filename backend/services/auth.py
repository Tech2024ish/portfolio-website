"""Owner authentication: sessions in an HttpOnly cookie, CSRF guard, throttling."""

from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from threading import Lock
from time import monotonic

from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from core.config import get_settings
from core.db import get_db
from core.security import DUMMY_HASH, new_session_token, token_digest, verify_password
from models.entities import OwnerSession, OwnerUser, utcnow

CSRF_HEADER = "x-requested-with"
CSRF_VALUE = "portfolio-admin"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
SESSION_IDLE_TIMEOUT = timedelta(hours=2)


def _aware(value: datetime) -> datetime:
    # SQLite returns naive datetimes; treat them as UTC.
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def client_ip(request: Request) -> str:
    # Behind Vercel/Render the first X-Forwarded-For entry is the visitor.
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()[:64]
    return (request.client.host if request.client else "unknown")[:64]


# ----------------------------------------------------------------- throttling


class LoginThrottle:
    """Per-IP and per-account failure counter (per process).

    Hosting-edge rate limiting is still recommended; this blocks naive guessing.
    """

    def __init__(self, max_failures: int = 5, window_seconds: int = 15 * 60):
        self.max_failures = max_failures
        self.window = window_seconds
        self._failures: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def _recent(self, key: str) -> deque[float]:
        bucket = self._failures[key]
        now = monotonic()
        while bucket and now - bucket[0] > self.window:
            bucket.popleft()
        return bucket

    def check(self, *keys: str) -> None:
        with self._lock:
            if any(len(self._recent(key)) >= self.max_failures for key in keys):
                raise HTTPException(status_code=429, detail="Too many failed sign-in attempts. Try again later.")

    def fail(self, *keys: str) -> None:
        with self._lock:
            for key in keys:
                self._recent(key).append(monotonic())

    def reset(self, *keys: str) -> None:
        with self._lock:
            for key in keys:
                self._failures.pop(key, None)


login_throttle = LoginThrottle()


# ----------------------------------------------------------------- sessions


def authenticate(db: Session, email: str, password: str) -> OwnerUser | None:
    user = db.scalar(select(OwnerUser).where(OwnerUser.email == email.strip().lower()))
    if user is None:
        verify_password(password, DUMMY_HASH)
        return None
    return user if verify_password(password, user.password_hash) else None


def start_session(db: Session, user: OwnerUser, request: Request, response: Response) -> OwnerSession:
    settings = get_settings()
    token = new_session_token()
    session = OwnerSession(
        user_id=user.id,
        token_hash=token_digest(token),
        expires_at=utcnow() + timedelta(hours=settings.session_ttl_hours),
        ip_address=client_ip(request),
        user_agent=(request.headers.get("user-agent") or "")[:300],
    )
    db.add(session)
    db.flush()
    response.set_cookie(
        settings.session_cookie_name,
        token,
        max_age=settings.session_ttl_hours * 3600,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="strict",
        path="/api",
    )
    return session


def clear_cookie(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(
        settings.session_cookie_name, path="/api", secure=settings.cookie_secure, httponly=True, samesite="strict"
    )


def revoke_sessions(db: Session, user_id: int, except_id: int | None = None) -> None:
    stmt = update(OwnerSession).where(OwnerSession.user_id == user_id, OwnerSession.revoked_at.is_(None))
    if except_id is not None:
        stmt = stmt.where(OwnerSession.id != except_id)
    db.execute(stmt.values(revoked_at=utcnow()))


@dataclass
class OwnerContext:
    user: OwnerUser
    session: OwnerSession
    ip: str


def _check_csrf(request: Request) -> None:
    if request.method in SAFE_METHODS:
        return
    if request.headers.get(CSRF_HEADER) != CSRF_VALUE:
        raise HTTPException(status_code=403, detail="Missing request verification header.")
    origin = request.headers.get("origin")
    if origin and origin.rstrip("/") not in get_settings().cors_origins:
        raise HTTPException(status_code=403, detail="Request origin is not allowed.")


def require_owner(request: Request, db: Session = Depends(get_db)) -> OwnerContext:
    """Server-side authorisation for every protected route."""
    token = request.cookies.get(get_settings().session_cookie_name)
    if not token:
        raise HTTPException(status_code=401, detail="Sign in to continue.")
    session = db.scalar(select(OwnerSession).where(OwnerSession.token_hash == token_digest(token)))
    now = utcnow()
    if (
        session is None
        or session.revoked_at is not None
        or _aware(session.expires_at) <= now
        or now - _aware(session.last_seen_at) > SESSION_IDLE_TIMEOUT
    ):
        raise HTTPException(status_code=401, detail="Your session has ended. Sign in again.")
    _check_csrf(request)
    session.last_seen_at = now
    return OwnerContext(user=session.user, session=session, ip=client_ip(request))


def require_csrf(request: Request) -> None:
    """For unauthenticated state-changing endpoints such as login."""
    _check_csrf(request)
