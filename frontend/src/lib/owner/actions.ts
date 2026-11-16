/**
 * Owner requests made from the browser. They go to the same-origin `/api/...` path (rewritten
 * to FastAPI), so the HttpOnly session cookie is sent automatically; every state-changing call
 * also sends the CSRF token, which the server checks against that cookie.
 */
import { api } from "@/lib/api/client";

import { CSRF_HEADER, type OwnerSessionInfo } from "./types";

export function signIn(email: string, password: string): Promise<OwnerSessionInfo> {
  return api.post<OwnerSessionInfo>("/api/v1/auth/login", { email, password });
}

export function ownerActions(csrfToken: string) {
  const options = { headers: { [CSRF_HEADER]: csrfToken } };
  return {
    signOut: () => api.post<void>("/api/v1/auth/logout", undefined, options),
    revokeSession: (id: number) => api.delete<void>(`/api/v1/auth/sessions/${id}`, options),
    revokeOtherSessions: () =>
      api.post<{ revoked: number }>("/api/v1/auth/sessions/revoke-others", undefined, options),
    changePassword: (currentPassword: string, newPassword: string) =>
      api.post<void>(
        "/api/v1/auth/password",
        { current_password: currentPassword, new_password: newPassword },
        options,
      ),
  };
}

/** A short, human description of a browser's user agent, e.g. "Chrome on Windows". */
export function describeDevice(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Firefox\//.test(userAgent)
      ? "Firefox"
      : /Chrome\//.test(userAgent)
        ? "Chrome"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : null;
  const system = /Windows/.test(userAgent)
    ? "Windows"
    : /Android/.test(userAgent)
      ? "Android"
      : /iPhone|iPad/.test(userAgent)
        ? "iOS"
        : /Mac OS X/.test(userAgent)
          ? "macOS"
          : /Linux/.test(userAgent)
            ? "Linux"
            : null;
  if (browser && system) return `${browser} on ${system}`;
  return browser ?? system ?? "Unknown device";
}

const dateTime = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

/** A timestamp in UTC, so the server render and the browser render are identical. */
export function formatUtc(iso: string): string {
  return `${dateTime.format(new Date(iso))} UTC`;
}
