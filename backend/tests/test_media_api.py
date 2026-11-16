"""The media library against real PostgreSQL, with local storage in a temporary directory."""

from __future__ import annotations

import io
import json
from collections.abc import Callable
from pathlib import Path
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.cli.content import DEFAULT_FILE, import_content
from app.core.config import Settings
from app.database.session import Database
from app.integrations.storage import SupabaseStorage
from app.services.media import safe_filename
from tests.conftest import ORIGIN, csrf_headers, signed_in

pytestmark = pytest.mark.postgres


def image_bytes(width: int = 2000, height: int = 1200, fmt: str = "PNG", **save: Any) -> bytes:
    out = io.BytesIO()
    Image.new("RGB", (width, height), (40, 120, 200)).save(out, fmt, **save)
    return out.getvalue()


def jpeg_with_location() -> bytes:
    exif = Image.Exif()
    exif[0x010F] = "Camera maker"  # Make
    exif[0x8825] = {2: (1.0, 2.0, 3.0)}  # GPS IFD: latitude
    return image_bytes(800, 600, "JPEG", exif=exif.tobytes())


@pytest.fixture
def studio(
    make_api: Callable[..., TestClient], owner: int, tmp_path: Path
) -> tuple[TestClient, dict[str, str]]:
    client = make_api(storage_backend="local", local_media_dir=str(tmp_path))
    return client, csrf_headers(signed_in(client))


def upload(
    client: TestClient,
    headers: dict[str, str],
    data: bytes,
    *,
    name: str = "screen.png",
    content_type: str = "image/png",
    **fields: str,
) -> Any:
    return client.post(
        "/api/v1/owner/media",
        files={"file": (name, data, content_type)},
        data={"folder": "projects", "alt_text": "A dashboard", **fields},
        headers=headers,
    )


def stored(client: TestClient, url: str) -> Any:
    return client.get(url)


# ------------------------------------------------------------------ upload and delivery


def test_an_upload_is_stored_with_responsive_variants(
    studio: tuple[TestClient, dict[str, str]],
) -> None:
    client, headers = studio
    response = upload(client, headers, image_bytes())
    assert response.status_code == 201, response.text
    asset = response.json()
    assert (asset["width"], asset["height"], asset["content_type"]) == (2000, 1200, "image/png")
    assert [v["width"] for v in asset["variants"]] == [480, 960, 1600]
    assert asset["url"].startswith("/api/v1/media/files/projects/")

    original = stored(client, asset["url"])
    assert original.status_code == 200
    assert original.headers["content-type"] == "image/png"
    assert original.headers["cache-control"] == "public, max-age=31536000, immutable"
    variant = stored(client, asset["variants"][0]["url"])
    assert variant.headers["content-type"] == "image/webp"
    assert Image.open(io.BytesIO(variant.content)).size == (480, 288)


def test_small_images_are_never_enlarged(studio: tuple[TestClient, dict[str, str]]) -> None:
    client, headers = studio
    asset = upload(client, headers, image_bytes(400, 300)).json()
    assert asset["variants"] == []


def test_location_and_camera_metadata_are_removed(
    studio: tuple[TestClient, dict[str, str]],
) -> None:
    client, headers = studio
    asset = upload(
        client, headers, jpeg_with_location(), name="p.jpg", content_type="image/jpeg"
    ).json()
    original = Image.open(io.BytesIO(stored(client, asset["url"]).content))
    assert dict(original.getexif()) == {}


@pytest.mark.parametrize(
    ("data", "content_type", "status"),
    [
        (
            b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
            "image/svg+xml",
            415,
        ),
        (image_bytes(64, 64, "GIF"), "image/gif", 415),
        (image_bytes(64, 64), "image/jpeg", 415),  # PNG bytes declared as JPEG
        (b"\x89PNG\r\n\x1a\n" + b"\x00" * 64, "image/png", 415),  # a signature and nothing else
        (b"<?php echo 1; ?>", "image/png", 415),
    ],
)
def test_anything_but_a_real_image_is_refused(
    studio: tuple[TestClient, dict[str, str]], data: bytes, content_type: str, status: int
) -> None:
    client, headers = studio
    response = upload(client, headers, data, content_type=content_type)
    assert response.status_code == status, response.text
    assert response.json()["error"]["fields"][0]["field"] == "file"
    assert client.get("/api/v1/owner/media").json() == []


