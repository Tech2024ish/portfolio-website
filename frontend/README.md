# Portfolio web (frontend)

Next.js App Router application: the public portfolio and the private owner portal (`/owner`).
It contains **no business logic**. All data comes from the FastAPI backend through the typed client
in `src/lib/api/client.ts`.

## Rules

- Server Components by default. Add `"use client"` only for real interactivity.
- Public pages use static or ISR rendering. Owner pages and previews are `no-store` (enforced by headers
  in `next.config.ts` and tested in `e2e/smoke.spec.ts`).
- Styling uses tokens from `src/app/globals.css` only. No raw hex values in components.
- Every token is registered, with its purpose, in `src/design/tokens.ts`; `src/app/tokens.test.ts` fails if
  the registry and `globals.css` differ. Groups: surfaces, borders, text, accent, focus, status, fonts, type
  scale, radii, spacing, layout (breakpoints, page container), elevation (shadows), motion (easing, durations) and
  layers (z-index). Status text uses the `-fg` colours; the base status colours are for icons and dots.
- Spacing is one base unit, `--spacing` (0.25rem), and padding, margin, gap and space utilities use only the
  steps in `spacingScale` (`src/design/tokens.ts`): a 4px grid with half steps for small controls.
  `src/design/spacing-usage.test.ts` fails on any other step or an arbitrary value such as `p-[13px]`. Positioning
  (`top`, `inset`) and sizing (`w`, `h`, `size`) utilities are not covered.
- `/styleguide` previews every token and every reusable component **in development only** (`npm run dev`);
  production builds answer 404 (tested in `e2e/design-tokens.spec.ts`) and the page is never linked or indexed.
- Only `NEXT_PUBLIC_*` values reach the browser, and none of them are secrets.

## Components

Reusable primitives live in `src/components/ui/`. Build pages from these instead of restyling raw elements.

| Module              | Exports                                                       | Notes                                                                                                                                |
| ------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `button.tsx`        | `Button`, `buttonClasses`                                     | Variants primary, secondary, outline, ghost, danger; `loading` shows a spinner, is `aria-busy` and `aria-disabled`, and keeps focus. |
| `form.tsx`          | `Field`, `Label`, `Input`, `Textarea`, `Select`, `FieldError` | `Field` wires the label, hint, error and aside to the control (`aria-describedby`, `aria-invalid`, `required`).                      |
| `feedback.tsx`      | `Alert`, `Spinner`, `EmptyState`, `ErrorState`                | `Alert` is `role="alert"` for danger and `role="status"` otherwise; pass `role="note"` for static content.                           |
| `toast.tsx`         | `ToastProvider`, `useToast`                                   | Client. Pre-rendered polite and assertive live regions; text only; pauses on hover or focus; `duration: 0` is sticky.                |
| `dialog.tsx`        | `Dialog`, `ConfirmDialog`                                     | Client. Native modal `<dialog>`; restores focus; a destructive confirmation focuses Cancel first.                                    |
| `dropdown-menu.tsx` | `DropdownMenu`                                                | Client. WAI-ARIA menu button: arrows, Home/End, Escape, disabled items skipped.                                                      |
| `tag.tsx`           | `Badge`, `Tag`, `StatusBadge`                                 | Meaning is always in the text; dots are decorative.                                                                                  |
| `card.tsx`          | `Card`                                                        | `interactive` adds hover feedback.                                                                                                   |
| `link.tsx`          | `TextLink`, `textLinkClasses`                                 | In-site links, underlined so they are not identified by colour alone.                                                                |
| `external-link.tsx` | `ExternalLink`                                                | Opens in a new tab with `rel="noopener noreferrer"`.                                                                                 |
| `section.tsx`       | `Section`, `containerClasses`                                 | Page sections inside the `max-w-page` container.                                                                                     |
| `icons.tsx`         | Inline SVG icons                                              | Always decorative (`aria-hidden`); the accessible name comes from visible text or the control's `aria-label`.                        |

Most components have unit tests, and the form, feedback, toast, dialog and menu tests include an axe scan
(`src/test/axe.ts`; colour contrast is checked in the browser instead). `external-link.tsx` and `section.tsx` are
covered only through the pages that use them. `e2e/components/` exercises the interactive ones in a real browser on `/styleguide`.

## Setup

```bash
cp .env.example .env.local
npm ci
npm run dev            # http://localhost:3000, proxies /api/* to API_ORIGIN
```

## Scripts

| Script                        | What it does                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                | ESLint (Next core-web-vitals + TypeScript), zero warnings allowed                                             |
| `npm run typecheck`           | `tsc --noEmit` (strict, `noUncheckedIndexedAccess`)                                                           |
| `npm test`                    | Vitest + Testing Library (components, API client, token registry and contrast)                                |
| `npm run build`               | Production build                                                                                              |
| `npm run test:e2e`            | Both suites below, one after the other. Run `npm run build` first and `npx playwright install chromium` once. |
| `npm run test:e2e:site`       | Playwright against the production build at 1440/1280/768/390 px.                                              |
| `npm run test:e2e:components` | `e2e/components/` against a dev server on port 3101 (`/styleguide` exists only in development).               |
| `npm run format:check`        | Prettier (with Tailwind class sorting)                                                                        |

The two suites run as separate Playwright invocations, so a site-only run needs no dev server. Next.js allows one
dev server per directory, so if `npm run dev` is already running, reuse it with
`E2E_COMPONENTS_URL=http://localhost:3000 npm run test:e2e` (use the host it was started for; the dev server only
serves its scripts to that origin).

Known issue, cause not identified: on the development machine, responses from the dev server intermittently take
tens of seconds while the server process is idle, and the component tests then time out. It has been seen after the
site suite and in standalone component runs. Re-run `npm run test:e2e:components` when it happens.

Node 24.15+ is recommended: the jsdom test environment declares `^24.15`.
