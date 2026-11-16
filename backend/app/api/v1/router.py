"""Aggregates every /api/v1 endpoint module. Areas are registered here as phases land."""

from fastapi import APIRouter

from app.api.v1.endpoints import auth, contact, media_files, owner, public

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(contact.router)
api_router.include_router(auth.router)
api_router.include_router(owner.router)
api_router.include_router(public.router)
api_router.include_router(media_files.router)
