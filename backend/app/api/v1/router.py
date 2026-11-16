"""Aggregates every /api/v1 endpoint module. Areas are registered here as phases land."""

from fastapi import APIRouter

from app.api.v1.endpoints import auth, contact, owner

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(contact.router)
api_router.include_router(auth.router)
api_router.include_router(owner.router)
