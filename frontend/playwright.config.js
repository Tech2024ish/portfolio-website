import { defineConfig } from '@playwright/test'

// Browser regression tests against the production build. The API is mocked per
// test with page.route(), so no backend or database is needed. Uses the locally
// installed Google Chrome (no browser download).
const PORT = 4179

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: 'chrome',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { API_PROXY_TARGET: 'http://127.0.0.1:9' },
  },
})
