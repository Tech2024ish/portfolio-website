"use client";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { cx } from "@/lib/cx";

import type { Tone } from "./feedback";
import { CheckCircleIcon, CloseIcon, ErrorIcon, InfoIcon, WarningIcon } from "./icons";

/**
 * Toast notifications: brief, non-blocking confirmations ("Project saved").
 *
 * - Live regions exist before any toast appears, so screen readers announce new toasts
 *   reliably: polite for info/success/warning, assertive for danger.
 * - While a modal dialog is open, everything outside it is inert: hidden from assistive
 *   technology and unreachable. Each open Dialog therefore registers a toast host inside itself
 *   (see `useToastHost`), with its own live regions, and toasts raised while it is open appear
 *   there. A toast raised in the same update that closes a dialog goes to the page, not to the
 *   closing dialog. When a dialog closes, toasts still showing in it move to the page outside
 *   the live regions, so they stay visible without being announced twice.
 * - Toasts dismiss themselves after `duration` ms (0 = until dismissed), pausing while the
 *   pointer or keyboard focus is on them, and always offer a dismiss button.
 * - Text is rendered as text, never as HTML.
 * - Never the only place an error is reported: forms keep their inline errors.
 */

export type ToastInput = {
  title: string;
  description?: string;
  tone?: Tone;
  /** Milliseconds before auto-dismissal. Defaults to 6000; 0 keeps the toast until dismissed. */
  duration?: number;
};

/** Where a toast is shown: not yet decided, the page, an open dialog, or carried to the page. */
type Placement = undefined | null | HTMLElement | "carried";

type ToastEntry = Required<Pick<ToastInput, "title" | "tone" | "duration">> &
  Pick<ToastInput, "description"> & { id: number; placement: Placement };

const MAX_VISIBLE = 3;
const DEFAULT_DURATION = 6000;

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);
const ToastHostContext = createContext<((host: HTMLElement) => () => void) | null>(null);

/** Returns `toast(input)`. Must be used inside a ToastProvider. */
export function useToast(): (toast: ToastInput) => void {
  const toast = use(ToastContext);
  if (!toast) throw new Error("useToast must be used inside a ToastProvider");
  return toast;
}

/**
 * For modal containers (Dialog): returns `register(element)`, which shows toasts inside that
 * element until the returned function is called, or null outside a ToastProvider. Register while
 * the modal is open, from a layout effect.
 */
export function useToastHost(): ((host: HTMLElement) => () => void) | null {
  return use(ToastHostContext);
}

const toneIcon = { info: InfoIcon, success: CheckCircleIcon, warning: WarningIcon, danger: ErrorIcon };
const toneColour = {
  info: "text-accent",
  success: "text-success-fg",
  warning: "text-warning",
  danger: "text-danger-fg",
};

const viewportClasses =
  "pointer-events-none fixed inset-x-4 bottom-4 z-(--z-toast) flex flex-col gap-2 sm:inset-x-auto sm:right-4 sm:w-96";

function ToastItem({ entry, onDismiss }: { entry: ToastEntry; onDismiss: (id: number) => void }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(entry.duration);
  const startedAt = useRef(0);

  useEffect(() => {
    if (entry.duration === 0 || paused) return;
    startedAt.current = Date.now();
    const timer = setTimeout(() => onDismiss(entry.id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - startedAt.current;
    };
  }, [entry.duration, entry.id, onDismiss, paused]);

  const Icon = toneIcon[entry.tone];
  return (
    <div
      className="pointer-events-auto flex gap-3 rounded-card border border-border-strong bg-overlay p-4 text-sm shadow-overlay"
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false);
      }}
    >
      <Icon className={cx("mt-0.5 size-4", toneColour[entry.tone])} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="font-semibold text-fg">{entry.title}</p>
        {entry.description ? <p className="text-muted">{entry.description}</p> : null}
      </div>
      <button
        type="button"
        aria-label={`Dismiss notification: ${entry.title}`}
        onClick={() => onDismiss(entry.id)}
        className="-m-1 inline-flex size-8 shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:bg-raised hover:text-fg"
      >
        <CloseIcon className="size-4" />
      </button>
    </div>
  );
}

function LiveRegions({ entries, onDismiss }: { entries: ToastEntry[]; onDismiss: (id: number) => void }) {
  return (
    <>
      <div aria-live="polite" aria-atomic="false" className="flex flex-col gap-2">
        {entries
          .filter((entry) => entry.tone !== "danger")
          .map((entry) => (
            <ToastItem key={entry.id} entry={entry} onDismiss={onDismiss} />
          ))}
      </div>
      <div aria-live="assertive" aria-atomic="false" className="flex flex-col gap-2">
        {entries
          .filter((entry) => entry.tone === "danger")
          .map((entry) => (
            <ToastItem key={entry.id} entry={entry} onDismiss={onDismiss} />
          ))}
      </div>
    </>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(0);
  // Open modal hosts, innermost last. The ref is current within a commit (registration happens
  // in layout effects); the state drives rendering of each host's live regions.
  const hostsRef = useRef<HTMLElement[]>([]);
  const [hosts, setHosts] = useState<HTMLElement[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback((input: ToastInput) => {
    nextId.current += 1;
    const entry: ToastEntry = {
      id: nextId.current,
      title: input.title,
      description: input.description,
      tone: input.tone ?? "info",
      duration: input.duration ?? DEFAULT_DURATION,
      placement: undefined,
    };
    setToasts((current) => [...current, entry].slice(-MAX_VISIBLE));
  }, []);

  const registerHost = useCallback((host: HTMLElement) => {
    hostsRef.current = [...hostsRef.current, host];
    setHosts(hostsRef.current);
    return () => {
      hostsRef.current = hostsRef.current.filter((element) => element !== host);
      setHosts(hostsRef.current);
      setToasts((current) =>
        current.map((entry) => (entry.placement === host ? { ...entry, placement: "carried" } : entry)),
      );
    };
  }, []);

  // Place new toasts once this commit's dialogs have opened or closed. Layout effects run
  // children first, so a Dialog closing in this commit has already unregistered its host.
  useLayoutEffect(() => {
    if (!toasts.some((entry) => entry.placement === undefined)) return;
    const top = hostsRef.current.at(-1);
    // A host registered in this commit has no live regions in the DOM yet; wait one render so
    // the toast is added to an existing live region and announced.
    if (top && !hosts.includes(top)) return;
    setToasts((current) =>
      current.map((entry) => (entry.placement === undefined ? { ...entry, placement: top ?? null } : entry)),
    );
  }, [toasts, hosts]);

  const carried = toasts.filter((entry) => entry.placement === "carried");

  return (
    <ToastContext value={toast}>
      <ToastHostContext value={registerHost}>
        {children}
        <section aria-label="Notifications" className={viewportClasses}>
          {carried.length > 0 ? (
            // Already announced inside a dialog that has since closed: visible, not re-announced.
            <div className="flex flex-col gap-2">
              {carried.map((entry) => (
                <ToastItem key={entry.id} entry={entry} onDismiss={dismiss} />
              ))}
            </div>
          ) : null}
          <LiveRegions entries={toasts.filter((entry) => entry.placement === null)} onDismiss={dismiss} />
        </section>
        {hosts.map((host, index) =>
          createPortal(
            <div className={viewportClasses}>
              <LiveRegions entries={toasts.filter((entry) => entry.placement === host)} onDismiss={dismiss} />
            </div>,
            host,
            `toast-host-${index}`,
          ),
        )}
      </ToastHostContext>
    </ToastContext>
  );
}
