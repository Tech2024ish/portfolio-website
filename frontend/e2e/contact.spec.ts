import { expect, test, type Page } from "@playwright/test";

const ENDPOINT = "**/api/v1/contact";

async function fillForm(page: Page) {
  const form = page.getByRole("form", { name: "Send a message" });
  await form.getByLabel("Full name").fill("Ada Lovelace");
  await form.getByLabel("Email address").fill("ada@example.com");
  await form.getByLabel("Subject").fill("Backend role");
  await form.getByLabel("Message").fill("I would like to talk about a backend role.");
  return form;
}

test.describe("contact form", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#contact");
    // Typing before hydration would be lost; the form marks itself ready once React owns it.
    await expect(page.locator('form[data-ready="true"]')).toBeVisible();
  });

  test("blocks invalid input in the browser without calling the API", async ({ page }) => {
    let calls = 0;
    await page.route(ENDPOINT, (route) => {
      calls += 1;
      return route.abort();
    });
    const form = page.getByRole("form", { name: "Send a message" });
    await form.getByRole("button", { name: "Send message" }).click();

    await expect(form.getByLabel("Full name")).toHaveAttribute("aria-invalid", "true");
    await expect(form.getByLabel("Full name")).toBeFocused();
    await expect(form.getByText("Enter a valid email address", { exact: false })).toHaveCount(0);
    await form.getByLabel("Email address").fill("ada@example");
    await form.getByRole("button", { name: "Send message" }).click();
    await expect(form.getByText(/valid email address/)).toBeVisible();
    expect(calls).toBe(0);
  });

  test("sends once, shows a loading state, then confirms", async ({ page }) => {
    const bodies: unknown[] = [];
    // The response is held until the test releases it, so the in-flight state is deterministic.
    let release!: () => void;
    const released = new Promise<void>((resolve) => (release = resolve));
    await page.route(ENDPOINT, async (route) => {
      bodies.push(route.request().postDataJSON());
      await released;
      await route.fulfill({ status: 201, json: { status: "received" } });
    });
    const form = await fillForm(page);
    await form.getByRole("button", { name: "Send message" }).click();
    await expect(form.getByRole("button", { name: "Sending…" })).toBeDisabled();
    await expect(form).toHaveAttribute("aria-busy", "true");
    await form.evaluate((el: HTMLFormElement) => el.requestSubmit()); // a second attempt is ignored
    release();

    await expect(page.getByRole("heading", { name: "Message sent" })).toBeVisible();
    expect(bodies).toEqual([
      {
        name: "Ada Lovelace",
        email: "ada@example.com",
        subject: "Backend role",
        message: "I would like to talk about a backend role.",
        website: "",
      },
    ]);
  });

  test("explains the rate limit and keeps the text", async ({ page }) => {
    await page.route(ENDPOINT, (route) =>
      route.fulfill({
        status: 429,
        headers: { "Retry-After": "3600" },
        json: { error: { code: "rate_limited", message: "Too many messages." } },
      }),
    );
    const form = await fillForm(page);
    await form.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("form", { name: "Send a message" }).getByRole("alert")).toContainText(
      "sent several messages recently",
    );
    await expect(form.getByLabel("Subject")).toHaveValue("Backend role");
  });

  // Failure modes are stubbed so the result never depends on what else listens on the
  // API_ORIGIN port of the machine running the tests. The unstubbed browser -> Next.js proxy
  // -> FastAPI -> PostgreSQL path is verified separately against a real backend.
  for (const [label, stub, expected] of [
    [
      "the backend is down (proxy 502)",
      { status: 502, body: "Bad Gateway", contentType: "text/plain" },
      /temporarily unavailable, so your message was not sent/,
    ],
    ["the network is unreachable", "connectionrefused", /couldn't reach the server/],
  ] as const) {
    test(`reports honestly when ${label}`, async ({ page }) => {
      await page.route(ENDPOINT, (route) =>
        typeof stub === "string" ? route.abort(stub) : route.fulfill(stub),
      );
      const form = await fillForm(page);
      await form.getByRole("button", { name: "Send message" }).click();
      const alert = form.getByRole("alert");
      await expect(alert).toContainText(expected);
      await expect(alert.getByRole("link", { name: /@/ })).toHaveAttribute("href", /^mailto:/);
      await expect(alert).toBeFocused();
      await expect(form.getByLabel("Message")).toHaveValue("I would like to talk about a backend role.");
      await expect(page.getByRole("heading", { name: "Message sent" })).toHaveCount(0);
    });
  }

  test("can be completed with the keyboard alone", async ({ page, isMobile }) => {
    test.skip(isMobile, "Tab-key navigation is a desktop interaction");
    await page.route(ENDPOINT, (route) => route.fulfill({ status: 201, json: { status: "received" } }));
    const form = page.getByRole("form", { name: "Send a message" });
    await form.getByLabel("Full name").focus();
    await page.keyboard.type("Ada Lovelace");
    await page.keyboard.press("Tab");
    await page.keyboard.type("ada@example.com");
    await page.keyboard.press("Tab");
    await page.keyboard.type("Backend role");
    await page.keyboard.press("Tab");
    await expect(form.getByLabel("Message")).toBeFocused();
    await page.keyboard.type("I would like to talk about a backend role.");
    await page.keyboard.press("Tab"); // skips the hidden honeypot
    await expect(form.getByRole("button", { name: "Send message" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("status").filter({ hasText: "Message sent" })).toBeFocused();
  });
});
