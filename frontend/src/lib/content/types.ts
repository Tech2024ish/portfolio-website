import type {
  ImageVariant,
  ResponsiveImage,
  Article,
  Certification,
  Education,
  Experience,
  Principle,
  Profile,
  Project,
  SkillGroup,
} from "@/content/profile";

/** A note without its body, as listings show it. */
export type ArticleSummary = Omit<Article, "body">;

/**
 * Everything the public site renders. Only published records ever reach it: drafts are filtered
 * out by the source (the bundled filter or the API), and a project's `details` are present only
 * when its case study is published.
 */
export type PublicContent = {
  profile: Profile;
  principles: Principle[];
  skillGroups: SkillGroup[];
  projects: Project[];
  experience: Experience[];
  education: Education[];
  certifications: Certification[];
  /** Newest first. */
  articles: ArticleSummary[];
};

/* ---- the FastAPI public API (/api/v1/public), as served ---- */

export type ApiProfile = {
  name: string;
  initials: string;
  title: string;
  location: string;
  availability: string;
  headline: string;
  summary: string;
  about_lead: string;
  about_body: string[];
  email: string;
  cv_href: string;
  portrait_src: string;
  portrait_alt: string;
  contact_intro: string;
  social: { label: string; href: string }[];
  principles: { title: string; body: string; icon: string }[];
};

export type ApiCaseStudy = {
  overview: string[];
  problem: string | null;
  objectives: string[];
  approach: string | null;
  architecture: string[];
  decisions: { title: string; detail: string }[];
  challenges: { challenge: string; solution: string }[];
  outcomes: string[];
  scope_implemented: string[];
  scope_not_yet: string[];
  media: {
    src: string;
    alt: string;
    caption: string | null;
    width: number;
    height: number;
    variants?: ImageVariant[];
  }[];
};

export type ApiProject = {
  slug: string;
  title: string;
  category: string;
  summary: string;
  tech: string[];
  featured: boolean;
  repo_url: string | null;
  live_url: string | null;
  case_study: ApiCaseStudy | null;
};

export type ApiArticleSummary = {
  slug: string;
  title: string;
  summary: string;
  category: string;
  published_on: string | null;
};

export type ApiArticle = ApiArticleSummary & { body: string };

export type ApiPortfolio = {
  profile: ApiProfile;
  portrait?: ResponsiveImage | null;
  skill_groups: { name: string; skills: string[] }[];
  experience: {
    organization: string;
    role: string;
    location: string | null;
    start_month: string;
    end_month: string | null;
    is_current: boolean;
    highlights: string[];
  }[];
  education: {
    institution: string;
    qualification: string;
    location: string | null;
    status_label: string | null;
    start_month: string | null;
    end_month: string | null;
    coursework: string[];
  }[];
  certifications: {
    name: string;
    issuer: string;
    issued_month: string | null;
    credential_url: string | null;
  }[];
  projects: ApiProject[];
  articles: ApiArticleSummary[];
};
