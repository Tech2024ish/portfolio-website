"""Image validation and processing for uploads. Pure: bytes in, bytes out; no storage, no database.

An upload is accepted only when all of these hold:
- its size is within MAX_IMAGE_MB (checked while reading, before this module runs);
- its first bytes are a JPEG, PNG or WebP signature, and the type the browser declared (if any)
  is the same; SVG, GIF, HEIC and everything else are refused;
- Pillow decodes it completely as that same format, it is not animated, and it has at most
  MAX_PIXELS pixels (decompression bombs are refused before decoding the pixels).

The stored original is re-encoded from the decoded pixels, oriented by its EXIF orientation and
without any metadata (EXIF, GPS, comments). Narrower WebP variants are made for responsive
delivery; images are never enlarged.
"""

from __future__ import annotations

import hashlib
import io
import warnings
from dataclasses import dataclass

from PIL import Image, ImageOps

from app.core.errors import AppError

MAX_PIXELS = 40_000_000
VARIANT_WIDTHS = (480, 960, 1600)

# content type -> (Pillow format, extension)
FORMATS = {
    "image/jpeg": ("JPEG", "jpg"),
    "image/png": ("PNG", "png"),
    "image/webp": ("WEBP", "webp"),
}


@dataclass(frozen=True)
class Variant:
    width: int
    height: int
    data: bytes


@dataclass(frozen=True)
class ProcessedImage:
    content_type: str
    extension: str
    width: int
    height: int
    data: bytes
    sha256: str
    variants: tuple[Variant, ...]


def _rejected(message: str, status: int = 415) -> AppError:
    return AppError(
        status, "unsupported_image", message, fields=[{"field": "file", "message": message}]
    )


def sniff(data: bytes) -> str | None:
    """The image type from the file's first bytes, whatever its name or declared type."""
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    return None


def _encode(image: Image.Image, fmt: str) -> bytes:
    out = io.BytesIO()
    if fmt == "JPEG":
        image.convert("RGB").save(out, "JPEG", quality=88, optimize=True, progressive=True)
    elif fmt == "PNG":
        image.save(out, "PNG", optimize=True)
    else:
        image.save(out, "WEBP", quality=85, method=4)
    return out.getvalue()


def process(data: bytes, declared_type: str | None) -> ProcessedImage:
    content_type = sniff(data)
    if content_type is None:
        raise _rejected("Upload a JPEG, PNG or WebP image.")
    declared = (declared_type or "").split(";")[0].strip().lower()
    if declared and declared != "application/octet-stream" and declared != content_type:
        raise _rejected("The file's contents do not match its type.")
    fmt, extension = FORMATS[content_type]

    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as probe:
                if probe.format != fmt:
                    raise _rejected("The file's contents do not match its type.")
                width, height = probe.size
                if width * height > MAX_PIXELS:
                    raise _rejected("The image has too many pixels (40 megapixels at most).", 413)
                if getattr(probe, "is_animated", False):
                    raise _rejected("Animated images are not supported.")
                probe.load()
                image = ImageOps.exif_transpose(probe)
    except AppError:
        raise
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
        raise _rejected("The image has too many pixels (40 megapixels at most).", 413) from error
    except Exception as error:  # Pillow raises many types for corrupt input
        raise _rejected("The image could not be read; it may be damaged.") from error

    if image.mode not in ("RGB", "RGBA", "L", "LA"):
        image = image.convert(
            "RGBA" if "A" in image.getbands() or "transparency" in image.info else "RGB"
        )
    image.info.clear()  # no EXIF, ICC or text chunks are written back

    original = _encode(image, fmt)
    width, height = image.size
    variants = []
    for target in VARIANT_WIDTHS:
        if target >= width:
            break
        resized = image.resize(
            (target, max(1, round(height * target / width))), Image.Resampling.LANCZOS
        )
        variants.append(Variant(target, resized.height, _encode(resized, "WEBP")))
    return ProcessedImage(
        content_type=content_type,
        extension=extension,
        width=width,
        height=height,
        data=original,
        sha256=hashlib.sha256(original).hexdigest(),
        variants=tuple(variants),
    )
