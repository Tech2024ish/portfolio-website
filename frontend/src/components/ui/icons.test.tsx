import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { iconClasses, MailIcon } from "./icons";

describe("icons", () => {
  it("keep the default size when only a colour class is passed", () => {
    expect(iconClasses("text-accent")).toBe("size-5 shrink-0 text-accent");
    expect(iconClasses()).toBe("size-5 shrink-0");
  });

  it("use the caller's size when one is given", () => {
    expect(iconClasses("size-4")).toBe("shrink-0 size-4");
  });

  it("are hidden from assistive technology", () => {
    const { container } = render(<MailIcon className="text-accent" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveClass("size-5", "text-accent");
  });
});
