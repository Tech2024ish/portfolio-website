"""``POST /api/v1/contact``: the public contact form."""

from __future__ import annotations

from fastapi import APIRouter, Request, Response, status

from app.core.client_ip import client_address
from app.core.config import Settings
from app.database.session import DbSession
from app.schemas.contact import ContactReceipt, ContactSubmission
from app.services.contact import submit_contact_message

router = APIRouter(tags=["contact"])

# Largest accepted request body. A maximal valid submission sent as raw UTF-8 (how browsers
# send JSON) is about 22 KB even when every character takes 4 bytes, so this limit only
# rejects bodies no valid message needs.
MAX_BODY_BYTES = 64 * 1024

_ERRORS: dict[int | str, dict[str, str]] = {
    413: {"description": "The request body is larger than 64 KB; nothing was read or stored."},
    422: {"description": "Validation failed; `error.fields` lists each problem."},
    429: {"description": "Too many messages from this client; see `Retry-After`."},
    503: {"description": "The database is unavailable; nothing was stored."},
}


@router.post(
    "/contact",
    status_code=status.HTTP_201_CREATED,
    response_model=ContactReceipt,
    summary="Send a message to the site owner",
    responses=_ERRORS,
)
def create_contact_message(
    submission: ContactSubmission, request: Request, response: Response, session: DbSession
) -> ContactReceipt:
    settings: Settings = request.app.state.settings
    submit_contact_message(
        session, submission, client_address(request, settings.trusted_proxy_count), settings
    )
    # Commit here, not in the dependency's teardown: teardown can run after the response has
    # been sent, and the client must only ever see success for a durably stored message.
    session.commit()
    response.headers["Cache-Control"] = "no-store"
    return ContactReceipt()
