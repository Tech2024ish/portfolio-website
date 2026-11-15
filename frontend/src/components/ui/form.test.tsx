import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { axeViolations } from "@/test/axe";

import { Field, FieldError, Input, Select, Textarea } from "./form";

describe("Field", () => {
  it("labels the control and leaves it valid without an error", () => {
    render(<Field label="Full name">{(control) => <Input {...control} />}</Field>);
    const input = screen.getByLabelText("Full name");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(input).not.toBeRequired();
  });

  it("marks the control invalid and announces error, hint and aside in that order", () => {
    render(
      <Field label="Message" error="Enter a message." hint="Plain text only." aside="0 / 5000" required>
        {(control) => <Textarea {...control} />}
      </Field>,
    );
    const textarea = screen.getByLabelText("Message");
    expect(textarea).toBeRequired();
    expect(textarea).toHaveAttribute("aria-invalid", "true");
    expect(textarea).toHaveAccessibleDescription("Enter a message. Plain text only. 0 / 5000");
  });

  it("uses a caller-provided id so other code can find the control", () => {
    render(
      <Field label="Email" id="contact-email" error="Enter a valid email address.">
        {(control) => <Input {...control} type="email" />}
      </Field>,
    );
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("id", "contact-email");
    expect(input).toHaveAttribute("aria-describedby", "contact-email-error");
  });

  it("gives every field on a page its own ids", () => {
    render(
      <>
        <Field label="First">{(control) => <Input {...control} />}</Field>
        <Field label="Second">{(control) => <Input {...control} />}</Field>
      </>,
    );
    expect(screen.getByLabelText("First").id).not.toBe(screen.getByLabelText("Second").id);
  });

  it("has no accessibility violations in its error state", async () => {
    const { container } = render(
      <form aria-label="Example">
        <Field label="Full name" error="Enter your name." required>
          {(control) => <Input {...control} />}
        </Field>
        <Field label="Topic" hint="Choose one.">
          {(control) => (
            <Select {...control} defaultValue="api">
              <option value="api">API design</option>
              <option value="db">Databases</option>
            </Select>
          )}
        </Field>
      </form>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe("controls", () => {
  it("pass native props through and merge class names", () => {
    render(<Input aria-label="Search" placeholder="Search" className="extra" maxLength={10} disabled />);
    const input = screen.getByRole("textbox", { name: "Search" });
    expect(input).toHaveAttribute("maxlength", "10");
    expect(input).toBeDisabled();
    expect(input.className).toContain("extra");
    expect(input.className).toContain("rounded-control");
  });

  it("render a native select whose chevron is decorative", () => {
    const { container } = render(
      <Select aria-label="Status" defaultValue="draft">
        <option value="draft">Draft</option>
        <option value="published">Published</option>
      </Select>,
    );
    expect(screen.getByRole("combobox", { name: "Status" })).toHaveValue("draft");
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("FieldError renders nothing without a message", () => {
    const { container } = render(<FieldError id="x" />);
    expect(container).toBeEmptyDOMElement();
  });
});
