"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/feedback";
import { LogOutIcon } from "@/components/ui/icons";
import { ownerActions } from "@/lib/owner/actions";
import { LOGIN_PATH } from "@/lib/owner/types";

/**
 * Ends this session on the server, then returns to sign-in (also when it had already ended).
 * "button": a compact secondary button (the header on small screens). "sidebar": a full-width
 * row with an icon, in the error colour, at the foot of the Studio sidebar.
 */
export function SignOutButton({
  csrfToken,
  appearance = "button",
}: {
  csrfToken: string;
  appearance?: "button" | "sidebar";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await ownerActions(csrfToken).signOut();
    } catch {
      // Already signed out or unreachable: either way the page must not stay signed in.
    }
    router.replace(LOGIN_PATH);
    router.refresh();
  }

  if (appearance === "sidebar") {
    return (
      <button
        type="button"
        onClick={pending ? undefined : signOut}
        aria-busy={pending || undefined}
        className="flex min-h-11 w-full items-center gap-3 rounded-card px-4 text-[0.9375rem] font-medium text-danger-fg transition-colors hover:bg-danger-soft"
      >
        {pending ? <Spinner /> : <LogOutIcon className="size-5" />}
        Sign out
      </button>
    );
  }

  return (
    <Button variant="secondary" size="sm" loading={pending} onClick={signOut}>
      Sign out
    </Button>
  );
}
