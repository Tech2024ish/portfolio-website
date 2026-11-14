import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { axeViolations } from "@/test/axe";

import { DropdownMenu, type MenuItem } from "./dropdown-menu";

function setup(overrides: Partial<Record<"edit" | "publish" | "remove", Partial<MenuItem>>> = {}) {
  const edit = vi.fn();
  const publish = vi.fn();
  const remove = vi.fn();
  render(
    <>
      <DropdownMenu
        label="Actions"
        items={[
          { label: "Edit", onSelect: edit, ...overrides.edit },
          { label: "Publish", onSelect: publish, ...overrides.publish },
          { label: "Delete", onSelect: remove, tone: "danger", ...overrides.remove },
        ]}
      />
      <button type="button">Elsewhere</button>
    </>,
  );
  const trigger = screen.getByRole("button", { name: "Actions" });
  return { trigger, edit, publish, remove };
}

const items = () => screen.getAllByRole("menuitem");

describe("DropdownMenu", () => {
  it("exposes the menu-button pattern and starts closed", () => {
    const { trigger } = setup();
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("opens on click with focus on the first item, labelled by its trigger", () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    const menu = screen.getByRole("menu", { name: "Actions" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(trigger).toHaveAttribute("aria-controls", menu.id);
    expect(items()[0]).toHaveFocus();
  });

  it("opens on ArrowUp with focus on the last item", () => {
    const { trigger } = setup();
    fireEvent.keyDown(trigger, { key: "ArrowUp" });
    expect(items()[2]).toHaveFocus();
  });

  it("moves focus with arrows (wrapping), Home and End", () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    const menu = screen.getByRole("menu");
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(items()[1]).toHaveFocus();
    fireEvent.keyDown(menu, { key: "End" });
    expect(items()[2]).toHaveFocus();
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(items()[0]).toHaveFocus();
    fireEvent.keyDown(menu, { key: "ArrowUp" });
    expect(items()[2]).toHaveFocus();
    fireEvent.keyDown(menu, { key: "Home" });
    expect(items()[0]).toHaveFocus();
  });

  it("skips disabled items and never activates them", () => {
    const { trigger, publish } = setup({ publish: { disabled: true } });
    fireEvent.click(trigger);
    const menu = screen.getByRole("menu");
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(items()[2]).toHaveFocus();
    expect(items()[1]).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(items()[1]!);
    expect(publish).not.toHaveBeenCalled();
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("runs the chosen action, closes and returns focus to the trigger", () => {
    const { trigger, remove } = setup();
    fireEvent.click(trigger);
    fireEvent.click(items()[2]!);
    expect(remove).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("closes on Escape with focus back on the trigger", () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it("closes on Tab and on a pointer press outside", () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("menu"), { key: "Tab" });
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(trigger);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Elsewhere" }));
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("has no accessibility violations when open", async () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    expect(await axeViolations(document.body)).toEqual([]);
  });
});
