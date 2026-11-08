# Architecture

Status: **V3 rebuild, Phase 1 (foundation)** on branch `rebuild/v3`.

```text
Browser ──HTTPS──▶ Next.js (Vercel) ──rewrite /api/*──▶ FastAPI (Render) ──▶ Supabase PostgreSQL
                    │  Server Components fetch           │                 └─▶ Supabase Storage
                    │  API_ORIGIN directly               └─ signed revalidation call (Phase 10)
                    └─ /api/revalidate: cache-only, HMAC-signed, no business logic
```

## Boundaries

| Concern | Owner | Never in |
|---|---|---|
| Business rules, publishing decisions, auth, authorization, database, files | FastAPI | Next.js (route handlers, Server Actions, client) |
| Rendering, SEO metadata, caching of **published** content | Next.js | FastAPI |
| Secrets (`DATABASE_URL`, `SUPABASE_SERVICE_KEY`, mail keys) | Render env vars | Next.js, browser bundles, Git, logs |

Next.js has exactly one route handler, `/api/revalidate` (Phase 10). Its only job is to clear cache tags.
Requests must carry an HMAC-SHA256 signature over a timestamp and nonce. Stale timestamps and
replayed nonces are refused. Only an allowlist of tags or paths can be cleared. FastAPI calls it only
after the publishing transaction has committed.

## Key decisions

| # | Decision | Why |
|---|---|---|
| 1 | Same-origin proxy (`next.config.ts` rewrites `/api/*` to FastAPI) | Owner session cookie stays first-party, so it can be `SameSite=Strict`; no CORS credentials in the browser. |
| 2 | Opaque, server-stored owner sessions (hashed), not JWTs | Instant revocation, simple single-owner model. Ported from V2. |
| 3 | Argon2id with transparent upgrade from V2 scrypt on next successful login | Modern hashing without locking out or force-resetting the existing owner. |
| 4 | Rate limits stored in PostgreSQL | Works across Render restarts and instances without paying for Redis. |
| 5 | Public visibility enforced in repositories (`status='published' AND deleted_at IS NULL`) and tested per endpoint | Never relies on the frontend or on indexes alone. |
| 6 | Alembic history is forward-only. V2 revisions 0001 and 0002 are kept if Supabase has them | Preserves production data and history (see `runbooks/supabase-state-check.sql`). |
| 7 | Integration tests run on real PostgreSQL 17, never SQLite | Same engine as Supabase; migrations exercised for real. |
| 8 | Dark theme only, English only (initial release) | Phase 0 review decisions. |
| 9 | uv `exclude-newer` and exact npm pins; no release younger than two weeks | Supply-chain hygiene and reproducible builds. |
| 10 | TypeScript 6.0 (not 7.0) | TS 7 is the native-Go compiler. Next.js and typescript-eslint (`<6.1`) still need the JS compiler API. |

## Design tokens

Source: `design-reference/` (local only). Implemented in `frontend/src/app/globals.css` as Tailwind v4 `@theme`
tokens. Two deliberate deviations for WCAG AA are enforced by `src/app/tokens.test.ts`:
dark ink on the teal accent, and a lighter secondary-text colour.

## V2 → V3 porting map

The V2 backend lives in `backend/legacy/` as a read-only reference. Each item is ported into `backend/app/`
in the phase shown, then deleted from `legacy/`. The untouched original stays in Git (`feat/portfolio-v2`, `144156d`).

| V2 module | V3 destination | Phase |
|---|---|---|
| `core/config.py` | `app/core/config.py` (pydantic-settings, same env names) | 1 ✅ |
| `core/db.py`, `alembic/` (revisions 0001, 0002) | `app/database/`, `migrations/` | 2 |
| `main.py` error envelope and security headers | `app/core/errors.py`, middleware | 2 |
| `models/entities.py` | `app/models/` (+ new tables, forward migrations) | 2 |
| `core/security.py`, `services/auth.py`, `routers/v1/auth.py` | `app/core/security.py`, `app/services/auth.py` | 3 |
| `routers/v1/public.py`, `models/v1.py` | `app/api/v1/endpoints/public_*`, `app/schemas/` | 4 |
| `services/storage.py`, `routers/v1/admin_media.py` | `app/integrations/storage.py`, media service | 5 |
| `routers/v1/admin_content.py` | owner endpoints and services | 8 |
| `routers/v1/admin_inbox.py`, `services/email.py` | inbox service, `app/integrations/email.py` | 9 |
| `services/activity.py` | audit service | 3+ |
| `services/seed.py` | verified-content data migration (drafts where unverified) | 2/4 |
| Legacy `/api/*` routes (`visits`, `gallery`, `contact`, `projects`) | dropped after production check | 12 |

The V2 frontend (React/Vite, EN/FR/RW) is in Git history only. It is not ported; the V3 frontend is built
from the design reference.
