from fastapi import APIRouter

from routers.v1 import admin_content, admin_inbox, admin_media, admin_system, auth, public

api_v1 = APIRouter(prefix="/api/v1")
for module in (public, auth, admin_content, admin_media, admin_inbox, admin_system):
    api_v1.include_router(module.router)
