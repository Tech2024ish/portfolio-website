import {
  certifications,
  education,
  experience,
  isPublished,
  principles,
  profile,
  projects,
  articles,
  skillGroups,
  type Article,
  type Principle,
  type Project,
  type ProjectDetails,
  type SocialLink,
} from "@/content/profile";

import { parseArticleBody } from "./body";
import { formatPeriod } from "./period";
import type {
  ApiArticle,
  ApiArticleSummary,
  ApiPortfolio,
  ApiProject,
  ArticleSummary,
  PublicContent,
} from "./types";

const ICONS = new Set<Principle["icon"]>(["architecture", "database", "api", "quality"]);
const SOCIAL = new Set<SocialLink["label"]>(["GitHub", "LinkedIn"]);

const newestFirst = <T extends { publishedOn: string }>(list: T[]): T[] =>
  list.sort((a, b) => b.publishedOn.localeCompare(a.publishedOn));

const summaryOf = (article: Article): ArticleSummary => ({
  slug: article.slug,
  title: article.title,
  summary: article.summary,
  category: article.category,
  publishedOn: article.publishedOn,
  visibility: article.visibility,
});

/** The bundled content (src/content/profile.ts), published records only. */
export function bundledContent(): PublicContent {
  return {
    profile,
    principles,
    skillGroups,
    projects: projects.filter(isPublished).map((project) => ({
      ...project,
      details: project.details && isPublished(project.details) ? project.details : undefined,
    })),
    experience: experience.filter(isPublished),
    education: education.filter(isPublished),
    certifications: certifications.filter(isPublished),
    articles: newestFirst(articles.filter(isPublished).map(summaryOf)),
  };
}

/** A case-study section exists only when it has content, as in the bundled data. */
const some = <T>(list: T[]): T[] | undefined => (list.length ? list : undefined);

function details(study: ApiProject["case_study"]): ProjectDetails | undefined {
  if (!study) return undefined;
  const scope =
    study.scope_implemented.length || study.scope_not_yet.length
      ? { implemented: study.scope_implemented, notYetImplemented: study.scope_not_yet }
      : undefined;
  return {
    sources: [],
    overview: some(study.overview),
    problem: study.problem ?? undefined,
    objectives: some(study.objectives),
    approach: study.approach ?? undefined,
    architecture: some(study.architecture),
    decisions: some(study.decisions),
    challenges: some(study.challenges),
    outcomes: some(study.outcomes),
    scope,
    media: some(study.media.map(({ caption, ...media }) => ({ ...media, caption: caption ?? undefined }))),
    visibility: "published",
  };
}

export function projectFromApi(project: ApiProject): Project {
  return {
    slug: project.slug,
    title: project.title,
    category: project.category,
    summary: project.summary,
    tech: project.tech,
    featured: project.featured,
    repoUrl: project.repo_url ?? undefined,
    liveUrl: project.live_url ?? undefined,
    details: details(project.case_study),
    visibility: "published",
  };
}

/** Published notes always carry a date (publishing sets it); anything else is not listed. */
function articleSummaryFromApi(article: ApiArticleSummary): ArticleSummary | null {
  if (!article.published_on) return null;
  return {
    slug: article.slug,
    title: article.title,
    summary: article.summary,
    category: article.category,
    publishedOn: article.published_on,
    visibility: "published",
  };
}

export function articleFromApi(article: ApiArticle): Article | null {
  const summary = articleSummaryFromApi(article);
  return summary ? { ...summary, body: parseArticleBody(article.body) } : null;
}

export function contentFromApi(data: ApiPortfolio): PublicContent {
  const p = data.profile;
  return {
    profile: {
      name: p.name,
      initials: p.initials,
      title: p.title,
      location: p.location,
      availability: p.availability,
      headline: p.headline,
      summary: p.summary,
      aboutLead: p.about_lead,
      aboutBody: p.about_body,
      email: p.email,
      cvHref: p.cv_href,
      portraitSrc: p.portrait_src,
      portraitAlt: p.portrait_alt,
      contactIntro: p.contact_intro,
      social: p.social.filter((link): link is SocialLink => SOCIAL.has(link.label as SocialLink["label"])),
    },
    principles: p.principles.filter((item): item is Principle => ICONS.has(item.icon as Principle["icon"])),
    skillGroups: data.skill_groups.filter((group) => group.skills.length > 0),
    projects: data.projects.map(projectFromApi),
    experience: data.experience.map((job) => ({
      organization: job.organization,
      role: job.role,
      period: formatPeriod(job.start_month, job.end_month, job.is_current),
      current: job.is_current,
      highlights: job.highlights,
      visibility: "published",
    })),
    education: data.education.map((entry) => ({
      institution: entry.institution,
      degree: entry.qualification,
      location: entry.location ?? "",
      status: entry.status_label ?? "",
      coursework: entry.coursework,
      visibility: "published",
    })),
    certifications: data.certifications.map((cert) => ({
      name: cert.name,
      issuer: cert.issuer,
      visibility: "published",
    })),
    articles: newestFirst(
      data.articles.map(articleSummaryFromApi).filter((item): item is ArticleSummary => item !== null),
    ),
  };
}
