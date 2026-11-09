from collections import defaultdict, deque
from time import monotonic

from fastapi import APIRouter, HTTPException, Request
from database import get_client
from models.schemas import ContactMessage, ContactResponse

router = APIRouter()
WINDOW_SECONDS = 15 * 60
MAX_SUBMISSIONS = 5
submissions = defaultdict(deque)


def _check_rate_limit(client_id: str) -> None:
    now = monotonic()
    recent = submissions[client_id]
    while recent and now - recent[0] > WINDOW_SECONDS:
        recent.popleft()
    if len(recent) >= MAX_SUBMISSIONS:
        raise HTTPException(status_code=429, detail="Too many messages. Please try again later.")
    recent.append(now)


@router.post("/contact", response_model=ContactResponse)
def send_contact(body: ContactMessage, request: Request):
    if body.website:
        raise HTTPException(status_code=400, detail="Invalid submission.")
    _check_rate_limit(request.client.host if request.client else "unknown")
    with get_client() as client:
        response = client.post("/contacts", json={
            "name": body.name,
            "email": body.email,
            "message": body.message,
        })
        if response.status_code not in (200, 201):
            raise HTTPException(status_code=response.status_code, detail=response.text)
        return ContactResponse(success=True, message="Message sent successfully!")
