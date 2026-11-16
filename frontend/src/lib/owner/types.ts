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
  messages: { new: number; read: number; archived: number };
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
