"""Owner sign-in, sessions and password changes.

Sign-in order matters:
1. Every attempt counts toward the client-address limit (``login-ip``) before anything else.
2. Failed attempts are counted per account (``login-account``) under an advisory lock. The key
   is the submitted email whether or not it exists, so the limit never reveals the account.
3. The password is verified; an unknown email spends the same time on a dummy hash.
4. On success a legacy or outdated hash is re-hashed with Argon2id, and a new session starts.

The caller commits. On ``SignInFailedError`` it must commit before responding, so the failure
counted in step 2 is stored even though the request ends in an error.

Nothing here logs an email, password, token or hash.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import AppError
from app.core.security import (
    burn_verification_time,
    hash_password,
    needs_rehash,
    new_session_token,
    password_problems,
    token_digest,
    verify_password,
)
from app.models.contact import ContactMessage
from app.models.owner import IP_ADDRESS_MAX, USER_AGENT_MAX, OwnerSession, OwnerUser
from app.repositories import rate_limit

logger = logging.getLogger("app.auth")

LOGIN_IP_BUCKET = "login-ip"
LOGIN_ACCOUNT_BUCKET = "login-account"
# last_seen_at is refreshed at most this often, so reads do not write on every request.
TOUCH_INTERVAL = timedelta(minutes=1)
# Ended sessions are kept this long for the owner's session history, then deleted.
SESSION_RETENTION = timedelta(days=30)

TOO_MANY_ATTEMPTS = "Too many sign-in attempts. Please wait and try again later."


class SignInFailedError(Exception):
    """Wrong email or password. Deliberately carries no detail about which one."""


@dataclass(frozen=True)
class OwnerContext:
    """The authenticated owner of the current request."""

    user: OwnerUser
    session: OwnerSession
    token: str


def utcnow() -> datetime:
    return datetime.now(UTC)


def normalise_email(email: str) -> str:
    return email.strip().lower()


def _rate_limited(window: timedelta) -> AppError:
    return AppError(
        429,
        "rate_limited",
        TOO_MANY_ATTEMPTS,
        headers={"Retry-After": str(int(window.total_seconds()))},
    )


def sign_in(
    session: Session,
    *,
    email: str,
    password: str,
    client_address: str,
    user_agent: str | None,
    settings: Settings,
) -> tuple[OwnerUser, OwnerSession, str]:
    """Verify the credentials and start a session. Returns (user, session, raw token)."""
    ip_window = timedelta(minutes=settings.login_ip_window_minutes)
    ip_key = rate_limit.client_key(LOGIN_IP_BUCKET, client_address)
    if not rate_limit.acquire(
        session, LOGIN_IP_BUCKET, ip_key, settings.login_ip_attempts, ip_window
    ):
        logger.warning("owner sign-in rate limited (client address)")
        raise _rate_limited(ip_window)

    email = normalise_email(email)
    account_window = timedelta(minutes=settings.login_account_window_minutes)
    account_key = rate_limit.client_key(LOGIN_ACCOUNT_BUCKET, email)
    rate_limit.lock(session, account_key)
    failures = rate_limit.recent_count(session, LOGIN_ACCOUNT_BUCKET, account_key, account_window)
    if failures >= settings.login_account_failures:
        logger.warning("owner sign-in rate limited (account)")
        raise _rate_limited(account_window)

    user = session.scalar(select(OwnerUser).where(OwnerUser.email == email))
    if user is None:
        burn_verification_time(password)
        valid = False
    else:
        valid = verify_password(password, user.password_hash)
    if user is None or not valid:
        rate_limit.record(session, LOGIN_ACCOUNT_BUCKET, account_key, account_window)
        logger.info("owner sign-in failed")
        raise SignInFailedError

    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(password)
        logger.info("owner password hash upgraded to the current Argon2id parameters")

    _purge_old_sessions(session, user.id)
    owner_session, token = _start_session(session, user, client_address, user_agent, settings)
    logger.info("owner signed in (session %s)", owner_session.id)
    return user, owner_session, token


def _start_session(
    session: Session,
    user: OwnerUser,
    client_address: str,
    user_agent: str | None,
    settings: Settings,
) -> tuple[OwnerSession, str]:
    token = new_session_token()
    now = utcnow()
    owner_session = OwnerSession(
        user_id=user.id,
        token_hash=token_digest(token),
        created_at=now,
        last_seen_at=now,
        expires_at=now + timedelta(hours=settings.session_ttl_hours),
        ip_address=client_address[:IP_ADDRESS_MAX],
        user_agent=(user_agent or "")[:USER_AGENT_MAX] or None,
    )
    session.add(owner_session)
    session.flush()
    return owner_session, token


def _purge_old_sessions(session: Session, user_id: int) -> None:
    cutoff = utcnow() - SESSION_RETENTION
    session.execute(
        delete(OwnerSession).where(
            OwnerSession.user_id == user_id,
            or_(OwnerSession.expires_at < cutoff, OwnerSession.revoked_at < cutoff),
        )
    )


def is_active(owner_session: OwnerSession, settings: Settings, now: datetime) -> bool:
    if owner_session.revoked_at is not None or owner_session.expires_at <= now:
        return False
    return now - owner_session.last_seen_at <= timedelta(minutes=settings.session_idle_minutes)


def authenticate(session: Session, token: str | None, settings: Settings) -> OwnerContext | None:
    """The owner behind a session token, or None when the session is unknown or has ended."""
    if not token:
        return None
    row = session.execute(
        select(OwnerSession, OwnerUser)
        .join(OwnerUser, OwnerUser.id == OwnerSession.user_id)
        .where(OwnerSession.token_hash == token_digest(token))
    ).first()
    if row is None:
        return None
    owner_session, user = row
    now = utcnow()
    if not is_active(owner_session, settings, now):
        return None
    if now - owner_session.last_seen_at >= TOUCH_INTERVAL:
        owner_session.last_seen_at = now
    return OwnerContext(user=user, session=owner_session, token=token)


def sign_out(owner: OwnerContext) -> None:
    owner.session.revoked_at = utcnow()
    logger.info("owner signed out (session %s)", owner.session.id)


def change_password(
    session: Session, owner: OwnerContext, *, current_password: str, new_password: str
) -> int:
    """Change the password and end every other session. Returns how many were ended."""
    if not verify_password(current_password, owner.user.password_hash):
        raise AppError(
            400,
            "invalid_password",
            "The current password is incorrect.",
            fields=[{"field": "current_password", "message": "The current password is incorrect."}],
        )
    problems = password_problems(new_password)
    if not problems and verify_password(new_password, owner.user.password_hash):
        problems = ["Choose a password you are not using now."]
    if problems:
        raise AppError(
            422,
            "validation_error",
            "Some fields need attention.",
            fields=[{"field": "new_password", "message": " ".join(problems)}],
        )
    owner.user.password_hash = hash_password(new_password)
    owner.user.password_changed_at = utcnow()
    ended = revoke_other_sessions(session, owner)
    logger.info("owner password changed; %s other session(s) ended", ended)
    return ended


def active_sessions(
    session: Session, owner: OwnerContext, settings: Settings
) -> list[OwnerSession]:
    now = utcnow()
    rows = session.scalars(
        select(OwnerSession)
        .where(OwnerSession.user_id == owner.user.id, OwnerSession.revoked_at.is_(None))
        .order_by(OwnerSession.last_seen_at.desc())
    )
    return [row for row in rows if is_active(row, settings, now)]


def revoke_session(session: Session, owner: OwnerContext, session_id: int) -> None:
    target = session.get(OwnerSession, session_id)
    if target is None or target.user_id != owner.user.id or target.revoked_at is not None:
        raise AppError(404, "not_found", "Session not found.")
    target.revoked_at = utcnow()
    logger.info("owner session %s revoked", session_id)


def revoke_other_sessions(session: Session, owner: OwnerContext) -> int:
    result = session.execute(
        update(OwnerSession)
        .where(
            OwnerSession.user_id == owner.user.id,
            OwnerSession.revoked_at.is_(None),
            OwnerSession.id != owner.session.id,
        )
        .values(revoked_at=utcnow())
    )
    return int(getattr(result, "rowcount", 0) or 0)


def message_counts(session: Session) -> dict[str, int]:
    rows = session.execute(
        select(ContactMessage.status, func.count()).group_by(ContactMessage.status)
    ).all()
    counts = {"new": 0, "read": 0, "archived": 0, "spam": 0}
    for status, count in rows:
        counts[str(status)] = int(count)
    return counts