def test_decompression_bombs_are_refused_before_decoding(
    studio: tuple[TestClient, dict[str, str]],
) -> None:
    client, headers = studio
    out = io.BytesIO()
    Image.new("1", (8000, 6000)).save(out, "PNG")  # 48 megapixels in a few kilobytes
    response = upload(client, headers, out.getvalue())
    assert response.status_code == 413


def test_oversized_uploads_are_refused_before_reading(
    make_api: Callable[..., TestClient], owner: int, tmp_path: Path
) -> None:
    client = make_api(storage_backend="local", local_media_dir=str(tmp_path), max_image_mb=1)
    headers = csrf_headers(signed_in(client))
    response = upload(client, headers, b"\x89PNG\r\n\x1a\n" + b"\x00" * (1024 * 1024 + 70_000))
    assert response.status_code == 413
    assert list(tmp_path.iterdir()) == []


def test_uploads_and_deletes_need_the_owner_session_and_csrf_token(
    studio: tuple[TestClient, dict[str, str]], make_api: Callable[..., TestClient], tmp_path: Path
) -> None:
    client, headers = studio
    asset = upload(client, headers, image_bytes()).json()
    anonymous = make_api(storage_backend="local", local_media_dir=str(tmp_path))
    assert upload(anonymous, {"Origin": ORIGIN}, image_bytes()).status_code == 401
    assert anonymous.delete(f"/api/v1/owner/media/{asset['id']}").status_code == 401
    assert upload(client, {"Origin": ORIGIN}, image_bytes()).status_code == 403
    assert (
        client.delete(f"/api/v1/owner/media/{asset['id']}", headers={"Origin": ORIGIN}).status_code
        == 403
    )
    assert len(client.get("/api/v1/owner/media").json()) == 1


def test_storage_keys_cannot_reach_outside_the_media_directory(
    studio: tuple[TestClient, dict[str, str]],
) -> None:
    client, _ = studio
    for key in [
        "../../pyproject.toml",
        "projects/..%2F..%2Fpyproject.toml",
        "projects/x/r1/original.png",
    ]:
        assert client.get(f"/api/v1/media/files/{key}").status_code == 404


def test_without_storage_the_library_says_so(
    make_api: Callable[..., TestClient], owner: int
) -> None:
    client = make_api()  # STORAGE_BACKEND=disabled
    response = upload(client, csrf_headers(signed_in(client)), image_bytes())
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "storage_unavailable"


def test_file_names_are_display_only_and_sanitised() -> None:
    assert safe_filename("../../etc/passwd") == "passwd"
    assert safe_filename("C:\\Users\\me\\photo <1>.png") == "photo 1.png"
    assert safe_filename("") == "image"


# ------------------------------------------------------------------ details, replace, delete


@pytest.fixture
def seeded(make_auth_settings: Callable[..., Settings]) -> None:
    database = Database(make_auth_settings())
    with database.session() as db, db.begin():
        import_content(db, json.loads(DEFAULT_FILE.read_text(encoding="utf-8")))
    database.dispose()


def use_as_portrait(client: TestClient, headers: dict[str, str], url: str) -> None:
    profile = client.get("/api/v1/owner/profile").json()
    fields = {k: v for k, v in profile.items() if k not in ("updated_at",)}
    response = client.put(
        "/api/v1/owner/profile", json={**fields, "portrait_src": url}, headers=headers
    )
    assert response.status_code == 200, response.text


