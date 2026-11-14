import { expect, test as setup } from "@playwright/test";

/**
 * The dev server compiles /styleguide and its client bundles on the first request. Loading the
 * page once, before the parallel component tests, keeps that compile time out of their timeouts.
 * It does not prevent the intermittent local stall described in playwright.config.ts.
 */
setup("compile and hydrate /styleguide on the dev server", async ({ page }) => {
  setup.setTimeout(180_000);
  await page.goto("/styleguide", { timeout: 170_000 });
  await expect(page.getByRole("button", { name: "Open dialog" })).toBeEnabled({ timeout: 60_000 });
});
