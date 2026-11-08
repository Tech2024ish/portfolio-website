"""Aggregates every /api/v1 endpoint module. Areas are registered here as phases land."""

from fastapi import APIRouter

api_router = APIRouter(prefix="/api/v1")
