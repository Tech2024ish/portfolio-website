/**
 * The Studio's description of every editable content type. Field names and limits mirror the
 * FastAPI schemas (backend/app/schemas/content.py), which remain the authority: the server
 * validates everything again and its field errors are shown next to these fields.
 *
 * Pure and shared by Server Components (initial values) and the client editor (payloads).
 */

export type FieldKind =
  | "text" // one line
  | "textarea" // free text, may span lines
  | "lines" // a list: one item per line
  | "paragraphs" // a list: paragraphs separated by a blank line
  | "pairs" // a list of objects: one per line, values separated by " | "
  | "checkbox"
  | "month" // YYYY-MM
  | "date" // YYYY-MM-DD
  | "url"
  | "select"
  | "body"; // a note's body (see src/lib/content/body.ts)

export type FieldSpec = {
  name: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  /** Empty means null (optional single values). */
  nullable?: boolean;
  help?: string;
  maxLength?: number;
  /** For "select": fixed options, or the name of options supplied by the page (`choices`). */
  options?: { value: string; label: string }[];
  choices?: string;
  /** For "pairs": the object keys, in column order; numeric keys are converted. */
  keys?: string[];
  numericKeys?: string[];
  /**
   * Offers "Choose from library": `set` puts the image's address in the field, `append` adds a
   * line "address | alt text | width | height" (for the "pairs" image list).
   */
  picker?: "set" | "append";
  /** With `set`: a field that receives the image's alt text when it is still empty. */
  pickerAlt?: string;
  /** For "select": the value is sent as a number. */
  numeric?: boolean;
  /** Groups fields under a heading in the editor. */
  group?: string;
};

export type CollectionSpec = {
  key: string;
  label: string;
  singular: string;
  publishable: boolean;
  /** The field that names an item in lists and messages. */
  titleField: string;
  /** Shown next to the title in lists. */
  subtitleField?: string;
  fields: FieldSpec[];
  /** Public page of a published item, for "View on site". */
  publicPath?: (item: OwnerItem) => string | null;
  previewable?: boolean;
};

export type OwnerItem = Record<string, unknown> & {
  id: number;
  version: number;
  position: number;
  updated_at: string;
  status?: "draft" | "published";
  published_at?: string | null;
};

export type FormValues = Record<string, string | boolean>;

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft (not shown)" },
  { value: "published", label: "Published" },
];

const ICON_HELP = "One per line: title | text | icon (architecture, database, api or quality).";

export const PROFILE_SPEC: CollectionSpec = {
  key: "profile",
  label: "Profile",
  singular: "profile",
  publishable: false,
  titleField: "name",
  fields: [
    { name: "name", label: "Name", kind: "text", required: true, maxLength: 100, group: "Identity" },
    { name: "initials", label: "Initials", kind: "text", required: true, maxLength: 4, group: "Identity" },
    {
      name: "title",
      label: "Professional title",
      kind: "text",
      required: true,
      maxLength: 120,
      group: "Identity",
    },
    { name: "location", label: "Location", kind: "text", required: true, maxLength: 120, group: "Identity" },
    {
      name: "availability",
      label: "Availability",
      kind: "text",
      required: true,
      maxLength: 120,
      group: "Identity",
    },
    { name: "email", label: "Public email", kind: "text", required: true, maxLength: 254, group: "Identity" },
    { name: "headline", label: "Headline", kind: "text", required: true, maxLength: 200, group: "Home page" },
    {
      name: "summary",
      label: "Summary",
      kind: "textarea",
      required: true,
      maxLength: 600,
      group: "Home page",
    },
    {
      name: "about_lead",
      label: "About: lead",
      kind: "textarea",
      required: true,
      maxLength: 600,
      group: "About",
    },
    {
      name: "about_body",
      label: "About: paragraphs",
      kind: "paragraphs",
      help: "Separate paragraphs with a blank line.",
      group: "About",
    },
    {
      name: "principles",
      label: "Principles",
      kind: "pairs",
      keys: ["title", "body", "icon"],
      help: ICON_HELP,
      group: "About",
    },
    {
      name: "contact_intro",
      label: "Contact introduction",
      kind: "textarea",
      required: true,
      maxLength: 600,
      group: "Contact",
    },
    {
      name: "social",
      label: "Social links",
      kind: "pairs",
      keys: ["label", "href"],
      help: "One per line: label | https address. The site shows GitHub and LinkedIn.",
      group: "Contact",
    },
    {
      name: "cv_href",
      label: "CV file",
      kind: "text",
      required: true,
      help: "A site path such as /Resume.pdf, or an https address.",
      group: "Files",
    },
    {
      name: "portrait_src",
      label: "Portrait image",
      kind: "text",
      required: true,
      help: "Choose from the media library, or enter a site path such as /portrait.png.",
      picker: "set",
      pickerAlt: "portrait_alt",
      group: "Files",
    },
    {
      name: "portrait_alt",
      label: "Portrait description (alt text)",
      kind: "text",
      required: true,
      maxLength: 200,
      group: "Files",
    },
  ],
};

