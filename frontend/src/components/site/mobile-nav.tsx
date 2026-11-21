"use client";

import { useEffect, useId, useRef, useState } from "react";

import { buttonClasses } from "@/components/ui/button";
import { CloseIcon, DownloadIcon, MenuIcon } from "@/components/ui/icons";

import { NavAnchor } from "./nav-anchor";

type NavItem = { label: string; href: string; current?: boolean };

/**
 * Disclosure menu for small screens. A client component: it needs state for open/closed,
 * Escape to close, and closing after navigation.
 */
export function MobileNav({
  items,
  cvHref,
  labels = { open: "Open menu", close: "Close menu", cv: "Download CV" },
}: {
  items: readonly NavItem[];
  cvHref: string;
  labels?: { open: string; close: string; cv: string };
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? labels.close : labels.open}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex size-11 items-center justify-center rounded-control text-fg hover:bg-raised"
      >
        {open ? <CloseIcon className="size-6" /> : <MenuIcon className="size-6" />}
      </button>

      <div
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 top-full border-b border-border bg-surface shadow-overlay"
      >
        <nav aria-label="Mobile" className="px-4 pt-2 pb-5">
          <ul className="flex flex-col">
            {items.map((item) => (
              <li key={item.href}>
                <NavAnchor
                  href={item.href}
                  aria-current={item.current ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className="flex min-h-12 items-center rounded-control px-3 text-base text-fg hover:bg-raised aria-[current=page]:text-accent"
                >
                  {item.label}
                </NavAnchor>
              </li>
            ))}
          </ul>
          <a href={cvHref} download className={`${buttonClasses("primary")} mt-4 w-full`}>
            <DownloadIcon />
            {labels.cv}
          </a>
        </nav>
      </div>
    </div>
  );
}
