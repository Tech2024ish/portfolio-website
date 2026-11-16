import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { ApiError, createApiClient } from "@/lib/api/client";

import { loginUrl, type OwnerSessionInfo } from "./types";

/**
 * The owner's data access layer: the only place the frontend decides who is signed in, and it
 * decides nothing itself. It forwards the session cookie to FastAPI, which verifies it.
 *
 * - No cookie, or FastAPI answers 401: "signed-out" (the page redirects to sign-in).
 * - FastAPI unreachable or failing: "unavailable" (the page shows an error), never signed in.
 *
 * Cookie names match `Settings.session_cookie_name` in the backend: `__Host-owner_session` in
 * production (Secure), `owner_session` in local HTTP development.
 */
export const SESSION_COOKIE_NAMES = ["__Host-owner_session", "owner_session"] as const;

export type OwnerSessionResult =
  { status: "signed-in"; session: OwnerSessionInfo } | { status: "signed-out" } | { status: "unavailable" };

export class OwnerApiUnavailableError extends Error {
  constructor() {
    super("The owner API is unavailable.");
    this.name = "OwnerApiUnavailableError";
  }
}

async function sessionCookieHeader(): Promise<string | null> {
  const store = await cookies();
  for (const name of SESSION_COOKIE_NAMES) {
    const cookie = store.get(name);
    if (cookie?.value) return `${name}=${cookie.value}`;
  }
  return null;
}

const server = createApiClient();

/** Verified once per request (React `cache`), however many components ask. */
export const getOwnerSession = cache(async (): Promise<OwnerSessionResult> => {
  const cookie = await sessionCookieHeader();
  if (!cookie) return { status: "signed-out" };
  try {
    const session = await server.get<OwnerSessionInfo>("/api/v1/auth/session", {
      headers: { Cookie: cookie },
      cache: "no-store",
    });
    return { status: "signed-in", session };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return { status: "signed-out" };
    return { status: "unavailable" };
  }
});

/**
 * Reads an owner endpoint on the server with the visitor's session. A 401 means the session
 * ended between checks: redirect to sign-in. Anything else unexpected is "unavailable".
 */
export async function ownerGet<T>(path: string, returnTo: string): Promise<T> {
  const cookie = await sessionCookieHeader();
  if (!cookie) redirect(loginUrl(returnTo));
  try {
    return await server.get<T>(path, { headers: { Cookie: cookie }, cache: "no-store" });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect(loginUrl(returnTo, "expired"));
    throw new OwnerApiUnavailableError();
  }
}
