/**
 * Verified public portfolio content.
 *
 * Every entry comes from one of two owner-authored sources, noted per section:
 *   [CV]   frontend/public/Resume.pdf
 *   [V2]   the published (visible) entries of the V2 seed, backend/legacy/services/seed.py,
 *          which were taken from the live V1 site and the owner's public GitHub repositories.
 * Entries the V2 seed marked as hidden or draft (no verified details) are deliberately absent.
 *
 * This file is the static source until the public content API exists; the shapes mirror
 * that API so the components will not change when data moves to FastAPI.
 */

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
  social: SocialLink[];
  contactIntro: string;
};

export type Principle = {
  title: string;
  body: string;
  icon: "architecture" | "database" | "api" | "quality";
};

export type SkillGroup = { name: string; skills: string[] };

export type Project = {
  slug: string;
  title: string;
  category: string;
  summary: string;
  tech: string[];
  featured: boolean;
  repoUrl?: string;
  liveUrl?: string;
};

export type Experience = {
  organization: string;
  role: string;
  period: string;
  current: boolean;
  highlights: string[];
};

export type Education = {
  institution: string;
  degree: string;
  location: string;
  status: string;
  coursework: string[];
};

export type Certification = { name: string; issuer: string };

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

/** [V2] published projects only; tech and summaries as published. Portfolio stack reflects this repository. */
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
  },
  {
    slug: "school-management-system",
    title: "School Management System",
    category: "Backend & web app",
    summary:
      "A full-stack Java application for managing students, teachers, courses, attendance and reports, with secure authentication built on an MVC architecture.",
    tech: ["Java", "JSF", "Hibernate", "MySQL"],
    featured: true,
    repoUrl: "https://github.com/Tech2024ish/school-management-system",
  },
  {
    slug: "buzhub-platform",
    title: "BuzHub Platform",
    category: "Backend contribution",
    summary:
      "Backend development contribution focused on API design, business logic and persistence for a platform built around real product needs.",
    tech: ["FastAPI", "PostgreSQL", "REST APIs"],
    featured: false,
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
  },
];

/** SilverLandTech: [CV] role, dates and highlights. Techinika: [V2]. */
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
  },
];

/** [CV] institution, degree, coursework; [V2] status and expected completion. */
export const education: Education[] = [
  {
    institution: "University of Rwanda",
    degree: "Bachelor of Science in Computer Science",
    location: "Kigali, Rwanda",
    status: "In progress · expected July 2028",
    coursework: [
      "Data Structures & Algorithms",
      "Database Systems",
      "Software Engineering",
      "Web Development",
    ],
  },
];

/** [V2] Cisco certifications; [CV] A2SV training. */
export const certifications: Certification[] = [
  { name: "Python Essentials", issuer: "Cisco Networking Academy" },
  { name: "HTML Essentials", issuer: "Cisco Networking Academy" },
  { name: "Data Structures & Algorithms training", issuer: "A2SV (Africa to Silicon Valley)" },
];

/** In-page navigation, in page order. Every href must match a section id on the home page. */
export const navigation = [
  { label: "About", href: "#about" },
  { label: "Skills", href: "#skills" },
  { label: "Projects", href: "#projects" },
  { label: "Experience", href: "#experience" },
  { label: "Contact", href: "#contact" },
] as const;
