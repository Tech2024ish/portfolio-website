import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { allTokens, spacingScale, tokenGroups } from "@/design/tokens";

import StyleguidePage, { metadata } from "./page";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  }),
}));

afterEach(() => vi.unstubAllEnvs());

describe("styleguide (development only)", () => {
  it("is a 404 in production builds", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => render(<StyleguidePage />)).toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  });

  it("is never indexed", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it("documents every token, grouped, outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    const { container } = render(<StyleguidePage />);
    expect(screen.getByRole("heading", { level: 1, name: "Design system" })).toBeInTheDocument();
    // The page is large (every component and token), so sections are found through their
    // labelling heading rather than role queries over the whole accessibility tree.
    for (const group of tokenGroups) {
      const heading = screen.getByText(group.title, { selector: "h2" });
      const section = heading.closest("section");
      expect(section).toHaveAttribute("aria-labelledby", heading.id);
      for (const token of group.tokens) {
        expect(within(section!).getByText(token.name)).toBeInTheDocument();
      }
    }
    // Every token is one list item; the component catalogue adds none.
    expect(container.querySelectorAll("li")).toHaveLength(allTokens.length);
  });

  it("renders colour swatches from the live CSS variables", () => {
    vi.stubEnv("NODE_ENV", "development");
    const { container } = render(<StyleguidePage />);
    const card = container.querySelector('[style*="var(--color-card)"]');
    expect(card).not.toBeNull();
    expect(container.querySelector('[style*="var(--shadow-overlay)"]')).not.toBeNull();
  });

  it("shows every spacing step, sized from the base unit, in the Spacing section", () => {
    vi.stubEnv("NODE_ENV", "development");
    const { container } = render(<StyleguidePage />);
    const section = screen.getByText("Spacing", { selector: "h2" }).closest("section") as HTMLElement;
    const samples = [...section.querySelectorAll<HTMLElement>("[data-spacing-sample]")];
    expect(samples.map((sample) => sample.dataset.spacingSample)).toEqual(
      spacingScale.map((entry) => entry.step),
    );
    for (const sample of samples) {
      const step = sample.dataset.spacingSample;
      expect(sample.style.width).toBe(step === "px" ? "1px" : `calc(var(--spacing) * ${step})`);
    }
    // Rows are headed by their step, so each row is announced with it.
    const rowHeaders = [...section.querySelectorAll("tbody th[scope=row]")].map((cell) => cell.textContent);
    expect(rowHeaders).toEqual(spacingScale.map((entry) => entry.step));
    // A table, not list items: the page keeps exactly one list item per token.
    expect(container.querySelectorAll("li")).toHaveLength(allTokens.length);
  });
});
