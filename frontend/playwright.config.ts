import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`;

// Interactive design-system components are exercised on /styleguide, which exists only in
// development builds (production answers 404), so they run against a dev server. Next.js allows
// one dev server per directory: if one is already running, point E2E_COMPONENTS_URL at it (using
// the host it was started for, e.g. http://localhost:3000) and none is started.
const componentsPort = Number(process.env.E2E_COMPONENTS_PORT ?? 3101);
const existingComponentsURL = process.env.E2E_COMPONENTS_URL;
const componentsURL = existingComponentsURL ?? `http://127.0.0.1:${componentsPort}`;

// Start only the servers the selected projects need (`--project=...`; none selected means all).
// The npm scripts run the site and component suites as separate invocations, so a site-only run
// needs no dev server.
// Known issue, cause not identified: on the development machine, responses from the dev server
// intermittently take tens of seconds (up to ~30 s for a 1 MB chunk, even with curl) while the
// server process is idle and connections open normally. Component tests then time out. It has
// been seen right after the site suite and in standalone component runs, and the split does not
// prevent it. Re-run the component suite when it happens; investigate before relying on it in CI.
const selectedProjects = process.argv.flatMap((arg, index, args) =>
  arg.startsWith("--project=")
    ? [arg.slice("--project=".length)]
    : arg === "--project"
      ? [args[index + 1] ?? ""]
      : [],
);
const isComponentsProject = (name: string) => name.startsWith("components");
const needsSiteServer =
  selectedProjects.length === 0 || selectedProjects.some((name) => !isComponentsProject(name));
const needsComponentsServer =
  !existingComponentsURL && (selectedProjects.length === 0 || selectedProjects.some(isComponentsProject));
// The dev server compiles each route on first request, so allow more than the default 30 s.
const componentsTimeout = 90_000;
const runComponents = !process.env.E2E_BASE_URL;

const viewports = [
  { name: "desktop-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  { name: "laptop-1280", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  { name: "tablet-768", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } } },
  { name: "mobile-390", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 } } },
];

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // Locally, more than four parallel browsers (plus axe analysis) saturated a 16-thread machine and
  // made the first batch time out; CI runners keep Playwright's default.
  workers: process.env.CI ? undefined : 4,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    // The four viewports the public site is verified at, against the production build.
    // The full-stack workflow test has its own config (playwright.fullstack.config.ts).
    ...viewports.map((project) => ({ ...project, testIgnore: ["components/**", "full-stack/**"] })),
    ...(runComponents
      ? [
          {
            name: "components-setup",
            testMatch: "components/warmup.setup.ts",
            use: { ...viewports[1]!.use, baseURL: componentsURL },
          },
          {
            name: "components-desktop",
            testMatch: "components/**/*.spec.ts",
            dependencies: ["components-setup"],
            timeout: componentsTimeout,
            use: { ...viewports[1]!.use, baseURL: componentsURL },
          },
          {
            name: "components-mobile",
            testMatch: "components/**/*.spec.ts",
            dependencies: ["components-setup"],
            timeout: componentsTimeout,
            use: { ...viewports[3]!.use, baseURL: componentsURL },
          },
        ]
      : []),
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        ...(needsSiteServer
          ? [
              {
                // The public site is tested against the production build, not the dev server.
                command: `npm run start -- --hostname 127.0.0.1 --port ${port}`,
                url: baseURL,
                reuseExistingServer: !process.env.CI,
                timeout: 120_000,
              },
            ]
          : []),
        ...(!needsComponentsServer
          ? []
          : [
              {
                command: `npm run dev -- --hostname 127.0.0.1 --port ${componentsPort}`,
                url: `${componentsURL}/styleguide`,
                reuseExistingServer: !process.env.CI,
                timeout: 180_000,
              },
            ]),
      ],
});
