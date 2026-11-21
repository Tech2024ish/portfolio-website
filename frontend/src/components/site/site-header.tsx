import { containerClasses } from "@/components/ui/section";
import type { Profile } from "@/content/profile";
import { DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { dictionary } from "@/i18n/dictionaries";
import { siteNavigation, type SitePage } from "@/lib/navigation";

import { LanguageSwitcher } from "./language-switcher";
import { MobileNav } from "./mobile-nav";
import { NavAnchor } from "./nav-anchor";
import { ThemeToggle } from "./theme-toggle";

/** On the home page the logo returns to the top; on every other page it leads home. */
export function Logo({
  profile,
  home = true,
  lang = DEFAULT_LOCALE,
}: {
  profile: Pick<Profile, "name">;
  home?: boolean;
  lang?: Locale;
}) {
  const t = dictionary(lang).shell;
  return (
    // The accessible name starts with the visible text (the name), so speech-input users can say
    // what they see (WCAG 2.5.3). Where the link leads is announced but not shown.
    <NavAnchor
      href={home ? "#top" : localePath(lang, "/")}
      className="rounded-control text-base font-medium text-fg"
    >
      {profile.name}
      <span className="sr-only">, {home ? t.backToTop : t.home}</span>
    </NavAnchor>
  );
}

export function SiteHeader({
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
  const t = dictionary(lang);
  const links = siteNavigation(page, articleCount, hidden, lang);
  return (
    <header className="sticky top-0 z-(--z-header) border-b border-border bg-canvas/90 backdrop-blur-md">
      <div className={`${containerClasses} relative flex h-16 items-center justify-between gap-6`}>
        <Logo profile={profile} home={page === "home"} lang={lang} />

        <nav aria-label={t.shell.primaryNav} className="hidden md:block">
          <ul className="flex items-center gap-1 lg:gap-2">
            {links.map((item) => (
              <li key={item.href}>
                <NavAnchor
                  href={item.href}
                  aria-current={item.current ? "page" : undefined}
                  className="rounded-control px-3 py-2 text-sm text-muted transition-colors hover:text-fg aria-[current=page]:font-medium aria-[current=page]:text-fg"
                >
                  {item.label}
                </NavAnchor>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1">
          <LanguageSwitcher lang={lang} />
          <ThemeToggle labels={{ dark: t.shell.switchToDark, light: t.shell.switchToLight }} />
          <MobileNav
            items={links}
            cvHref={profile.cvHref}
            labels={{ open: t.shell.openMenu, close: t.shell.closeMenu, cv: t.hero.downloadCv }}
          />
        </div>
      </div>
    </header>
  );
}
