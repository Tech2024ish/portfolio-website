import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Owner Studio access on the production build. No FastAPI runs here, so these tests cover what
 * must hold without a valid session: protected pages redirect, nothing private is rendered or
 * cached, and the sign-in form handles every answer the API can give (stubbed in the browser).
 * Real sign-in against FastAPI is covered by backend/tests/test_auth_api.py.
 */

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test.describe("owner studio access", () => {
  test("the Studio redirects a visitor without a session to sign in", async ({ page }) => {
    await page.goto("/owner");
    await expect(page).toHaveURL(/\/owner\/login\?next=%2Fowner$/);
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  });

  test("owner pages are never cached or indexed", async ({ request }) => {
    const response = await request.get("/owner/login");
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.headers()["x-robots-tag"]).toContain("noindex");
    expect(await response.text()).toContain('name="robots" content="noindex, nofollow"');
  });

  test("a forged session cookie never reveals the Studio", async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "owner_session", value: "forged", url: baseURL! }]);
    await page.goto("/owner");
    // FastAPI either rejects the cookie (redirect to sign-in) or is unreachable (error state).
    await expect(page.getByRole("heading", { name: /^(Sign in|The Studio is unavailable)$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign out" })).toHaveCount(0);
    await expect(page.getByText(/^Welcome,/)).toHaveCount(0);
  });

  test("the sign-in form checks missing fields without a request", async ({ page }) => {
    let requests = 0;
    await page.route("**/api/v1/auth/login", (route) => {
      requests += 1;
      return route.abort();
    });
    await page.goto("/owner/login");
    await expect(page.locator('form[data-ready="true"]')).toBeVisible();
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByLabel("Email")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Password")).toHaveAttribute("aria-invalid", "true");
    expect(requests).toBe(0);
  });

  for (const { status, code, message } of [
    { status: 401, code: "invalid_credentials", message: "The email or password is incorrect." },
    {
      status: 429,
      code: "rate_limited",
      message: "Too many sign-in attempts. Please wait and try again later.",
    },
  ]) {
    test(`the sign-in form shows the API's ${status} answer and stays on the page`, async ({ page }) => {
      await page.route("**/api/v1/auth/login", (route) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify({ error: { code, message } }),
        }),
      );
      await page.goto("/owner/login");
      await expect(page.locator('form[data-ready="true"]')).toBeVisible();
      await page.getByLabel("Email").fill("owner@example.com");
      await page.getByLabel("Password").fill("not-the-password");
      await page.getByRole("button", { name: "Sign in" }).click();
      // Scoped to the form: Next.js renders its own route announcer with role="alert".
      await expect(page.getByRole("form", { name: "Sign in" }).getByRole("alert")).toHaveText(message);
      await expect(page.getByLabel("Password")).toHaveValue("");
      await expect(page).toHaveURL(/\/owner\/login/);
    });
  }

  test("a crafted next= parameter cannot send the owner to another site", async ({ page, baseURL }) => {
    await page.route("**/api/v1/auth/login", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: { email: "owner@example.com", display_name: "Owner" },
          csrf_token: "x",
          expires_at: "2030-01-01T00:00:00Z",
        }),
      }),
    );
    await page.goto("/owner/login?next=https://evil.example/steal");
    await expect(page.locator('form[data-ready="true"]')).toBeVisible();
    await page.getByLabel("Email").fill("owner@example.com");
    await page.getByLabel("Password").fill("Correct-Horse-9-battery");
    await page.getByRole("button", { name: "Sign in" }).click();
    // Sign-in succeeds, so the form goes to /owner (not to the crafted URL). The stub sets no
    // cookie, so the Studio sends us back to sign in with a clean next=: we never left this site.
    await expect(page).toHaveURL(/\/owner\/login\?next=%2Fowner$/);
    expect(new URL(page.url()).origin).toBe(new URL(baseURL!).origin);
  });

  test("the sign-in page has no detectable accessibility violations", async ({ page }) => {
    await page.goto("/owner/login");
    await page.getByRole("button", { name: "Sign in" }).click();
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });

  test("the password never appears in the URL, even if submitted early", async ({ page }) => {
    await page.goto("/owner/login");
    const form = page.getByRole("form", { name: "Sign in" });
    await expect(form).toHaveAttribute("method", "post");
    await page.getByLabel("Password").fill("Correct-Horse-9-battery");
    await page.getByLabel("Password").press("Enter");
    expect(page.url()).not.toContain("Correct-Horse");
  });
});
