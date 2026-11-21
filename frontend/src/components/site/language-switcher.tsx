"use client";

import { useEffect, useId, useRef, useState } from "react";

import { CheckCircleIcon, ChevronDownIcon } from "@/components/ui/icons";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, LOCALE_LABELS, LOCALES, type Locale } from "@/i18n/config";
import { dictionary } from "@/i18n/dictionaries";
import { cx } from "@/lib/cx";

/** Stores the choice and reloads the same address, which the proxy now serves in that language. */
export function chooseLanguage(lang: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${lang}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
  window.location.reload();
}

/**
 * EN / FR / RW. The address stays the same: choosing a language stores it (a cookie, for a year)
 * and reloads the page, so everything on it, the page title and `<html lang>` included, switches
 * at once. A disclosure (button + list): Escape or a click outside closes it, Escape returns focus
 * to the button. Each option is announced in its own language (`lang`).
 */
export function LanguageSwitcher({ lang, className }: { lang: Locale; className?: string }) {
  const t = dictionary(lang).shell;
  const [open, setOpen] = useState(false);
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    }
    function onPointerDown(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div ref={root} className={cx("relative", className)}>
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        // Starts with the visible code (WCAG 2.5.3, label in name): "EN, Language: English".
        aria-label={`${LOCALE_LABELS[lang].short}, ${t.language}: ${LOCALE_LABELS[lang].name}`}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-11 items-center gap-1 rounded-control px-2.5 text-sm font-medium text-fg transition-colors hover:bg-raised"
      >
        {LOCALE_LABELS[lang].short}
        <ChevronDownIcon className={cx("size-4 transition-transform", open ? "rotate-180" : "")} />
      </button>
      <ul
        id={listId}
        hidden={!open}
        className="absolute right-0 z-(--z-overlay) mt-1 w-44 rounded-card border border-border bg-overlay p-1 shadow-overlay"
      >
        {LOCALES.map((locale) => {
          const active = locale === lang;
          return (
            <li key={locale}>
              <button
                type="button"
                lang={locale}
                aria-pressed={active}
                onClick={() => (active ? setOpen(false) : chooseLanguage(locale))}
                className={cx(
                  "flex min-h-10 w-full items-center justify-between gap-3 rounded-control px-3 text-sm transition-colors hover:bg-raised",
                  active ? "font-medium text-fg" : "text-muted hover:text-fg",
                )}
              >
                <span className="flex items-center gap-2">
                  <span className="w-6 text-left text-xs font-semibold" aria-hidden="true">
                    {LOCALE_LABELS[locale].short}
                  </span>
                  {LOCALE_LABELS[locale].name}
                </span>
                {active ? <CheckCircleIcon className="size-4" /> : null}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
