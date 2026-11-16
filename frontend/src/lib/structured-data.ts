import type { Article, Profile, Project } from "@/content/profile";

import { absoluteUrl, siteDescription, siteName, siteUrl } from "./site";

/**
 * schema.org data for search engines, built only from published content. Nothing is claimed that
 * the page does not show (no ratings, no employer, no completed degree).
 */

type Node = Record<string, unknown>;

const personId = absoluteUrl("/#person");
const websiteId = absoluteUrl("/#website");

export function personNode(profile: Profile): Node {
  return {
    "@type": "Person",
    "@id": personId,
    name: profile.name,
    jobTitle: profile.title,
    description: siteDescription,
    url: siteUrl.toString(),
    image: absoluteUrl(profile.portraitSrc),
    email: `mailto:${profile.email}`,
    address: { "@type": "PostalAddress", addressLocality: "Kigali", addressCountry: "RW" },
    sameAs: profile.social.map((link) => link.href),
  };
}

/** The home page: the person and the website, linked. */
export function homeGraph(profile: Profile): Node {
  return {
    "@context": "https://schema.org",
    "@graph": [
      personNode(profile),
      {
        "@type": "WebSite",
        "@id": websiteId,
        url: siteUrl.toString(),
        name: siteName,
        description: siteDescription,
        inLanguage: "en",
        publisher: { "@id": personId },
      },
    ],
  };
}

function breadcrumbs(items: { name: string; path: string }[]): Node {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/** The projects listing: the published projects, in order. */
export function projectsGraph(projects: Project[]): Node {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": absoluteUrl("/projects#page"),
    name: "Projects",
    url: absoluteUrl("/projects"),
    isPartOf: { "@id": websiteId },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: projects.map((project, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: project.title,
        url: absoluteUrl(`/projects/${project.slug}`),
      })),
    },
  };
}

export function projectGraph(project: Project, profile: Profile): Node {
  const path = `/projects/${project.slug}`;
  const work: Node = {
    "@type": project.repoUrl ? "SoftwareSourceCode" : "CreativeWork",
    "@id": absoluteUrl(`${path}#project`),
    name: project.title,
    description: project.summary,
    url: absoluteUrl(path),
    genre: project.category,
    keywords: project.tech.join(", "),
    author: { "@type": "Person", "@id": personId, name: profile.name },
  };
  if (project.repoUrl) work.codeRepository = project.repoUrl;
  return {
    "@context": "https://schema.org",
    "@graph": [
      work,
      breadcrumbs([
        { name: "Home", path: "/" },
        { name: "Projects", path: "/projects" },
        { name: project.title, path },
      ]),
    ],
  };
}

export function articleGraph(article: Article, profile: Profile): Node {
  const path = `/notes/${article.slug}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": absoluteUrl(`${path}#article`),
        headline: article.title,
        description: article.summary,
        datePublished: article.publishedOn,
        articleSection: article.category,
        url: absoluteUrl(path),
        mainEntityOfPage: absoluteUrl(path),
        inLanguage: "en",
        author: { "@type": "Person", "@id": personId, name: profile.name },
      },
      breadcrumbs([
        { name: "Home", path: "/" },
        { name: "Engineering Notes", path: "/notes" },
        { name: article.title, path },
      ]),
    ],
  };
}
