import type { ComponentPropsWithRef, ReactNode } from "react";

import { cx } from "@/lib/cx";

import { CheckCircleIcon, ErrorIcon, InboxIcon, InfoIcon, WarningIcon } from "./icons";

/**
 * Feedback primitives: inline alerts, loading indicators, and empty and error states.
 * All are Server-Component compatible; toast notifications (client-only) live in toast.tsx.
 */

export type Tone = "info" | "success" | "warning" | "danger";

const toneStyles: Record<Tone, { box: string; icon: string; Icon: typeof InfoIcon }> = {
  info: { box: "border-accent/40 bg-accent-soft", icon: "text-accent", Icon: InfoIcon },
  success: { box: "border-success/40 bg-success-soft", icon: "text-success-fg", Icon: CheckCircleIcon },
  warning: { box: "border-warning/40 bg-warning-soft", icon: "text-warning", Icon: WarningIcon },
  danger: { box: "border-danger-fg/40 bg-danger-soft", icon: "text-danger-fg", Icon: ErrorIcon },
};

type AlertProps = Omit<ComponentPropsWithRef<"div">, "title"> & {
  tone?: Tone;
  title?: ReactNode;
};

/**
 * An inline message. Danger alerts use role="alert" (announced immediately); other tones use
 * role="status" (announced politely). Pass `role` to override, e.g. for static notes.
 */
export function Alert({ tone = "info", title, className, role, children, ...props }: AlertProps) {
  const { box, icon, Icon } = toneStyles[tone];
  return (
    <div
      role={role ?? (tone === "danger" ? "alert" : "status")}
      className={cx("flex gap-3 rounded-control border px-4 py-3 text-sm text-fg", box, className)}
      {...props}
    >
      <Icon className={cx("mt-0.5 size-4", icon)} />
      <div className="flex min-w-0 flex-col gap-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children}
      </div>
    </div>
  );
}

type SpinnerProps = {
  /** When given, the spinner is announced as a status with this text; otherwise it is decorative. */
  label?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const spinnerSizes = { sm: "size-4 border-2", md: "size-6 border-2", lg: "size-10 border-[3px]" };

export function Spinner({ label, size = "sm", className }: SpinnerProps) {
  const ring = (
    <span
      aria-hidden="true"
      className={cx(
        "inline-block animate-spin rounded-full border-current border-r-transparent",
        spinnerSizes[size],
        className,
      )}
    />
  );
  if (!label) return ring;
  return (
    <span role="status" className="inline-flex items-center gap-2">
      {ring}
      <span className="sr-only">{label}</span>
    </span>
  );
}

type StateProps = {
  title: ReactNode;
  description?: ReactNode;
  /** A button or link offering the next step, e.g. "Create project" or "Try again". */
  action?: ReactNode;
  /** Heading level, so the state fits the surrounding document outline. */
  headingLevel?: 2 | 3 | 4;
  className?: string;
};

function StatePanel({
  title,
  description,
  action,
  headingLevel = 3,
  className,
  icon,
}: StateProps & { icon: ReactNode }) {
  const Heading = `h${headingLevel}` as const;
  return (
    <div
      className={cx(
        "flex flex-col items-center gap-3 rounded-card border border-dashed border-border-strong px-6 py-10 text-center",
        className,
      )}
    >
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-raised">{icon}</span>
      <Heading className="font-display text-lg font-semibold text-fg">{title}</Heading>
      {description ? <p className="max-w-md text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

/** Nothing to show yet (an empty list, no search results). Not an error. */
export function EmptyState(props: StateProps) {
  return <StatePanel {...props} icon={<InboxIcon className="size-6 text-muted" />} />;
}

/**
 * Content could not be loaded. Explains what happened in plain language and, where possible,
 * offers a way forward. Never shows raw error details.
 */
export function ErrorState(props: StateProps) {
  return <StatePanel {...props} icon={<ErrorIcon className="size-6 text-danger-fg" />} />;
}
