import { navigation } from "@/content/profile";
import { DEFAULT_LOCALE, localePath, type Locale } from "@/i18n/config";
import { dictionary } from "@/i18n/dictionaries";

/** The page a navigation is rendered on. */
export type SitePage = "home" | "projects" | "notes" | "other";

export type NavLink = { label: string; href: string; current: boolean };

const labelKeys = {
  "#about": "about",
  "#skills": "skills",
  "#projects": "projects",
  "#experience": "experience",
  "#contact": "contact",
} as const;

/**
 * Site navigation for a page, in the page's language. On the home page the links scroll to its
 * sections; elsewhere they lead back to those sections, except Projects, which opens the projects
 * listing. Notes appears only once a note is published, so the site never links to an empty page.
 * Links stay in the page's language (`/fr/projects`, `/fr#about`).
 */
export function siteNavigation(
  page: SitePage,
  publishedArticles: number,
  hidden: readonly string[] = [],
  lang: Locale = DEFAULT_LOCALE,
): NavLink[] {
  const t = dictionary(lang).nav;
  const links: NavLink[] = navigation
    .filter(({ href }) => !hidden.includes(href))
    .map(({ href }) => {
      const label = t[labelKeys[href]];
      if (page === "home") return { label, href, current: false };
      if (href === "#projects")
        return { label, href: localePath(lang, "/projects"), current: page === "projects" };
      return { label, href: localePath(lang, `/${href}`), current: false };
    });
  if (publishedArticles > 0) {
    const contact = links.findIndex((link) => link.label === t.contact);
    links.splice(contact === -1 ? links.length : contact, 0, {
      label: t.notes,
      href: localePath(lang, "/notes"),
      current: page === "notes",
    });
  }
  return links;
}
