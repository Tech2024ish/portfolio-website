"""Operational endpoints. Unversioned: they describe the process, not the API contract.

- ``GET /health``: liveness. Answers 200 whenever the process can serve HTTP. It never
  touches the database, so a database outage does not make Render restart a healthy process.
- ``GET /ready``: readiness, including database connectivity. Added in Phase 2 with the
  database layer.
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Response
from pydantic import BaseModel

from app import __version__

router = APIRouter(tags=["operations"])


class HealthResponse(BaseModel):
    status: Literal["ok"]
    version: str


@router.get("/health", response_model=HealthResponse, summary="Liveness probe")
def health(response: Response) -> HealthResponse:
    response.headers["Cache-Control"] = "no-store"
    return HealthResponse(status="ok", version=__version__)
