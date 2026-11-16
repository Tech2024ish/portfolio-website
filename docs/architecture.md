# Architecture

Status: **V3 rebuild.** Phases 1, 2 and 2.5 are merged into `main`; Phase 3 (design system) is in progress.
Phase numbers below refer to the owner's master development roadmap.

```text
Browser ──HTTPS──▶ Next.js (Vercel) ──rewrite /api/*──▶ FastAPI (Render) ──▶ Supabase PostgreSQL
                    │  Server Components fetch           │                 └─▶ Supabase Storage
                    │  API_ORIGIN directly               └─ signed revalidation call (Phase 6)
                    └─ /api/revalidate: cache-only, HMAC-signed, no business logic
```

## Boundaries

| Concern | Owner | Never in |
|---|---|---|
| Business rules, publishing decisions, auth, authorization, database, files | FastAPI | Next.js (route handlers, Server Actions, client) |
| Rendering, SEO metadata, caching of **published** content | Next.js | FastAPI |
| Secrets (`DATABASE_URL`, `SUPABASE_SERVICE_KEY`, mail keys) | Render env vars | Next.js, browser bundles, Git, logs |

Next.js has exactly one route handler, `/api/revalidate` (Phase 6). Its only
job is to clear cache tags; it never duplicates business logic, authentication, authorization or data access.
Requests must carry an HMAC-SHA256 signature over a timestamp and nonce. Stale timestamps and
replayed nonces are refused. Only an allowlist of tags or paths can be cleared. FastAPI calls it only
after the publishing transaction has committed.

**Public content source.** Public pages read content through one loader, `frontend/src/lib/content/portfolio.ts`,
from one of two sources chosen by `PUBLIC_CONTENT_SOURCE` (server-only):

- `bundled` (default): the verified module `frontend/src/content/profile.ts` (Phase 4), rendered statically.
- `api`: the FastAPI public API (`/api/v1/public/*`), which the Owner Studio edits (Phase 6).

Both return published records only, and both produce the same pages (a test renders the exported seed through the
API mapping and compares it with the bundled content). `bundled` stays the default until production deployment is
configured (Phase 11): switching the live site to `api` before `API_ORIGIN` is set on Vercel would take it offline.

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
| 8 | Dark theme only, English only (initial release) | Initial V3 review decisions. |
| 9 | uv `exclude-newer` and exact npm pins; no release younger than two weeks | Supply-chain hygiene and reproducible builds. |
| 10 | TypeScript 6.0 (not 7.0) | TS 7 is the native-Go compiler. Next.js and typescript-eslint (`<6.1`) still need the JS compiler API. |

## Owner authentication (Phase 5)

- **One owner, one role.** The account is created with `python -m app.cli.owner`; there is no
  sign-up. Every owner endpoint lives under `/api/v1/owner` and the router itself requires the
  owner session, so no route can be added unprotected (a test enumerates them from OpenAPI).
- **Passwords.** Argon2id (`argon2-cffi`, RFC 9106 low-memory profile). V2 `scrypt$...` hashes
  are verified and re-hashed with Argon2id after a successful sign-in, so owner access survives
  the migration. An unknown email spends the time of a real verification.
- **Sessions.** 256-bit random tokens in an HttpOnly, SameSite=Strict cookie, `__Host-` prefixed
  and Secure in production; PostgreSQL stores only the SHA-256 digest. Absolute lifetime 12 h,
  idle timeout 2 h, revocation per session or all others; a password change ends every other
  session.
- **CSRF.** State-changing owner requests must carry `X-CSRF-Token` (an HMAC of the session
  token, returned by `GET /auth/session`) and, when sent, an allowed `Origin`. Sign-in needs an
  allowed `Origin` and a JSON body.
- **Brute force.** Per client address (every attempt) and per account (failures only) in the
  PostgreSQL rate-limit ledger; the account key is the submitted email, so limits reveal nothing
  about which accounts exist. Responses are generic and logs never contain credentials, tokens or
  the email.
- **Frontend.** Next.js never decides who is signed in: `src/lib/owner/session.ts` (server-only)
  forwards the session cookie to FastAPI and redirects to `/owner/login` on 401. An unreachable
  API shows an error, never the Studio. Owner pages are dynamic, `no-store` and `noindex`.
- **Production note (Phase 11).** The per-address limit relies on `TRUSTED_PROXY_COUNT` matching
  the real proxy chain (Vercel rewrite, Render router). With the default 0 every sign-in arrives
  from the proxy's address and shares one limit, so it must be set during deployment.

