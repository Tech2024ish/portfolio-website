"""File storage and upload validation.

Files are identified by content (magic bytes + Pillow decoding), never by the
client-supplied filename or Content-Type. SVG and HTML are deliberately not
accepted because they can carry script.
"""

from __future__ import annotations

import hashlib
import io
import os
import re
import uuid
from dataclasses import dataclass
from pathlib import Path

import httpx
from fastapi import HTTPException
from PIL import Image, UnidentifiedImageError

from core.config import Settings, get_settings

Image.MAX_IMAGE_PIXELS = 40_000_000  # refuse decompression bombs

IMAGE_TYPES = {"PNG": ("image/png", "png"), "JPEG": ("image/jpeg", "jpg"), "WEBP": ("image/webp", "webp"), "GIF": ("image/gif", "gif")}


@dataclass
class ValidatedFile:
    data: bytes
    content_type: str
    extension: str
    kind: str
    width: int | None
    height: int | None
    sha256: str
    filename: str


def safe_filename(name: str | None) -> str:
    base = os.path.basename(name or "file").strip() or "file"
    base = re.sub(r"[^A-Za-z0-9._ -]", "_", base)
    return base[:200]


def validate_upload(data: bytes, filename: str | None, settings: Settings | None = None) -> ValidatedFile:
    settings = settings or get_settings()
    if not data:
        raise HTTPException(status_code=422, detail="The file is empty.")

    if data.startswith(b"%PDF-"):
        if len(data) > settings.max_document_mb * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"PDFs must be {settings.max_document_mb} MB or smaller.")
        return ValidatedFile(
            data, "application/pdf", "pdf", "document", None, None, hashlib.sha256(data).hexdigest(), safe_filename(filename)
        )

    if len(data) > settings.max_image_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"Images must be {settings.max_image_mb} MB or smaller.")
    try:
        with Image.open(io.BytesIO(data)) as probe:
            fmt = probe.format
            probe.verify()
        with Image.open(io.BytesIO(data)) as image:
            width, height = image.size
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError, SyntaxError):
        fmt = None
    if fmt not in IMAGE_TYPES:
        raise HTTPException(
            status_code=415, detail="Unsupported file. Upload a PNG, JPEG, WebP or GIF image, or a PDF document."
        )
    content_type, extension = IMAGE_TYPES[fmt]
    return ValidatedFile(
        data, content_type, extension, "image", width, height, hashlib.sha256(data).hexdigest(), safe_filename(filename)
    )


def new_storage_key(validated: ValidatedFile) -> str:
    folder = "images" if validated.kind == "image" else "documents"
    return f"{folder}/{uuid.uuid4().hex}.{validated.extension}"


class Storage:
    def save(self, key: str, data: bytes, content_type: str) -> str:  # returns public URL
        raise NotImplementedError

    def delete(self, key: str) -> None:
        raise NotImplementedError


class LocalStorage(Storage):
    """Development/test storage. Files are served by the API at /media-files."""

    def __init__(self, root: str, url_prefix: str = "/api/v1/media-files"):
        self.root = Path(root).resolve()
        self.url_prefix = url_prefix

    def _path(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if self.root not in path.parents:
            raise ValueError("Invalid storage key")
        return path

    def save(self, key: str, data: bytes, content_type: str) -> str:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return f"{self.url_prefix}/{key}"

    def delete(self, key: str) -> None:
        path = self._path(key)
        if path.exists():
            path.unlink()


class SupabaseStorage(Storage):
    def __init__(self, base_url: str, service_key: str, bucket: str):
        self.base_url = base_url.rstrip("/")
        self.bucket = bucket
        self.headers = {"apikey": service_key, "Authorization": f"Bearer {service_key}"}

    def save(self, key: str, data: bytes, content_type: str) -> str:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(
                f"{self.base_url}/storage/v1/object/{self.bucket}/{key}",
                headers={**self.headers, "Content-Type": content_type, "x-upsert": "false", "cache-control": "31536000"},
                content=data,
            )
        if response.status_code not in (200, 201):
            raise HTTPException(status_code=502, detail="File storage rejected the upload. Try again shortly.")
        return f"{self.base_url}/storage/v1/object/public/{self.bucket}/{key}"

    def delete(self, key: str) -> None:
        with httpx.Client(timeout=15.0) as client:
            response = client.request(
                "DELETE",
                f"{self.base_url}/storage/v1/object/{self.bucket}",
                headers={**self.headers, "Content-Type": "application/json"},
                json={"prefixes": [key]},
            )
        if response.status_code not in (200, 204):
            raise HTTPException(status_code=502, detail="File storage could not delete the file.")


_storage: Storage | None = None


def get_storage() -> Storage:
    global _storage
    if _storage is None:
        settings = get_settings()
        if settings.storage_backend == "supabase":
            if not (settings.supabase_url and settings.supabase_service_key):
                raise HTTPException(status_code=503, detail="File storage is not configured.")
            _storage = SupabaseStorage(settings.supabase_url, settings.supabase_service_key, settings.media_bucket)
        else:
            _storage = LocalStorage(settings.local_media_dir)
    return _storage


def set_storage(storage: Storage | None) -> None:
    global _storage
    _storage = storage
