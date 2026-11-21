"use client";

import { useSyncExternalStore } from "react";

import { MoonIcon, SunIcon } from "@/components/ui/icons";
import { cx } from "@/lib/cx";

/**
 * Light (the default) or dark. The choice is stored in localStorage and applied to <html> by the
 * inline script in app/layout.tsx before the first paint, so pages never flash the wrong theme.
 */
export const THEME_STORAGE_KEY = "theme";
export type Theme = "light" | "dark";

/** Runs before React (see layout.tsx): only a stored "dark" changes anything. */
export const themeScript = `try{if(localStorage.getItem("${THEME_STORAGE_KEY}")==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`;

const listeners = new Set<() => void>();

function current(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") root.dataset.theme = "dark";
  else delete root.dataset.theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be blocked (private browsing): the theme still changes for this page.
  }
  for (const listener of listeners) listener();
}

export function ThemeToggle({
  className,
  labels = { dark: "Switch to dark theme", light: "Switch to light theme" },
}: {
  className?: string;
  /** Accessible names for the two actions, in the page's language. */
  labels?: { dark: string; light: string };
}) {
  // The server cannot know the visitor's choice: it renders the light state, and the client
  // reads the real one after hydration (no mismatch, no flash: the page colours come from CSS).
  const theme = useSyncExternalStore(subscribe, current, () => "light" as Theme);
  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => applyTheme(next)}
      aria-label={labels[next]}
      className={cx(
        "inline-flex size-11 items-center justify-center rounded-control text-muted transition-colors hover:bg-raised hover:text-fg",
        className,
      )}
    >
      {theme === "dark" ? <SunIcon className="size-5" /> : <MoonIcon className="size-5" />}
    </button>
  );
}