## Content management (Phase 6)

- **Data.** Profile (one row), skill groups and skills, experience, education, certifications, projects (with their
  case study) and Engineering Notes live in PostgreSQL (migration `v3_0003`). Every row has a `position`, a
  `version` and soft delete (`deleted_at`); everything but the profile, skill groups and skills has a
  `draft`/`published` status. A project's case study has its own status. Slugs and names are unique among live rows
  (partial unique indexes), so a deleted item's slug can be reused. RLS is enabled and the Supabase `anon` and
  `authenticated` roles have no privileges on these tables.
- **Owner API.** `/api/v1/owner/{collection}` gives every collection the same routes (list, create, get, update,
  delete, publish, unpublish, reorder), built from one `CollectionSpec` registry in `app/services/content.py`, plus
  `/owner/profile`, `/owner/dashboard` and `/owner/activity`. They are included in the owner router, so its guard
  (session, and CSRF for changes) applies to all of them; the OpenAPI enumeration test covers them.
- **Concurrency.** Updates carry the `version` the editor loaded; a different current version answers 409 and
  nothing is written, so a change made in another tab is never silently overwritten. The Studio offers to load the
  latest version.
- **Validation.** Pydantic schemas mirror the database limits: slugs, `https://` URLs only, site-relative or
  `https://` asset paths (no `..`), months as `YYYY-MM`, date order, no control characters, blank list lines
  dropped. Unknown fields are rejected.
- **Audit.** Every change records who, what (entity and id), the action and the names of the changed fields, never
  their contents. `/owner/activity` lists them.
- **Public API.** `/api/v1/public/portfolio`, `/projects/{slug}`, `/articles`, `/articles/{slug}`: published and
  undeleted only, enforced in `app/repositories/content.py`. Drafts and unknown slugs get the same 404. A case study
  is included only when it is published too. Responses are `Cache-Control: public, max-age=60`.
- **Cache invalidation.** After each committed change FastAPI sends, as a background task,
  `POST {REVALIDATE_URL}` with body `{"tags":["content"],"timestamp":…,"nonce":…}` and
  `X-Revalidate-Signature: sha256=<HMAC-SHA256(body)>` (`app/integrations/revalidate.py`). The Next.js handler
  refuses bad signatures, timestamps older than five minutes, replayed nonces and any tag but `content`, then calls
  `revalidateTag("content", { expire: 0 })`. Failures are logged and never fail a save. Cached content also expires
  after five minutes, so a missed invalidation cannot leave the site stale for long.
- **Initial content.** `node frontend/scripts/export-content.mjs` exports `profile.ts` to
  `backend/app/cli/verified-content.json` (`--check` fails when it is out of date);
  `python -m app.cli.content import` loads it into an empty database in one transaction, keeping each record's
  draft or published state. It refuses to run when any content exists, so it can never overwrite Studio edits.
- **Studio.** `/owner` (dashboard), `/owner/profile`, `/owner/content/{collection}` (list, order, publish),
  `.../new`, `.../{id}` (edit, publish, delete with confirmation), `.../{id}/preview` (projects and notes, drafts
  included, owner only) and `/owner/activity`; sessions and the password moved to `/owner/security`. Forms are
  generated from one field description per collection (`src/lib/owner/content-schema.ts`); FastAPI remains the
  authority and its field errors are shown next to the fields.
- **Note bodies** are plain text with a small markup (`## ` headings, `- ` lists, code fences, blank lines between
  paragraphs), parsed into blocks and rendered as text, never as HTML.

## Media library (Phase 7)

- **Storage.** `STORAGE_BACKEND=supabase` in production: Supabase Storage through its HTTP API with the service
  key, which never leaves the backend. The bucket (`MEDIA_BUCKET`) must be **public for reads**; writes and deletes
  need the service key, so only the API can change it. `local` (development only, refused in production) keeps
  files under `LOCAL_MEDIA_DIR` and serves them at `/api/v1/media/files/{key}`; `disabled` makes the media
  endpoints answer 503.
- **Validation** (`app/services/images.py`). The body is capped before parsing (`MAX_IMAGE_MB` plus 64 KB, in
  `BodySizeLimitMiddleware`) and again while reading. The file's first bytes must be a JPEG, PNG or WebP
  signature matching the declared type; Pillow must decode it completely as that format; animated images and
  images over 40 megapixels are refused (decompression bombs are caught before decoding pixels). SVG is never
  accepted.
