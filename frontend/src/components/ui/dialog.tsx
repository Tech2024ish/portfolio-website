"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";

import { cx } from "@/lib/cx";

import { Button } from "./button";
import { CloseIcon } from "./icons";
import { useToastHost } from "./toast";

/**
 * Modal dialog on the native <dialog> element (showModal): the browser makes the rest of the
 * page inert, keeps focus inside, renders the backdrop and turns Escape into a cancel event.
 * This component adds the rest of the dialog contract:
 * - it is controlled: `open` is the single source of truth; Escape, the close button and
 *   backdrop clicks all request closing through `onClose`;
 * - focus returns to the element that opened it;
 * - page scrolling is locked while it, or any other dialog, is open;
 * - title and description are wired with aria-labelledby / aria-describedby;
 * - toasts raised while it is open appear inside it, because everything outside a modal dialog
 *   is inert (hidden from assistive technology and unreachable); see toast.tsx.
 * Initial focus goes to `initialFocus` when given, otherwise to the first focusable element.
 */

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Action buttons, right-aligned at the bottom. */
  footer?: ReactNode;
  /** When false, Escape, the backdrop and the close button cannot close the dialog. */
  dismissible?: boolean;
  size?: "sm" | "md" | "lg";
  /** Element to focus when the dialog opens (React's autoFocus fires before showModal). */
  initialFocus?: RefObject<HTMLElement | null>;
};

const sizes = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };

// Page scrolling stays locked while any dialog is open, so closing a nested dialog does not
// unlock the page under the dialog that is still open.
let scrollLocks = 0;

function lockScroll() {
  scrollLocks += 1;
  document.documentElement.style.overflow = "hidden";
}

function unlockScroll() {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks === 0) document.documentElement.style.overflow = "";
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  dismissible = true,
  size = "md",
  initialFocus,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  // Whether this dialog currently holds one of the page's scroll locks.
  const holdsScrollLock = useRef(false);
  // Whether the current press started on the backdrop (see onClick).
  const pressedBackdrop = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const toastHost = useRef<HTMLDivElement>(null);
  const registerToastHost = useToastHost();

  // Layout effects, so the modal state and the toast host change in the same commit (see
  // ToastProvider: a toast raised while closing must go to the page, not to this dialog).
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      initialFocus?.current?.focus();
      if (!holdsScrollLock.current) {
        holdsScrollLock.current = true;
        lockScroll();
      }
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open, initialFocus]);

  useLayoutEffect(() => {
    if (!open || !registerToastHost || !toastHost.current) return;
    return registerToastHost(toastHost.current);
  }, [open, registerToastHost]);

  function releaseScrollLock() {
    if (!holdsScrollLock.current) return;
    holdsScrollLock.current = false;
    unlockScroll();
  }

  // If the dialog unmounts while open, still release its scroll lock.
  useEffect(() => releaseScrollLock, []);

  function handleClosed() {
    releaseScrollLock();
    const target = returnFocus.current;
    returnFocus.current = null;
    if (target?.isConnected) target.focus();
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        // Escape: keep the element open until the owner of `open` decides.
        event.preventDefault();
        if (dismissible) onClose();
      }}
      onClose={handleClosed}
      onPointerDown={(event) => {
        pressedBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        // A click whose target is the <dialog> itself landed on the backdrop. Both the press and
        // the release must be there: a drag that starts inside (e.g. selecting text in a field)
        // and ends over the backdrop must not close the dialog and lose what was typed.
        const onBackdrop = event.target === event.currentTarget && pressedBackdrop.current;
        pressedBackdrop.current = false;
        if (dismissible && onBackdrop) onClose();
      }}
      className={cx(
        "m-auto w-[calc(100%-2rem)] rounded-card border border-border-strong bg-card p-0 text-fg shadow-overlay backdrop:bg-backdrop",
        sizes[size],
      )}
    >
      <div className="flex flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <h2 id={titleId} className="font-display text-lg font-semibold">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="text-sm text-muted">
                {description}
              </p>
            ) : null}
          </div>
          {dismissible ? (
            <button
              type="button"
              aria-label="Close dialog"
              onClick={onClose}
              className="-m-1 inline-flex size-9 shrink-0 items-center justify-center rounded-control text-muted transition-colors hover:bg-raised hover:text-fg"
            >
              <CloseIcon className="size-5" />
            </button>
          ) : null}
        </div>
        {children}
        {footer ? (
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">{footer}</div>
        ) : null}
      </div>
      <div ref={toastHost} />
    </dialog>
  );
}

type ConfirmDialogProps = {
  open: boolean;
  title: ReactNode;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" for destructive actions: red confirm button, and Cancel receives initial focus. */
  tone?: "default" | "danger";
  /** May be async. While it runs the dialog shows progress and cannot be dismissed. */
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
};

/**
 * Asks before an action that is destructive or hard to undo. For destructive actions the safe
 * choice (Cancel) receives initial focus, so pressing Enter by reflex never deletes anything;
 * otherwise the confirm button does.
 * If `onConfirm` throws, the dialog stays open so the caller can report the failure.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  async function confirm() {
    setPending(true);
    try {
      await onConfirm();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      dismissible={!pending}
      size="sm"
      initialFocus={tone === "danger" ? cancelRef : confirmRef}
      footer={
        <>
          <Button ref={cancelRef} variant="secondary" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={confirm}
            loading={pending}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
