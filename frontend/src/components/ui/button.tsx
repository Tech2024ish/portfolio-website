import type { ComponentPropsWithRef, ReactNode } from "react";

import { cx } from "@/lib/cx";

import { Spinner } from "./feedback";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded-control font-medium transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:opacity-50 aria-busy:cursor-progress";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-accent-hover active:bg-accent",
  secondary: "border border-border-strong bg-card text-fg hover:bg-raised active:bg-card",
  outline: "border border-accent/60 text-fg hover:border-accent hover:bg-accent-soft",
  ghost: "text-muted hover:bg-raised hover:text-fg",
  danger: "bg-danger-strong text-fg hover:bg-danger-strong-hover",
};

const sizes: Record<ButtonSize, string> = {
  // 44px minimum touch target on md, per WCAG 2.5.8 guidance for primary actions.
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-[0.9375rem]",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md") {
  return `${base} ${variants[variant]} ${sizes[size]}`;
}

type ButtonProps = ComponentPropsWithRef<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
};

/**
 * While `loading`, the button is aria-disabled rather than natively disabled: a natively disabled
 * button drops keyboard focus (to <body>, or out of a dialog), so the person who pressed it
 * would lose their place. Activation is ignored instead: the caller's onClick is not attached and
 * the button is rendered as type="button", so it cannot submit its form.
 * Button attaches no event handler of its own, so Server Components can render it.
 */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  type = "button",
  onClick,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={loading ? "button" : type}
      disabled={disabled}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      onClick={loading ? undefined : onClick}
      className={cx(buttonClasses(variant, size), className)}
      {...rest}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}
