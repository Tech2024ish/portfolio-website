import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Automated WCAG 2.2 A/AA checks (axe-core) on the production build, at every configured
 * viewport. Automated checks find a subset of issues; they complement, not replace, the
 * keyboard and screen-reader tests elsewhere in this suite.
 */

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function violations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  // Readable failure output: rule, impact and the offending elements.
  return results.violations.map((violation) => ({
    rule: violation.id,
    impact: violation.impact,
    targets: violation.nodes.map((node) => node.target.join(" ")),
  }));
}

test.describe("accessibility (axe, WCAG 2.2 A/AA)", () => {
  test("the homepage has no detectable violations", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('form[data-ready="true"]')).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test("the open mobile menu has no detectable violations", async ({ page, isMobile }) => {
    test.skip(!isMobile, "The menu button exists only at small widths");
    await page.goto("/");
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("navigation", { name: "Mobile" })).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  for (const path of [
    "/projects",
    "/projects/mosaic",
    "/projects/buzhub-platform",
    "/notes",
    "/no-such-page",
  ]) {
    test(`${path} has no detectable violations`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      expect(await violations(page)).toEqual([]);
    });
  }

  test("the contact form in its error state has no detectable violations", async ({ page }) => {
    await page.goto("/#contact");
    const form = page.getByRole("form", { name: "Send a message" });
    await expect(page.locator('form[data-ready="true"]')).toBeVisible();
    await form.getByRole("button", { name: "Send message" }).click();
    await expect(form.getByLabel("Full name")).toHaveAttribute("aria-invalid", "true");
    expect(await violations(page)).toEqual([]);
  });
});
