import { expect, test } from "@playwright/test";

test.describe("foundation smoke", () => {
  test("home renders with metadata, tokens and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    const response = await page.goto("/");
    expect(response?.status()).toBe(200);

    await expect(page).toHaveTitle("Jean Claude Ishimwe — Backend Software Engineer");
    await expect(page.getByRole("heading", { level: 1, name: "Jean Claude Ishimwe" })).toBeVisible();
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /Backend Software Engineer/,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /^https?:\/\/[^/]+\/?$/);

    // Dark design tokens are applied (canvas #080d17).
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(background).toBe("rgb(8, 13, 23)");

    expect(errors).toEqual([]);
  });

  test("layout never scrolls horizontally", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("security headers are set and the framework is not advertised", async ({ request }) => {
    const response = await request.get("/");
    const headers = response.headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  test("owner routes are never cacheable and never indexed", async ({ request }) => {
    const response = await request.get("/owner/login");
    const headers = response.headers();
    expect(headers["cache-control"]).toContain("no-store");
    expect(headers["x-robots-tag"]).toBe("noindex, nofollow");
  });
});
