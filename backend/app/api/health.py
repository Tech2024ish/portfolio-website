"""Operational endpoints. Unversioned: they describe the process, not the API contract.

- ``GET /health``: liveness. Answers 200 whenever the process can serve HTTP. It never
  touches the database, so a database outage does not make Render restart a healthy process.
  It is ``async`` and does no blocking work, so it runs on the event loop and cannot queue
  behind worker threads busy with readiness checks or requests. Render's health check must
  stay on this endpoint.
- ``GET /ready``: readiness. 200 only when the database answers a read-only query and holds
  exactly the Alembic revision this build expects; 503 otherwise. It never writes, and its body
  carries coarse check states only, never exception details, hosts or credentials.
"""

from __future__ import annotations

import logging
from typing import Literal

from fastapi import APIRouter, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app import __version__
from app.database.readiness import UNAVAILABLE, Readiness, ReadinessCache, check_database

logger = logging.getLogger("app.readiness")

router = APIRouter(tags=["operations"])

# Results are reused for this many seconds after a check completes (see ReadinessCache).
READY_CACHE_SECONDS = 5.0


class HealthResponse(BaseModel):
    status: Literal["ok"]
    version: str


class ReadinessChecks(BaseModel):
    database: Literal["ok", "unavailable", "unknown"]
    migrations: Literal["ok", "pending", "unknown"]


class ReadinessResponse(BaseModel):
    status: Literal["ready", "not_ready"]
    checks: ReadinessChecks


@router.get("/health", response_model=HealthResponse, summary="Liveness probe")
async def health(response: Response) -> HealthResponse:
    response.headers["Cache-Control"] = "no-store"
    return HealthResponse(status="ok", version=__version__)


def _readiness(request: Request) -> Readiness:
    cache: ReadinessCache = request.app.state.readiness_cache
    database = request.app.state.database
    return cache.get(lambda: check_database(database), READY_CACHE_SECONDS)


@router.get(
    "/ready",
    response_model=ReadinessResponse,
    summary="Readiness probe (database and migrations)",
    responses={503: {"model": ReadinessResponse, "description": "Not ready."}},
)
def ready(request: Request) -> JSONResponse:
    try:
        result = _readiness(request)
    except Exception as exc:  # defensive: the contract is 503, never a 500 or a leaked detail
        logger.warning("readiness: unexpected failure (%s)", type(exc).__name__)
        result = UNAVAILABLE
    body = ReadinessResponse(
        status="ready" if result.ready else "not_ready",
        checks=ReadinessChecks(database=result.database, migrations=result.migrations),
    )
    return JSONResponse(
        body.model_dump(),
        status_code=200 if result.ready else 503,
        headers={"Cache-Control": "no-store"},
    )
