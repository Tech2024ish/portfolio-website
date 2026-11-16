"""``GET /api/v1/media/files/{key}``: serves library images when ``STORAGE_BACKEND=local``.

Development only (production refuses local storage and uses Supabase Storage, which serves its
own public URLs). Keys must match the generated pattern, so nothing outside the media directory
can be requested. Files never change under a key, so they are cached as immutable.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import FileResponse

from app.api.owner_access import settings_of
from app.core.config import StorageBackend
from app.core.errors import AppError
from app.integrations.storage import IMMUTABLE, KEY_PATTERN, LocalStorage

router = APIRouter(prefix="/media/files", tags=["media"])

_TYPES = {"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp"}


@router.get("/{key:path}", include_in_schema=False)
def media_file(key: str, request: Request) -> FileResponse:
    settings = settings_of(request)
    if settings.storage_backend is not StorageBackend.LOCAL or not KEY_PATTERN.match(key):
        raise AppError(404, "not_found", "Not found.")
    path = LocalStorage(Path(settings.local_media_dir)).path(key)
    if not path.is_file():
        raise AppError(404, "not_found", "Not found.")
    return FileResponse(
        path,
        media_type=_TYPES[key.rsplit(".", 1)[1]],
        headers={"Cache-Control": IMMUTABLE, "X-Content-Type-Options": "nosniff"},
    )
