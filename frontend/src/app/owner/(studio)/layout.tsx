import type { ReactNode } from "react";

import { SignOutButton } from "@/components/owner/sign-out-button";
import { StudioNav } from "@/components/owner/studio-nav";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { LayoutIcon } from "@/components/ui/icons";
import { containerClasses } from "@/components/ui/section";
import { initialsOf } from "@/lib/owner/initials";
import { getOwnerSession } from "@/lib/owner/session";
import { siteName } from "@/lib/site";

const mainClasses = "flex flex-col gap-8 py-10 focus:outline-none sm:py-12";

/**
 * The Studio frame. The header and navigation appear only for a session FastAPI has verified on
 * this request; every page also checks the session itself (and redirects to sign in without one)
 * before loading anything, so this layout never decides access on its own.
 */
export default async function StudioLayout({ children }: { children: ReactNode }) {
  const result = await getOwnerSession();
  const session = result.status === "signed-in" ? result.session : null;
  if (!session) {
    return (
      <main id="main" tabIndex={-1} className={`${mainClasses} ${containerClasses}`}>
        {children}
      </main>
    );
  }
  const initials = initialsOf(session.user.display_name, session.user.email);
  const avatar = (size: string) => (
    <span
      aria-hidden="true"
      className={`inline-flex ${size} shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-ink`}
    >
      {initials}
    </span>
  );
  return (
    // Wide screens: a full-height sidebar on the left of the top bar and the page. Narrow screens:
    // top bar, then the navigation as a scrolling row, then the page. The source order (header,
    // nav, main) is the reading and tab order on every screen.
    <div className="lg:grid lg:min-h-dvh lg:grid-cols-[17rem_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-(--z-skip-link) focus:rounded-control focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink"
      >
        Skip to content
      </a>
      {/* Sticky, like the sidebar: the owner's controls stay in view while the page scrolls. */}
      <header className="sticky top-0 z-(--z-header) border-b border-border bg-surface lg:col-start-2 lg:row-start-1 lg:bg-canvas">
        <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:justify-end lg:px-8">
          <p className="text-base font-medium text-fg lg:hidden">
            {siteName} <span className="text-sm font-normal text-muted">· Studio</span>
          </p>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <span className="hidden text-sm text-muted lg:inline">{session.user.display_name}</span>
            <span className="hidden lg:inline-flex">{avatar("size-9")}</span>
            <div className="lg:hidden">
              <SignOutButton csrfToken={session.csrf_token} />
            </div>
          </div>
        </div>
      </header>
      <aside className="lg:sticky lg:top-0 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:flex lg:h-dvh lg:flex-col lg:border-r lg:border-border lg:bg-surface">
        <div className="hidden h-16 items-center gap-3 border-b border-border px-5 lg:flex">
          <span
            aria-hidden="true"
            className="inline-flex size-10 items-center justify-center rounded-card bg-raised text-fg"
          >
            <LayoutIcon className="size-5" />
          </span>
          <p className="flex flex-col leading-tight">
            <span className="text-[0.9375rem] font-semibold text-fg">{siteName}</span>
            <span className="text-xs font-medium tracking-wider text-muted uppercase">Owner Studio</span>
          </p>
        </div>
        <div className="lg:flex-1 lg:overflow-y-auto lg:py-4">
          <StudioNav />
        </div>
        <div className="hidden border-t border-border p-3 lg:block">
          <div className="flex items-center gap-3 px-2 pb-2">
            {avatar("size-10")}
            <p className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold text-fg">{session.user.display_name}</span>
              <span className="truncate text-xs text-muted">{session.user.email}</span>
            </p>
          </div>
          <SignOutButton csrfToken={session.csrf_token} appearance="sidebar" />
        </div>
      </aside>
      <main
        id="main"
        tabIndex={-1}
        className={`${mainClasses} w-full px-4 sm:px-6 lg:col-start-2 lg:max-w-6xl lg:px-8`}
      >
        {children}
      </main>
    </div>
  );
}
