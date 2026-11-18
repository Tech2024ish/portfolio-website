# Production deployment (Phase 11)

The procedure that takes V3 to production on **Vercel** (frontend), **Render** (FastAPI) and
**Supabase** (PostgreSQL and Storage), preserving the existing data. Follow the steps in order;
each ends with a check. Nothing here deletes data. Migrations are applied by hand, never by the
application at startup.

Commands that need the production database read its address from `DATABASE_URL` (or
`PRODUCTION_DATABASE_URL` for the backup script) **set only in that terminal**. Never put the
production address in a `.env` file or a commit, and never paste it into a chat or an issue.

```bash
# In backend/, for one terminal session only (Git Bash):
export DATABASE_URL='postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres'
```

Use the **Session pooler** connection string (Supabase → Project Settings → Database →
Connection string → Session pooler, port **5432**). The transaction pooler (port 6543) does not
support what Alembic needs, and the direct connection is IPv6-only on many networks.

## What is in production today (inventory of 9 November 2026)

| Item | Contents | V3 plan |
|---|---|---|
| `public.contacts` | 13 messages from the earlier site | Moved to `legacy.contacts` by migration `v3_0000`; imported into the inbox with their original dates (step 6) |
| `public.projects` | 3 projects from the earlier site (Task Management API, Book Notes App, School Management System) | Moved to `legacy.projects` and kept; **not imported** (V3 has the verified projects) |
| `public.visits` | 362 visits (time only) | Moved to `legacy.visits` and kept as is; `legacy-report` summarises them by month. V3 analytics start fresh, because these rows have no page or visitor |
| `public.customer` | empty (Supabase starter table) | Moved to `legacy.customer`, kept |
| Storage bucket `gallery` | 3 files, 6 MB, public | Kept untouched; V3 uses a new bucket `media` |
| Grants | `anon` and `authenticated` hold **every** privilege on all four tables, including TRUNCATE, which row-level security does not stop | Revoked by `v3_0000` when the tables move |
| Migrations | no `alembic_version` table | V3 history starts at `v3_0000` |

`v3_0000` exists because V3 also has a `projects` table: without moving the old one first, the
first deploy would fail half-way.

## 1. Review the live database (read-only)

```bash
cd backend
uv run python -m app.cli.production check          # read-only preflight
```

Expect: no revision yet, the four legacy tables still in `public` (WARN), and FAIL lines for the
client-role privileges on them. Save the output: it is the "before" record.

## 2. Back up the database and the storage files

```bash
cd ..   # repository root
export PRODUCTION_DATABASE_URL="$DATABASE_URL"
bash scripts/production/backup.sh                         # writes backups/portfolio-<UTC>.dump
bash scripts/production/verify-backup.sh backups/portfolio-<UTC>.dump
```

`verify-backup.sh` checks the checksum, restores the dump into a throwaway local database and
prints every table's row count: `public.contacts 13`, `public.projects 3`, `public.visits 362`,
`public.customer 0`. Then download the three files of the `gallery` bucket (Supabase → Storage →
gallery → select all → Download) next to the dump. Keep both outside the repository (`backups/`
is git-ignored) until production has run correctly for a while.

**Check:** the restored counts match step 1, and the three files open.

## 3. Prepare Supabase Storage for V3 media

Supabase → Storage → New bucket: name `media`, **Public bucket** on (images are read by visitors).
Leave the policies empty: only the API writes, with the service key.

## 4. Configure Render (the API)

Render → the web service → Settings: Docker, root `backend/`, **Health Check Path `/health`**,
no pre-deploy command (migrations are manual, step 5). Environment:

| Variable | Value |
|---|---|
| `ENVIRONMENT` | `production` |
| `DATABASE_URL` | the Session pooler URI (owner role `postgres.<project-ref>`, see backend/README.md "Database role") |
| `COOKIE_SECURE` | `true` |
| `PUBLIC_SITE_URL` | `https://goslish.vercel.app` (or the custom domain) |
| `CORS_ORIGINS` | `https://goslish.vercel.app` |
| `TRUSTED_PROXY_COUNT` | leave `0` for now; set in step 8 |
| `STORAGE_BACKEND` | `supabase` |
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `SUPABASE_SERVICE_KEY` | the **service_role** key (secret; Render only, never Vercel) |
| `MEDIA_BUCKET` | `media` |
| `MAIL_PROVIDER` | `resend` (or leave `disabled` until a verified sending domain exists) |
| `RESEND_API_KEY`, `MAIL_FROM`, `CONTACT_NOTIFY_EMAIL`, `MAIL_REPLY_TO` | from Resend; `MAIL_FROM` on a verified domain |
| `REVALIDATE_URL` | `https://goslish.vercel.app/api/revalidate` |
| `REVALIDATE_SIGNING_SECRET` | 64 random hex characters, the **same** value as on Vercel |
| `LOG_LEVEL` | `INFO` |

Generate the signing secret locally: `python -c "import secrets; print(secrets.token_hex(32))"`.
The API refuses to start in production with unsafe settings (HTTP origins, local storage, SMTP
mail, a short signing secret) and names the variable at fault in the log, never its value.

