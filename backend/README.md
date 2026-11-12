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
docker compose up -d db          # from repo root: PostgreSQL 17 on 127.0.0.1:54329
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8100
# → http://127.0.0.1:8100/health and http://127.0.0.1:8100/api/v1/docs
# Port 8100, not uvicorn's default 8000: other local projects commonly use 8000.
# The frontend proxies /api/* to API_ORIGIN (default http://127.0.0.1:8100).
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
credentials. Storage is `disabled` by default and needs no credentials until a feature uses it.
Secrets are `SecretStr` and never appear in logs or error messages.

### Database role (production)

The API must connect as the role that **owns** the tables (the role that ran the migrations;
on Supabase this is `postgres`, through the session pooler user `postgres.<project-ref>`), or as
a role with `BYPASSRLS`. Every V3 table, including `alembic_version`, has row-level security
enabled with no policies, so that Supabase's `anon` and `authenticated` roles can never read
or write them. Any other role is blocked in the same way: requests fail, and `GET /ready`
reports `migrations: pending` even after a successful migration.

## Endpoints

| Path | Purpose |
|---|---|
| `GET /health` | Liveness. 200 while the process serves HTTP; never touches the database. Use it for Render's health check. |
| `GET /ready` | Readiness. 200 only when a read-only query succeeds and `alembic_version` is exactly the expected revision; otherwise 503. Results are cached for 5 s per process, one check at a time. |
| `/api/v1/*` | Versioned API (Phases 2–10). |
| `/api/v1/docs` | OpenAPI UI, disabled in production by default. |
