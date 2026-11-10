// @vitest-environment node
/**
 * Guards the design tokens against accessibility regressions: every text/background
 * pairing the design system relies on must meet WCAG 2.2 AA (4.5:1 for body text).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const css = readFileSync(fileURLToPath(new URL("./globals.css", import.meta.url)), "utf8");

function token(name: string): string {
  const match = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!match?.[1]) throw new Error(`token --color-${name} not found`);
  return match[1];
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

describe("design token contrast (WCAG AA)", () => {
  const surfaces = ["canvas", "surface", "card", "raised"];

  it.each(surfaces)("primary and secondary text are legible on %s", (surface) => {
    expect(contrast(token("fg"), token(surface))).toBeGreaterThanOrEqual(AA);
    expect(contrast(token("muted"), token(surface))).toBeGreaterThanOrEqual(AA);
  });

  it.each(surfaces)("accent text and links are legible on %s", (surface) => {
    expect(contrast(token("accent"), token(surface))).toBeGreaterThanOrEqual(AA);
  });

  it("text on the primary (teal) button is legible", () => {
    expect(contrast(token("accent-ink"), token("accent"))).toBeGreaterThanOrEqual(AA);
    expect(contrast(token("accent-ink"), token("accent-hover"))).toBeGreaterThanOrEqual(AA);
  });

  it.each(surfaces)("error text is legible on %s", (surface) => {
    expect(contrast(token("danger-fg"), token(surface))).toBeGreaterThanOrEqual(AA);
  });

  it("status text is legible on its soft background", () => {
    expect(contrast(token("success"), token("success-soft"))).toBeGreaterThanOrEqual(3);
  });

  it("documents that the reference secondary-text swatch fails AA (kept decorative only)", () => {
    expect(contrast(token("subtle"), token("surface"))).toBeLessThan(AA);
  });
});
