# syntax=docker/dockerfile:1.7
# Production image for the FastAPI backend (Render) and the local Compose stack.

ARG PYTHON_VERSION=3.13

# ---------------------------------------------------------------- build stage
FROM python:${PYTHON_VERSION}-slim-bookworm AS build
COPY --from=ghcr.io/astral-sh/uv:0.13.5 /uv /bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/opt/venv

WORKDIR /src
# Dependencies first (cached layer), exactly as pinned in uv.lock.
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project
# Then the application itself.
COPY README.md ./
COPY app ./app
RUN uv sync --locked --no-dev --no-editable

# ---------------------------------------------------------------- runtime stage
FROM python:${PYTHON_VERSION}-slim-bookworm AS runtime

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    FORWARDED_ALLOW_IPS=127.0.0.1

RUN groupadd --system app && useradd --system --gid app --home-dir /srv --no-create-home app
WORKDIR /srv
COPY --from=build /opt/venv /opt/venv
# Alembic files are added here in Phase 2 so the image can run controlled pre-deploy migrations.

USER app
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["python", "-c", "import os, urllib.request; urllib.request.urlopen(f\"http://127.0.0.1:{os.environ['PORT']}/health\", timeout=4)"]

# Render injects $PORT. FORWARDED_ALLOW_IPS controls whose X-Forwarded-For is trusted
# (reviewed in Phase 3 together with rate limiting).
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port \"$PORT\" --proxy-headers --no-server-header"]
