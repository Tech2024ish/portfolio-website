/**
 * Verified public portfolio content.
 *
 * Every entry comes from one of two owner-authored sources, noted per section:
 *   [CV]   frontend/public/Resume.pdf
 *   [V2]   the published (visible) entries of the V2 seed, backend/legacy/services/seed.py,
 *          which were taken from the live V1 site and the owner's public GitHub repositories.
 * Entries the V2 seed marked as hidden or draft (no verified details) are deliberately absent.
 *
 * Records the owner has not approved for publication are kept here with `visibility: "draft"`
 * so the data is not lost. Components must render only the `public*` lists exported at the end
 * of this file, never the raw arrays; tests enforce that no draft reaches the page.
 *
 * This file is the static content source of the public site. Content moves to PostgreSQL and the
 * FastAPI public API together with the Owner Studio (Phase 6), which writes it; the shapes here are
 * kept close to that API so the pages change little when the source does.
 */

/** "draft" records are kept for later review and are never rendered publicly. */
export type Visibility = "published" | "draft";

export type SocialLink = { label: "GitHub" | "LinkedIn"; href: string };

export type Profile = {
  name: string;
  initials: string;
  title: string;
  location: string;
  availability: string;
  headline: string;
  summary: string;
  aboutLead: string;
  aboutBody: string[];
  email: string;
  cvHref: string;
  portraitSrc: string;
  portraitAlt: string;
  social: SocialLink[];
  contactIntro: string;
};

export type Principle = {
  title: string;
  body: string;
  icon: "architecture" | "database" | "api" | "quality";
};

export type SkillGroup = { name: string; skills: string[] };

/** An image shown on a project page. Paths are under /public; `alt` describes the image. */
export type ProjectMedia = { src: string; alt: string; caption?: string; width: number; height: number };

/**
 * The long-form case study of a project. It has its own visibility: a published project can have
 * draft details, which are never rendered until the owner approves them. Every field except
 * `sources` is optional and its section is shown only when present: nothing is filled in to look
 * complete.
 */
export type ProjectDetails = {
  /** Where the statements come from, e.g. the project's README. Required, never rendered. */
  sources: string[];
  /** Full description, one entry per paragraph. */
  overview?: string[];
  problem?: string;
  objectives?: string[];
  approach?: string;
  architecture?: string[];
  decisions?: { title: string; detail: string }[];
  challenges?: { challenge: string; solution: string }[];
  /** Results that have been verified. Never estimates or goals. */
  outcomes?: string[];
  /** What exists today and what is deliberately not built yet. */
  scope?: { implemented: string[]; notYetImplemented: string[] };
  media?: ProjectMedia[];
  visibility: Visibility;
};

export type Project = {
  slug: string;
  title: string;
  category: string;
  /** The short description shown on cards and at the top of the project page. */
  summary: string;
  tech: string[];
  featured: boolean;
  repoUrl?: string;
  liveUrl?: string;
  details?: ProjectDetails;
  visibility: Visibility;
};

/** One block of an article body. Text is rendered as text, never as HTML. */
export type ArticleBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "list"; items: string[] }
  | { type: "code"; language: string; code: string };

/** An Engineering Note. `publishedOn` is an ISO date (YYYY-MM-DD). */
export type Article = {
  slug: string;
  title: string;
  summary: string;
  category: string;
  publishedOn: string;
  body: ArticleBlock[];
  visibility: Visibility;
};

export type Experience = {
  organization: string;
  role: string;
  period: string;
  current: boolean;
  highlights: string[];
  visibility: Visibility;
};

export type Education = {
  institution: string;
  degree: string;
  location: string;
  status: string;
  coursework: string[];
  visibility: Visibility;
};

export type Certification = { name: string; issuer: string; visibility: Visibility };

