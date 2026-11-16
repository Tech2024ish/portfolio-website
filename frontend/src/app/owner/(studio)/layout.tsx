import type { ReactNode } from "react";

import { SignOutButton } from "@/components/owner/sign-out-button";
import { StudioNav } from "@/components/owner/studio-nav";
import { containerClasses } from "@/components/ui/section";
import { getOwnerSession } from "@/lib/owner/session";

/**
 * The Studio frame. The header and navigation appear only for a session FastAPI has verified on
 * this request; every page also checks the session itself (and redirects to sign in without one)
 * before loading anything, so this layout never decides access on its own.
 */
export default async function StudioLayout({ children }: { children: ReactNode }) {
  const result = await getOwnerSession();
  const session = result.status === "signed-in" ? result.session : null;
  return (
    <>
      {session ? (
        <>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-(--z-skip-link) focus:rounded-control focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink"
          >
            Skip to content
          </a>
          <header className="border-b border-border bg-surface">
            <div className={`${containerClasses} flex h-16 items-center justify-between gap-4`}>
              <p className="font-display text-lg font-extrabold tracking-tight text-fg">
                JC<span className="text-accent">.</span>{" "}
                <span className="font-sans text-sm font-normal text-muted">Owner Studio</span>
              </p>
              <div className="flex items-center gap-3">
                <span className="hidden text-sm text-muted sm:inline">{session.user.email}</span>
                <SignOutButton csrfToken={session.csrf_token} />
              </div>
            </div>
          </header>
          <StudioNav />
        </>
      ) : null}
      <main
        id="main"
        tabIndex={-1}
        className={`${containerClasses} flex flex-col gap-8 py-10 focus:outline-none sm:py-12`}
      >
        {children}
      </main>
    </>
  );
}
