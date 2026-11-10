"""Aggregates every /api/v1 endpoint module. Areas are registered here as phases land."""

from fastapi import APIRouter

from app.api.v1.endpoints import contact

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(contact.router)
