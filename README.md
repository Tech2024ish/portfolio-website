# Jean Claude Ishimwe — Portfolio (V3 rebuild)

A professional portfolio for Jean Claude Ishimwe, Backend Software Engineer in Kigali, Rwanda,
with a private owner portal at `/owner` for managing all public content without editing code.

> **Status:** V3 is being rebuilt in phases on branch `rebuild/v3`. Phase 1 (foundation) is in review.
> Production (goslish.vercel.app) still runs V2 from `main`.

| Part | Stack | Hosting |
|---|---|---|
| `frontend/` | Next.js 16 (App Router), React 19, TypeScript 6, Tailwind CSS 4 | Vercel |
| `backend/` | Python 3.13, FastAPI, Pydantic v2, SQLAlchemy 2, Alembic | Render (Docker) |
| Data | PostgreSQL 17, Supabase Storage | Supabase |
| CI | GitHub Actions (`.github/workflows/ci.yml`) | — |

FastAPI is the **only** backend. Next.js renders pages and proxies `/api/*` to FastAPI.
See [docs/architecture.md](docs/architecture.md).

## Quick start (local)

Requirements: Docker, [uv](https://docs.astral.sh/uv/), Node 24.15+.

```bash
docker compose up -d db                      # PostgreSQL 17 on 127.0.0.1:54329 (+ portfolio_test DB)

cd backend && cp .env.example .env && uv sync
uv run uvicorn app.main:app --reload         # http://127.0.0.1:8000/health

cd ../frontend && cp .env.example .env.local && npm ci
npm run dev                                  # http://localhost:3000
```

The whole backend stack in containers: `docker compose up --build` (API on http://127.0.0.1:18000).
Ports are configurable via `POSTGRES_PORT` and `API_PORT`.

## Quality gates

```bash
# backend/
uv run ruff check . && uv run ruff format --check . && uv run mypy
TEST_DATABASE_URL=postgresql://portfolio:portfolio@127.0.0.1:54329/portfolio_test uv run pytest
uv run pip-audit --skip-editable

# frontend/
npm run lint && npm run format:check && npm run typecheck && npm test
npm run build && npm run test:e2e && npm audit --omit=dev
```

## Repository layout

```text
backend/            FastAPI app (app/), tests, Dockerfile. legacy/ = V2 reference being ported
frontend/           Next.js app (src/app, src/components, src/lib), Vitest + Playwright
docker/             Local PostgreSQL init scripts
docs/               Architecture, runbooks
design-reference/   Local-only visual reference (not in Git)
```

More: [backend/README.md](backend/README.md) · [frontend/README.md](frontend/README.md)

## Contact

claudeish88@gmail.com
