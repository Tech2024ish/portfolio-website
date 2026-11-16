"""``/api/v1/owner/media``: the media library. Included in the owner router, whose guard requires
the owner session (and the CSRF token for changes) on every route here.

Uploads are multipart (``file`` plus form fields). The body size is capped before parsing by
``BodySizeLimitMiddleware`` (see ``app.main``) and again while reading the file.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import (
    APIRouter,
    BackgroundTasks,
    File,
    Form,
    Query,
    Request,
    Response,
    UploadFile,
    status,
)
from pydantic import ValidationError

from app.api.owner_access import Owner, settings_of
from app.core.config import Settings
from app.core.errors import AppError
from app.database.session import DbSession
from app.integrations.revalidate import notify_content_changed
from app.integrations.storage import Storage, storage_for
from app.schemas.media import MediaDetail, MediaOut, MediaUpdate
from app.services import images
from app.services import media as service

router = APIRouter(prefix="/media", tags=["owner media"])
_NO_STORE = {"Cache-Control": "no-store"}
# Multipart framing and form fields on top of the image itself.
UPLOAD_OVERHEAD_BYTES = 64 * 1024


def upload_limit(settings: Settings) -> int:
    return settings.max_image_mb * 1024 * 1024 + UPLOAD_OVERHEAD_BYTES


def _read_image(file: UploadFile, settings: Settings) -> images.ProcessedImage:
    limit = settings.max_image_mb * 1024 * 1024
    data = file.file.read(limit + 1)
    if len(data) > limit:
        message = f"The image is larger than {settings.max_image_mb} MB."
        raise AppError(
            413, "payload_too_large", message, fields=[{"field": "file", "message": message}]
        )
    if not data:
        raise AppError(
            422,
            "validation_error",
            "Choose an image.",
            fields=[{"field": "file", "message": "Choose an image."}],
        )
    return images.process(data, file.content_type)


def _alt(alt_text: str) -> str:
    try:
        return MediaUpdate(alt_text=alt_text, folder="general", version=1).alt_text
    except ValidationError as error:
        message = str(error.errors()[0]["msg"])
        raise AppError(
            422, "validation_error", message, fields=[{"field": "alt_text", "message": message}]
        ) from error


def _storage(request: Request) -> Storage:
    return storage_for(settings_of(request))


def _after(
    request: Request, tasks: BackgroundTasks, storage: Storage, outcome: service.Outcome
) -> None:
    """Once committed: remove unused files; refresh the site if content moved."""
    if outcome.obsolete_keys:
        tasks.add_task(service.discard, storage, outcome.obsolete_keys)
    if outcome.content_changed:
        tasks.add_task(notify_content_changed, settings_of(request))


@router.get("", response_model=list[MediaOut], summary="Every image, newest first")
def list_media(
    session: DbSession, response: Response, folder: Annotated[str | None, Query()] = None
) -> list[MediaOut]:
    response.headers.update(_NO_STORE)
    return [MediaOut.model_validate(row) for row in service.list_assets(session, folder)]


@router.post(
    "", response_model=MediaOut, status_code=status.HTTP_201_CREATED, summary="Upload an image"
)
def upload(
    owner: Owner,
    request: Request,
    session: DbSession,
    file: Annotated[UploadFile, File()],
    folder: Annotated[str, Form()] = "general",
    alt_text: Annotated[str, Form()] = "",
) -> MediaOut:
    storage = _storage(request)
    image = _read_image(file, settings_of(request))
    outcome = service.upload(
        session,
        storage,
        owner,
        image,
        filename=file.filename,
        folder=folder,
        alt_text=_alt(alt_text),
    )
    try:
        session.commit()
    except Exception:
        service.discard(storage, outcome.asset.keys())
        raise
    return MediaOut.model_validate(outcome.asset)


@router.get("/{asset_id}", response_model=MediaDetail)
def get_media(asset_id: int, session: DbSession, response: Response) -> MediaDetail:
    response.headers.update(_NO_STORE)
    asset = service.get_asset(session, asset_id)
    return MediaDetail(
        **MediaOut.model_validate(asset).model_dump(), used_by=service.usages(session, asset.url)
    )


@router.put("/{asset_id}", response_model=MediaOut, summary="Edit alt text and folder")
def update_media(asset_id: int, body: MediaUpdate, owner: Owner, session: DbSession) -> MediaOut:
    outcome = service.update_details(
        session, owner, asset_id, alt_text=body.alt_text, folder=body.folder, version=body.version
    )
    session.commit()
    return MediaOut.model_validate(outcome.asset)


@router.post("/{asset_id}/replace", response_model=MediaOut, summary="Replace the image file")
def replace_media(
    asset_id: int,
    owner: Owner,
    request: Request,
    tasks: BackgroundTasks,
    session: DbSession,
    file: Annotated[UploadFile, File()],
    version: Annotated[int, Form(ge=1)],
) -> MediaOut:
    storage = _storage(request)
    image = _read_image(file, settings_of(request))
    outcome = service.replace(
        session, storage, owner, asset_id, image, filename=file.filename, version=version
    )
    new_keys = outcome.asset.keys()
    try:
        session.commit()
    except Exception:
        service.discard(storage, new_keys)
        raise
    _after(request, tasks, storage, outcome)
    return MediaOut.model_validate(outcome.asset)


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_media(
    asset_id: int, owner: Owner, request: Request, tasks: BackgroundTasks, session: DbSession
) -> Response:
    storage = _storage(request)
    outcome = service.delete(session, owner, asset_id)
    session.commit()
    _after(request, tasks, storage, outcome)
    return Response(status_code=status.HTTP_204_NO_CONTENT, headers=_NO_STORE)
