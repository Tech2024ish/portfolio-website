"""Sliding-window rate limiting stored in PostgreSQL (architecture decision 4).

Works across restarts and multiple instances.

Concurrency:
- A transaction-scoped advisory lock per (bucket, client) serialises concurrent requests from
  the same client, so a burst cannot slip past the limit between the count and the insert.
  Different clients never wait for each other.

Retention and cleanup:
- Events are kept for ``RETENTION_FACTOR`` (2) times the window; only older rows are deleted.
- Both the count and the cleanup use ``clock_timestamp()`` (the real current time), not
  ``now()`` (the transaction's start time). A row is deleted only when it is older than two
  windows at the moment of deletion, and any count that can observe that deletion runs later
  and looks back only one window, so cleanup can never remove an event that could still count.
- Each request deletes at most ``CLEANUP_BATCH`` expired rows, chosen with
  ``FOR UPDATE SKIP LOCKED``: rows another request is already deleting are skipped instead of
  waited on, so cleanup never blocks a request, cannot deadlock, and its work is bounded. Every
  request adds one row and can remove up to a full batch, so expired rows cannot accumulate.
"""

from __future__ import annotations

import hashlib
from datetime import timedelta

from sqlalchemy import delete, func, select, text
from sqlalchemy.orm import Session

from app.models.contact import RateLimitEvent

RETENTION_FACTOR = 2
CLEANUP_BATCH = 500


def client_key(bucket: str, address: str) -> str:
    return hashlib.sha256(f"{bucket}:{address}".encode()).hexdigest()


def _lock_id(key: str) -> int:
    # First 8 bytes of the digest as a signed 64-bit advisory-lock id.
    return int.from_bytes(bytes.fromhex(key[:16]), "big", signed=True)


def purge_expired(session: Session, bucket: str, window: timedelta) -> int:
    """Delete up to one batch of events older than the retention period. Never waits."""
    expired = (
        select(RateLimitEvent.id)
        .where(
            RateLimitEvent.bucket == bucket,
            RateLimitEvent.created_at < func.clock_timestamp() - window * RETENTION_FACTOR,
        )
        .limit(CLEANUP_BATCH)
        .with_for_update(skip_locked=True)
    )
    result = session.execute(delete(RateLimitEvent).where(RateLimitEvent.id.in_(expired)))
    return int(getattr(result, "rowcount", 0) or 0)


def acquire(session: Session, bucket: str, key: str, limit: int, window: timedelta) -> bool:
    """Record one event and return True, or return False if the client is over the limit."""
    session.execute(text("select pg_advisory_xact_lock(:id)"), {"id": _lock_id(key)})
    purge_expired(session, bucket, window)
    recent = session.scalar(
        select(func.count())
        .select_from(RateLimitEvent)
        .where(
            RateLimitEvent.bucket == bucket,
            RateLimitEvent.client_key == key,
            RateLimitEvent.created_at >= func.clock_timestamp() - window,
        )
    )
    if (recent or 0) >= limit:
        return False
    # Stamp with the real time, not the transaction start: a request that waited for the
    # advisory lock must not record an event that already looks older than it is.
    session.add(RateLimitEvent(bucket=bucket, client_key=key, created_at=func.clock_timestamp()))
    session.flush()
    return True
