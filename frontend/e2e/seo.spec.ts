import { expect, test } from "@playwright/test";

/**
 * Discoverability on the production build: every public page describes itself (title, description,
 * canonical URL, sharing image, structured data), robots.txt and the sitemap agree with what is
 * public, and private pages are never indexed.
 */

const PUBLIC_PAGES = ["/", "/projects", "/projects/mosaic", "/projects/buzhub-platform"];

test.describe("SEO", () => {
  for (const path of PUBLIC_PAGES) {
    test(`${path} has its own metadata, sharing image and structured data`, async ({ page, request }) => {
      await page.goto(path);
      await expect(page).toHaveTitle(/Jean Claude Ishimwe/);
      const meta = (selector: string) => page.locator(selector).first().getAttribute("content");
      expect((await meta('meta[name="description"]'))?.length).toBeGreaterThan(50);
      const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
      expect(new URL(canonical!).pathname).toBe(path);
      expect(await meta('meta[property="og:title"]')).toBeTruthy();
      expect(await meta('meta[name="twitter:card"]')).toBe("summary_large_image");
      const image = await meta('meta[property="og:image"]');
      const response = await request.get(new URL(image!).pathname);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toBe("image/png");
      expect(await page.locator('meta[name="robots"][content*="noindex"]').count()).toBe(0);
      const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent();
      expect(() => JSON.parse(jsonLd!)).not.toThrow();
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    });
  }

  test("robots.txt allows the portfolio and keeps crawlers out of private areas", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
    const text = await response.text();
    expect(text).toContain("Allow: /");
    for (const path of ["/owner", "/api/", "/styleguide"]) expect(text).toContain(`Disallow: ${path}`);
    expect(text).toMatch(/Sitemap: \S+\/sitemap\.xml/);
  });

  test("the sitemap lists exactly the published pages", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    const paths = [...(await response.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (match) => new URL(match[1]!).pathname,
    );
    // One address per page: every language is served there (the visitor's choice).
    expect(paths).toEqual(PUBLIC_PAGES);
  });

  test("private and empty pages are never indexed", async ({ page, request }) => {
    const login = await request.get("/owner/login");
    expect(login.headers()["x-robots-tag"]).toContain("noindex");
    await page.goto("/notes");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await page.goto("/no-such-page");
    await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("transitions and smooth scrolling are switched off", async ({ page }) => {
    await page.goto("/");
    const styles = await page.evaluate(() => {
      const link = document.querySelector("a");
      return {
        scroll: getComputedStyle(document.documentElement).scrollBehavior,
        transition: link ? getComputedStyle(link).transitionDuration : "0s",
      };
    });
    expect(styles.scroll).toBe("auto");
    for (const duration of styles.transition.split(","))
      expect(Number.parseFloat(duration)).toBeLessThan(0.05);
  });
});
