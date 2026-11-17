import { buttonClasses } from "@/components/ui/button";
import { DownloadIcon } from "@/components/ui/icons";
import { containerClasses } from "@/components/ui/section";
import type { Profile } from "@/content/profile";
import { siteNavigation, type SitePage } from "@/lib/navigation";

import { MobileNav } from "./mobile-nav";
import { NavAnchor } from "./nav-anchor";

/** On the home page the logo returns to the top; on every other page it leads home. */
export function Logo({
  profile,
  home = true,
}: {
  profile: Pick<Profile, "initials" | "name">;
  home?: boolean;
}) {
  return (
    // The accessible name must contain the visible text ("JC."), so speech-input users can say
    // what they see (WCAG 2.5.3). The rest of the name is announced but not shown.
    <NavAnchor
      href={home ? "#top" : "/"}
      className="rounded-control font-display text-xl font-extrabold tracking-tight text-fg"
    >
      {profile.initials}
      <span className="text-accent">.</span>
      <span className="sr-only">
        {" "}
        — {profile.name}, {home ? "back to top" : "home"}
      </span>
    </NavAnchor>
  );
}

export function SiteHeader({
  page,
  profile,
  articleCount,
  hidden = [],
}: {
  page: SitePage;
  profile: Profile;
  articleCount: number;
  /** Home-page sections switched off in the settings. */
  hidden?: readonly string[];
}) {
  const links = siteNavigation(page, articleCount, hidden);
  return (
    <header className="sticky top-0 z-(--z-header) border-b border-border bg-canvas/85 backdrop-blur-md">
      <div className={`${containerClasses} relative flex h-16 items-center justify-between gap-6`}>
        <Logo profile={profile} home={page === "home"} />

        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-1 lg:gap-2">
            {links.map((item) => (
              <li key={item.href}>
                <NavAnchor
                  href={item.href}
                  aria-current={item.current ? "page" : undefined}
                  className="rounded-control px-3 py-2 text-sm text-muted transition-colors hover:text-fg aria-[current=page]:text-fg aria-[current=page]:underline aria-[current=page]:decoration-accent aria-[current=page]:underline-offset-8"
                >
                  {item.label}
                </NavAnchor>
              </li>
            ))}
          </ul>
        </nav>

        {/* Wrapper owns visibility: buttonClasses sets display, which would override `hidden`. */}
        <div className="hidden md:block">
          <a href={profile.cvHref} download className={buttonClasses("primary", "sm")}>
            <DownloadIcon className="size-4" />
            Download CV
          </a>
        </div>

        <MobileNav items={links} cvHref={profile.cvHref} />
      </div>
    </header>
  );
}
