"""Ask the public site (Next.js) to refresh its cached content after a change.

The request is signed: ``X-Revalidate-Signature: sha256=<HMAC-SHA256 of the raw body>`` with the
shared ``REVALIDATE_SIGNING_SECRET``. The body carries a timestamp and a random nonce, so the
receiver refuses stale or replayed requests, and an allowlisted tag, so it can only clear
content caches. It is sent after the response (a background task) and failures are logged,
never raised: a save never fails because the public site could not be reached.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import secrets
import time

import httpx

from app.core.config import Settings

logger = logging.getLogger("app.revalidate")

CONTENT_TAG = "content"
SIGNATURE_HEADER = "X-Revalidate-Signature"
TIMEOUT_SECONDS = 5.0


def signed_request(secret: str, tags: list[str], now: float | None = None) -> tuple[bytes, str]:
    """The request body and its signature header value."""
    body = json.dumps(
        {
            "tags": tags,
            "timestamp": int(now if now is not None else time.time()),
            "nonce": secrets.token_hex(16),
        },
        separators=(",", ":"),
    ).encode()
    digest = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return body, f"sha256={digest}"


def notify_content_changed(settings: Settings) -> None:
    """Best effort: the public site refreshes on its next visit either way."""
    if not settings.revalidate_url or settings.revalidate_signing_secret is None:
        return
    body, signature = signed_request(
        settings.revalidate_signing_secret.get_secret_value(), [CONTENT_TAG]
    )
    try:
        response = httpx.post(
            settings.revalidate_url,
            content=body,
            headers={"Content-Type": "application/json", SIGNATURE_HEADER: signature},
            timeout=TIMEOUT_SECONDS,
        )
    except httpx.HTTPError as error:
        logger.warning("public-site revalidation failed: %s", type(error).__name__)
        return
    if response.status_code != 200:
        logger.warning("public-site revalidation answered %s", response.status_code)
