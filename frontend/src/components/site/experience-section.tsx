import { BadgeIcon, GraduationIcon } from "@/components/ui/icons";
import { cardClasses, Section } from "@/components/ui/section";
import { certifications, education, experience } from "@/content/profile";

export function ExperienceSection() {
  return (
    <Section id="experience" eyebrow="Experience" title="Experience and education">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-12">
        <ol
          className="relative flex flex-col gap-8 border-l border-border-strong pl-6"
          aria-label="Work history"
        >
          {experience.map((job) => (
            <li key={`${job.organization}-${job.role}`} className="relative">
              <span
                aria-hidden="true"
                className={`absolute top-1.5 -left-[1.9rem] size-3 rounded-full border-2 border-canvas ${
                  job.current ? "bg-accent" : "bg-border-strong"
                }`}
              />
              <article className="flex flex-col gap-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <h3 className="font-display text-lg font-semibold text-fg">
                    {job.role} <span className="text-muted">·</span>{" "}
                    <span className="text-accent">{job.organization}</span>
                  </h3>
                  <p className="shrink-0 font-mono text-xs text-muted">{job.period}</p>
                </div>
                <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted marker:text-accent">
                  {job.highlights.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
              </article>
            </li>
          ))}
        </ol>

        <div className="flex flex-col gap-4">
          {education.map((entry) => (
            <article key={entry.institution} className={`${cardClasses} flex flex-col gap-3 p-5`}>
              <div className="flex items-center gap-3">
                <span className="inline-flex size-10 items-center justify-center rounded-control bg-accent-soft text-accent">
                  <GraduationIcon />
                </span>
                <div>
                  <h3 className="font-display text-base font-semibold text-fg">{entry.institution}</h3>
                  <p className="text-sm text-muted">{entry.location}</p>
                </div>
              </div>
              <p className="text-sm text-fg">{entry.degree}</p>
              <p className="font-mono text-xs text-accent">{entry.status}</p>
              <p className="text-sm text-muted">
                <span className="text-fg/90">Relevant coursework:</span> {entry.coursework.join(", ")}
              </p>
            </article>
          ))}

          <article className={`${cardClasses} flex flex-col gap-3 p-5`}>
            <div className="flex items-center gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-control bg-accent-soft text-accent">
                <BadgeIcon />
              </span>
              <h3 className="font-display text-base font-semibold text-fg">Certifications and training</h3>
            </div>
            <ul className="flex flex-col gap-3">
              {certifications.map((cert) => (
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
