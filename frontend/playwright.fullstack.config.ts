import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

/**
 * The full-stack workflow test (Phase 12.3): a real browser drives the production build of the
 * site, the real FastAPI and a real PostgreSQL database together, with nothing stubbed.
 *
 *   docker compose up -d db          (from the repository root)
 *   npm run test:e2e:full-stack
 *
 * The API runs against a throwaway database, portfolio_e2e on the local Docker PostgreSQL, rebuilt
 * from nothing before every run (backend/tests/e2e_stack.py refuses anything else). The owner's
 * password and the shared secrets are random per run and never written to disk. The site is
 * rebuilt for this API first, so this run replaces the regular e2e build in .next.
 */

const sitePort = Number(process.env.E2E_FULLSTACK_SITE_PORT ?? 3200);
const apiPort = Number(process.env.E2E_FULLSTACK_API_PORT ?? 8200);
const site = `http://127.0.0.1:${sitePort}`;
const api = `http://127.0.0.1:${apiPort}`;

// The config is evaluated again in every worker: `??=` keeps one value per run, inherited from
// the runner's environment.
const random = () => randomBytes(24).toString("base64url");
process.env.E2E_OWNER_EMAIL ??= "owner@example.com";
process.env.E2E_OWNER_PASSWORD ??= `Aa1!${random()}`;
process.env.E2E_REVALIDATE_SECRET ??= random();
process.env.E2E_PROXY_SECRET ??= random();
// Emptied by backend/tests/e2e_stack.py at the start of every run.
process.env.E2E_MEDIA_DIR ??= path.join(tmpdir(), "portfolio-e2e-media");

const database =
  process.env.E2E_DATABASE_URL ?? "postgresql://portfolio:portfolio@127.0.0.1:54329/portfolio_e2e";

const apiEnv = {
  E2E_DATABASE_URL: database,
  DATABASE_URL: database,
  ENVIRONMENT: "development",
  COOKIE_SECURE: "false", // plain http on 127.0.0.1
  PUBLIC_SITE_URL: site,
  CORS_ORIGINS: site,
  TRUSTED_PROXY_COUNT: "1",
  TRUSTED_PROXY_SECRET: process.env.E2E_PROXY_SECRET,
  REVALIDATE_URL: `${site}/api/revalidate`,
  REVALIDATE_SIGNING_SECRET: process.env.E2E_REVALIDATE_SECRET,
  STORAGE_BACKEND: "local",
  LOCAL_MEDIA_DIR: process.env.E2E_MEDIA_DIR,
  MAIL_PROVIDER: "disabled",
  // Values the developer's backend/.env might set differently.
  CONTACT_RATE_LIMIT: "20",
  LOGIN_IP_ATTEMPTS: "20",
  LOGIN_ACCOUNT_FAILURES: "20",
  LOG_LEVEL: "WARNING",
};

const siteEnv = {
  API_ORIGIN: api,
  PUBLIC_CONTENT_SOURCE: "api",
  REVALIDATE_SIGNING_SECRET: process.env.E2E_REVALIDATE_SECRET,
  TRUSTED_PROXY_SECRET: process.env.E2E_PROXY_SECRET,
  NEXT_PUBLIC_SITE_URL: site,
};

export default defineConfig({
  testDir: "./e2e/full-stack",
  // One journey whose steps build on each other: a single worker, in order, never retried.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  timeout: 60_000,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    ...devices["Desktop Chrome"],
    viewport: { width: 1280, height: 800 },
    baseURL: site,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      // Rebuild the throwaway database, then serve the API on it.
      command: `uv run python -m tests.e2e_stack && uv run uvicorn app.main:app --host 127.0.0.1 --port ${apiPort}`,
      cwd: "../backend",
      url: `${api}/ready`,
      env: apiEnv,
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      // Rewrites to the API are fixed at build time, so the site is built for this API. Next's data
      // cache survives builds and would prerender content from an earlier run's database: clear it.
      command: `node -e "require('fs').rmSync('.next/cache/fetch-cache',{recursive:true,force:true})" && npx next build && npx next start --hostname 127.0.0.1 --port ${sitePort}`,
      url: site,
      env: siteEnv,
      reuseExistingServer: false,
      timeout: 400_000,
    },
  ],
});
