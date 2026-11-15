import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * Design-system components in a real browser, on the development-only /styleguide.
 * jsdom cannot show modal inertness, the top layer, real keyboard focus movement or
 * rendered colour contrast; these tests do.
 */

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function openStyleguide(page: Page) {
  await page.goto("/styleguide");
  await expect(page.getByRole("heading", { level: 1, name: "Design system" })).toBeVisible();
  // Interactive demos are client components; wait until React owns them.
  await expect(page.getByRole("button", { name: "Open dialog" })).toBeEnabled();
}

test.describe("design-system components (styleguide)", () => {
  test("the whole component catalogue has no detectable WCAG 2.2 A/AA violations", async ({ page }) => {
    await openStyleguide(page);
    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      // The Next.js development overlay is not part of the site.
      .exclude("nextjs-portal")
      .analyze();
    expect(
      results.violations.map((violation) => ({
        rule: violation.id,
        targets: violation.nodes.map((node) => node.target.join(" ")),
      })),
    ).toEqual([]);
  });

  test("a dialog is modal, closes on Escape and returns focus to its opener", async ({ page }) => {
    await openStyleguide(page);
    const opener = page.getByRole("button", { name: "Open dialog" });
    await opener.click();
    const dialog = page.getByRole("dialog", { name: "Edit profile" });
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((element) => element.matches(":modal"))).toBe(true);
    await expect(dialog).toHaveAccessibleDescription("Changes are saved when you press Save.");

    // The page behind is covered: a pointer over the opener reaches the dialog (its backdrop or
    // its own content), never the page.
    const box = (await opener.boundingBox())!;
    const hitInsideDialog = await dialog.evaluate(
      (element, { x, y }) => element.contains(document.elementFromPoint(x, y)),
      { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    );
    expect(hitInsideDialog).toBe(true);

    // Initial focus is inside the dialog, and scrolling the page is locked.
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("hidden");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe("");
  });

  test("a dialog fits small screens without horizontal scrolling", async ({ page }) => {
    await openStyleguide(page);
    await page.getByRole("button", { name: "Open dialog" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit profile" });
    const box = (await dialog.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  });

  test("a destructive confirmation focuses Cancel, so Enter never deletes by reflex", async ({ page }) => {
    await openStyleguide(page);
    await page.getByRole("button", { name: "Delete project" }).click();
    const dialog = page.getByRole("dialog", { name: "Delete project?" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Project deleted")).toHaveCount(0);

    // Confirming shows progress, then completes and reports the outcome.
    await page.getByRole("button", { name: "Delete project" }).click();
    await dialog.getByRole("button", { name: "Delete project" }).click();
    await expect(dialog.getByRole("button", { name: "Delete project" })).toHaveAttribute("aria-busy", "true");
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("region", { name: "Notifications" })).toContainText("Project deleted");
  });

  test("the menu works from the keyboard and skips disabled items", async ({ page, isMobile }) => {
    test.skip(isMobile, "Keyboard menu navigation is a desktop interaction");
    await openStyleguide(page);
    const trigger = page.getByRole("button", { name: "Project actions" });
    await trigger.focus();
    await page.keyboard.press("ArrowDown");
    const menu = page.getByRole("menu", { name: "Project actions" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Edit" })).toBeFocused();
    await page.keyboard.press("ArrowDown"); // "Duplicate" is disabled and skipped
    await expect(menu.getByRole("menuitem", { name: "Publish" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(page.getByTestId("last-action")).toHaveText("Last menu action: Publish");

    await trigger.click();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("the menu works by touch and closes when tapping elsewhere", async ({ page }) => {
    await openStyleguide(page);
    await page.getByRole("button", { name: "Project actions" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await expect(page.getByTestId("last-action")).toHaveText("Last menu action: Delete");

    await page.getByRole("button", { name: "Project actions" }).click();
    await expect(page.getByRole("menu")).toBeVisible();
    await page.getByRole("heading", { level: 1 }).click();
    await expect(page.getByRole("menu")).toBeHidden();
  });

  test("toasts are announced in the right live region and can be dismissed", async ({ page }) => {
    await openStyleguide(page);
    const region = page.getByRole("region", { name: "Notifications" });
    await page.getByRole("button", { name: "Success toast" }).click();
    await expect(region.locator('[aria-live="polite"]')).toContainText("Project saved");
    await page.getByRole("button", { name: "Error toast" }).click();
    await expect(region.locator('[aria-live="assertive"]')).toContainText("Upload failed");
    await region.getByRole("button", { name: "Dismiss notification: Upload failed" }).click();
    await expect(region).not.toContainText("Upload failed");
  });

  test("a toast raised while a dialog is open is announced and reachable inside it", async ({ page }) => {
    await openStyleguide(page);
    await page.getByRole("button", { name: "Open dialog" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit profile" });
    await dialog.getByRole("button", { name: "Notify from the dialog" }).click();

    // Chrome prunes everything outside a modal dialog from its accessibility tree, so check the
    // real tree (Playwright's own role queries do not model inertness).
    const cdp = await page.context().newCDPSession(page);
    await expect
      .poll(async () => {
        const { nodes } = await cdp.send("Accessibility.getFullAXTree");
        return nodes.some((node) => !node.ignored && node.name?.value === "Notification from the dialog");
      })
      .toBe(true);

    // Reachable: it can be dismissed while the dialog stays open.
    await dialog.getByRole("button", { name: "Dismiss notification: Notification from the dialog" }).click();
    await expect(page.getByText("Notification from the dialog")).toHaveCount(0);
    await expect(dialog).toBeVisible();

    // A toast raised while closing goes to the page, which is no longer inert.
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole("region", { name: "Notifications" }).locator('[aria-live="polite"]'),
    ).toContainText("Profile saved");
  });

  test("the styleguide never scrolls horizontally", async ({ page }) => {
    await openStyleguide(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
