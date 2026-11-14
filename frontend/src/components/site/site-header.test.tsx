import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { profile } from "@/content/profile";

import { Logo } from "./site-header";

describe("Logo", () => {
  it("has an accessible name that contains its visible text (WCAG 2.5.3 label in name)", () => {
    render(<Logo />);
    const link = screen.getByRole("link", { name: /back to top/ });
    expect(link).toHaveAttribute("href", "#top");
    expect(link).not.toHaveAttribute("aria-label");
    const visible = `${profile.initials}.`;
    expect(link.textContent?.startsWith(visible)).toBe(true);
    expect(link).toHaveAccessibleName(expect.stringContaining(profile.name));
    expect(link).toHaveAccessibleName(expect.stringMatching(/^JC\./));
  });
});
