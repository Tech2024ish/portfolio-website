"""The media library: upload, replace, describe and delete images.

Files are written to storage before the database row is committed; if anything fails afterwards
the new files are removed. Files that are no longer needed (a replaced revision, a deleted image)
are removed only after the transaction commits, by the caller (``obsolete_keys``), so a failed
request never leaves content pointing at missing files.

An image that content still uses (the profile portrait or a project's case-study image) cannot be
deleted; the answer names where it is used. Replacing an image points that content at the new
revision in the same transaction.
"""

from __future__ import annotations

import contextlib
import re
import unicodedata
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.core.errors import AppError
from app.integrations.storage import Storage, StorageError
from app.models.content import Profile, Project
from app.models.media import MEDIA_FOLDERS, MediaAsset
from app.services import audit
from app.services.auth import OwnerContext
from app.services.images import ProcessedImage

MAX_FILENAME = 160


@dataclass
class Outcome:
    asset: MediaAsset
    obsolete_keys: list[str] = field(default_factory=list)
    content_changed: bool = False


def utcnow() -> datetime:
    return datetime.now(UTC)


def safe_filename(name: str | None) -> str:
    """A display name only (storage keys never use it): no paths, controls or odd characters."""
    base = re.split(r"[\\/]", name or "")[-1]
    base = unicodedata.normalize("NFKC", base)
    base = re.sub(r"[^\w.\- ]+", "", base, flags=re.UNICODE).strip(" .")
    return (base or "image")[:MAX_FILENAME]


def _folder(folder: str) -> str:
    if folder not in MEDIA_FOLDERS:
        raise AppError(
            422,
            "validation_error",
            "Choose a folder.",
            fields=[{"field": "folder", "message": f"One of: {', '.join(MEDIA_FOLDERS)}."}],
        )
    return folder


def _store(
    storage: Storage, folder: str, uid: str, revision: int, image: ProcessedImage
) -> dict[str, Any]:
    prefix = f"{folder}/{uid}/r{revision}"
    written: list[str] = []
    try:
        original = f"{prefix}/original.{image.extension}"
        storage.put(original, image.data, image.content_type)
        written.append(original)
        variants = []
        for variant in image.variants:
            key = f"{prefix}/w{variant.width}.webp"
            storage.put(key, variant.data, "image/webp")
            written.append(key)
            variants.append(
                {
                    "width": variant.width,
                    "height": variant.height,
                    "key": key,
                    "url": storage.url(key),
                    "byte_size": len(variant.data),
                }
            )
    except StorageError as error:
        discard(storage, written)
        raise AppError(
            502, "storage_failed", "The image could not be stored. Try again."
        ) from error
    return {
        "key_prefix": prefix,
        "url": storage.url(original),
        "variants": variants,
        "written": written,
    }


def discard(storage: Storage, keys: list[str]) -> None:
    """Best effort: an orphaned file costs storage, never correctness."""
    with contextlib.suppress(StorageError):
        storage.delete(keys)


def list_assets(session: Session, folder: str | None = None) -> list[MediaAsset]:
    query = select(MediaAsset).where(MediaAsset.deleted_at.is_(None))
    if folder:
        query = query.where(MediaAsset.folder == _folder(folder))
    return list(session.scalars(query.order_by(MediaAsset.created_at.desc(), MediaAsset.id.desc())))


def get_asset(session: Session, asset_id: int) -> MediaAsset:
    asset = session.get(MediaAsset, asset_id)
    if asset is None or asset.deleted_at is not None:
        raise AppError(404, "not_found", "Image not found.")
    return asset


def upload(
    session: Session,
    storage: Storage,
    owner: OwnerContext,
    image: ProcessedImage,
    *,
    filename: str | None,
    folder: str,
    alt_text: str,
) -> Outcome:
    uid = uuid.uuid4().hex
    stored = _store(storage, _folder(folder), uid, 1, image)
    try:
        now = utcnow()
        asset = MediaAsset(
            uid=uid,
            revision=1,
            folder=folder,
            filename=safe_filename(filename),
            content_type=image.content_type,
            url=stored["url"],
            key_prefix=stored["key_prefix"],
            extension=image.extension,
            byte_size=len(image.data),
            width=image.width,
            height=image.height,
            sha256=image.sha256,
            variants=stored["variants"],
            alt_text=alt_text,
            version=1,
            created_at=now,
            updated_at=now,
        )
        session.add(asset)
        session.flush()
        audit.record(
            session,
            owner,
            action="upload",
            entity_type="media",
            entity_id=asset.id,
            summary=f"Uploaded image “{asset.filename}”",
        )
    except Exception:
        discard(storage, stored["written"])
        raise
    return Outcome(asset)


