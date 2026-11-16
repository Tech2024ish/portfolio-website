/** Shapes returned by the FastAPI owner endpoints (`backend/app/schemas/auth.py`). */

export type OwnerProfile = { email: string; display_name: string };

/** The signed-in owner. `csrf_token` must accompany every state-changing request. */
export type OwnerSessionInfo = { user: OwnerProfile; csrf_token: string; expires_at: string };

export type SessionSummary = {
  id: number;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  ip_address: string | null;
  user_agent: string | null;
  current: boolean;
};

export type OwnerOverview = { messages: { new: number; read: number; archived: number } };

export type MessageStatus = "new" | "read" | "archived" | "spam";
export type DeliveryStatus = "pending" | "sending" | "sent" | "failed" | "skipped";

/** The inbox (`backend/app/schemas/inbox.py`). */
export type MessageSummary = {
  id: number;
  created_at: string;
  name: string;
  email: string;
  subject: string;
  snippet: string;
  status: MessageStatus;
  notification: DeliveryStatus | null;
};

export type MessagePage = { items: MessageSummary[]; total: number; page: number; page_size: number };

export type Delivery = {
  id: number;
  kind: "notification" | "reply";
  status: DeliveryStatus;
  recipient: string;
  subject: string;
  body: string;
  attempts: number;
  next_attempt_at: string | null;
  last_error: string | null;
  created_at: string;
  sent_at: string | null;
};

export type MessageDetail = {
  id: number;
  created_at: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: MessageStatus;
  spam_reason: string | null;
  read_at: string | null;
  deliveries: Delivery[];
  email_configured: boolean;
};

/** Inbox views, in tab order. "inbox" is new and read messages. */
export const MESSAGE_VIEWS = [
  { value: "inbox", label: "Inbox" },
  { value: "new", label: "Unread" },
  { value: "archived", label: "Archived" },
  { value: "spam", label: "Spam" },
  { value: "all", label: "All" },
] as const;

/** What each delivery status means, in words that never overstate what happened. */
export const DELIVERY_LABELS: Record<DeliveryStatus, string> = {
  pending: "Waiting to be sent",
  sending: "Sending",
  sent: "Sent (accepted by the email provider)",
  failed: "Not sent",
  skipped: "Not sent: email is not configured",
};

export type MediaFolder = "profile" | "projects" | "notes" | "general";

/** A media-library image (`backend/app/schemas/media.py`). */
export type OwnerMedia = {
  id: number;
  folder: MediaFolder;
  filename: string;
  content_type: string;
  url: string;
  byte_size: number;
  width: number;
  height: number;
  variants: { width: number; height: number; url: string }[];
  alt_text: string;
  version: number;
  created_at: string;
  updated_at: string;
};

export type OwnerMediaDetail = OwnerMedia & { used_by: string[] };

/** The smallest stored version, for thumbnails. Shared by server pages and client components. */
export function thumbnailOf(asset: OwnerMedia): string {
  return asset.variants[0]?.url ?? asset.url;
}

export const MEDIA_FOLDERS: { value: MediaFolder; label: string }[] = [
  { value: "projects", label: "Projects" },
  { value: "profile", label: "Profile" },
  { value: "notes", label: "Notes" },
  { value: "general", label: "General" },
];

/** The backend's default MAX_IMAGE_MB; the server enforces its own setting either way. */
export const MAX_IMAGE_MB = 8;

/** Matches the server: JPEG, PNG and WebP only; the server checks the bytes, not just this. */
export const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type AuditEvent = {
  id: number;
  created_at: string;
  action: string;
  entity_type: string;
  entity_id: number | null;
  summary: string;
  changed_fields: string[];
};

export type OwnerDashboard = {
  messages: { new: number; read: number; archived: number; spam?: number };
  content: Record<string, { draft: number; published: number }>;
  recent_messages: { id: number; created_at: string; name: string; subject: string; status: string }[];
  recent_activity: AuditEvent[];
};

export const LOGIN_PATH = "/owner/login";
export const STUDIO_PATH = "/owner";
export const CSRF_HEADER = "X-CSRF-Token";

/**
 * Where to go after signing in. Only Owner Studio paths are accepted, so a crafted
 * `?next=https://evil.example` (or `//evil.example`) can never redirect elsewhere.
 */
export function safeNext(next: string | string[] | undefined | null): string {
  const value = Array.isArray(next) ? next[0] : next;
  if (!value || !value.startsWith(STUDIO_PATH) || value.startsWith(LOGIN_PATH)) return STUDIO_PATH;
  if (value.includes("\\") || value.includes("//") || /[\u0000-\u001f]/.test(value)) return STUDIO_PATH;
  const rest = value.slice(STUDIO_PATH.length);
  return rest === "" || rest.startsWith("/") || rest.startsWith("?") ? value : STUDIO_PATH;
}

/** The login URL that returns to `path` afterwards. */
export function loginUrl(path: string = STUDIO_PATH, reason?: "expired"): string {
  const params = new URLSearchParams({ next: safeNext(path) });
  if (reason) params.set("reason", reason);
  return `${LOGIN_PATH}?${params.toString()}`;
}
