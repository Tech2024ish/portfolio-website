// @vitest-environment node
/**
 * Padding, margin, gap and space utilities may use only the approved steps in `spacingScale`
 * (src/design/tokens.ts), never an off-scale step or an arbitrary value such as `p-[13px]`.
 *
 * Out of scope on purpose: positioning (`top-*`, `inset-*`) and sizing (`w-*`, `h-*`, `size-*`)
 * utilities share Tailwind's spacing unit but express geometry, not rhythm.
 *
 * Classes are read from source text, so only literal class names are checked (all of them today).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { spacingScale } from "./tokens";

const APPROVED = new Set(spacingScale.map((entry) => entry.step));

// Longest prefixes first so `gap-x-2` is read as `gap-x` + `2`, not `gap` + `x-2`.
const SPACING_UTILITY =
  /^(space-x|space-y|gap-x|gap-y|gap|px|py|ps|pe|pt|pr|pb|pl|p|mx|my|ms|me|mt|mr|mb|ml|m)-(.+)$/;
// Values that are spacing steps: numbers, `px`, or an arbitrary `[...]` value. Anything else
// (`mx-auto`, `space-y-reverse`, or look-alike words such as `my-project`) is not a step.
const STEP_LIKE = /^(\d+(\.\d+)?|px|\[.+\])$/;

/** Strips variants (`md:`, `hover:`, `[&>svg]:`), the important marker and a leading minus. */
function utilityOf(token: string): string {
  let depth = 0;
  let lastColon = -1;
  for (let i = 0; i < token.length; i++) {
    const char = token[i];
    if (char === "[") depth++;
    else if (char === "]") depth--;
    else if (char === ":" && depth === 0) lastColon = i;
  }
  return token
    .slice(lastColon + 1)
    .replace(/^!|!$/g, "")
    .replace(/^-/, "");
}

/** Splits source text into class-like tokens, never inside `[...]` (arbitrary values and variants). */
function tokens(source: string): string[] {
  const found: string[] = [];
  let current = "";
  let depth = 0;
  for (const char of source) {
    if (char === "[") depth++;
    else if (char === "]") depth = Math.max(0, depth - 1);
    if (depth === 0 && /[\s"'`{}()$,;]/.test(char)) {
      if (current) found.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current) found.push(current);
  return found;
}

/** The off-scale spacing utilities in a piece of source text. */
function spacingViolations(source: string): string[] {
  const violations: string[] = [];
  for (const token of tokens(source)) {
    const match = SPACING_UTILITY.exec(utilityOf(token));
    if (!match) continue;
    const value = match[2] as string;
    if (!STEP_LIKE.test(value)) continue;
    if (value.startsWith("[") || !APPROVED.has(value)) violations.push(token);
  }
  return violations;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe("spacingViolations (the class parser)", () => {
  it("accepts approved steps with responsive, state, stacked and arbitrary variants", () => {
    expect(
      spacingViolations(
        'className="p-4 md:py-20 hover:px-3 sm:focus-visible:gap-1.5 [&>svg]:mt-0.5 group-hover:space-y-2"',
      ),
    ).toEqual([]);
  });

  it("accepts negative margins, the important marker and the px hairline", () => {
    expect(spacingViolations("-m-1 -mt-0.5 md:-mx-4 p-4! !gap-2 mt-px")).toEqual([]);
  });

  it("accepts keywords and ignores look-alike words and other utilities", () => {
    expect(
      spacingViolations("mx-auto ml-auto space-y-reverse my-project pt-br w-9 size-11 top-40 inset-x-4"),
    ).toEqual([]);
  });

  it("flags off-scale steps, including inside variants and negatives", () => {
    expect(spacingViolations("p-7 md:gap-9 hover:-mt-11 [&:hover]:px-13")).toEqual([
      "p-7",
      "md:gap-9",
      "hover:-mt-11",
      "[&:hover]:px-13",
    ]);
  });

  it("flags arbitrary values, even when they equal an approved size", () => {
    expect(spacingViolations('cx("p-[13px]", "md:gap-[2rem]", "mt-[var(--x)]")')).toEqual([
      "p-[13px]",
      "md:gap-[2rem]",
      "mt-[var(--x)]",
    ]);
  });

  it("reads template literals and expressions", () => {
    expect(spacingViolations("`${containerClasses} flex gap-12 py-7`")).toEqual(["py-7"]);
  });
});

describe("spacing utilities in the source", () => {
  it("use only approved steps", () => {
    const root = fileURLToPath(new URL("..", import.meta.url));
    const files = sourceFiles(root);
    // Guard against a vacuous pass: the scan must reach the components that use spacing.
    const scanned = files.map((file) => relative(root, file).replaceAll("\\", "/"));
    expect(scanned).toEqual(
      expect.arrayContaining(["components/ui/section.tsx", "components/site/hero.tsx", "app/page.tsx"]),
    );
    const found = files.flatMap((file) =>
      spacingViolations(readFileSync(file, "utf8")).map((token) => `${relative(root, file)}: ${token}`),
    );
    expect(found).toEqual([]);
  });
});
