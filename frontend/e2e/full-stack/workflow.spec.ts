import { deflateSync } from "node:zlib";

import { expect, test, type Page } from "@playwright/test";

/**
 * Phase 12.3: the complete visitor and owner workflows on the real stack (see
 * playwright.fullstack.config.ts). Nothing is stubbed: the browser talks to the production build,
 * which talks to FastAPI, which writes to a throwaway PostgreSQL database. The steps run in order
 * and build on each other, numbered as in the roadmap.
 */

const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL!;
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD!;

// Unique per run, so a failure can never be hidden by data from an earlier run.
const run = Date.now().toString(36);
const message = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  subject: `Backend role ${run}`,
  text: "I would like to talk about a backend role on my team.",
};
const project = {
  title: `Ledger Service ${run}`,
  slug: `ledger-service-${run}`,
  category: "Backend service",
  summary: "An append-only ledger API written for the full-stack workflow test.",
};
const headline = `Shipping dependable APIs (${run}).`;
const seoTitle = `Jean Claude Ishimwe | Backend (${run})`;

/** A valid PNG of one colour, so uploads go through the API's real image processing. */
function png(size: number, rgb: [number, number, number]): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (bytes: Buffer) => {
    let c = 0xffffffff;
    for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE(crc(body));
    return Buffer.concat([length, body, checksum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8-bit RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(size * 3, Buffer.from(rgb))]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.concat(Array.from({ length: size }, () => row)))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Public pages are cached; Studio saves ask the site to refresh. Reload until the change shows. */
async function eventually(page: Page, path: string, check: () => Promise<void>) {
  await expect(async () => {
    await page.goto(path);
    await check();
  }).toPass({ timeout: 20_000 });
}

test.describe.configure({ mode: "serial" });

test.describe("full-stack workflows", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });
  test.afterAll(async () => {
    await page.close();
  });

  test("1-3. a visitor opens the portfolio, explores the projects and opens one", async () => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Jean Claude Ishimwe");
    // The content comes from the API's database (imported), not from the bundled copy.
    await expect(page.getByText("Building reliable backend systems for real-world problems.")).toBeVisible();

    await page.getByRole("link", { name: /view all projects/i }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await page.getByRole("heading", { level: 2, name: "MOSAIC" }).getByRole("link").click();
    await expect(page).toHaveURL(/\/projects\/mosaic$/);
    await expect(page.getByRole("heading", { level: 1, name: "MOSAIC" })).toBeVisible();
  });

  test("4-5. the visitor sends a contact message", async () => {
    await page.goto("/#contact");
    await expect(page.locator('form[data-ready="true"]')).toBeVisible();
    const form = page.getByRole("form", { name: "Send a message" });
    await form.getByLabel("Full name").fill(message.name);
    await form.getByLabel("Email address").fill(message.email);
    await form.getByLabel("Subject").fill(message.subject);
    await form.getByLabel("Message").fill(message.text);
    await form.getByRole("button", { name: "Send message" }).click();
    await expect(page.getByRole("heading", { name: "Message sent" })).toBeVisible();
  });

  test("6. the owner signs in", async () => {
    await page.goto("/owner");
    await expect(page).toHaveURL(/\/owner\/login/);
    const form = page.getByRole("form", { name: "Sign in" });
    await form.getByLabel("Email").fill(OWNER_EMAIL);
    await form.getByLabel("Password").fill(OWNER_PASSWORD);
    await form.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/owner$/);
  });

  test("7. the owner reads the visitor's message, stored in the database", async () => {
    await page.goto("/owner/messages");
    await page.getByRole("link", { name: message.subject }).click();
    const body = page.getByRole("region", { name: "Message" });
    await expect(body).toContainText(message.text);
    await expect(page.getByText(message.email).first()).toBeVisible();
    // No email provider here: the owner replies from their own mailbox, pre-filled.
    const gmail = new URL((await page.getByRole("link", { name: /^Reply in Gmail/ }).getAttribute("href"))!);
    expect(gmail.searchParams.get("to")).toBe(message.email);
    expect(gmail.searchParams.get("su")).toBe(`Re: ${message.subject}`);
    expect(gmail.searchParams.get("body")).toContain(`> ${message.text}`);
    const mailto = await page.getByRole("link", { name: "Reply with your email app" }).getAttribute("href");
    expect(mailto).toContain(
      `mailto:${message.email}?subject=${encodeURIComponent(`Re: ${message.subject}`)}&body=`,
    );
  });

  test("8-11. the owner creates a project, previews it, publishes it, and it appears publicly", async () => {
    await page.goto("/owner/content/projects/new");
    const form = page.getByRole("form", { name: "New project" });
    await form.getByLabel("Title", { exact: true }).fill(project.title);
    await form.getByLabel("Address (slug)", { exact: true }).fill(project.slug);
    await form.getByLabel("Category", { exact: true }).fill(project.category);
    await form.getByLabel("Summary", { exact: true }).fill(project.summary);
    await form.getByRole("button", { name: "Create project" }).click();
    await expect(page.getByRole("heading", { level: 1, name: project.title })).toBeVisible();
    const editor = new URL(page.url()).pathname;

    // A draft is private.
    expect((await page.request.get(`/projects/${project.slug}`)).status()).toBe(404);

    await page.getByRole("link", { name: "Preview" }).click();
    await expect(page.getByText(project.summary).first()).toBeVisible();
    await page.goto(editor);

    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByRole("button", { name: "Unpublish" })).toBeVisible();

    await eventually(page, "/projects", async () => {
      await expect(page.getByRole("heading", { level: 2, name: project.title })).toBeVisible();
    });
    await page.goto(`/projects/${project.slug}`);
    await expect(page.getByRole("heading", { level: 1, name: project.title })).toBeVisible();
  });

  test("12. the owner uploads an image, then replaces it", async () => {
    await page.goto("/owner/media");
    const upload = page.getByRole("form", { name: "Upload an image" });
    await upload.getByLabel("Image", { exact: true }).setInputFiles({
      name: `cover-${run}.png`,
      mimeType: "image/png",
      buffer: png(64, [37, 99, 235]),
    });
    await upload.getByLabel("Alternative text").fill(`Blue cover ${run}`);
    await upload.getByRole("button", { name: "Upload" }).click();
    await expect(page.getByRole("status").filter({ hasText: `Uploaded “cover-${run}.png”.` })).toBeVisible();

    await page
      .getByRole("link", { name: new RegExp(`cover-${run}|Blue cover ${run}`) })
      .first()
      .click();
    await expect(page).toHaveURL(/\/owner\/media\/\d+$/);
    const image = page.locator("img").first();
    const before = await image.getAttribute("src");
    expect((await page.request.get(before!)).status()).toBe(200);

    const replace = page.getByRole("form", { name: "Replace the image" });
    await replace.getByLabel("New image file").setInputFiles({
      name: `cover-${run}-v2.png`,
      mimeType: "image/png",
      buffer: png(64, [22, 163, 74]),
    });
    await replace.getByRole("button", { name: "Replace image" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Replaced." })).toBeVisible();
    await page.reload();
    const after = await page.locator("img").first().getAttribute("src");
    expect(after).not.toBe(before);
    expect((await page.request.get(after!)).status()).toBe(200);
  });

  test("13. the owner updates the profile, and the home page shows it", async () => {
    await page.goto("/owner/profile");
    await page.getByLabel("Headline", { exact: true }).fill(headline);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    await eventually(page, "/", async () => {
      await expect(page.getByText(headline)).toBeVisible();
    });
  });

  test("14. the owner changes the website settings, and the site uses them", async () => {
    await page.goto("/owner/settings");
    await page.getByLabel("Default page title", { exact: true }).fill(seoTitle);
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Saved.")).toBeVisible();
    await eventually(page, "/", async () => {
      await expect(page).toHaveTitle(seoTitle);
    });
  });

  test("15. the owner signs out, and the Studio is closed again", async () => {
    await page.goto("/owner");
    await page.getByRole("button", { name: "Sign out" }).first().click();
    await expect(page).toHaveURL(/\/owner\/login/);
    await page.goto("/owner/messages");
    await expect(page).toHaveURL(/\/owner\/login/);
  });

  test("16. without a session, private pages and the owner API are refused", async ({ browser }) => {
    const stranger = await browser.newContext();
    const visitor = await stranger.newPage();
    for (const path of ["/owner", "/owner/messages", "/owner/content/projects", "/owner/media"]) {
      await visitor.goto(path);
      await expect(visitor, path).toHaveURL(/\/owner\/login/);
    }
    for (const path of ["/api/v1/owner/messages", "/api/v1/owner/projects", "/api/v1/owner/media"]) {
      expect((await visitor.request.get(path)).status(), path).toBe(401);
    }
    // Writes are refused too, even with a made-up session cookie.
    await stranger.addCookies([{ name: "portfolio_session", value: "forged", url: page.url() }]);
    const write = await visitor.request.post("/api/v1/owner/projects", {
      data: { title: "Injected" },
      headers: { Origin: new URL(page.url()).origin },
    });
    expect([401, 403]).toContain(write.status());
    await stranger.close();
  });
});
