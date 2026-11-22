import { ExternalLink } from "@/components/ui/external-link";
import { containerClasses } from "@/components/ui/section";
import type { Profile } from "@/content/profile";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { dictionary } from "@/i18n/dictionaries";
import { siteNavigation, type SitePage } from "@/lib/navigation";

import { NavAnchor } from "./nav-anchor";
import { Logo } from "./site-header";

const footerLink = "inline-flex min-h-8 items-center text-sm text-muted transition-colors hover:text-fg";

export function SiteFooter({
  page,
  profile,
  articleCount,
  hidden = [],
  lang = DEFAULT_LOCALE,
}: {
  page: SitePage;
  profile: Profile;
  articleCount: number;
  /** Home-page sections switched off in the settings. */
  hidden?: readonly string[];
  lang?: Locale;
}) {
  const t = dictionary(lang).footer;
  const year = new Date().getFullYear();
  const links = siteNavigation(page, articleCount, hidden, lang);
  return (
    <footer className="border-t border-border bg-surface">
      <div className={`${containerClasses} grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4`}>
        <div className="flex flex-col gap-3 sm:col-span-2">
          <Logo profile={profile} home={page === "home"} lang={lang} />
          <p className="text-sm text-muted">
            {profile.title} · {profile.location}
          </p>
          <p className="text-xs text-muted">
            © {year} {profile.name}. {t.rights}
          </p>
        </div>

        <nav aria-label={dictionary(lang).shell.footerNav}>
          <h2 className="mb-3 text-sm font-semibold text-fg">{t.navigate}</h2>
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
          <h2 className="mb-3 text-sm font-semibold text-fg">{t.connect}</h2>
          <ul className="flex flex-col gap-1">
            <li>
              <a href={`mailto:${profile.email}`} className={footerLink}>
                {t.email}
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
                {t.downloadCv}
              </a>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
