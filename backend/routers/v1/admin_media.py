from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from core.config import get_settings
from core.db import get_db
from models.entities import MediaAsset, SiteProfile
from models.v1 import MediaPatch, ResumeSelect
from routers.v1.common import apply_patch, ensure_media, get_or_404, media_out, media_usage, search_filter
from services import activity
from services.auth import OwnerContext, require_owner
from services.storage import get_storage, new_storage_key, validate_upload

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_owner)])

# Hard ceiling on bytes read from a request, above any configured limit.
READ_LIMIT_BYTES = 12 * 1024 * 1024


async def _read_limited(upload: UploadFile) -> bytes:
    settings = get_settings()
    limit = min(READ_LIMIT_BYTES, max(settings.max_image_mb, settings.max_document_mb) * 1024 * 1024) + 1
    data = await upload.read(limit)
    if len(data) >= limit:
        raise HTTPException(status_code=413, detail="The file is too large.")
    return data


def _media_detail(db: Session, media: MediaAsset) -> dict:
    return {**media_out(media), "usage": media_usage(db, media.id)}


@router.get("/media")
def list_media(
    q: str | None = None,
    kind: str | None = None,
    page: int = 1,
    page_size: int = 48,
    db: Session = Depends(get_db),
):
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    stmt = select(MediaAsset)
    condition = search_filter([MediaAsset.filename, MediaAsset.alt_text], q)
    if condition is not None:
        stmt = stmt.where(condition)
    if kind in {"image", "document"}:
        stmt = stmt.where(MediaAsset.kind == kind)
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    items = db.scalars(stmt.order_by(MediaAsset.created_at.desc(), MediaAsset.id.desc()).offset((page - 1) * page_size).limit(page_size))
    return {"items": [media_out(item) for item in items], "total": total, "page": page, "page_size": page_size}


@router.get("/media/{item_id}")
def get_media(item_id: int, db: Session = Depends(get_db)):
    return _media_detail(db, get_or_404(db, MediaAsset, item_id, "File"))


@router.post("/media", status_code=201)
async def upload_media(
    file: UploadFile = File(...),
    alt_text: str = "",
    owner: OwnerContext = Depends(require_owner),
    db: Session = Depends(get_db),
):
    validated = validate_upload(await _read_limited(file), file.filename)
    key = new_storage_key(validated)
    url = get_storage().save(key, validated.data, validated.content_type)
    media = MediaAsset(
        storage_key=key,
        url=url,
        filename=validated.filename,
        content_type=validated.content_type,
        kind=validated.kind,
        size_bytes=len(validated.data),
        sha256=validated.sha256,
        width=validated.width,
        height=validated.height,
        alt_text=alt_text.strip()[:300],
    )
    db.add(media)
    try:
        db.flush()
    except Exception:
        get_storage().delete(key)  # don't leave an orphaned file if the row fails
        raise
    activity.record(db, owner, "upload", "media", f"Uploaded {media.filename}", media.id)
    return _media_detail(db, media)


@router.put("/media/{item_id}/file")
async def replace_media_file(
    item_id: int,
    file: UploadFile = File(...),
    owner: OwnerContext = Depends(require_owner),
    db: Session = Depends(get_db),
):
    media = get_or_404(db, MediaAsset, item_id, "File")
    validated = validate_upload(await _read_limited(file), file.filename)
    if validated.kind != media.kind:
        raise HTTPException(status_code=422, detail=f"Replace this {media.kind} with another {media.kind}.")
    old_key = media.storage_key
    key = new_storage_key(validated)
    media.url = get_storage().save(key, validated.data, validated.content_type)
    media.storage_key = key
    media.filename = validated.filename
    media.content_type = validated.content_type
    media.size_bytes = len(validated.data)
    media.sha256 = validated.sha256
    media.width, media.height = validated.width, validated.height
    db.flush()
    try:
        get_storage().delete(old_key)
    except HTTPException:
        pass  # the new file is live; an unreferenced old object is harmless
    activity.record(db, owner, "replace", "media", f"Replaced file for {media.filename}", media.id)
    return _media_detail(db, media)


@router.patch("/media/{item_id}")
def update_media(item_id: int, body: MediaPatch, owner: OwnerContext = Depends(require_owner), db: Session = Depends(get_db)):
    media = get_or_404(db, MediaAsset, item_id, "File")
    apply_patch(media, body)
    db.flush()
    activity.record(db, owner, "update", "media", f"Updated details for {media.filename}", media.id)
    return _media_detail(db, media)


@router.delete("/media/{item_id}", status_code=204)
def delete_media(item_id: int, owner: OwnerContext = Depends(require_owner), db: Session = Depends(get_db)):
    media = get_or_404(db, MediaAsset, item_id, "File")
    usage = media_usage(db, media.id)
    if usage:
        raise HTTPException(status_code=409, detail="This file is in use: " + "; ".join(usage) + ". Remove it there first.")
    key = media.storage_key
    activity.record(db, owner, "delete", "media", f"Deleted {media.filename}", media.id)
    db.delete(media)
    db.flush()
    get_storage().delete(key)


# ------------------------------------------------------------------ resume


@router.get("/resume")
def get_resume(db: Session = Depends(get_db)):
    profile = get_or_404(db, SiteProfile, 1, "Profile")
    documents = db.scalars(
        select(MediaAsset).where(MediaAsset.content_type == "application/pdf").order_by(MediaAsset.created_at.desc())
    )
    return {"active": media_out(profile.resume), "versions": [media_out(doc) for doc in documents]}


@router.put("/resume")
def set_resume(body: ResumeSelect, owner: OwnerContext = Depends(require_owner), db: Session = Depends(get_db)):
    profile = get_or_404(db, SiteProfile, 1, "Profile")
    ensure_media(db, body.media_id, "document", "Resume")
    profile.resume_id = body.media_id
    db.flush()
    db.refresh(profile)
    summary = f"Set active resume to {profile.resume.filename}" if profile.resume else "Removed the public resume"
    activity.record(db, owner, "update", "resume", summary, body.media_id)
    return {"active": media_out(profile.resume)}
