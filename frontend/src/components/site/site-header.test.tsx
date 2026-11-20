import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { profile } from "@/content/profile";

import { Logo } from "./site-header";

describe("Logo", () => {
  it("has an accessible name that contains its visible text (WCAG 2.5.3 label in name)", () => {
    render(<Logo profile={profile} />);
    const link = screen.getByRole("link", { name: /back to top/ });
    expect(link).toHaveAttribute("href", "#top");
    expect(link).not.toHaveAttribute("aria-label");
    expect(link.textContent?.startsWith(profile.name)).toBe(true);
    expect(link).toHaveAccessibleName(`${profile.name}, back to top`);
  });

  it("leads home from other pages, still starting with its visible text", () => {
    render(<Logo profile={profile} home={false} />);
    const link = screen.getByRole("link", { name: /home$/ });
    expect(link).toHaveAttribute("href", "/");
    expect(link).toHaveAccessibleName(`${profile.name}, home`);
  });
});
