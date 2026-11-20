import { expect, test, type Locator } from "@playwright/test";

/** Design tokens as the browser actually computes them on the production build. */

const FOCUS_RGB = "rgb(3, 2, 19)"; // --color-focus in the default (light) theme, #030213

async function outline(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      color: style.outlineColor,
      style: style.outlineStyle,
      width: style.outlineWidth,
      offset: style.outlineOffset,
    };
  });
}

test.describe("design tokens in the browser", () => {
  test("the styleguide does not exist in production", async ({ request }) => {
    const response = await request.get("/styleguide");
    expect(response.status()).toBe(404);
    expect(await response.text()).not.toContain("Design system");
  });

  test("keyboard focus draws the token focus ring", async ({ page, isMobile }) => {
    test.skip(isMobile, "Tab-key navigation is a desktop interaction");
    await page.goto("/");
    // A Tab pressed while the page is still hydrating can be lost: wait until it has settled.
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Skip to content" });
    await expect(skip).toBeFocused();
    expect(await outline(skip)).toEqual({ color: FOCUS_RGB, style: "solid", width: "2px", offset: "2px" });
    // The skip link sits above every other layer while focused.
    expect(await skip.evaluate((element) => getComputedStyle(element).zIndex)).toBe("70");

    await page.keyboard.press("Tab");
    const logo = page.getByRole("banner").getByRole("link", { name: /back to top/ });
    await expect(logo).toBeFocused();
    expect(await outline(logo)).toEqual({ color: FOCUS_RGB, style: "solid", width: "2px", offset: "2px" });
  });

  test("buttons get the same focus ring as links (one global rule)", async ({ page, isMobile }) => {
    test.skip(isMobile, "Tab-key navigation is a desktop interaction");
    await page.goto("/");
    // A Tab pressed while the page is still hydrating can be lost: wait until it has settled.
    await page.waitForLoadState("networkidle");
    const button = page.getByRole("link", { name: "View projects" });
    for (let i = 0; i < 20 && !(await button.evaluate((el) => el === document.activeElement)); i++) {
      await page.keyboard.press("Tab");
    }
    await expect(button).toBeFocused();
    // transition-colors also animates outline-color, so wait for the ring to finish fading in.
    await expect
      .poll(() => outline(button))
      .toEqual({
        color: FOCUS_RGB,
        style: "solid",
        width: "2px",
        offset: "2px",
      });
  });

  test("transitions use the motion tokens", async ({ page }) => {
    await page.goto("/");
    const timing = await page.getByRole("link", { name: "View projects" }).evaluate((element) => {
      const style = getComputedStyle(element);
      return { duration: style.transitionDuration, easing: style.transitionTimingFunction };
    });
    expect(timing).toEqual({ duration: "0.15s", easing: "cubic-bezier(0.2, 0, 0, 1)" });
  });

  test("motion is removed for users who prefer reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const duration = await page
      .getByRole("link", { name: "View projects" })
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).transitionDuration));
    expect(duration).toBeLessThan(0.001);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe("auto");
  });

  test("layout and layering tokens apply", async ({ page }) => {
    await page.goto("/");
    expect(
      await page
        .locator("header")
        .first()
        .evaluate((el) => getComputedStyle(el).zIndex),
    ).toBe("40");
    const container = page.locator("section#about > div").first();
    expect(await container.evaluate((el) => getComputedStyle(el).maxWidth)).toBe("1152px");
  });

  test("status text uses the AA-compliant success colour", async ({ page }) => {
    await page.goto("/");
    const badge = page.getByText("Available for backend opportunities").first();
    expect(await badge.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(22, 101, 52)");
  });

  test("the theme toggle switches to dark, and the choice survives a reload", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(await background()).toBe("rgb(255, 255, 255)");

    await page.getByRole("button", { name: "Switch to dark theme" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await background()).toBe("rgb(8, 13, 23)");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await background()).toBe("rgb(8, 13, 23)");
    await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible();

    await page.getByRole("button", { name: "Switch to light theme" }).click();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", "dark");
    expect(await background()).toBe("rgb(255, 255, 255)");
  });
});
