import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button, buttonClasses } from "./button";

describe("Button", () => {
  it("renders an accessible button that defaults to type=button", () => {
    render(<Button>Save draft</Button>);
    const button = screen.getByRole("button", { name: "Save draft" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toBeEnabled();
  });

  it("calls onClick when activated", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Publish</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("is disabled and announces busy state while loading", () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Saving
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Saving" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("uses dark ink on the teal primary for AA contrast", () => {
    expect(buttonClasses("primary")).toContain("text-accent-ink");
    expect(buttonClasses("primary")).not.toContain("text-white");
  });

  it("keeps the md size at a 44px touch target", () => {
    expect(buttonClasses("secondary", "md")).toContain("h-11");
  });
});