export const SETTINGS_SPEC: CollectionSpec = {
  key: "settings",
  label: "Settings",
  singular: "settings",
  publishable: false,
  titleField: "seo_title",
  fields: [
    {
      name: "seo_title",
      label: "Default page title",
      kind: "text",
      required: true,
      maxLength: 70,
      help: "Shown by search engines and when the home page is shared. Up to 70 characters.",
      group: "Search and sharing",
    },
    {
      name: "seo_description",
      label: "Default description",
      kind: "textarea",
      required: true,
      maxLength: 200,
      help: "One or two sentences, 50 to 200 characters. Pages with their own description use that.",
      group: "Search and sharing",
    },
    { name: "show_skills", label: "Show the Skills section", kind: "checkbox", group: "Home page" },
    {
      name: "show_experience",
      label: "Show Experience, education and certifications",
      kind: "checkbox",
      group: "Home page",
    },
    {
      name: "home_project_count",
      label: "Projects on the home page",
      kind: "select",
      numeric: true,
      options: [1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: String(n) })),
      help: "Featured projects first. All published projects are on the Projects page.",
      group: "Home page",
    },
    { name: "show_cv_download", label: "Offer the CV download", kind: "checkbox", group: "Contact" },
    {
      name: "show_contact_form",
      label: "Accept messages through the contact form",
      kind: "checkbox",
      help: "Off: the form is hidden and the server refuses messages; your email stays visible.",
      group: "Contact",
    },
  ],
};

