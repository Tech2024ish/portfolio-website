# Portfolio web (frontend)

Next.js App Router application: the public portfolio and the private owner portal (`/owner`).
It contains **no business logic**. All data comes from the FastAPI backend through the typed client
in `src/lib/api/client.ts`.

## Rules

- Server Components by default. Add `"use client"` only for real interactivity.
- Public pages use static or ISR rendering. Owner pages and previews are `no-store` (enforced by headers
  in `next.config.ts` and tested in `e2e/smoke.spec.ts`).
- Styling uses tokens from `src/app/globals.css` only. No raw hex values in components.
- Only `NEXT_PUBLIC_*` values reach the browser, and none of them are secrets.

## Setup

```bash
cp .env.example .env.local
npm ci
npm run dev            # http://localhost:3000, proxies /api/* to API_ORIGIN
```

## Scripts

| Script                 | What it does                                                                                                                           |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`         | ESLint (Next core-web-vitals + TypeScript), zero warnings allowed                                                                      |
| `npm run typecheck`    | `tsc --noEmit` (strict, `noUncheckedIndexedAccess`)                                                                                    |
| `npm test`             | Vitest + Testing Library (components, API client, token contrast)                                                                      |
| `npm run build`        | Production build                                                                                                                       |
| `npm run test:e2e`     | Playwright against the production build at 1440/1280/768/390 px. Run `npm run build` first and `npx playwright install chromium` once. |
| `npm run format:check` | Prettier (with Tailwind class sorting)                                                                                                 |

Node 24.15+ is recommended: the jsdom test environment declares `^24.15`.