**Check:** `https://<service>.onrender.com/health` answers 200. `/ready` answers 503
("migrations: pending") until step 5: that is expected.

## 5. Apply the migrations

```bash
cd backend
uv run python -m app.cli.production check        # still the "before" state
uv run alembic upgrade head                      # v3_0000 ... v3_0007, one transaction each
uv run python -m app.cli.production check        # must end with "0 problem(s)"
uv run python -m app.cli.production legacy-report
```

`v3_0000` moves the four old tables into the `legacy` schema with every row, revokes the client
roles' privileges on them, and creates nothing else; the next revisions create the V3 tables with
row-level security on and no client-role access.

**Check:** `check` passes (expected revision, RLS on every table, no client-role privilege
anywhere, sequences ahead of their data); `legacy-report` shows 13 contacts, 3 projects and 362
visits; `https://<service>.onrender.com/ready` answers 200.

## 6. Load the content, the old messages and the owner account

```bash
uv run python -m app.cli.content import                      # the verified portfolio content
uv run python -m app.cli.production import-legacy-contacts   # dry run: review what would import
uv run python -m app.cli.production import-legacy-contacts --apply
uv run python -m app.cli.owner create claudeish88@gmail.com --name "Jean Claude"
```

The contact import keeps each message's original date, marks them unread, sends no email, leaves
`legacy.contacts` unchanged, and is safe to repeat (already imported rows are skipped). Rows that
fail V3's validation are listed and left out.

**Check:** the Studio inbox (after step 7) shows the imported messages with their dates. In the
first production run 12 of the 13 were imported; legacy id 8 failed validation and stays in
`legacy.contacts`.

## 7. Configure Vercel (the site)

Vercel → the project → Settings → Environment Variables (Production), then redeploy:

| Variable | Value |
|---|---|
| `API_ORIGIN` | `https://<service>.onrender.com` (no trailing slash) |
| `PUBLIC_CONTENT_SOURCE` | `api` |
| `REVALIDATE_SIGNING_SECRET` | the same value as on Render |
| `NEXT_PUBLIC_SITE_URL` | only for a custom domain; otherwise Vercel's production domain is used |

The build reads the content from the API, so the API must be up (step 5) before redeploying.

**Check:** the home page shows the content; `https://goslish.vercel.app/owner/login` signs you in;
the Studio opens.

## 8. Set TRUSTED_PROXY_COUNT from evidence

Signed in, open `https://goslish.vercel.app/api/v1/owner/diagnostics/client-address`. It shows the
`X-Forwarded-For` chain the API received and, under `candidates`, the address each setting would
use. Look up your own public IP address (for example by searching "what is my IP"); the candidate
number that shows **your** address is the right value. Set it on Render, redeploy, and open the
page again: `resolved` must now be your address.

Too low and every visitor shares one address (one sign-in rate limit for everyone, merged
analytics visitors); too high and visitors could choose their own address.

## 9. Retries for email

Notifications and replies are sent right after they are queued. To retry failures after an
outage, run `python -m app.cli.mail process` every 5 minutes: a Render Cron Job with the same
image, root and environment, command `python -m app.cli.mail process`. Without it, a failed email
waits until the next message or a "Send again" in the Studio.

## 10. Verify production (acceptance)

- [ ] `/health` 200 and `/ready` 200 on Render.
- [ ] `python -m app.cli.production check`: 0 problems.
- [ ] Home, Projects, a project page, sitemap and robots answer 200 on the production domain, with
      canonical URLs on that domain.
- [ ] The contact form on production: message appears in the Studio inbox; with email configured,
      the notification arrives and its history says "Sent".
- [ ] A Studio edit (for example the headline) appears on the public site within seconds.
- [ ] Upload an image in Media; it shows on its page and via "Choose from library".
- [ ] Analytics count a view from another browser (not signed in, no Do Not Track).
- [ ] `legacy-report` still shows 13 / 3 / 362 / 0: no legacy data was lost.

## Rollback

- **Site:** Vercel → Deployments → promote the previous deployment (instant). To serve the
  bundled content while keeping the new build, set `PUBLIC_CONTENT_SOURCE=bundled` and redeploy.
- **API:** Render → Deploys → roll back to the previous deploy.
- **Database:** migrations are not rolled back in production (downgrades drop V3 tables). The
  legacy tables can be returned to `public` without losing anything:
  `alter table legacy.<name> set schema public;` (their old client-role grants are not restored).
  As a last resort, restore the step 2 backup into a new Supabase project or a fresh database
  with `pg_restore --no-owner` and point `DATABASE_URL` at it.

## Logging and health

Render keeps the API's logs (uvicorn access lines and application warnings, at `LOG_LEVEL`).
Every response carries an `X-Request-ID` to find its log lines. Logs never contain passwords,
tokens, email addresses of the owner, message contents or connection strings. `/health` is the
liveness check (no database access); `/ready` checks the database and the expected migration.
