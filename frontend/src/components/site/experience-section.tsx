import { BadgeIcon, BriefcaseIcon, CalendarIcon, GraduationIcon, MapPinIcon } from "@/components/ui/icons";
import { cardClasses, Section } from "@/components/ui/section";
import { Badge } from "@/components/ui/tag";
import type { Certification, Education, Experience } from "@/content/profile";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { dictionary } from "@/i18n/dictionaries";

/** Only published records reach these props (see src/lib/content/portfolio.ts). */
export function ExperienceSection({
  experience: publicExperience,
  education: publicEducation,
  certifications: publicCertifications,
  lang = DEFAULT_LOCALE,
}: {
  experience: Experience[];
  education: Education[];
  certifications: Certification[];
  lang?: Locale;
}) {
  const t = dictionary(lang).sections;
  return (
    <Section id="experience" title={t.experience} tone="band">
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <ol className="flex flex-col gap-5" aria-label={t.workHistory}>
          {publicExperience.map((job) => (
            <li key={`${job.organization}-${job.role}`}>
              <article className={`${cardClasses} flex flex-col gap-4 p-6`}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                  <div className="flex flex-col gap-1">
                    <h3 className="flex items-center gap-2 text-base font-medium text-fg">
                      <BriefcaseIcon className="size-5" />
                      {job.role}
                    </h3>
                    <p className="text-base text-fg">{job.organization}</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1 text-sm text-muted sm:items-end">
                    <p className="flex items-center gap-2">
                      <CalendarIcon className="size-4" />
                      {job.period}
                    </p>
                    {job.current ? (
                      <Badge tone="success" dot>
                        {t.current}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted marker:text-subtle">
                  {job.highlights.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
              </article>
            </li>
          ))}
        </ol>

        <div className="grid gap-5 md:grid-cols-2">
          {publicEducation.map((entry) => (
            <article key={entry.institution} className={`${cardClasses} flex flex-col gap-3 p-6`}>
              <h3 className="flex items-center gap-2 text-base font-medium text-fg">
                <GraduationIcon className="size-5" />
                {entry.institution}
              </h3>
              <p className="flex items-center gap-2 text-sm text-muted">
                <MapPinIcon className="size-4" />
                {entry.location}
              </p>
              <p className="text-sm text-fg">{entry.degree}</p>
              <Badge tone="neutral">{entry.status}</Badge>
              <p className="text-sm text-muted">
                <span className="text-fg">{t.relevantCoursework}</span> {entry.coursework.join(", ")}
              </p>
            </article>
          ))}

          <article className={`${cardClasses} flex flex-col gap-3 p-6`}>
            <h3 className="flex items-center gap-2 text-base font-medium text-fg">
              <BadgeIcon className="size-5" />
              {t.certifications}
            </h3>
            <ul className="flex flex-col gap-3">
              {publicCertifications.map((cert) => (
                <li key={cert.name} className="text-sm">
                  <p className="text-fg">{cert.name}</p>
                  <p className="text-muted">{cert.issuer}</p>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </div>
    </Section>
  );
}
