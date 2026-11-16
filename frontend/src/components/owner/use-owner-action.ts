"use client";

import { useRouter } from "next/navigation";

import { ApiError } from "@/lib/api/client";
import { loginUrl, STUDIO_PATH } from "@/lib/owner/types";

/**
 * Wraps an owner request: a 401 means the session has ended (expired, revoked elsewhere or
 * signed out), so the owner is sent to sign in again. Other errors are returned to the caller.
 */
export function useOwnerAction() {
  const router = useRouter();
  return async function run<T>(
    action: () => Promise<T>,
  ): Promise<{ ok: true; value: T } | { ok: false; error: ApiError | null }> {
    try {
      return { ok: true, value: await action() };
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.replace(loginUrl(STUDIO_PATH, "expired"));
        router.refresh();
      }
      return { ok: false, error: error instanceof ApiError ? error : null };
    }
  };
}
