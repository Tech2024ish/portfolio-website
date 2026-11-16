"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ownerActions } from "@/lib/owner/actions";
import { LOGIN_PATH } from "@/lib/owner/types";

/** Ends this session on the server, then returns to sign-in (also when it had already ended). */
export function SignOutButton({ csrfToken }: { csrfToken: string }) {
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

  return (
    <Button variant="secondary" size="sm" loading={pending} onClick={signOut}>
      Sign out
    </Button>
  );
}
