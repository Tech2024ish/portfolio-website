# SEO, performance and accessibility (Phase 9)

How the public site is made discoverable, fast and accessible, and the evidence for each. Measured
on 16 November 2026 against a local production build (`npm run build && npm run start`) with the
bundled content.

## SEO

| Requirement | Implementation | Verified by |
|---|---|---|
| Page titles and descriptions | Every public page sets its own title (template `%s · Jean Claude Ishimwe`) and description; project and note pages use their own title and summary | `e2e/seo.spec.ts`, `e2e/portfolio.spec.ts` |
| Canonical URLs on the real domain | `NEXT_PUBLIC_SITE_URL`, else Vercel's production domain (`VERCEL_PROJECT_PRODUCTION_URL`), resolved at build time in `src/lib/site-url.ts`. Fixes the production finding where canonical and Open Graph URLs pointed at localhost | `src/lib/seo.test.ts`, `e2e/seo.spec.ts` |
| Open Graph and X cards | `og:*` and `twitter:card=summary_large_image` on every page | `e2e/seo.spec.ts` |
| Social sharing images | Generated 1200×630 PNG cards (`opengraph-image.tsx`) for the site, the projects listing, each project, the notes listing and each note; prerendered at build time | `e2e/seo.spec.ts` (every page's image answers 200 `image/png`) |
| Sitemap | `/sitemap.xml` lists exactly the published pages (no drafts, no Studio, no empty Notes listing) | `src/lib/seo.test.ts`, `e2e/seo.spec.ts` |
| robots.txt | `/robots.txt` allows the site, disallows `/owner`, `/api/`, `/styleguide`, links the sitemap; disallows everything on Vercel preview deployments | `src/lib/seo.test.ts`, `e2e/seo.spec.ts` |
| Structured data | Home: `Person` + `WebSite`; projects listing: `CollectionPage` with an `ItemList`; project: `SoftwareSourceCode` (or `CreativeWork`) + `BreadcrumbList`; note: `BlogPosting` + `BreadcrumbList`. Only published facts; `<` escaped | `src/lib/seo.test.ts`, `src/app/page.test.tsx`, `e2e/seo.spec.ts` |
| Indexation rules | Owner pages: `X-Robots-Tag: noindex` and `<meta name="robots" noindex>`; the API proxy: `X-Robots-Tag: noindex`; 404 and the empty Notes listing: `noindex`; preview deployments: `X-Robots-Tag: noindex` on every path | `e2e/seo.spec.ts`, `e2e/owner.spec.ts`, `e2e/smoke.spec.ts` |

Known: a project slug that is not prerendered and answers 404 carries two identical `noindex` tags
(Next.js on-demand not-found rendering); harmless.

## Performance

**Rendering and caching.** Public pages are static (prerendered at build time) and, with
`PUBLIC_CONTENT_SOURCE=api`, refreshed by tag when content changes, with a five-minute safety expiry.
Project and note pages published later render on their first visit. The Studio is dynamic and never
cached. Library images are served under immutable URLs (cached for a year); `/public` files are cached
for a day.

**Images.** `next/image` serves AVIF, then WebP, at the size the layout needs; library images come
with stored 480/960/1600 px WebP versions in `srcset`. Every image has width and height (no layout
shift). Only the hero portrait is loaded eagerly with high priority.

**Fonts.** Self-hosted by `next/font` (no request to Google), Latin subset only, `font-display: swap`
with metric-matched fallbacks. The heading and body fonts are preloaded; the monospace font (small
labels only) is not, because on slow connections preloaded fonts compete with the page for bandwidth:
not preloading it cut the MOSAIC page's mobile LCP from 3.05 s to 1.00 s with no layout shift.

**API and database.** Each page makes one request to the content API per render (deduplicated with
React `cache`). `/api/v1/public/portfolio` runs a fixed number of queries however many items exist
(no N+1; `test_the_public_portfolio_takes_a_fixed_number_of_queries`).

**Bundle.** 156 KB of JavaScript (compressed) on the home page, 173 KB on project pages; about
120 KB of it is React and the Next.js runtime. Client components are limited to interactive parts
(navigation menu, contact form, Studio forms).

### Measurements

`node scripts/measure-vitals.mjs --runs 5` (`npm run perf`): median of five cold loads. Mobile:
390×844, 4× CPU slowdown, slow 4G (150 ms RTT, 1.6 Mbps). Times in ms, sizes in KB transferred.

| Profile | Page | TTFB | FCP | LCP | CLS | TBT | JS | Total |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| mobile | / | 23 | 1948 | 1948 | 0.000 | 710 | 156 | 264 |
| mobile | /projects | 13 | 1272 | 1272 | 0.000 | 941 | 173 | 282 |
| mobile | /projects/mosaic | 11 | 1000 | 1000 | 0.000 | 336 | 173 | 278 |
| mobile | /projects/buzhub-platform | 15 | 1048 | 1048 | 0.000 | 958 | 173 | 273 |
| desktop | / | 11 | 140 | 140 | 0.000 | 0 | 156 | 253 |
| desktop | /projects | 9 | 140 | 140 | 0.000 | 0 | 162 | 264 |
| desktop | /projects/mosaic | 9 | 120 | 120 | 0.000 | 0 | 173 | 278 |
| desktop | /projects/buzhub-platform | 8 | 108 | 108 | 0.000 | 0 | 173 | 273 |

Targets ("good" on web.dev): LCP ≤ 2.5 s, CLS ≤ 0.1, TBT ≤ 200 ms (mobile lab), JavaScript ≤ 250 KB.

- **Met:** LCP (1.0–1.9 s mobile, ≤ 0.14 s desktop), CLS (0 everywhere), JavaScript (≤ 173 KB) and
  total weight (≤ 282 KB) on every page; TBT is 0 on desktop.
- **Not met:** TBT on throttled mobile, 336–958 ms and noisy between runs (pages with identical
  JavaScript differ by 600 ms). It is dominated by evaluating React and the Next.js runtime under a 4×
  slowdown; reducing it substantially would need fewer framework bytes, not a page-level change. TBT
  is a lab proxy for INP: real-user INP should be measured once the site runs in production (for
  example with Vercel Speed Insights), and the target revisited then.
- TTFB here is a local server; production adds network and Vercel edge latency.

## Accessibility

| Requirement | Implementation and evidence |
|---|---|
| Semantic HTML | Landmarks (banner, navigation, main, contentinfo), one `h1` per page, ordered headings, lists, `<time>`, breadcrumbs; `e2e/seo.spec.ts` checks one `h1` on every public page |
| Keyboard | Skip link to `main`; visible focus; menus and dialogs fully keyboard-operable; targets at least 24 px (WCAG 2.5.8): `e2e/home.spec.ts`, `e2e/portfolio.spec.ts`, `e2e/components/` |
| Screen readers | Accessible names that contain the visible text, live regions for form status and toasts, `aria-invalid` and described-by errors; automated checks only, see "Pending" |
| Forms | Labels, hints and errors wired to every control (`Field`); errors announced; nothing lost on failure: contact form, sign-in, every Studio form |
| Colour contrast | Token pairs verified by `src/app/tokens.test.ts` (WCAG AA) and by axe on every page |
| Reduced motion | All transitions and smooth scrolling are removed under `prefers-reduced-motion`: `e2e/seo.spec.ts` |
| Modals | Native `<dialog>`: focus moves in and returns, Escape closes, background inert, scroll locked, the safe action focused first for destructive confirmations: `e2e/components/` |
| Automated audit | axe (WCAG 2.2 A/AA) with zero violations on every public page at four viewports (`e2e/accessibility.spec.ts`), the sign-in page, and, in the live full-stack checks, every Studio page (dashboard, lists, editors, media, inbox, message, activity, security) |

**Pending (manual):** a screen-reader pass with NVDA (Windows) and VoiceOver (iOS) over the home page,
a project page, the contact form and the Studio sign-in. Automated tools cannot confirm the spoken
experience.
