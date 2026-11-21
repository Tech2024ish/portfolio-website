import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * English, French and Kinyarwanda on the production build. Every language uses the same
 * addresses: the visitor picks one in the header menu, the choice is remembered, and everything on
 * the page (interface and portfolio content alike) switches to it.
 */

async function choose(page: Page, current: RegExp, option: RegExp) {
  await page.getByRole("button", { name: current }).click();
  await Promise.all([page.waitForEvent("load"), page.getByRole("button", { name: option }).click()]);
}

test.describe("languages", () => {
  test.beforeEach(async ({ page }) => {
    // No analytics API runs here: answer the page-view report so the page settles.
    await page.route("**/api/v1/analytics/pageview", (route) => route.fulfill({ status: 204 }));
  });

  test("the menu switches the whole page to French, at the same address, and remembers it", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    await choose(page, /^EN, Language: English/, /Français/);
    await expect(page).toHaveURL(/\/$/); // same address
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    // The site translates itself: browsers must not offer their own translation bar on top.
    await expect(page.locator("html")).toHaveAttribute("translate", "no");
    await expect(page.locator('meta[name="google"]')).toHaveAttribute("content", "notranslate");
    // Interface text...
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Bonjour, je suis");
    await expect(page.getByRole("heading", { level: 2, name: "Compétences techniques" })).toBeVisible();
    // ...and the portfolio content itself.
    await expect(
      page.getByText("Concevoir des systèmes backend fiables pour des problèmes concrets."),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ingénierie des bases de données" })).toBeVisible();
    await expect(page.getByText("Disponible pour des opportunités backend").first()).toBeVisible();
    await expect(page.getByText("janvier 2026 – aujourd'hui")).toBeVisible();
    await expect(page).toHaveTitle(/Ingénieur logiciel backend/);

    // Remembered: other pages open in French too, still at their usual addresses.
    await page.goto("/projects/mosaic");
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.getByRole("heading", { name: "Choix d'ingénierie" })).toBeVisible();
    await expect(page.getByText("Accès aux données cloisonné par organisation")).toBeVisible();
  });

  test("Kinyarwanda, then back to English", async ({ page }) => {
    await page.goto("/projects");
    await page.waitForLoadState("networkidle");
    await choose(page, /^EN, /, /Ikinyarwanda/);
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "rw");
    await expect(page.getByRole("heading", { level: 1, name: "Imishinga" })).toBeVisible();
    await expect(page.getByText("Uruhare muri backend")).toBeVisible();

    await choose(page, /^RW, /, /English/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();
  });

  test("the menu is keyboard-friendly: Escape closes it and returns focus", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const button = page.getByRole("button", { name: /^EN, Language: English/ });
    await button.click();
    const french = page.getByRole("button", { name: /Français/ });
    await expect(french).toBeVisible();
    await expect(french).toHaveAttribute("lang", "fr");
    await expect(page.getByRole("button", { name: "English", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.keyboard.press("Escape");
    await expect(french).toBeHidden();
    await expect(button).toBeFocused();
  });

  test("addresses never change: links stay plain in every language", async ({ page, context }) => {
    await context.addCookies([{ name: "lang", value: "rw", url: test.info().project.use.baseURL! }]);
    await page.goto("/projects");
    await expect(page.getByRole("link", { name: "MOSAIC", exact: true }).first()).toHaveAttribute(
      "href",
      "/projects/mosaic",
    );
  });

  for (const lang of ["fr", "rw"]) {
    test(`the home page in ${lang} has no detectable accessibility violations`, async ({ page, context }) => {
      await context.addCookies([{ name: "lang", value: lang, url: test.info().project.use.baseURL! }]);
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(results.violations.map((violation) => violation.id)).toEqual([]);
    });
  }
});
