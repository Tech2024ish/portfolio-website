import json
import os
from fastapi import APIRouter

router = APIRouter()

COUNTER_FILE = os.path.join(os.path.dirname(__file__), "..", "visit_count.json")


def _read_count() -> int:
    try:
        with open(COUNTER_FILE, "r") as f:
            data = json.load(f)
            return int(data.get("count", 0))
    except (FileNotFoundError, ValueError, KeyError):
        return 0


def _write_count(count: int) -> None:
    with open(COUNTER_FILE, "w") as f:
        json.dump({"count": count}, f)


@router.get("/visits")
def get_visits():
    return {"count": _read_count()}


@router.post("/visits")
def record_visit():
    count = _read_count() + 1
    _write_count(count)
    return {"count": count}
