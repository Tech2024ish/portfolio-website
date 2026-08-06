import json
import os
import tempfile
from threading import Lock

from fastapi import APIRouter

from database import get_client

router = APIRouter()
COUNTER_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "visit_count.json"))
file_lock = Lock()


def _local_count() -> int:
    try:
        with open(COUNTER_FILE, "r", encoding="utf-8") as file:
            return int(json.load(file).get("count", 0))
    except (FileNotFoundError, ValueError, KeyError, TypeError):
        return 0


def _write_local_count(count: int) -> None:
    directory = os.path.dirname(COUNTER_FILE)
    fd, temp_path = tempfile.mkstemp(prefix="visit_count_", suffix=".json", dir=directory)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as file:
            json.dump({"count": count}, file)
        os.replace(temp_path, COUNTER_FILE)
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)


def _supabase_count() -> int:
    with get_client() as client:
        response = client.get("/visit_stats", params={"id": "eq.1", "select": "count"})
        if response.status_code != 200:
            raise RuntimeError(response.text)
        rows = response.json()
        if not rows:
            raise RuntimeError("visit_stats row is missing")
        return int(rows[0]["count"])


def _increment_supabase_count() -> int:
    with get_client() as client:
        response = client.post("/rpc/increment_visit_count", json={})
        if response.status_code != 200:
            raise RuntimeError(response.text)
        return int(response.json())


@router.get("/visits")
def get_visits():
    try:
        return {"count": _supabase_count()}
    except Exception:
        return {"count": _local_count()}


@router.post("/visits")
def record_visit():
    try:
        return {"count": _increment_supabase_count()}
    except Exception:
        with file_lock:
            count = _local_count() + 1
            _write_local_count(count)
        return {"count": count}
