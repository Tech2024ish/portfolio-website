import { ExternalLink } from "@/components/ui/external-link";
import { containerClasses } from "@/components/ui/section";
import type { Profile } from "@/content/profile";
import { siteNavigation, type SitePage } from "@/lib/navigation";

import { NavAnchor } from "./nav-anchor";
import { Logo } from "./site-header";

const footerLink = "inline-flex min-h-8 items-center text-sm text-muted transition-colors hover:text-fg";

export function SiteFooter({
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
  const year = new Date().getFullYear();
  const links = siteNavigation(page, articleCount, hidden);
  return (
    <footer className="border-t border-border bg-surface">
      <div className={`${containerClasses} grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4`}>
        <div className="flex flex-col gap-3 sm:col-span-2">
          <Logo profile={profile} home={page === "home"} />
          <p className="text-sm text-muted">
            {profile.title} · {profile.location}
          </p>
          <p className="text-xs text-muted">
            © {year} {profile.name}. All rights reserved.
          </p>
        </div>

        <nav aria-label="Footer">
          <h2 className="mb-3 text-sm font-semibold text-fg">Navigate</h2>
          <ul className="flex flex-col gap-1">
            {links.map((item) => (
              <li key={item.href}>
                <NavAnchor
                  href={item.href}
                  aria-current={item.current ? "page" : undefined}
                  className={footerLink}
                >
                  {item.label}
                </NavAnchor>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-fg">Connect</h2>
          <ul className="flex flex-col gap-1">
            <li>
              <a href={`mailto:${profile.email}`} className={footerLink}>
                Email
              </a>
            </li>
            {profile.social.map((link) => (
              <li key={link.label}>
                <ExternalLink href={link.href} className={footerLink}>
                  {link.label}
                </ExternalLink>
              </li>
            ))}
            <li>
              <a href={profile.cvHref} download className={footerLink}>
                Download CV
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
