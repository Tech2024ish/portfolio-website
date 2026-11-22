// Export the verified content (src/content/profile.ts) as the backend's import file.
//
//   node scripts/export-content.mjs            writes backend/app/cli/verified-content.json
//   node scripts/export-content.mjs --check    fails if that file is out of date
//
// The backend loads it into an empty database with `python -m app.cli.content import`.
// Records keep their publication state: drafts stay drafts. Node strips the TypeScript types.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const content = await import("../src/content/profile.ts");
const { localizeSource } = await import("../src/content/translations.ts");

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const month = (name, year) => {
  const index = MONTHS.indexOf(name);
  if (index === -1) throw new Error(`Unknown month: ${name}`);
  return `${year}-${String(index + 1).padStart(2, "0")}-01`;
};

/** "January 2026 – Present" or "January – September 2026" as structured months. */
export function parsePeriod(period, current) {
  let match = period.match(/^(\w+) (\d{4}) – Present$/);
  if (match) return { start_month: month(match[1], match[2]), end_month: null, is_current: true };
  match = period.match(/^(\w+) – (\w+) (\d{4})$/);
  if (match && !current) {
    return {
      start_month: month(match[1], match[3]),
      end_month: month(match[2], match[3]),
      is_current: false,
    };
  }
  match = period.match(/^(\w+) (\d{4}) – (\w+) (\d{4})$/);
  if (match && !current) {
    return {
      start_month: month(match[1], match[2]),
      end_month: month(match[3], match[4]),
      is_current: false,
    };
  }
  throw new Error(`Unrecognised period "${period}": add its format to scripts/export-content.mjs`);
}

export function exportContent(c) {
  const { profile, principles, skillGroups, projects, experience, education, certifications, articles } = c;
  return {
    profile: {
      name: profile.name,
      initials: profile.initials,
      title: profile.title,
      location: profile.location,
      availability: profile.availability,
      headline: profile.headline,
      summary: profile.summary,
      about_lead: profile.aboutLead,
      about_body: profile.aboutBody,
      email: profile.email,
      cv_href: profile.cvHref,
      portrait_src: profile.portraitSrc,
      portrait_alt: profile.portraitAlt,
      contact_intro: profile.contactIntro,
      social: profile.social,
      principles,
    },
    skill_groups: skillGroups.map((group) => ({ name: group.name, skills: group.skills })),
    experiences: experience.map((job) => ({
      organization: job.organization,
      role: job.role,
      ...parsePeriod(job.period, job.current),
      highlights: job.highlights,
      status: job.visibility,
    })),
    education: education.map((entry) => ({
      institution: entry.institution,
      qualification: entry.degree,
      location: entry.location,
      status_label: entry.status,
      coursework: entry.coursework,
      status: entry.visibility,
    })),
    certifications: certifications.map((cert) => ({
      name: cert.name,
      issuer: cert.issuer,
      status: cert.visibility,
    })),
    projects: projects.map((project) => {
      const d = project.details;
      return {
        slug: project.slug,
        title: project.title,
        category: project.category,
        summary: project.summary,
        tech: project.tech,
        featured: project.featured,
        repo_url: project.repoUrl ?? null,
        live_url: project.liveUrl ?? null,
        status: project.visibility,
        case_study_status: d?.visibility ?? "draft",
        overview: d?.overview ?? [],
        problem: d?.problem ?? null,
        objectives: d?.objectives ?? [],
        approach: d?.approach ?? null,
        architecture: d?.architecture ?? [],
        decisions: d?.decisions ?? [],
        challenges: d?.challenges ?? [],
        outcomes: d?.outcomes ?? [],
        scope_implemented: d?.scope?.implemented ?? [],
        scope_not_yet: d?.scope?.notYetImplemented ?? [],
        media: d?.media ?? [],
        sources: d?.sources ?? [],
      };
    }),
    articles: articles.map((article) => ({
      slug: article.slug,
      title: article.title,
      summary: article.summary,
      category: article.category,
      published_on: article.publishedOn,
      body: article.body
        .map((block) =>
          block.type === "heading"
            ? `## ${block.text}`
            : block.type === "list"
              ? block.items.map((item) => `- ${item}`).join("\n")
              : block.type === "code"
                ? `\`\`\`${block.language}\n${block.code}\n\`\`\``
                : block.text,
        )
        .join("\n\n"),
      status: article.visibility,
    })),
  };
}

const target = fileURLToPath(new URL("../../backend/app/cli/verified-content.json", import.meta.url));
/**
 * The fields the backend accepts translations for (TRANSLATABLE in backend/app/schemas/content.py).
 * Each record's `translations` holds, per language, the fields whose text differs from English.
 */
const TRANSLATABLE = {
  experiences: ["organization", "role", "location", "highlights"],
  education: ["institution", "qualification", "location", "status_label", "coursework"],
  certifications: ["name", "issuer"],
  projects: [
    "category",
    "summary",
    "overview",
    "problem",
    "objectives",
    "approach",
    "architecture",
    "decisions",
    "challenges",
    "outcomes",
    "scope_implemented",
    "scope_not_yet",
  ],
  articles: ["title", "summary", "category", "body"],
};
const PROFILE_TRANSLATABLE = [
  "title",
  "location",
  "availability",
  "headline",
  "summary",
  "about_lead",
  "about_body",
  "portrait_alt",
  "contact_intro",
  "principles",
];

function addTranslation(record, lang, english, translated, fields) {
  const changed = {};
  for (const field of fields) {
    if (JSON.stringify(translated[field]) !== JSON.stringify(english[field]))
      changed[field] = translated[field];
  }
  if (Object.keys(changed).length > 0) record.translations = { ...record.translations, [lang]: changed };
}

/** The English export, with each record's French and Kinyarwanda text in `translations`. */
export function exportWithTranslations(c) {
  const english = exportContent(c);
  const result = structuredClone(english);
  for (const lang of ["fr", "rw"]) {
    const localized = localizeSource(c, lang);
    // Dates are not translated: keep the English period, which the export parses into months.
    localized.experience = localized.experience.map((job, index) => ({
      ...job,
      period: c.experience[index].period,
    }));
    const translated = exportContent({ ...c, ...localized });
    addTranslation(result.profile, lang, english.profile, translated.profile, PROFILE_TRANSLATABLE);
    result.skill_groups.forEach((group, index) =>
      addTranslation(group, lang, english.skill_groups[index], translated.skill_groups[index], ["name"]),
    );
    for (const [key, fields] of Object.entries(TRANSLATABLE)) {
      result[key].forEach((record, index) =>
        addTranslation(record, lang, english[key][index], translated[key][index], fields),
      );
    }
  }
  return result;
}

const json = `${JSON.stringify(exportWithTranslations(content), null, 2)}\n`;

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(target, "utf8").replace(/\r\n/g, "\n");
  } catch {
    // missing file: out of date
  }
  if (current !== json) {
    console.error(
      "backend/app/cli/verified-content.json is out of date: run node scripts/export-content.mjs",
    );
    process.exit(1);
  }
  console.log("verified-content.json is up to date");
} else {
  writeFileSync(target, json);
  console.log(`wrote ${target}`);
}
