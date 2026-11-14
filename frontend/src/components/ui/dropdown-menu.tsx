"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { cx } from "@/lib/cx";

import { buttonClasses, type ButtonVariant } from "./button";
import { ChevronDownIcon } from "./icons";

/**
 * Menu button (WAI-ARIA APG "menu button" pattern) for a short list of actions.
 * - Trigger: aria-haspopup="menu", aria-expanded, aria-controls.
 * - ArrowDown/ArrowUp on the trigger open the menu on the first/last item.
 * - In the menu: ArrowDown/ArrowUp (wrapping), Home and End move focus; disabled items are
 *   skipped; Enter/Space activate; Escape closes and returns focus to the trigger; Tab closes.
 * - A pointer press outside closes it.
 * Use it for actions. Navigation belongs in links, choices in a Select.
 */

export type MenuItem = {
  label: string;
  onSelect: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
};

type DropdownMenuProps = {
  /** Visible trigger content. */
  label: ReactNode;
  items: readonly MenuItem[];
  align?: "start" | "end";
  variant?: ButtonVariant;
};

export function DropdownMenu({ label, items, align = "start", variant = "secondary" }: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerId = useId();
  const menuId = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const pendingFocus = useRef<"first" | "last" | null>(null);

  const enabled = items.map((item, index) => (item.disabled ? -1 : index)).filter((index) => index >= 0);

  function focusItem(index: number | undefined) {
    if (index !== undefined) itemRefs.current[index]?.focus();
  }

  // Focus moves into the menu after it has rendered.
  useEffect(() => {
    if (!open || !pendingFocus.current) return;
    focusItem(pendingFocus.current === "first" ? enabled[0] : enabled.at(-1));
    pendingFocus.current = null;
  });

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function openMenu(focus: "first" | "last") {
    pendingFocus.current = focus;
    setOpen(true);
  }

  function close(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) trigger.current?.focus();
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openMenu(event.key === "ArrowDown" ? "first" : "last");
    }
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = enabled.indexOf(itemRefs.current.findIndex((item) => item === document.activeElement));
    const move = (position: number) => {
      event.preventDefault();
      focusItem(enabled[(position + enabled.length) % enabled.length]);
    };
    switch (event.key) {
      case "ArrowDown":
        return move(current + 1);
      case "ArrowUp":
        return move(current - 1);
      case "Home":
        return move(0);
      case "End":
        return move(enabled.length - 1);
      case "Escape":
        event.preventDefault();
        return close(true);
      case "Tab":
        return close(false);
    }
  }

  return (
    <div ref={wrapper} className="relative inline-block">
      <button
        ref={trigger}
        id={triggerId}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => (open ? close(false) : openMenu("first"))}
        onKeyDown={onTriggerKeyDown}
        className={buttonClasses(variant, "sm")}
      >
        {label}
        <ChevronDownIcon className={cx("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-labelledby={triggerId}
          onKeyDown={onMenuKeyDown}
          className={cx(
            "absolute top-full z-(--z-overlay) mt-2 flex min-w-48 flex-col rounded-control border border-border-strong bg-overlay p-1 shadow-overlay",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {items.map((item, index) => (
            <button
              key={item.label}
              ref={(element) => {
                itemRefs.current[index] = element;
              }}
              type="button"
              role="menuitem"
              tabIndex={-1}
              aria-disabled={item.disabled || undefined}
              onClick={() => {
                if (item.disabled) return;
                close(true);
                item.onSelect();
              }}
              className={cx(
                "flex min-h-10 items-center rounded-control px-3 text-left text-sm transition-colors",
                item.disabled
                  ? "cursor-not-allowed text-muted"
                  : cx(
                      item.tone === "danger" ? "text-danger-fg" : "text-fg",
                      "hover:bg-raised focus-visible:bg-raised",
                    ),
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
