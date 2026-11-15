/**
 * Registry of every design token defined in src/app/globals.css, with its purpose.
 *
 * Values live only in globals.css; this file names them. src/app/tokens.test.ts fails if a
 * token is added to or removed from either place without the other, so the styleguide
 * (/styleguide, development only) always documents the complete, real token set.
 */

export type TokenGroupId =
  | "surface"
  | "border"
  | "text"
  | "accent"
  | "focus"
  | "status"
  | "font"
  | "type"
  | "radius"
  | "spacing"
  | "layout"
  | "shadow"
  | "motion"
  | "layer";

export type Token = {
  /** CSS custom property, e.g. "--color-card". */
  name: `--${string}`;
  purpose: string;
};

export type TokenGroup = {
  id: TokenGroupId;
  title: string;
  tokens: readonly Token[];
};

export const tokenGroups: readonly TokenGroup[] = [
  {
    id: "surface",
    title: "Surfaces",
    tokens: [
      { name: "--color-canvas", purpose: "Page background" },
      { name: "--color-surface", purpose: "Sections and footer" },
      { name: "--color-card", purpose: "Cards and form panels" },
      { name: "--color-raised", purpose: "Hovered or raised elements" },
      { name: "--color-overlay", purpose: "Menus, popovers and dialogs" },
      { name: "--color-backdrop", purpose: "Dims the page behind modal dialogs" },
    ],
  },
  {
    id: "border",
    title: "Borders and dividers",
    tokens: [
      { name: "--color-border", purpose: "Default borders and dividers" },
      { name: "--color-border-strong", purpose: "Inputs and emphasised borders" },
    ],
  },
  {
    id: "text",
    title: "Text",
    tokens: [
      { name: "--color-fg", purpose: "Primary text" },
      { name: "--color-muted", purpose: "Secondary text (AA on every surface)" },
      { name: "--color-subtle", purpose: "Decorative only; fails AA as text" },
    ],
  },
  {
    id: "accent",
    title: "Accent",
    tokens: [
      { name: "--color-accent", purpose: "Primary actions and links" },
      { name: "--color-accent-hover", purpose: "Hover state of accent elements" },
      { name: "--color-accent-ink", purpose: "Text on accent backgrounds" },
      { name: "--color-accent-soft", purpose: "Tinted accent backgrounds" },
    ],
  },
  {
    id: "focus",
    title: "Focus and interaction",
    tokens: [
      { name: "--color-focus", purpose: "Focus ring colour" },
      { name: "--focus-ring-width", purpose: "Focus ring thickness" },
      { name: "--focus-ring-offset", purpose: "Gap between element and focus ring" },
    ],
  },
  {
    id: "status",
    title: "Status",
    tokens: [
      { name: "--color-success", purpose: "Success icons and indicators" },
      { name: "--color-success-fg", purpose: "Success text" },
      { name: "--color-success-soft", purpose: "Success backgrounds" },
      { name: "--color-danger", purpose: "Destructive actions and error indicators" },
      { name: "--color-danger-fg", purpose: "Error text" },
      { name: "--color-danger-soft", purpose: "Error backgrounds" },
      { name: "--color-danger-strong", purpose: "Filled destructive buttons" },
      { name: "--color-danger-strong-hover", purpose: "Hover state of destructive buttons" },
      { name: "--color-warning", purpose: "Warning text, icons and badges" },
      { name: "--color-warning-soft", purpose: "Warning backgrounds" },
    ],
  },
  {
    id: "font",
    title: "Font families",
    tokens: [
      { name: "--font-display", purpose: "Headings (Plus Jakarta Sans 600/700/800)" },
      { name: "--font-sans", purpose: "Body and UI text (Inter, variable)" },
      { name: "--font-mono", purpose: "Labels and code (JetBrains Mono 400/500)" },
    ],
  },
  {
    id: "type",
    title: "Type scale",
    tokens: [
      { name: "--text-display", purpose: "Page headings, 50px" },
      { name: "--text-title", purpose: "Section headings, 28px" },
      { name: "--text-body", purpose: "Lead and body copy, 18px" },
    ],
  },
  {
    id: "radius",
    title: "Radii",
    tokens: [
      { name: "--radius-control", purpose: "Buttons, inputs and tags" },
      { name: "--radius-card", purpose: "Cards, panels and dialogs" },
      { name: "--radius-pill", purpose: "Pills and status badges" },
    ],
  },
  {
    id: "spacing",
    title: "Spacing",
    tokens: [
      {
        name: "--spacing",
        purpose: "Base unit, 0.25rem (4px). Every spacing utility is a multiple of it; see the scale",
      },
    ],
  },
  {
    id: "layout",
    title: "Layout",
    tokens: [
      { name: "--breakpoint-sm", purpose: "640px" },
      { name: "--breakpoint-md", purpose: "768px" },
      { name: "--breakpoint-lg", purpose: "1024px" },
      { name: "--breakpoint-xl", purpose: "1280px" },
      { name: "--breakpoint-2xl", purpose: "1536px" },
      { name: "--container-page", purpose: "Maximum page width, 1152px" },
    ],
  },
  {
    id: "shadow",
    title: "Elevation",
    tokens: [
      { name: "--shadow-raised", purpose: "Slightly lifted elements" },
      { name: "--shadow-overlay", purpose: "Menus, popovers and dialogs" },
    ],
  },
  {
    id: "motion",
    title: "Motion",
    tokens: [
      { name: "--ease-standard", purpose: "Entering and changing elements" },
      { name: "--ease-exit", purpose: "Leaving elements" },
      { name: "--default-transition-duration", purpose: "Default for transition utilities" },
      { name: "--default-transition-timing-function", purpose: "Default easing (standard)" },
      { name: "--duration-fast", purpose: "Hover and colour changes, 150ms" },
      { name: "--duration-normal", purpose: "Menus and small overlays, 200ms" },
      { name: "--duration-slow", purpose: "Dialogs and larger transitions, 300ms" },
    ],
  },
  {
    id: "layer",
    title: "Layers",
    tokens: [
      { name: "--z-header", purpose: "Sticky site header" },
      { name: "--z-overlay", purpose: "Menus, dialogs and their backdrops" },
      { name: "--z-toast", purpose: "Notifications, above dialogs" },
      { name: "--z-skip-link", purpose: "Skip link, above everything when focused" },
    ],
  },
];