def _check_version(asset: MediaAsset, version: int) -> None:
    if asset.version != version:
        raise AppError(
            409,
            "conflict",
            "This image was changed after you opened it. Reload it to see the latest version.",
        )


def update_details(
    session: Session,
    owner: OwnerContext,
    asset_id: int,
    *,
    alt_text: str,
    folder: str,
    version: int,
) -> Outcome:
    asset = get_asset(session, asset_id)
    _check_version(asset, version)
    changed = [
        name
        for name, value in (("alt_text", alt_text), ("folder", _folder(folder)))
        if getattr(asset, name) != value
    ]
    if changed:
        # The folder is organisation only: stored keys keep the folder of their revision.
        asset.alt_text = alt_text
        asset.folder = folder
        asset.version += 1
        asset.updated_at = utcnow()
        audit.record(
            session,
            owner,
            action="update",
            entity_type="media",
            entity_id=asset.id,
            summary=f"Edited image “{asset.filename}”",
            changed_fields=changed,
        )
    return Outcome(asset)


def usages(session: Session, url: str) -> list[str]:
    """Where content uses this image, as short descriptions."""
    found = []
    profile = session.get(Profile, 1)
    if profile is not None and url in (profile.portrait_src, profile.cv_href):
        found.append("the profile portrait")
    projects = session.scalars(select(Project).where(Project.deleted_at.is_(None)))
    for project in projects:
        if any(item.get("src") == url for item in project.media):
            found.append(f"project “{project.title}”")
    return found


def _rewrite_references(session: Session, old: str, new: str) -> bool:
    changed = False
    now = utcnow()
    profile = session.get(Profile, 1)
    if profile is not None and profile.portrait_src == old:
        profile.portrait_src = new
        profile.version += 1
        profile.updated_at = now
        changed = True
    for project in session.scalars(select(Project).where(Project.deleted_at.is_(None))):
        if any(item.get("src") == old for item in project.media):
            project.media = [
                {**item, "src": new} if item.get("src") == old else item for item in project.media
            ]
            flag_modified(project, "media")
            project.version += 1
            project.updated_at = now
            changed = True
    return changed


def replace(
    session: Session,
    storage: Storage,
    owner: OwnerContext,
    asset_id: int,
    image: ProcessedImage,
    *,
    filename: str | None,
    version: int,
) -> Outcome:
    asset = get_asset(session, asset_id)
    _check_version(asset, version)
    old_url, old_keys = asset.url, asset.keys()
    stored = _store(storage, asset.folder, asset.uid, asset.revision + 1, image)
    try:
        asset.revision += 1
        asset.filename = safe_filename(filename)
        asset.content_type = image.content_type
        asset.url = stored["url"]
        asset.key_prefix = stored["key_prefix"]
        asset.extension = image.extension
        asset.byte_size = len(image.data)
        asset.width = image.width
        asset.height = image.height
        asset.sha256 = image.sha256
        asset.variants = stored["variants"]
        asset.version += 1
        asset.updated_at = utcnow()
        content_changed = _rewrite_references(session, old_url, asset.url)
        session.flush()
        audit.record(
            session,
            owner,
            action="replace",
            entity_type="media",
            entity_id=asset.id,
            summary=f"Replaced image “{asset.filename}”",
        )
    except Exception:
        discard(storage, stored["written"])
        raise
    return Outcome(asset, obsolete_keys=old_keys, content_changed=content_changed)


def delete(session: Session, owner: OwnerContext, asset_id: int) -> Outcome:
    asset = get_asset(session, asset_id)
    used = usages(session, asset.url)
    if used:
        raise AppError(
            409,
            "in_use",
            f"This image is used by {', '.join(used)}. Choose another image there first.",
        )
    asset.deleted_at = utcnow()
    audit.record(
        session,
        owner,
        action="delete",
        entity_type="media",
        entity_id=asset.id,
        summary=f"Deleted image “{asset.filename}”",
    )
    return Outcome(asset, obsolete_keys=asset.keys())


def by_url(session: Session, urls: set[str]) -> dict[str, MediaAsset]:
    """Library images among these URLs, for responsive delivery of public content."""
    if not urls:
        return {}
    rows = session.scalars(
        select(MediaAsset).where(MediaAsset.url.in_(urls), MediaAsset.deleted_at.is_(None))
    )
    return {row.url: row for row in rows}