/** [CV] name, location, email, title; [V2] availability, about copy, contact intro. */
export const profile: Profile = {
  name: "Jean Claude Ishimwe",
  initials: "JC",
  title: "Backend Software Engineer",
  location: "Kigali, Rwanda",
  availability: "Available for backend opportunities",
  headline: "Building reliable backend systems for real-world problems.",
  summary:
    "Backend Developer at SilverLandTech and Computer Science student at the University of Rwanda. I design REST APIs and database-driven services with Python, FastAPI and PostgreSQL.",
  aboutLead:
    "A backend-minded builder, passionate about reliable, scalable systems and technology that solves real-world problems.",
  aboutBody: [
    "I develop backend applications using Python, FastAPI, Java, PostgreSQL, SQL and REST APIs, with experience designing APIs, implementing backend logic and building maintainable software. I also work with JavaScript and React, which helps me collaborate across the whole development lifecycle.",
    "I'm particularly interested in backend engineering, system design, cloud technologies and AI-driven applications.",
  ],
  email: "claudeish88@gmail.com",
  cvHref: "/Resume.pdf",
  portraitSrc: "/ishimwe-jean-claude.png",
  portraitAlt: "Portrait of Jean Claude Ishimwe",
  social: [
    { label: "GitHub", href: "https://github.com/Tech2024ish" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/ishimwe-jean-claude-goslish/" },
  ],
  contactIntro:
    "Open to backend engineering internships, graduate programs, junior backend engineer roles and software engineering opportunities.",
};

/** [V2] engineering_principles. */
export const principles: Principle[] = [
  {
    title: "Architecture",
    body: "Clear boundaries, cohesive business logic and maintainable service structure.",
    icon: "architecture",
  },
  {
    title: "Database engineering",
    body: "Thoughtful schemas, relationships and persistence shaped around the domain.",
    icon: "database",
  },
  {
    title: "API design",
    body: "Explicit contracts and RESTful interfaces that frontend teams can work with.",
    icon: "api",
  },
  {
    title: "Engineering quality",
    body: "An emphasis on reliability, authentication and code that stays understandable.",
    icon: "quality",
  },
];

/** [CV] "Relevant skills"; "Practices" from [V2] core concepts. */
export const skillGroups: SkillGroup[] = [
  { name: "Programming languages", skills: ["Python", "Java", "JavaScript", "SQL"] },
  { name: "Backend engineering", skills: ["FastAPI", "REST APIs", "API Design", "JWT Authentication"] },
  { name: "Databases", skills: ["PostgreSQL", "MySQL"] },
  { name: "Frontend", skills: ["React", "HTML", "CSS"] },
  { name: "Tools", skills: ["Git", "GitHub", "Docker", "Postman"] },
  {
    name: "Practices",
    skills: ["OOP", "Database Design", "Data Structures", "Algorithms", "Software Engineering"],
  },
];

/**
 * [V2] projects with their V2 summaries and tech. Published: MOSAIC and BuzHub.
 * Drafts (owner decision, 2026-11-10): School Management System is not an approved portfolio
 * project; Portfolio Website stays unpublished until the V3 rebuild is complete.
 */
export const projects: Project[] = [
  {
    slug: "mosaic",
    title: "MOSAIC",
    category: "Backend platform",
    summary:
      "A supply-chain decision intelligence platform for mid-market distributors, starting with African distribution businesses. The current foundation is a modular-monolith FastAPI backend with PostgreSQL migrations; the decision engine is not implemented yet.",
    tech: ["Python", "FastAPI", "PostgreSQL", "Alembic", "React", "Docker"],
    featured: true,
    repoUrl: "https://github.com/Tech2024ish/mosaic",
    // Drafted from the project's own README (owner-authored, public); every statement restates it.
    // Published as drafted with the owner's approval (2026-11-16).
    details: {
      sources: ["https://github.com/Tech2024ish/mosaic#readme (default branch, last pushed 2026-10-19)"],
      overview: [
        "MOSAIC is a supply-chain decision intelligence platform for mid-market distributors, beginning with African distribution businesses.",
        "The repository contains its production-oriented foundation: a modular-monolith FastAPI backend, PostgreSQL persistence and migrations, a minimal React frontend, Docker Compose development services and automated quality checks.",
      ],
      problem:
        "Mid-market distributors already run ERP, inventory, accounting, POS and spreadsheet systems. MOSAIC is meant to sit above them and explain what is happening, why it is happening and what the business should do next.",
      objectives: [
        "Build the ingestion and operations foundations first.",
        "Add forecasting, optimisation, scenario simulation and recommendations incrementally, after those foundations.",
      ],
      approach:
        "A modular monolith: one FastAPI service with explicit layers, PostgreSQL as the system of record with migration-managed schema, and a React and TypeScript frontend that never embeds credentials. Quality is enforced with pytest, Ruff and mypy.",
      architecture: [
        "Core: settings, security and shared application concerns.",
        "Models and schemas: SQLAlchemy persistence models and Pydantic API contracts.",
        "Routers: thin HTTP endpoints.",
        "Services: application orchestration and transaction boundaries.",
        "Domain: framework-independent modules reserved for the future decision engine.",
        "Infrastructure: database and external adapters.",
      ],
      decisions: [
        {
          title: "Tenant-scoped data access",
          detail:
            "Master-data and analytics APIs are authenticated and scoped to the user's organization, and organization IDs are never accepted from clients.",
        },
        {
          title: "Aggregation in PostgreSQL",
          detail:
            "Sales analytics are aggregated in the database within the organization's scope; the browser never aggregates raw sales data.",
        },
        {
          title: "Revocable, database-backed sessions",
          detail:
            "Login creates a revocable session and logout revokes only the current one. Password-reset tokens are hashed, expiring and single-use, and revoke active sessions when consumed.",
        },
        {
          title: "Safe production configuration",
          detail:
            "Production settings reject debug mode, development signing keys, the default database password, SQLite and wildcard or local CORS origins.",
        },
      ],
      scope: {
        implemented: [
          "CSV imports for sales history, products, warehouses, suppliers and inventory snapshots.",
          "A tenant-scoped sales analytics API, grouped by date, product or warehouse.",
          "An overview dashboard of revenue, transactions and trends.",
          "Email verification and optional Google sign-in.",
        ],
        notYetImplemented: [
          "The decision engine: forecasting, machine learning, optimisation, scenario simulation and recommendations.",
          "ERP synchronisation.",
          "Role-based permissions and a distributed rate limiter.",
        ],
      },
      visibility: "published",
    },
    visibility: "published",
  },
  {
    slug: "school-management-system",
    title: "School Management System",
    category: "Backend & web app",
    summary:
      "A full-stack Java application for managing students, teachers, courses, attendance and reports, with secure authentication built on an MVC architecture.",
    tech: ["Java", "JSF", "Hibernate", "MySQL"],
    featured: false,
    repoUrl: "https://github.com/Tech2024ish/school-management-system",
    visibility: "draft",
  },
  {
    slug: "buzhub-platform",
    title: "BuzHub Platform",
    category: "Backend contribution",
    summary:
      "Backend development contribution focused on API design, business logic and persistence for a platform built around real product needs.",
    tech: ["FastAPI", "PostgreSQL", "REST APIs"],
    featured: false,
    visibility: "published",
  },
  {
    slug: "portfolio-website",
    title: "Portfolio Website",
    category: "Full-stack project",
    summary:
      "This site: a responsive personal portfolio showcasing projects, skills and experience, built with a Next.js frontend and a FastAPI and PostgreSQL backend.",
    tech: ["Next.js", "TypeScript", "FastAPI", "PostgreSQL"],
    featured: false,
    repoUrl: "https://github.com/Tech2024ish/portfolio-website",
    liveUrl: "https://goslish.vercel.app",
    visibility: "draft",
  },
];

/**
 * SilverLandTech: [CV] role and highlights; January 2026 – Present confirmed by the owner.
 * Techinika: [V2], kept as an unpublished draft (owner decision, 2026-11-08).
 */
export const experience: Experience[] = [
  {
    organization: "SilverLandTech",
    role: "Backend Developer",
    period: "January 2026 – Present",
    current: true,
    highlights: [
      "Develop scalable backend services using FastAPI and PostgreSQL.",
      "Design and maintain RESTful APIs for business applications.",
      "Collaborate with frontend developers to integrate APIs and improve performance.",
      "Participate in debugging, code reviews and backend architecture discussions.",
    ],
    visibility: "published",
  },
  {
    organization: "Techinika",
    role: "Technical Writer",
    period: "January – September 2026",
    current: false,
    highlights: [
      "Wrote technical articles explaining software engineering concepts.",
      "Produced educational technical content in collaboration with editorial members.",
    ],
    visibility: "draft",
  },
];

/**
 * [CV] institution, degree and coursework. The CV gives no completion date; the V2 seed's
 * "Expected July 2028" is unverified and is therefore not shown.
 */
export const education: Education[] = [
  {
    institution: "University of Rwanda",
    degree: "Bachelor of Science in Computer Science",
    location: "Kigali, Rwanda",
    status: "In progress",
    coursework: [
      "Data Structures & Algorithms",
      "Database Systems",
      "Software Engineering",
      "Web Development",
    ],
    visibility: "published",
  },
];

/**
 * Published entries use the CV's own wording. The V2 seed's "Python Essentials" and
 * "HTML Essentials" names do not appear in the CV, so they are drafts until verified.
 */
export const certifications: Certification[] = [
  { name: "Python programming", issuer: "Cisco Networking Academy", visibility: "published" },
  {
    name: "Data Structures and Algorithms",
    issuer: "A2SV (Africa to Silicon Valley)",
    visibility: "published",
  },
  { name: "Python Essentials", issuer: "Cisco Networking Academy", visibility: "draft" },
  { name: "HTML Essentials", issuer: "Cisco Networking Academy", visibility: "draft" },
];

/**
 * Engineering Notes. None is published yet: the only writing on record (the Techinika technical
 * writer role) is itself an unpublished draft, and no article text has been provided.
 */
export const articles: Article[] = [];

/** In-page navigation, in page order. Every href must match a section id on the home page. */
export const navigation = [
  { label: "About", href: "#about" },
  { label: "Skills", href: "#skills" },
  { label: "Projects", href: "#projects" },
  { label: "Experience", href: "#experience" },
  { label: "Contact", href: "#contact" },
] as const;

/* Public views: the only lists components may render. */
export function isPublished(record: { visibility: Visibility }): boolean {
  return record.visibility === "published";
}

export const publicProjects = projects.filter(isPublished);
export const publicArticles = articles.filter(isPublished);
export const publicExperience = experience.filter(isPublished);
export const publicEducation = education.filter(isPublished);
export const publicCertifications = certifications.filter(isPublished);

/** A published project by slug, or undefined for drafts and unknown slugs. */
export function getPublicProject(slug: string, list: readonly Project[] = projects): Project | undefined {
  return list.find((project) => project.slug === slug && isPublished(project));
}

/** The project's case study, only when both the project and its details are published. */
export function publicDetails(project: Project): ProjectDetails | undefined {
  return isPublished(project) && project.details && isPublished(project.details)
    ? project.details
    : undefined;
}

/** Projects for the home page: featured first, then the rest in their order, at most `limit`. */
export function homeProjects(list: readonly Project[] = publicProjects, limit = 3): Project[] {
  return list
    .filter(isPublished)
    .sort((a, b) => Number(b.featured) - Number(a.featured))
    .slice(0, limit);
}

/** A published article by slug, or undefined for drafts and unknown slugs. */
export function getPublicArticle(slug: string, list: readonly Article[] = articles): Article | undefined {
  return list.find((article) => article.slug === slug && isPublished(article));
}

/** Published articles, newest first. */
export function sortedArticles(list: readonly Article[] = publicArticles): Article[] {
  return list.filter(isPublished).sort((a, b) => b.publishedOn.localeCompare(a.publishedOn));
}
