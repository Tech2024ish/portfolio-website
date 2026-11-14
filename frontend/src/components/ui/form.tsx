import { useId, type ComponentPropsWithRef, type ReactNode } from "react";

import { cx } from "@/lib/cx";

import { ChevronDownIcon } from "./icons";

/**
 * Form primitives. Every control is a native element (so browsers, autofill and assistive
 * technology work unchanged) styled from the design tokens. `Field` wires the label, hint,
 * error and any extra description to the control, so accessible names and descriptions cannot
 * be forgotten.
 */

export const controlClasses =
  "w-full rounded-control border border-border-strong bg-surface px-3.5 py-2.5 text-base text-fg " +
  "placeholder:text-muted transition-colors hover:border-accent/50 focus-visible:border-accent " +
  "aria-invalid:border-danger-fg disabled:cursor-not-allowed disabled:opacity-60";

export function Label({ className, ...props }: ComponentPropsWithRef<"label">) {
  return <label className={cx("text-sm font-medium text-fg", className)} {...props} />;
}

export function Input({ className, ...props }: ComponentPropsWithRef<"input">) {
  return <input className={cx(controlClasses, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentPropsWithRef<"textarea">) {
  return <textarea className={cx(controlClasses, "min-h-36 resize-y", className)} {...props} />;
}

/** A native select with a token-styled chevron; the chevron is decorative. */
export function Select({ className, children, ...props }: ComponentPropsWithRef<"select">) {
  return (
    <div className="relative">
      <select className={cx(controlClasses, "appearance-none pr-10", className)} {...props}>
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" />
    </div>
  );
}

export function FieldError({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} className="text-sm text-danger-fg">
      {children}
    </p>
  );
}

/** Props `Field` hands to its control. Spread them onto Input, Textarea or Select. */
export type FieldControlProps = {
  id: string;
  required?: boolean;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
};

type FieldProps = {
  label: ReactNode;
  /** Defaults to a generated id. Pass one when other code must find the control. */
  id?: string;
  /** Shown below the control and announced as part of its description. */
  hint?: ReactNode;
  /** Validation message. Marks the control invalid and is announced first. */
  error?: ReactNode;
  /** Right-aligned description below the control, such as a character counter. */
  aside?: ReactNode;
  required?: boolean;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
};

export function Field({ label, id, hint, error, aside, required, className, children }: FieldProps) {
  const generated = useId();
  const controlId = id ?? generated;
  const errorId = `${controlId}-error`;
  const hintId = `${controlId}-hint`;
  const asideId = `${controlId}-aside`;
  const describedBy = [error ? errorId : null, hint ? hintId : null, aside ? asideId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cx("flex flex-col gap-2", className)}>
      <Label htmlFor={controlId}>{label}</Label>
      {children({
        id: controlId,
        required: required || undefined,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy || undefined,
      })}
      {error || hint || aside ? (
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <FieldError id={errorId}>{error}</FieldError>
            {hint ? (
              <p id={hintId} className="text-sm text-muted">
                {hint}
              </p>
            ) : null}
          </div>
          {aside ? (
            <p id={asideId} className="ml-auto shrink-0 font-mono text-xs text-muted">
              {aside}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
