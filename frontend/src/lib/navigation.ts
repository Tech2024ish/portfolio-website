import { navigation } from "@/content/profile";

/** The page a navigation is rendered on. */
export type SitePage = "home" | "projects" | "notes" | "other";

export type NavLink = { label: string; href: string; current: boolean };

/**
 * Site navigation for a page. On the home page the links scroll to its sections; elsewhere they
 * lead back to those sections, except Projects, which opens the projects listing. Notes appears
 * only once a note is published, so the site never links to an empty page.
 */
export function siteNavigation(
  page: SitePage,
  publishedArticles: number,
  hidden: readonly string[] = [],
): NavLink[] {
  const links: NavLink[] = navigation
    .filter(({ href }) => !hidden.includes(href))
    .map(({ label, href }) => {
      if (page === "home") return { label, href, current: false };
      if (href === "#projects") return { label, href: "/projects", current: page === "projects" };
      return { label, href: `/${href}`, current: false };
    });
  if (publishedArticles > 0) {
    const contact = links.findIndex((link) => link.label === "Contact");
    links.splice(contact === -1 ? links.length : contact, 0, {
      label: "Notes",
      href: "/notes",
      current: page === "notes",
    });
  }
  return links;
}