def test_alt_text_edits_are_versioned(studio: tuple[TestClient, dict[str, str]]) -> None:
    client, headers = studio
    asset = upload(client, headers, image_bytes()).json()
    body = {"alt_text": "The MOSAIC dashboard", "folder": "general", "version": asset["version"]}
    edited = client.put(f"/api/v1/owner/media/{asset['id']}", json=body, headers=headers)
    assert edited.json()["alt_text"] == "The MOSAIC dashboard"
    stale = client.put(f"/api/v1/owner/media/{asset['id']}", json=body, headers=headers)
    assert stale.status_code == 409


def test_an_image_in_use_cannot_be_deleted(
    studio: tuple[TestClient, dict[str, str]], seeded: None
) -> None:
    client, headers = studio
    asset = upload(client, headers, image_bytes()).json()
    use_as_portrait(client, headers, asset["url"])
    assert client.get(f"/api/v1/owner/media/{asset['id']}").json()["used_by"] == [
        "the profile portrait"
    ]
    refused = client.delete(f"/api/v1/owner/media/{asset['id']}", headers=headers)
    assert refused.status_code == 409
    assert "profile portrait" in refused.json()["error"]["message"]


def test_the_public_site_gets_responsive_versions_of_library_images(
    studio: tuple[TestClient, dict[str, str]], seeded: None
) -> None:
    client, headers = studio
    asset = upload(client, headers, image_bytes()).json()
    use_as_portrait(client, headers, asset["url"])
    portrait = client.get("/api/v1/public/portfolio").json()["portrait"]
    assert [v["width"] for v in portrait["variants"]] == [480, 960, 1600]


def test_replacing_an_image_updates_the_content_that_uses_it(
    studio: tuple[TestClient, dict[str, str]], seeded: None
) -> None:
    client, headers = studio
    asset = upload(client, headers, image_bytes()).json()
    use_as_portrait(client, headers, asset["url"])
    replaced = client.post(
        f"/api/v1/owner/media/{asset['id']}/replace",
        files={"file": ("new.jpg", image_bytes(1000, 800, "JPEG"), "image/jpeg")},
        data={"version": str(asset["version"])},
        headers=headers,
    )
    assert replaced.status_code == 200, replaced.text
    new = replaced.json()
    assert new["url"] != asset["url"] and "/r2/" in new["url"]
    assert client.get("/api/v1/owner/profile").json()["portrait_src"] == new["url"]
    assert stored(client, new["url"]).status_code == 200
    assert stored(client, asset["url"]).status_code == 404  # the old revision's files are gone
    events = [event["action"] for event in client.get("/api/v1/owner/activity").json()]
    assert events[0] == "replace"


def test_deleting_an_unused_image_removes_its_files(
    studio: tuple[TestClient, dict[str, str]],
) -> None:
    client, headers = studio
    asset = upload(client, headers, image_bytes()).json()
    assert client.delete(f"/api/v1/owner/media/{asset['id']}", headers=headers).status_code == 204
    assert client.get("/api/v1/owner/media").json() == []
    assert stored(client, asset["url"]).status_code == 404
    assert stored(client, asset["variants"][0]["url"]).status_code == 404


# ------------------------------------------------------------------ Supabase Storage adapter


def test_supabase_storage_uses_the_service_key_only_on_the_server_side() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json={})

    storage = SupabaseStorage(
        "https://abc.supabase.co",
        "service-key",
        "media",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    key = "projects/" + "a" * 32 + "/r1/original.png"
    storage.put(key, b"data", "image/png")
    storage.delete([key])
    put, delete = seen
    assert str(put.url) == f"https://abc.supabase.co/storage/v1/object/media/{key}"
    assert put.headers["authorization"] == "Bearer service-key"
    assert put.headers["x-upsert"] == "false"
    assert json.loads(delete.content) == {"prefixes": [key]}
    # The URL given to browsers is the public one and carries no key.
    assert storage.url(key) == f"https://abc.supabase.co/storage/v1/object/public/media/{key}"
