# Jean Claude Ishimwe — Portfolio (V2)

Professional portfolio for Jean Claude Ishimwe, Backend Software Engineer in Kigali, with a private
owner studio at `/admin` for managing every piece of public content without editing code.

Live: https://goslish.vercel.app · Design reference: Figma file `t6LaaAziZ3nBRtomnoKPzv`
(tokens: collections "Theme / Light" and "Theme / Dark", mirrored in `frontend/src/styles/tokens.css`).

## Stack

- **Frontend** — React 18, Vite, React Router 7, plain CSS with design tokens. Deployed on Vercel.
- **Backend** — FastAPI, SQLAlchemy 2, Alembic, PostgreSQL (Supabase). Deployed on Render.
- **Files** — Supabase Storage (public bucket), written only by the backend.
- **Email** — Resend, for replies from the studio inbox (optional).

## What's where

```text
frontend/src/
├── pages/            Public routes: /, /projects, /projects/:slug, /writing, /writing/:slug
├── components/       Public sections (hero, experience, projects, education, contact…)
├── content/          Site content provider + bundled fallback copy (renders before the API answers)
├── admin/            Owner studio (lazy-loaded chunk): pages/, ui.jsx kit, api.js, admin.css
├── styles/           tokens.css (light/dark), v2.css
└── translations.js   Interface strings (EN/FR/RW); uiStrings.js holds V2 additions

backend/
├── main.py           App, security headers, consistent error responses, legacy /api routes
├── core/             config (env), db (sessions), security (scrypt, tokens)
├── models/           entities.py (tables), v1.py (request validation)
├── routers/v1/       public, auth, admin_content, admin_media, admin_inbox, admin_system
├── services/         auth (sessions/CSRF/throttle), storage, email, activity log, seed
├── alembic/          migrations (0001 schema, 0002 RLS + legacy contacts import + seed)
└── tests/            pytest suite (auth on every route, CRUD, uploads, inbox)
```

API: `/api/v1/public/*` and `/api/v1/contact` are public; everything under `/api/v1/admin/*` and
`/api/v1/auth/*` (except login) requires an owner session. The original `/api/*` routes still work.

## Run locally

```bash
# backend
cd backend
python -m venv .venv && .venv/Scripts/activate      # or source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env                                # set DATABASE_URL (SQLite works locally)
alembic upgrade head                                # creates tables and seeds current content
python -m scripts.create_owner you@example.com      # prompts for a password
uvicorn main:app --reload

# frontend (proxies /api to http://localhost:8000; override with API_PROXY_TARGET)
cd frontend
npm install
npm run dev                                         # http://localhost:5173 and /admin
```

For a throwaway local database: `DATABASE_URL=sqlite:///./local.db`, `STORAGE_BACKEND=local`,
`COOKIE_SECURE=false`.

## Quality checks

```bash
cd backend && python -m pytest
cd frontend && npm run format:check && npm run lint && npm run build && npm audit --omit=dev
```

## Deploying V2 (one-time setup)

1. **Database** — in Supabase › Project settings › Database, copy the *session pooler* connection
   URI. On Render set `DATABASE_URL` to it and `ENVIRONMENT=production`.
2. **Migrate** — from `backend/` with that `DATABASE_URL`: `alembic upgrade head`. This creates the
   new tables (RLS enabled, so the public Supabase keys cannot read them), imports messages already
   sent through the old contact form, and seeds the current site content.
3. **Owner account** — `python -m scripts.create_owner <your email>` (same `DATABASE_URL`).
4. **Storage** — create a **public** bucket named `media` in Supabase Storage. On Render set
   `STORAGE_BACKEND=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`.
5. **Email (optional)** — verify a sending domain at Resend; set `RESEND_API_KEY`, `MAIL_FROM`,
   `MAIL_REPLY_TO`. Without these, replies are saved and clearly marked *not sent*.
6. **CORS** — `CORS_ORIGINS=https://goslish.vercel.app`.
7. **Frontend** — `frontend/vercel.json` proxies `/api/*` to the Render API so the session cookie is
   first-party and serves `index.html` for client routes. Ensure the Vercel project root is
   `frontend/`. `VITE_API_URL` is no longer needed while the proxy is in place.

Until step 1 is done the public site keeps working: it renders the bundled content and the contact
form falls back to the original endpoint.

## Security notes

- Owner sessions: random token in an `HttpOnly; Secure; SameSite=Strict` cookie scoped to `/api`,
  stored hashed; 12 h absolute / 2 h idle expiry; revocable from Settings.
- Every state-changing request needs the `X-Requested-With: portfolio-admin` header and an allowed
  `Origin`; passwords use scrypt; repeated failed sign-ins are throttled (per process — add
  edge rate limiting on Render/Vercel for stronger protection).
- Uploads are identified by content (PNG/JPEG/WebP/GIF via Pillow, PDF by signature), size-limited,
  stored under random names; SVG/HTML are rejected.
- Markdown is rendered without raw HTML. All studio actions are written to the activity log.

## Contact

claudeish88@gmail.com
