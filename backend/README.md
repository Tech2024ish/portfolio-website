# Portfolio API (backend)

A FastAPI modular monolith. It is the **only** backend: business logic, authentication,
database access, file management and publishing all live here. Deployed to Render, backed by
Supabase PostgreSQL and Supabase Storage.

## Layout

```text
backend/
├── app/
│   ├── api/            health.py (unversioned probes), v1/router.py, v1/endpoints/
│   ├── core/           settings, error envelope, body-size limit, client IP
│   ├── database/       engine, sessions, transaction boundaries, readiness
│   ├── integrations/   Supabase Storage, email, Next.js revalidation adapters
│   ├── models/         SQLAlchemy models
│   ├── repositories/   data access, including public visibility filters
│   ├── schemas/        Pydantic request/response contracts
│   ├── services/       business logic and transactions
│   └── main.py         create_app() factory
├── migrations/         Alembic (see migrations/README.md)
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

## Owner account

There is one owner. The account is created and managed only from the command line; passwords are
typed at a hidden prompt, never passed as arguments:

```bash
uv run python -m app.cli.owner create owner@example.com --name "Jean Claude"
uv run python -m app.cli.owner set-password owner@example.com      # also ends every session
uv run python -m app.cli.owner revoke-sessions owner@example.com
uv run python -m app.cli.owner import-legacy-hash owner@example.com < v2-hash.txt
```

`import-legacy-hash` keeps a V2 password working during migration: the `scrypt$...` hash is
stored as is and re-hashed with Argon2id at the next successful sign-in.

How it works (details in `docs/architecture.md`, "Owner authentication"):

- Passwords: Argon2id (RFC 9106 low-memory profile); V2 scrypt hashes are verified and upgraded.
- Sessions: a random token in an HttpOnly, SameSite=Strict cookie (`__Host-` and Secure in
  production); only its SHA-256 digest is stored. Sessions expire (12 h), end when idle (2 h)
  and can be revoked; a password change ends every other session.
- CSRF: state-changing owner requests need `X-CSRF-Token` (derived from the session) and an
  allowed `Origin`; sign-in needs a JSON body and an allowed `Origin`.
- Brute force: per-address and per-account limits in PostgreSQL, generic error messages, and
  equal timing for unknown accounts. Logs never contain emails, passwords or tokens.

## Portfolio content

Content (profile, skills, experience, education, certifications, projects, Engineering Notes) is edited in the
Owner Studio. To start a database from the verified content in `frontend/src/content/profile.ts`:

```bash
node ../frontend/scripts/export-content.mjs        # refreshes app/cli/verified-content.json
uv run python -m app.cli.content import            # into an EMPTY database; drafts stay drafts
```

The import validates everything first, runs in one transaction and refuses to run when any content already
exists. Details: `docs/architecture.md`, "Content management".

Set `REVALIDATE_URL` (the site's `/api/revalidate`) and `REVALIDATE_SIGNING_SECRET` (shared with the frontend,
at least 32 characters) so the public site refreshes after each change. Without them nothing is sent and the
site refreshes when its cache expires (five minutes).

## Media library

Images are uploaded in the Studio (`/owner/media`). Set `STORAGE_BACKEND`:

- `local` for development: files go to `LOCAL_MEDIA_DIR` (default `media_uploads/`, gitignored) and are served by
  the API at `/api/v1/media/files/...`.
- `supabase` for production: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (backend only) and a **public-read** bucket
  named `MEDIA_BUCKET`. Only the API can write to it.

Uploads are limited to `MAX_IMAGE_MB` and to real JPEG, PNG or WebP images; metadata is stripped and responsive
WebP sizes are stored. Details: `docs/architecture.md`, "Media library".

## Endpoints

| Path | Purpose |
|---|---|
| `GET /health` | Liveness. 200 while the process serves HTTP; never touches the database. Use it for Render's health check. |
| `GET /ready` | Readiness. 200 only when a read-only query succeeds and `alembic_version` is exactly the expected revision; otherwise 503. Results are cached for 5 s per process, one check at a time. |
| `/api/v1/contact` | Public contact form. |
| `/api/v1/auth/*` | Owner sign-in (`login`), `session`, `logout`, `password`, `sessions` (list, revoke one, revoke others). |
| `/api/v1/owner/*` | Owner Studio API. Every route requires the owner session (router-level guard): `dashboard`, `activity`, `profile`, and for each of `projects`, `experiences`, `education`, `certifications`, `skill-categories`, `skills`, `articles`: list, create, get, update (versioned), delete (soft), `reorder`, and `publish`/`unpublish` where content has a status. |
| `/api/v1/owner/media` | Media library (owner only): list, upload, details and usages, edit alt text and folder, `replace`, delete (refused while in use). |
| `/api/v1/media/files/*` | Library files when `STORAGE_BACKEND=local` (development). Immutable caching. |
| `/api/v1/public/*` | Published content for the site: `portfolio`, `projects/{slug}`, `articles`, `articles/{slug}`. No authentication; drafts are never returned. |
| `/api/v1/*` | Further areas are added as their phases land. |
| `/api/v1/docs` | OpenAPI UI, disabled in production by default. |
