import os
import httpx
from fastapi import APIRouter, HTTPException
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
BUCKET = "gallery"


@router.get("/gallery")
def get_gallery():
    storage_url = f"{SUPABASE_URL}/storage/v1/object/list/{BUCKET}"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }
    body = {"prefix": "", "limit": 100, "offset": 0, "sortBy": {"column": "created_at", "order": "desc"}}

    with httpx.Client(timeout=10.0) as client:
        response = client.post(storage_url, headers=headers, json=body)

    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.text)

    files = response.json()
    public_base = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}"

    return [
        {"name": f["name"], "url": f"{public_base}/{f['name']}"}
        for f in files
        if not f["name"].endswith("/")  # skip folder placeholders
    ]
