import axe from "axe-core";

/**
 * Runs axe-core's WCAG 2.2 A/AA rules against rendered component markup (jsdom).
 * Colour contrast needs real layout and rendering, so it is checked by the token contrast
 * tests and by the Playwright axe runs instead; everything else (names, roles, ARIA validity,
 * labels, structure) is checked here.
 */
export async function axeViolations(root: Element) {
  const results = await axe.run(root, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
    rules: { "color-contrast": { enabled: false } },
  });
  return results.violations.map((violation) => ({
    rule: violation.id,
    targets: violation.nodes.map((node) => node.target.join(" ")),
  }));
}
