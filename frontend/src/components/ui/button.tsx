import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-2 rounded-control font-medium transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent " +
  "disabled:cursor-not-allowed disabled:opacity-50 aria-busy:cursor-progress";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-accent-hover active:bg-accent",
  secondary: "border border-border-strong bg-card text-fg hover:bg-raised active:bg-card",
  outline: "border border-accent/60 text-fg hover:border-accent hover:bg-accent-soft",
  ghost: "text-muted hover:bg-raised hover:text-fg",
  danger: "bg-danger text-fg hover:bg-danger/85",
};

const sizes: Record<ButtonSize, string> = {
  // 44px minimum touch target on md, per WCAG 2.5.8 guidance for primary actions.
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-[0.9375rem]",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md") {
  return `${base} ${variants[variant]} ${sizes[size]}`;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={className ? `${buttonClasses(variant, size)} ${className}` : buttonClasses(variant, size)}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      ) : null}
      {children}
    </button>
  );
}
