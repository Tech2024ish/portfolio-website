import { expect, test } from "@playwright/test";

const sections = ["about", "skills", "projects", "experience", "contact"] as const;

test.describe("home page", () => {
  test("renders every section, the real portrait and no console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto("/");
    for (const id of sections) await expect(page.locator(`section#${id}`)).toHaveCount(1);

    const portrait = page.getByRole("img", { name: "Portrait of Jean Claude Ishimwe" });
    await expect(portrait).toBeVisible();
    expect(await portrait.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(
      true,
    );

    expect(errors).toEqual([]);
  });

  test("navigation links bring each section into view", async ({ page, isMobile }) => {
    await page.goto("/");
    for (const id of sections) {
      const label = id[0]!.toUpperCase() + id.slice(1);
      if (isMobile) {
        await page.getByRole("button", { name: "Open menu" }).click();
        await page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: label }).click();
        await expect(page.getByRole("button", { name: "Open menu" })).toHaveAttribute(
          "aria-expanded",
          "false",
        );
      } else {
        await page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: label }).click();
      }
      await expect(page).toHaveURL(new RegExp(`#${id}$`));
      await expect(page.locator(`#${id}-heading`)).toBeInViewport();
    }
  });

  test("shows the right navigation for the viewport", async ({ page, isMobile }) => {
    await page.goto("/");
    const primary = page.getByRole("navigation", { name: "Primary" });
    const toggle = page.getByRole("button", { name: "Open menu" });
    // The first download link in the header is the desktop CV button (the menu's comes later).
    const headerCv = page.locator("header a[download]").first();
    if (isMobile) {
      await expect(primary).toBeHidden();
      await expect(toggle).toBeVisible();
      // The header CV button moves into the menu on small screens.
      await expect(headerCv).toBeHidden();
    } else {
      await expect(primary).toBeVisible();
      await expect(toggle).toBeHidden();
      await expect(headerCv).toBeVisible();
    }
  });

  test("the CV download serves the PDF", async ({ page, request }) => {
    await page.goto("/");
    const href = await page.getByRole("link", { name: "Download CV" }).first().getAttribute("href");
    expect(href).toBe("/Resume.pdf");
    const response = await request.get(href!);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("application/pdf");
  });

  test("external links open safely in a new tab", async ({ page }) => {
    await page.goto("/");
    const links = page.locator('a[target="_blank"]');
    expect(await links.count()).toBeGreaterThan(0);
    for (const rel of await links.evaluateAll((all) => all.map((a) => a.getAttribute("rel")))) {
      expect(rel).toBe("noopener noreferrer");
    }
  });

  test("keyboard users can skip straight to the content", async ({ page, isMobile }) => {
    test.skip(isMobile, "Tab-key navigation is a desktop interaction");
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);
  });

  test("interactive targets are at least 24px (WCAG 2.5.8)", async ({ page }) => {
    await page.goto("/");
    const small = await page.locator("main a, main button, header a, header button").evaluateAll((all) =>
      all
        .filter((el) => (el as HTMLElement).offsetParent !== null)
        .map((el) => ({ text: el.textContent?.trim(), box: el.getBoundingClientRect() }))
        .filter(({ box }) => box.width < 24 || box.height < 24)
        .map(({ text, box }) => `${text} ${Math.round(box.width)}x${Math.round(box.height)}`),
    );
    expect(small).toEqual([]);
  });
});