export const COLLECTIONS: CollectionSpec[] = [
  {
    key: "projects",
    label: "Projects",
    singular: "project",
    publishable: true,
    titleField: "title",
    subtitleField: "category",
    previewable: true,
    publicPath: (item) => (item.status === "published" ? `/projects/${String(item.slug)}` : null),
    fields: [
      { name: "title", label: "Title", kind: "text", required: true, maxLength: 150, group: "Card" },
      {
        name: "slug",
        label: "Address (slug)",
        kind: "text",
        required: true,
        maxLength: 80,
        help: "Lowercase letters, digits and hyphens: /projects/<slug>.",
        group: "Card",
      },
      { name: "category", label: "Category", kind: "text", required: true, maxLength: 80, group: "Card" },
      { name: "summary", label: "Summary", kind: "textarea", required: true, maxLength: 600, group: "Card" },
      { name: "tech", label: "Technologies", kind: "lines", help: "One per line.", group: "Card" },
      { name: "featured", label: "Feature on the home page", kind: "checkbox", group: "Card" },
      { name: "repo_url", label: "Repository URL", kind: "url", nullable: true, group: "Card" },
      { name: "live_url", label: "Live URL", kind: "url", nullable: true, group: "Card" },
      {
        name: "case_study_status",
        label: "Case study",
        kind: "select",
        options: STATUS_OPTIONS,
        help: "The case study is shown only when this is Published and the project is published.",
        group: "Case study",
      },
      {
        name: "overview",
        label: "Overview",
        kind: "paragraphs",
        help: "Separate paragraphs with a blank line.",
        group: "Case study",
      },
      {
        name: "problem",
        label: "Problem",
        kind: "textarea",
        nullable: true,
        maxLength: 2000,
        group: "Case study",
      },
      { name: "objectives", label: "Objectives", kind: "lines", group: "Case study" },
      {
        name: "approach",
        label: "Approach",
        kind: "textarea",
        nullable: true,
        maxLength: 2000,
        group: "Case study",
      },
      { name: "architecture", label: "Architecture", kind: "lines", group: "Case study" },
      {
        name: "decisions",
        label: "Engineering decisions",
        kind: "pairs",
        keys: ["title", "detail"],
        help: "One per line: title | detail.",
        group: "Case study",
      },
      {
        name: "challenges",
        label: "Challenges",
        kind: "pairs",
        keys: ["challenge", "solution"],
        help: "One per line: challenge | solution.",
        group: "Case study",
      },
      {
        name: "outcomes",
        label: "Verified outcomes",
        kind: "lines",
        help: "Only results that have been verified.",
        group: "Case study",
      },
      { name: "scope_implemented", label: "Implemented today", kind: "lines", group: "Case study" },
      { name: "scope_not_yet", label: "Not implemented yet", kind: "lines", group: "Case study" },
      {
        name: "media",
        label: "Images",
        kind: "pairs",
        keys: ["src", "alt", "width", "height", "caption"],
        numericKeys: ["width", "height"],
        help: "One per line: path | alt text | width | height | caption (optional).",
        picker: "append",
        group: "Case study",
      },
      {
        name: "sources",
        label: "Sources (never shown)",
        kind: "lines",
        help: "Where the statements come from, for your own review.",
        group: "Case study",
      },
    ],
  },
  {
    key: "experiences",
    label: "Experience",
    singular: "role",
    publishable: true,
    titleField: "role",
    subtitleField: "organization",
    fields: [
      { name: "organization", label: "Organisation", kind: "text", required: true, maxLength: 150 },
      { name: "role", label: "Role", kind: "text", required: true, maxLength: 150 },
      { name: "location", label: "Location", kind: "text", nullable: true, maxLength: 120 },
      { name: "start_month", label: "Start", kind: "month", required: true },
      {
        name: "end_month",
        label: "End",
        kind: "month",
        nullable: true,
        help: "Leave empty for a current role.",
      },
      { name: "is_current", label: "Current role", kind: "checkbox" },
      { name: "highlights", label: "Highlights", kind: "lines", help: "One per line." },
    ],
  },
  {
    key: "education",
    label: "Education",
    singular: "education entry",
    publishable: true,
    titleField: "qualification",
    subtitleField: "institution",
    fields: [
      { name: "institution", label: "Institution", kind: "text", required: true, maxLength: 150 },
      { name: "qualification", label: "Qualification", kind: "text", required: true, maxLength: 150 },
      { name: "location", label: "Location", kind: "text", nullable: true, maxLength: 120 },
      {
        name: "status_label",
        label: "Status",
        kind: "text",
        nullable: true,
        maxLength: 80,
        help: "For example: In progress.",
      },
      { name: "start_month", label: "Start", kind: "month", nullable: true },
      { name: "end_month", label: "End", kind: "month", nullable: true },
      { name: "coursework", label: "Coursework", kind: "lines", help: "One per line." },
    ],
  },
  {
    key: "certifications",
    label: "Certifications",
    singular: "certification",
    publishable: true,
    titleField: "name",
    subtitleField: "issuer",
    fields: [
      { name: "name", label: "Name", kind: "text", required: true, maxLength: 150 },
      { name: "issuer", label: "Issuer", kind: "text", required: true, maxLength: 150 },
      { name: "issued_month", label: "Issued", kind: "month", nullable: true },
      { name: "credential_url", label: "Credential URL", kind: "url", nullable: true },
    ],
  },
  {
    key: "skill-categories",
    label: "Skill groups",
    singular: "skill group",
    publishable: false,
    titleField: "name",
    fields: [{ name: "name", label: "Name", kind: "text", required: true, maxLength: 80 }],
  },
  {
    key: "skills",
    label: "Skills",
    singular: "skill",
    publishable: false,
    titleField: "name",
    subtitleField: "category_id",
    fields: [
      { name: "name", label: "Name", kind: "text", required: true, maxLength: 80 },
      { name: "category_id", label: "Group", kind: "select", required: true, choices: "categories" },
      { name: "visible", label: "Show on the site", kind: "checkbox" },
    ],
  },
  {
    key: "articles",
    label: "Notes",
    singular: "note",
    publishable: true,
    titleField: "title",
    subtitleField: "category",
    previewable: true,
    publicPath: (item) => (item.status === "published" ? `/notes/${String(item.slug)}` : null),
    fields: [
      { name: "title", label: "Title", kind: "text", required: true, maxLength: 200 },
      {
        name: "slug",
        label: "Address (slug)",
        kind: "text",
        required: true,
        maxLength: 80,
        help: "/notes/<slug>.",
      },
      { name: "category", label: "Category", kind: "text", required: true, maxLength: 80 },
      { name: "summary", label: "Summary", kind: "textarea", required: true, maxLength: 600 },
      {
        name: "published_on",
        label: "Publication date",
        kind: "date",
        nullable: true,
        help: "Set automatically when you publish, if empty.",
      },
      {
        name: "body",
        label: "Body",
        kind: "body",
        maxLength: 100_000,
        help: "Blank lines separate paragraphs. “## ” starts a heading, “- ” a list item, ``` fences code.",
      },
    ],
  },
];