- **Processing.** The stored original is re-encoded from the decoded pixels, oriented by EXIF and without any
  metadata (location, camera). WebP versions 480, 960 and 1600 px wide are stored for responsive delivery; images
  are never enlarged.
- **Naming and caching.** Keys are generated, never taken from the client: `{folder}/{uid}/r{revision}/original.{ext}`
  and `.../w{width}.webp`. The uploaded name is kept, sanitised, for display only. A file never changes under its
  key, so it is cached as `immutable` for a year; replacing an image writes a new revision.
- **Integrity.** Files are written before the row is committed and removed if the request fails; replaced and
  deleted files are removed only after the commit. Replacing an image points the content that used it (profile
  portrait, project images) at the new revision in the same transaction and refreshes the public site. An image
  still in use cannot be deleted (409 naming where it is used). Uploads, edits, replacements and deletions are
  audited.
- **API.** `/api/v1/owner/media` (list with folder filter, upload), `/{id}` (details with usages, edit alt text and
  folder with a version check, delete) and `/{id}/replace`, all behind the owner router's guard and CSRF check.
- **Delivery.** The public API adds the stored sizes of library images (`portrait`, and `variants` on case-study
  images); the site renders them with `srcset` and explicit width and height (`MediaImage`). Images bundled in
  `/public` keep using `next/image`. Existing bundled images are preserved and keep working; the library holds
  new uploads.
- **Studio.** `/owner/media` (upload, folders, thumbnails) and `/owner/media/{id}` (preview, alt text, folder,
  replace, delete). "Choose from library" sets the profile portrait (and its alt text when empty) or adds a
  project image line.

## Design tokens

Source: `design-reference/` (local only). Implemented in `frontend/src/app/globals.css` as Tailwind v4 `@theme`
tokens and registered in `frontend/src/design/tokens.ts`. Colours, type and radii are measured from the board;
shadows, motion, focus-ring geometry, breakpoints, layering and the spacing scale (a 4px grid, enforced by
`frontend/src/design/spacing-usage.test.ts`) cannot be measured on a static board and follow documented
conventions. Three deliberate deviations for WCAG AA are enforced by `src/app/tokens.test.ts`:
dark ink on the teal accent, a lighter secondary-text colour, and `-fg` variants for status text (the base
danger and success colours are too dim for text). Automated WCAG 2.2 A/AA checks run with axe-core
(`frontend/e2e/accessibility.spec.ts`).

## V2 → V3 porting map

The V2 backend lives in `backend/legacy/` as a read-only reference. Each item is ported into `backend/app/`
in the phase shown, then deleted from `legacy/`. The untouched original stays in Git (`feat/portfolio-v2`, `144156d`).

| V2 module | V3 destination | Phase |
|---|---|---|
| `core/config.py` | `app/core/config.py` (pydantic-settings, same env names) | 1 ✅ |
| `core/db.py`, `alembic/` | `app/database/`, `migrations/` (new V3 history from `v3_0001`) | 2–2.5 ✅ |
| `main.py` error envelope and security headers | `app/core/errors.py`, middleware | 2 ✅ |
| `models/entities.py` (contact messages) | `app/models/contact.py` | 2 ✅ |
| `models/entities.py` (content) | `app/models/` (+ forward migrations) | 6 |
| `routers/v1/public.py`, `models/v1.py` | `app/api/v1/endpoints/public_*`, `app/schemas/` | 6 |
| `core/security.py`, `services/auth.py`, `routers/v1/auth.py` | `app/core/security.py`, `app/services/auth.py` | 5 |
| `routers/v1/admin_content.py` | owner endpoints and services | 6 |
| `services/storage.py`, `routers/v1/admin_media.py` | `app/integrations/storage.py`, media service | 7 |
| `routers/v1/admin_inbox.py`, `services/email.py` | inbox service, `app/integrations/email.py` | 8 |
| `services/activity.py` | audit service | 6, 10 |
| `services/seed.py` | verified-content data migration (drafts where unverified) | 6, 11 |
| Legacy Supabase data and `/api/*` routes (`visits`, `gallery`, `contact`, `projects`) | reviewed and migrated, then retired | 11 |

The V2 frontend (React/Vite, EN/FR/RW) is in Git history only. It is not ported; the V3 frontend is built
from the design reference.
