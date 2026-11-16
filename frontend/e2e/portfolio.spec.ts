import { expect, test, type Page } from "@playwright/test";

/**
 * The public portfolio beyond the home page (Phase 4): the projects listing, project pages,
 * Engineering Notes and the not-found page, on the production build at every viewport.
 */

const PUBLISHED = [
  { slug: "mosaic", title: "MOSAIC" },
  { slug: "buzhub-platform", title: "BuzHub Platform" },
];
const UNPUBLISHED = ["school-management-system", "portfolio-website"];

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe("public portfolio pages", () => {
  test("a visitor can go from the home page to a project and back", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /view all projects/i }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();

    await page.getByRole("heading", { level: 2, name: "MOSAIC" }).getByRole("link").click();
    await expect(page).toHaveURL(/\/projects\/mosaic$/);
    await expect(page.getByRole("heading", { level: 1, name: "MOSAIC" })).toBeVisible();

    await page
      .getByRole("navigation", { name: "Breadcrumb" })
      .getByRole("link", { name: "Projects" })
      .click();
    await expect(page).toHaveURL(/\/projects$/);

    await page.getByRole("banner").getByRole("link", { name: /home$/ }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1, name: "Jean Claude Ishimwe" })).toBeVisible();
  });

  test("the listing shows every published project and nothing else", async ({ page }) => {
    await page.goto("/projects");
    const list = page.getByRole("region", { name: "All projects" });
    await expect(list.getByRole("article")).toHaveCount(PUBLISHED.length);
    for (const { slug, title } of PUBLISHED) {
      await expect(list.getByRole("link", { name: title, exact: true })).toHaveAttribute(
        "href",
        `/projects/${slug}`,
      );
    }
    await expect(page.getByText("School Management System")).toHaveCount(0);
    await expect(page.getByText("Portfolio Website")).toHaveCount(0);
  });

  for (const { slug, title } of PUBLISHED) {
    test(`/projects/${slug} has its own title, description and canonical URL`, async ({ page }) => {
      const response = await page.goto(`/projects/${slug}`);
      expect(response?.status()).toBe(200);
      await expect(page).toHaveTitle(`${title} · Jean Claude Ishimwe`);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.{40,}/);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        new RegExp(`/projects/${slug}$`),
      );
      await expect(page.getByRole("complementary", { name: "Project facts" })).toBeVisible();
      await noHorizontalScroll(page);
    });
  }

  test("unpublished projects, unknown projects and notes answer 404 with a helpful page", async ({
    page,
  }) => {
    for (const path of [
      ...UNPUBLISHED.map((slug) => `/projects/${slug}`),
      "/projects/no-such-project",
      "/notes/anything",
      "/no-such-page",
    ]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
      await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeVisible();
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    }
  });

  test("MOSAIC's published case study is on its page, section by section", async ({ page }) => {
    await page.goto("/projects/mosaic");
    for (const name of [
      "Overview",
      "Problem",
      "Architecture overview",
      "Engineering decisions",
      "Current scope",
    ]) {
      await expect(page.getByRole("heading", { level: 2, name, exact: true })).toBeVisible();
    }
    // No outcome is claimed: none has been verified.
    await expect(page.getByRole("heading", { level: 2, name: "Outcomes", exact: true })).toHaveCount(0);
  });

  test("navigation from an inner page leads back to the home page's sections", async ({ page, isMobile }) => {
    await page.goto("/projects");
    if (isMobile) {
      await page.getByRole("button", { name: "Open menu" }).click();
      const menu = page.getByRole("navigation", { name: "Mobile" });
      await expect(menu.getByRole("link", { name: "Projects" })).toHaveAttribute("aria-current", "page");
      await menu.getByRole("link", { name: "Experience" }).click();
    } else {
      const primary = page.getByRole("navigation", { name: "Primary" });
      await expect(primary.getByRole("link", { name: "Projects" })).toHaveAttribute("aria-current", "page");
      await primary.getByRole("link", { name: "Experience" }).click();
    }
    await expect(page).toHaveURL(/\/#experience$/);
    await expect(page.locator("#experience-heading")).toBeInViewport();
  });

  test("Engineering Notes shows an empty state, is not indexed and is not linked", async ({ page }) => {
    const response = await page.goto("/notes");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "No notes published yet" })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expect(page.getByRole("link", { name: "Notes", exact: true })).toHaveCount(0);
  });

  test("inner pages never scroll horizontally", async ({ page }) => {
    for (const path of ["/projects", "/notes", "/no-such-page"]) {
      await page.goto(path);
      await noHorizontalScroll(page);
    }
  });

  test("interactive targets on inner pages are at least 24px (WCAG 2.5.8)", async ({ page }) => {
    for (const path of [
      "/projects",
      "/projects/mosaic",
      "/projects/buzhub-platform",
      "/notes",
      "/no-such-page",
    ]) {
      await page.goto(path);
      const small = await page.locator("main a, main button, header a, header button").evaluateAll((all) =>
        all
          .filter((el) => (el as HTMLElement).offsetParent !== null)
          .map((el) => ({ text: el.textContent?.trim(), box: el.getBoundingClientRect() }))
          .filter(({ box }) => box.width < 24 || box.height < 24)
          .map(({ text, box }) => `${text} ${Math.round(box.width)}x${Math.round(box.height)}`),
      );
      expect(small, path).toEqual([]);
    }
  });

  test("the skip link moves focus to the page's main content", async ({ page, isMobile }) => {
    test.skip(isMobile, "Tab-key navigation is a desktop interaction");
    await page.goto("/projects");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main")).toBeFocused();
  });
});