export function collectionSpec(key: string): CollectionSpec | undefined {
  return COLLECTIONS.find((spec) => spec.key === key);
}

/* ---- API values <-> form values ---- */

const SEPARATOR = " | ";

function toText(field: FieldSpec, value: unknown): string | boolean {
  switch (field.kind) {
    case "checkbox":
      return value === true;
    case "lines":
      return Array.isArray(value) ? value.join("\n") : "";
    case "paragraphs":
      return Array.isArray(value) ? value.join("\n\n") : "";
    case "pairs":
      return Array.isArray(value)
        ? value
            .map((row) =>
              (field.keys ?? [])
                .map((key) => {
                  const cell = (row as Record<string, unknown>)[key];
                  return cell === null || cell === undefined ? "" : String(cell);
                })
                .join(SEPARATOR)
                .replace(/( \| )+$/, ""),
            )
            .join("\n")
        : "";
    case "month":
      return typeof value === "string" ? value.slice(0, 7) : "";
    default:
      return value === null || value === undefined ? "" : String(value);
  }
}

/** Initial editor values: from an item, or defaults for a new one. */
export function toFormValues(spec: CollectionSpec, item: Record<string, unknown> | null): FormValues {
  const values: FormValues = {};
  for (const field of spec.fields) {
    let value = item?.[field.name];
    if (item === null) {
      if (field.name === "visible") value = true;
      if (field.name === "case_study_status") value = "draft";
    }
    values[field.name] = toText(field, value);
  }
  return values;
}

const nonEmptyLines = (text: string) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

function fromText(field: FieldSpec, value: string | boolean | undefined): unknown {
  if (field.kind === "checkbox") return value === true;
  const text = typeof value === "string" ? value : "";
  switch (field.kind) {
    case "lines":
      return nonEmptyLines(text);
    case "paragraphs":
      return text
        .split(/\r?\n\s*\r?\n/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean);
    case "pairs":
      return nonEmptyLines(text).map((line) => {
        const cells = line.split("|").map((cell) => cell.trim());
        const row: Record<string, unknown> = {};
        (field.keys ?? []).forEach((key, index) => {
          const cell = cells[index] ?? "";
          if (field.numericKeys?.includes(key)) row[key] = cell === "" ? null : Number(cell);
          else if (cell !== "" || index < 2) row[key] = cell;
        });
        return row;
      });
    case "select":
      if (field.choices) return text === "" ? null : Number(text);
      return field.numeric ? Number(text) : text;
    case "body":
      return text.replace(/\r\n?/g, "\n");
    default: {
      const trimmed = text.trim();
      if (trimmed === "" && field.nullable) return null;
      return field.kind === "textarea" ? text.replace(/\r\n?/g, "\n").trim() : trimmed;
    }
  }
}

/** The JSON the API expects for these form values (without `version`). */
export function fromFormValues(spec: CollectionSpec, values: FormValues): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const field of spec.fields) payload[field.name] = fromText(field, values[field.name]);
  return payload;
}

/** Which form field a server field error belongs to ("media.0.src" belongs to "media"). */
export function fieldOf(spec: CollectionSpec, path: string): string | null {
  const name = path.split(".")[0] ?? "";
  return spec.fields.some((field) => field.name === name) ? name : null;
}
