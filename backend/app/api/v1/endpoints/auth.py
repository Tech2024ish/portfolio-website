"""``/api/v1/auth``: owner sign-in, session and password endpoints.

Every response carries ``Cache-Control: no-store``. Errors are generic: a failed sign-in never
says whether the email or the password was wrong.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response, status

from app.api.owner_access import (
    Owner,
    clear_session_cookie,
    require_trusted_origin,
    set_session_cookie,
    settings_of,
)
from app.core.client_ip import client_address
from app.core.errors import AppError
from app.core.security import csrf_token_for
from app.database.session import DbSession
from app.schemas.auth import (
    LoginRequest,
    OwnerProfile,
    PasswordChangeRequest,
    RevokedSessions,
    SessionInfo,
    SessionSummary,
)
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["owner authentication"])

# Sign-in and password bodies are tiny; anything larger is rejected before it is read.
MAX_BODY_BYTES = 8 * 1024

_NO_STORE = {"Cache-Control": "no-store"}


def _session_info(owner: auth_service.OwnerContext) -> SessionInfo:
    return SessionInfo(
        user=OwnerProfile(email=owner.user.email, display_name=owner.user.display_name),
        csrf_token=csrf_token_for(owner.token),
        expires_at=owner.session.expires_at,
    )


@router.post(
    "/login",
    response_model=SessionInfo,
    dependencies=[Depends(require_trusted_origin)],
    summary="Sign in as the owner",
    responses={
        401: {"description": "The email or password is incorrect."},
        403: {"description": "The request came from an origin that is not allowed."},
        429: {"description": "Too many attempts; see `Retry-After`."},
    },
)
def login(
    body: LoginRequest, request: Request, response: Response, session: DbSession
) -> SessionInfo:
    settings = settings_of(request)
    try:
        user, owner_session, token = auth_service.sign_in(
            session,
            email=str(body.email),
            password=body.password,
            client_address=client_address(request, settings.trusted_proxy_count),
            user_agent=request.headers.get("user-agent"),
            settings=settings,
        )
    except auth_service.SignInFailedError:
        session.commit()  # keep the counted attempt and failure
        raise AppError(401, "invalid_credentials", "The email or password is incorrect.") from None
    except AppError as error:
        if error.status_code == 429:
            session.commit()  # keep the counted attempt
        raise
    session.commit()
    set_session_cookie(response, token, settings)
    response.headers.update(_NO_STORE)
    return _session_info(auth_service.OwnerContext(user=user, session=owner_session, token=token))


@router.get("/session", response_model=SessionInfo, summary="The signed-in owner")
def current_session(owner: Owner, response: Response, session: DbSession) -> SessionInfo:
    session.commit()  # last_seen_at may have been refreshed
    response.headers.update(_NO_STORE)
    return _session_info(owner)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, summary="Sign out")
def logout(owner: Owner, request: Request, session: DbSession) -> Response:
    auth_service.sign_out(owner)
    session.commit()
    response = Response(status_code=status.HTTP_204_NO_CONTENT, headers=_NO_STORE)
    clear_session_cookie(response, settings_of(request))
    return response


@router.post(
    "/password",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Change the password and end every other session",
)
def change_password(body: PasswordChangeRequest, owner: Owner, session: DbSession) -> Response:
    auth_service.change_password(
        session,
        owner,
        current_password=body.current_password,
        new_password=body.new_password,
    )
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT, headers=_NO_STORE)


@router.get("/sessions", response_model=list[SessionSummary], summary="Active sessions")
def list_sessions(
    owner: Owner, request: Request, response: Response, session: DbSession
) -> list[SessionSummary]:
    rows = auth_service.active_sessions(session, owner, settings_of(request))
    session.commit()
    response.headers.update(_NO_STORE)
    return [
        SessionSummary(
            id=row.id,
            created_at=row.created_at,
            last_seen_at=row.last_seen_at,
            expires_at=row.expires_at,
            ip_address=row.ip_address,
            user_agent=row.user_agent,
            current=row.id == owner.session.id,
        )
        for row in rows
    ]


@router.delete(
    "/sessions/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="End one session",
)
def revoke_session(session_id: int, owner: Owner, request: Request, session: DbSession) -> Response:
    auth_service.revoke_session(session, owner, session_id)
    session.commit()
    response = Response(status_code=status.HTTP_204_NO_CONTENT, headers=_NO_STORE)
    if session_id == owner.session.id:
        clear_session_cookie(response, settings_of(request))
    return response


@router.post(
    "/sessions/revoke-others",
    response_model=RevokedSessions,
    summary="End every session except this one",
)
def revoke_other_sessions(owner: Owner, response: Response, session: DbSession) -> RevokedSessions:
    revoked = auth_service.revoke_other_sessions(session, owner)
    session.commit()
    response.headers.update(_NO_STORE)
    return RevokedSessions(revoked=revoked)
