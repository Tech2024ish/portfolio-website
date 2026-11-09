# Portfolio API (backend)

A FastAPI modular monolith. It is the **only** backend: business logic, authentication,
database access, file management and publishing all live here. Deployed to Render, backed by
Supabase PostgreSQL and Supabase Storage.

## Layout

```text
backend/
├── app/
│   ├── api/            health.py (unversioned probes), v1/router.py, v1/endpoints/
│   ├── core/           settings (config.py); security, logging, errors from Phase 2
│   ├── database/       engine, sessions, transaction boundaries (Phase 2)
│   ├── integrations/   Supabase Storage, email, Next.js revalidation adapters
│   ├── models/         SQLAlchemy models
│   ├── repositories/   data access, including public visibility filters
│   ├── schemas/        Pydantic request/response contracts
│   ├── services/       business logic and transactions
│   └── main.py         create_app() factory
├── migrations/         Alembic (Phase 2)
├── tests/
├── legacy/             V2 implementation: read-only reference, ported phase by phase, then removed
├── Dockerfile
└── pyproject.toml      dependencies + ruff/mypy/pytest config; uv.lock pins exact versions
```

## Setup

Requires [uv](https://docs.astral.sh/uv/) and Docker.

```bash
cd backend
cp .env.example .env
uv sync                          # creates .venv with Python 3.13 and exact locked versions
docker compose up -d db          # from repo root: PostgreSQL 17 on localhost:54329
uv run uvicorn app.main:app --reload
# → http://localhost:8000/health and http://localhost:8000/api/v1/docs
```

## Quality checks

```bash
uv run ruff check .
uv run ruff format --check .
uv run mypy
uv run pytest                    # includes PostgreSQL tests; needs TEST_DATABASE_URL
uv run pytest -m "not postgres"  # explicit opt-out for a quick unit-only run
uv run pip-audit                 # known-vulnerability scan of the locked dependencies
```

PostgreSQL tests **fail**, rather than skip, when `TEST_DATABASE_URL` is missing.

## Configuration

See `.env.example`. With `ENVIRONMENT=production` the app refuses to start on unsafe settings:
missing or non-PostgreSQL `DATABASE_URL`, `COOKIE_SECURE=false`, a wildcard or non-HTTPS CORS
origin, a non-HTTPS `PUBLIC_SITE_URL`, local file storage, or Supabase storage without its
credentials. Secrets are `SecretStr` and never appear in logs or error messages.

## Endpoints

| Path | Purpose |
|---|---|
| `GET /health` | Liveness. 200 while the process serves HTTP; never touches the database. |
| `GET /ready` | Readiness including the database (Phase 2). |
| `/api/v1/*` | Versioned API (Phases 2–10). |
| `/api/v1/docs` | OpenAPI UI, disabled in production by default. |
