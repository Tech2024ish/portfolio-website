import { expect, test } from '@playwright/test'
import { fail, mockSignedInStudio, ok, pageOverflow } from './helpers'

const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1280, height: 800 }
const SHORT_DESKTOP = { width: 1280, height: 529 }

test.describe('Settings page layout (audit finding: 291px overflow at 390px)', () => {
  for (const [name, viewport] of [
    ['phone 390px', PHONE],
    ['desktop', DESKTOP],
  ]) {
    test(`no page-level horizontal overflow — ${name}`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await mockSignedInStudio(page)
      await page.goto('/admin/settings')
      await expect(page.getByRole('heading', { name: 'Activity history' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Active sessions' })).toBeVisible()
      expect(await pageOverflow(page)).toBeLessThanOrEqual(0)
    })
  }

  test('activity table stays usable on a phone: scrolls inside its region', async ({ page }) => {
    await page.setViewportSize(PHONE)
    await mockSignedInStudio(page)
    await page.goto('/admin/settings')
    const region = page.getByRole('region', { name: /Activity history/ })
    await expect(region).toBeVisible()
    const dims = await region.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }))
    expect(dims.scroll).toBeGreaterThan(dims.client) // the table scrolls…
    await region.focus() // …and is reachable by keyboard
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => region.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0)
    // Every column header is reachable by scrolling.
    await region.evaluate((el) => (el.scrollLeft = el.scrollWidth))
    await expect(region.getByRole('columnheader', { name: 'IP' })).toBeInViewport()
  })
})

test.describe('Sidebar Sign out (audit finding: unreachable on short screens)', () => {
  test('reachable and working on a short desktop viewport', async ({ page }) => {
    await page.setViewportSize(SHORT_DESKTOP)
    const calls = await mockSignedInStudio(page)
    await page.goto('/admin/settings')
    const signOut = page.locator('.studio-sidebar').getByRole('button', { name: 'Sign out' })
    // A real user click: Playwright scrolls it into view and fails if it is covered or clipped.
    await signOut.click()
    await expect(page).toHaveURL(/\/admin\/login$/)
    expect(calls.logout).toBe(1)
  })

  test('reachable from the opened mobile menu on a short phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 560 })
    const calls = await mockSignedInStudio(page)
    await page.goto('/admin')
    await page.getByRole('button', { name: 'Menu' }).click()
    await page.locator('.studio-sidebar').getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/admin\/login$/)
    expect(calls.logout).toBe(1)
  })

  test('sidebar navigation still lays out as a column and scrolls itself, not the page', async ({
    page,
  }) => {
    await page.setViewportSize(SHORT_DESKTOP)
    await mockSignedInStudio(page)
    await page.goto('/admin')
    const sidebar = page.locator('.studio-sidebar')
    const info = await sidebar.evaluate((el) => ({
      overflowY: getComputedStyle(el).overflowY,
      fitsViewport: el.getBoundingClientRect().height <= window.innerHeight,
      scrollable: el.scrollHeight > el.clientHeight,
    }))
    expect(info).toEqual({ overflowY: 'auto', fitsViewport: true, scrollable: true })
    await expect(sidebar.getByRole('link', { name: 'Overview' })).toBeVisible()
  })
})

test.describe('Session check when the API is unavailable (audit finding)', () => {
  for (const [label, respond] of [
    ['503 from the server', (route) => fail(route, 503, 'Content database is not configured.')],
    [
      '500 from the proxy',
      (route) => route.fulfill({ status: 500, body: 'Internal Server Error' }),
    ],
    ['network failure', (route) => route.abort('connectionrefused')],
  ]) {
    test(`${label}: shows a recoverable error, not the login page`, async ({ page }) => {
      let down = true
      await mockSignedInStudio(page, {
        '/auth/me': (route) =>
          down
            ? respond(route)
            : ok(route, { user: { email: 'owner@example.com', display_name: 'Jean Claude' } }),
      })
      await page.goto('/admin/projects')
      const alert = page.getByRole('alert')
      await expect(alert).toContainText("can't reach the server")
      await expect(page).toHaveURL(/\/admin\/projects$/) // not redirected to /admin/login
      await expect(page.getByLabel('Password')).toHaveCount(0)

      down = false
      await page.getByRole('button', { name: 'Try again' }).click()
      await expect(page.getByRole('heading', { name: 'Projects', level: 1 })).toBeVisible()
    })
  }

  for (const status of [401, 403]) {
    test(`${status} still means signed out → login page`, async ({ page }) => {
      await mockSignedInStudio(page, {
        '/auth/me': (route) => fail(route, status, 'Sign in to continue.'),
      })
      await page.goto('/admin/projects')
      await expect(page).toHaveURL(/\/admin\/login$/)
      await expect(page.getByLabel('Password')).toBeVisible()
    })
  }

  test('sign out during an outage keeps the session and says so', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await mockSignedInStudio(page, {
      '/auth/logout': (route) => fail(route, 503, 'Service unavailable.'),
    })
    await page.goto('/admin')
    await page.locator('.studio-sidebar').getByRole('button', { name: 'Sign out' }).click()
    await expect(page.getByText(/Could not sign out/)).toBeVisible()
    await expect(page).toHaveURL(/\/admin$/)
  })
})

test.describe('Contact form against a backend without /api/v1 (audit finding)', () => {
  const fillAndSend = async (page) => {
    await page.goto('/#contact')
    await page.getByLabel('Name', { exact: true }).fill('Ada Lovelace')
    await page.getByLabel('Email', { exact: true }).fill('ada@example.com')
    await page
      .getByLabel('Message', { exact: true })
      .fill('Hello, I would like to talk about a backend role.')
    await page.getByRole('button', { name: /Send message/ }).click()
  }

  for (const status of [404, 405, 503]) {
    test(`v1 ${status} → falls back to the legacy endpoint`, async ({ page }) => {
      let legacyBody = null
      await page.route('**/api/v1/**', (route) => fail(route, status, 'Not Found'))
      await page.route('**/api/contact', (route) => {
        legacyBody = route.request().postDataJSON()
        return ok(route, { success: true, message: 'Message sent successfully!' })
      })
      await fillAndSend(page)
      await expect(page.getByRole('status')).toContainText('Message sent')
      expect(legacyBody).toMatchObject({ name: 'Ada Lovelace', email: 'ada@example.com' })
      expect(legacyBody).not.toHaveProperty('subject') // legacy schema has no subject
    })
  }

  for (const status of [422, 429, 500]) {
    test(`v1 ${status} → error shown, no silent retry elsewhere`, async ({ page }) => {
      let legacyCalls = 0
      await page.route('**/api/v1/contact', (route) =>
        fail(route, status, 'Too many messages. Please try again later.'),
      )
      await page.route('**/api/v1/public/**', (route) => fail(route, 404))
      await page.route('**/api/contact', (route) => {
        legacyCalls += 1
        return ok(route, { success: true })
      })
      await fillAndSend(page)
      await expect(page.locator('.form-status.error')).toBeVisible()
      expect(legacyCalls).toBe(0)
    })
  }
})
