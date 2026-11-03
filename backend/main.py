import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import IntegrityError

from core.config import get_settings
from routers import contact, gallery, projects, visits
from routers.v1 import api_v1

logger = logging.getLogger("portfolio")
settings = get_settings()

app = FastAPI(title="Portfolio API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-Requested-With"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    # Local media files may be previewed in the studio (same origin); everything else is never framed.
    media = request.url.path.startswith("/api/v1/media-files")
    response.headers.setdefault("X-Frame-Options", "SAMEORIGIN" if media else "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    if request.url.path.startswith("/api/v1/admin") or request.url.path.startswith("/api/v1/auth"):
        response.headers["Cache-Control"] = "no-store"
    return response


# ------------------------------------------------------------------ predictable errors


def _error(status: int, code: str, message: str, fields: list | None = None) -> JSONResponse:
    body = {"detail": message, "error": {"code": code, "message": message}}
    if fields:
        body["error"]["fields"] = fields
    return JSONResponse(status_code=status, content=body)


CODES = {400: "bad_request", 401: "unauthenticated", 403: "forbidden", 404: "not_found", 409: "conflict",
         413: "too_large", 415: "unsupported_media", 422: "invalid", 429: "rate_limited", 502: "upstream_error",
         503: "unavailable"}


@app.exception_handler(HTTPException)
async def http_error(_: Request, exc: HTTPException):
    message = exc.detail if isinstance(exc.detail, str) else "Request failed."
    return _error(exc.status_code, CODES.get(exc.status_code, "error"), message)


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError):
    fields = [
        {"field": ".".join(str(part) for part in err["loc"][1:]) or "body", "message": err["msg"].removeprefix("Value error, ")}
        for err in exc.errors()
    ]
    summary = "; ".join(f"{f['field']}: {f['message']}" for f in fields[:3])
    return _error(422, "invalid", f"Check the highlighted fields. {summary}", fields)


@app.exception_handler(IntegrityError)
async def integrity_error(_: Request, exc: IntegrityError):
    logger.warning("Integrity error: %s", exc.orig)
    return _error(409, "conflict", "That change conflicts with existing data (for example a duplicate name).")


@app.exception_handler(Exception)
async def unexpected_error(_: Request, exc: Exception):
    logger.exception("Unhandled error", exc_info=exc)
    return _error(500, "server_error", "Something went wrong on the server.")


# ------------------------------------------------------------------ routes

# Legacy routes used by the current deployed frontend; kept for compatibility.
app.include_router(projects.router, prefix="/api")
app.include_router(contact.router, prefix="/api")
app.include_router(visits.router, prefix="/api")
app.include_router(gallery.router, prefix="/api")

app.include_router(api_v1)

if settings.storage_backend == "local":
    media_root = Path(settings.local_media_dir)
    media_root.mkdir(parents=True, exist_ok=True)
    app.mount("/api/v1/media-files", StaticFiles(directory=media_root), name="media-files")


@app.get("/")
def read_root():
    return {"message": "Portfolio API is running"}


@app.get("/api/v1/health")
def health():
    from sqlalchemy import text

    from core.db import get_engine

    engine = get_engine()
    if engine is None:
        return JSONResponse(status_code=503, content={"status": "degraded", "database": "not configured"})
    try:
        with engine.connect() as connection:
            connection.execute(text("select 1"))
    except Exception:
        return JSONResponse(status_code=503, content={"status": "degraded", "database": "unreachable"})
    return {"status": "ok", "database": "ok"}
