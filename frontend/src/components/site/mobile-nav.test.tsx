import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MobileNav } from "./mobile-nav";

const items = [
  { label: "About", href: "#about" },
  { label: "Projects", href: "#projects" },
];

function setup() {
  render(<MobileNav items={items} cvHref="/Resume.pdf" />);
  return screen.getByRole("button", { name: "Open menu" });
}

describe("MobileNav", () => {
  it("starts closed, with the panel hidden from the accessibility tree", () => {
    const toggle = setup();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("navigation", { name: "Mobile" })).not.toBeInTheDocument();
  });

  it("opens and controls the panel it reveals", () => {
    const toggle = setup();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAccessibleName("Close menu");
    const nav = screen.getByRole("navigation", { name: "Mobile" });
    expect(nav.parentElement).toHaveAttribute("id", toggle.getAttribute("aria-controls"));
    expect(screen.getByRole("link", { name: "Projects" })).toHaveAttribute("href", "#projects");
    expect(screen.getByRole("link", { name: "Download CV" })).toHaveAttribute("download");
  });

  it("closes after a link is followed", () => {
    const toggle = setup();
    fireEvent.click(toggle);
    fireEvent.click(screen.getByRole("link", { name: "About" }));
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on Escape and returns focus to the toggle", () => {
    const toggle = setup();
    fireEvent.click(toggle);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveFocus();
  });
});
