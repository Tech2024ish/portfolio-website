import { fireEvent, render, screen } from "@testing-library/react";
import type { FormEvent, ReactElement } from "react";
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

  it("announces a busy, disabled state while loading and ignores activation", () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Saving
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Saving" });
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("keeps keyboard focus while loading, unlike a natively disabled button", () => {
    function Saving({ loading }: { loading: boolean }) {
      return <Button loading={loading}>Save</Button>;
    }
    const { rerender } = render(<Saving loading={false} />);
    const button = screen.getByRole("button", { name: "Save" });
    button.focus();
    rerender(<Saving loading />);
    expect(button).not.toBeDisabled();
    expect(button).toHaveFocus();
  });

  it("does not submit its form while loading", () => {
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit" loading>
          Sending
        </Button>
      </form>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Sending" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("attaches no event handler unless given one, so Server Components can render it", () => {
    // React Server Components cannot pass functions to elements: an always-present handler
    // breaks every Server Component that renders a Button (e.g. the styleguide page).
    for (const loading of [false, true]) {
      const element = Button({ loading, children: "Save" }) as ReactElement<{ onClick?: unknown }>;
      expect(element.props.onClick).toBeUndefined();
    }
  });

  it("uses dark ink on the teal primary for AA contrast", () => {
    expect(buttonClasses("primary")).toContain("text-accent-ink");
    expect(buttonClasses("primary")).not.toContain("text-white");
  });

  it("keeps the md size at a 44px touch target", () => {
    expect(buttonClasses("secondary", "md")).toContain("h-11");
  });
});
