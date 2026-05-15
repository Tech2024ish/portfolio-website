import os
import httpx
from fastapi import APIRouter, HTTPException
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
BUCKET = "gallery"


def _list_files():
    storage_url = f"{SUPABASE_URL}/storage/v1/object/list/{BUCKET}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    with httpx.Client(timeout=15.0) as client:
        response = client.post(storage_url, headers=headers, json={"prefix": "", "limit": 100, "offset": 0})
    return response


@router.get("/gallery")
def get_gallery():
    response = _list_files()

    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.text)

    files = response.json()
    if not isinstance(files, list):
        raise HTTPException(status_code=500, detail=f"Unexpected Supabase response: {files}")

    public_base = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}"
    return [
        {"name": f["name"], "url": f"{public_base}/{f['name']}"}
        for f in files
        if isinstance(f, dict) and not f.get("name", "").endswith("/")
    ]


@router.get("/gallery/debug")
def debug_gallery():
    """Returns raw Supabase storage response for debugging."""
    response = _list_files()
    return {"status": response.status_code, "body": response.text[:2000]}
