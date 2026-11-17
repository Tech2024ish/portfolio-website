import type { ReactNode } from "react";

import type { Profile } from "@/content/profile";
import type { SitePage } from "@/lib/navigation";

import { PageViewTracker } from "./page-view-tracker";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

/**
 * The frame of every public page: skip link, header, the page's main landmark and the footer.
 * `page` marks the current navigation entry and adapts links that only make sense on the home page.
 */
export function SiteShell({
  page,
  profile,
  articleCount,
  hidden = [],
  track = true,
  children,
}: {
  page: SitePage;
  profile: Profile;
  /** Published notes: the Notes link appears only when there is at least one. */
  articleCount: number;
  /** Home-page sections switched off in the settings (navigation anchors). */
  hidden?: readonly string[];
  /** Report the view for analytics (not for the not-found page). */
  track?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-(--z-skip-link) focus:rounded-control focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-ink"
      >
        Skip to content
      </a>
      <SiteHeader page={page} profile={profile} articleCount={articleCount} hidden={hidden} />
      <main id="main" tabIndex={-1} className="focus:outline-none">
        {children}
      </main>
      <SiteFooter page={page} profile={profile} articleCount={articleCount} hidden={hidden} />
      {track ? <PageViewTracker /> : null}
    </>
  );
}