export const allTokens: readonly Token[] = tokenGroups.flatMap((group) => group.tokens);

/** Size of one `--spacing` unit in CSS pixels (0.25rem at the default 16px root size). */
export const SPACING_UNIT_PX = 4;

export type SpacingRole = "none" | "hairline" | "control" | "component" | "group" | "section";

export type SpacingStep = {
  /** The Tailwind utility suffix, as in `p-4`, `gap-1.5` or `mt-px`. */
  step: string;
  /** Rendered size: `step` x SPACING_UNIT_PX, or 1 for the `px` hairline. */
  px: number;
  role: SpacingRole;
};

/**
 * The approved spacing steps for padding, margin, gap and space utilities, enforced by
 * src/design/spacing-usage.test.ts. A 4px grid: half steps only inside small controls (badges,
 * fields, icon alignment), whole steps for components, groups and page sections. Add a step here
 * deliberately, never ad hoc in a component.
 */
export const spacingScale: readonly SpacingStep[] = [
  { step: "0", px: 0, role: "none" },
  { step: "px", px: 1, role: "hairline" },
  { step: "0.5", px: 2, role: "control" },
  { step: "1", px: 4, role: "control" },
  { step: "1.5", px: 6, role: "control" },
  { step: "2", px: 8, role: "control" },
  { step: "2.5", px: 10, role: "control" },
  { step: "3", px: 12, role: "control" },
  { step: "3.5", px: 14, role: "control" },
  { step: "4", px: 16, role: "component" },
  { step: "5", px: 20, role: "component" },
  { step: "6", px: 24, role: "component" },
  { step: "8", px: 32, role: "group" },
  { step: "10", px: 40, role: "group" },
  { step: "12", px: 48, role: "group" },
  { step: "14", px: 56, role: "section" },
  { step: "16", px: 64, role: "section" },
  { step: "20", px: 80, role: "section" },
  { step: "24", px: 96, role: "section" },
];
