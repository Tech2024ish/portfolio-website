// @vitest-environment node
/**
 * Guards the design tokens:
 * - the registry (src/design/tokens.ts) and globals.css define exactly the same tokens;
 * - every text/background pairing meets WCAG 2.2 AA (4.5:1 for text);
 * - the focus ring meets the 3:1 non-text contrast minimum on every surface (WCAG 1.4.11);
 * - values that must repeat a token outside CSS (the browser theme colour) stay in sync.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { allTokens, SPACING_UNIT_PX, spacingScale } from "@/design/tokens";

const css = readFileSync(fileURLToPath(new URL("./globals.css", import.meta.url)), "utf8");
const layout = readFileSync(fileURLToPath(new URL("./layout.tsx", import.meta.url)), "utf8");

function token(name: string): string {
  const match = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  if (!match?.[1]) throw new Error(`token --color-${name} not found`);
  return match[1];
}

function declaredValue(name: string): string {
  const match = css.match(new RegExp(`\\s${name}:\\s*([^;]+);`));
  if (!match?.[1]) throw new Error(`${name} not declared`);
  return match[1].trim();
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const AA = 4.5;
const NON_TEXT = 3;
const SURFACES = ["canvas", "surface", "card", "raised", "overlay"];

describe("token registry", () => {
  // Every custom property declared in globals.css. "--text-x--line-height" belongs to "--text-x".
  const declared = new Set(
    [...css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)]
      .map((match) => match[1] as string)
      .filter((name) => !name.endsWith("--line-height")),
  );
  const registered = allTokens.map((entry) => entry.name);

  it("lists every token declared in globals.css", () => {
    expect([...declared].filter((name) => !registered.includes(name as `--${string}`))).toEqual([]);
  });

  it("lists no token that globals.css does not declare", () => {
    expect(registered.filter((name) => !declared.has(name))).toEqual([]);
  });

  it("has no duplicates and documents a purpose for each token", () => {
    expect(new Set(registered).size).toBe(registered.length);
    for (const entry of allTokens) expect(entry.purpose.trim()).not.toBe("");
  });

  it("covers every roadmap token category", () => {
    for (const prefix of [
      "--color-",
      "--font-",
      "--text-",
      "--radius-",
      "--breakpoint-",
      "--container-",
      "--shadow-",
      "--ease-",
      "--duration-",
      "--focus-ring-",
      "--z-",
    ]) {
      expect(
        registered.some((name) => name.startsWith(prefix)),
        prefix,
      ).toBe(true);
    }
  });
});

describe("design token contrast (WCAG 2.2 AA)", () => {
  it.each(SURFACES)("primary and secondary text are legible on %s", (surface) => {
    expect(contrast(token("fg"), token(surface))).toBeGreaterThanOrEqual(AA);
    expect(contrast(token("muted"), token(surface))).toBeGreaterThanOrEqual(AA);
  });

  it.each(SURFACES)("accent text and links are legible on %s", (surface) => {
    expect(contrast(token("accent"), token(surface))).toBeGreaterThanOrEqual(AA);
  });

  it("text on the primary (teal) button is legible", () => {
    expect(contrast(token("accent-ink"), token("accent"))).toBeGreaterThanOrEqual(AA);
    expect(contrast(token("accent-ink"), token("accent-hover"))).toBeGreaterThanOrEqual(AA);
  });

  it("text on the destructive button is legible, including on hover", () => {
    expect(contrast(token("fg"), token("danger-strong"))).toBeGreaterThanOrEqual(AA);
    expect(contrast(token("fg"), token("danger-strong-hover"))).toBeGreaterThanOrEqual(AA);
    // Why the button does not use --color-danger directly.
    expect(contrast(token("fg"), token("danger"))).toBeLessThan(AA);
  });

  it.each(SURFACES)("status text is legible on %s", (surface) => {
    expect(contrast(token("success-fg"), token(surface))).toBeGreaterThanOrEqual(AA);
    expect(contrast(token("danger-fg"), token(surface))).toBeGreaterThanOrEqual(AA);
    expect(contrast(token("warning"), token(surface))).toBeGreaterThanOrEqual(AA);
  });

  it.each([
    ["accent", "accent-soft"],
    ["success-fg", "success-soft"],
    ["danger-fg", "danger-soft"],
    ["warning", "warning-soft"],
    ["fg", "success-soft"],
    ["fg", "danger-soft"],
    ["fg", "warning-soft"],
  ])("text %s is legible on its tinted background %s", (text, background) => {
    expect(contrast(token(text), token(background))).toBeGreaterThanOrEqual(AA);
  });

  it("documents why base status colours are not used for text", () => {
    expect(contrast(token("success"), token("success-soft"))).toBeLessThan(AA);
    expect(contrast(token("danger"), token("card"))).toBeLessThan(AA);
  });

  it("documents that the reference secondary-text swatch fails AA (kept decorative only)", () => {
    expect(contrast(token("subtle"), token("surface"))).toBeLessThan(AA);
  });
});

describe("focus and interaction tokens", () => {
  it.each(SURFACES)("the focus ring is visible against %s (3:1 non-text)", (surface) => {
    expect(contrast(token("focus"), token(surface))).toBeGreaterThanOrEqual(NON_TEXT);
  });

  it("the focus ring is visible on accent-tinted backgrounds", () => {
    expect(contrast(token("focus"), token("accent-soft"))).toBeGreaterThanOrEqual(NON_TEXT);
  });

  it("one global rule draws the focus ring from the tokens", () => {
    expect(css).toMatch(
      /:focus-visible\s*\{\s*outline:\s*var\(--focus-ring-width\)\s+solid\s+var\(--color-focus\);\s*outline-offset:\s*var\(--focus-ring-offset\);/,
    );
    expect(declaredValue("--focus-ring-width")).toBe("2px");
  });
});

describe("motion and layering tokens", () => {
  it("removes motion for users who ask for reduced motion", () => {
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?transition-duration:\s*0\.01ms !important/,
    );
  });

  it("keeps durations ordered and the transition default on the standard easing", () => {
    const ms = (name: string) => Number.parseFloat(declaredValue(name));
    expect(ms("--duration-fast")).toBeLessThan(ms("--duration-normal"));
    expect(ms("--duration-normal")).toBeLessThan(ms("--duration-slow"));
    expect(declaredValue("--default-transition-duration")).toBe(declaredValue("--duration-fast"));
    expect(declaredValue("--default-transition-timing-function")).toBe("var(--ease-standard)");
  });

  it("stacks layers in the intended order", () => {
    const z = (name: string) => Number(declaredValue(name));
    expect(z("--z-header")).toBeLessThan(z("--z-overlay"));
    expect(z("--z-overlay")).toBeLessThan(z("--z-toast"));
    expect(z("--z-toast")).toBeLessThan(z("--z-skip-link"));
  });
});

describe("values that must mirror a token", () => {
  it("the browser theme colour equals the canvas token", () => {
    const themeColor = layout.match(/themeColor:\s*"(#[0-9a-fA-F]{6})"/)?.[1];
    expect(themeColor?.toLowerCase()).toBe(token("canvas").toLowerCase());
  });
});

describe("spacing scale", () => {
  it("declares one base unit of 0.25rem, matching the registry's pixel size", () => {
    expect(declaredValue("--spacing")).toBe("0.25rem");
    expect(Number.parseFloat(declaredValue("--spacing")) * 16).toBe(SPACING_UNIT_PX);
  });

  it("lists each step once, in ascending order", () => {
    const steps = spacingScale.map((entry) => entry.step);
    expect(new Set(steps).size).toBe(steps.length);
    const sizes = spacingScale.map((entry) => entry.px);
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
  });

  it("gives every step the size the base unit produces", () => {
    for (const { step, px } of spacingScale) {
      const expected = step === "px" ? 1 : Number(step) * SPACING_UNIT_PX;
      expect({ step, px }).toEqual({ step, px: expected });
    }
  });

  it("stays on the 4px grid, with half steps only for small controls", () => {
    for (const { step, px, role } of spacingScale) {
      if (step === "px") continue;
      if (px % SPACING_UNIT_PX !== 0) expect({ step, role }).toEqual({ step, role: "control" });
    }
  });
});
