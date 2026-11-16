import type { ReactNode } from "react";

import { buttonClasses } from "@/components/ui/button";
import { ExternalLink } from "@/components/ui/external-link";
import { ExternalIcon, GitHubIcon } from "@/components/ui/icons";
import { TextLink } from "@/components/ui/link";
import { MediaImage } from "@/components/ui/media-image";
import { cardClasses, containerClasses } from "@/components/ui/section";
import { TagList } from "@/components/ui/tag";
import type { Project, ProjectDetails } from "@/content/profile";

import { PageHeader } from "./page-header";
import { projectHref } from "./project-card";

function DetailSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="font-display text-xl font-bold tracking-tight text-fg sm:text-2xl">
        {title}
      </h2>
      <div className="flex flex-col gap-4 text-base text-muted">{children}</div>
    </section>
  );
}

function BulletList({ items }: { items: readonly string[] }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-accent">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

/** The case study, section by section. Sections without content are not rendered. */
function CaseStudy({ details }: { details: ProjectDetails }) {
  return (
    <>
      {details.overview?.length ? (
        <DetailSection id="overview" title="Overview">
          {details.overview.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </DetailSection>
      ) : null}
      {details.problem ? (
        <DetailSection id="problem" title="Problem">
          <p>{details.problem}</p>
        </DetailSection>
      ) : null}
      {details.objectives?.length ? (
        <DetailSection id="objectives" title="Motivation and objectives">
          <BulletList items={details.objectives} />
        </DetailSection>
      ) : null}
      {details.approach ? (
        <DetailSection id="approach" title="Technical approach">
          <p>{details.approach}</p>
        </DetailSection>
      ) : null}
      {details.architecture?.length ? (
        <DetailSection id="architecture" title="Architecture overview">
          <BulletList items={details.architecture} />
        </DetailSection>
      ) : null}
      {details.decisions?.length ? (
        <DetailSection id="decisions" title="Engineering decisions">
          <dl className="flex flex-col gap-5">
            {details.decisions.map((decision) => (
              <div key={decision.title} className="flex flex-col gap-1">
                <dt className="font-semibold text-fg">{decision.title}</dt>
                <dd>{decision.detail}</dd>
              </div>
            ))}
          </dl>
        </DetailSection>
      ) : null}
      {details.challenges?.length ? (
        <DetailSection id="challenges" title="Challenges and solutions">
          <ul className="flex flex-col gap-4">
            {details.challenges.map((item) => (
              <li key={item.challenge} className={`${cardClasses} flex flex-col gap-2 p-5`}>
                <p>
                  <span className="font-semibold text-fg">Challenge: </span>
                  {item.challenge}
                </p>
                <p>
                  <span className="font-semibold text-fg">Solution: </span>
                  {item.solution}
                </p>
              </li>
            ))}
          </ul>
        </DetailSection>
      ) : null}
      {details.outcomes?.length ? (
        <DetailSection id="outcomes" title="Outcomes">
          <BulletList items={details.outcomes} />
        </DetailSection>
      ) : null}
      {details.scope ? (
        <DetailSection id="scope" title="Current scope">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <h3 className="font-semibold text-fg">Implemented</h3>
              <BulletList items={details.scope.implemented} />
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="font-semibold text-fg">Not yet implemented</h3>
              <BulletList items={details.scope.notYetImplemented} />
            </div>
          </div>
        </DetailSection>
      ) : null}
      {details.media?.length ? (
        <DetailSection id="media" title="Screenshots">
          <div className="grid gap-6">
            {details.media.map((item) => (
              <figure key={item.src} className="flex flex-col gap-2">
                <MediaImage
                  src={item.src}
                  alt={item.alt}
                  width={item.width}
                  height={item.height}
                  variants={item.variants}
                  sizes="(min-width: 1024px) 48rem, 100vw"
                  className="h-auto w-full rounded-card border border-border"
                />
                {item.caption ? <figcaption className="text-sm">{item.caption}</figcaption> : null}
              </figure>
            ))}
          </div>
        </DetailSection>
      ) : null}
    </>
  );
}

/**
 * A project's page. `details` is passed only when it is published; without it the page shows the
 * verified essentials (summary, technologies, links) and nothing invented to fill the gaps.
 */
export function ProjectDetail({
  project,
  details,
  related,
}: {
  project: Project;
  details?: ProjectDetails;
  related: readonly Project[];
}) {
  const titleId = "project-title";
  return (
    <article aria-labelledby={titleId}>
      <PageHeader
        titleId={titleId}
        title={project.title}
        eyebrow={
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <TextLink href="/projects" className="inline-flex min-h-6 items-center">
                  Projects
                </TextLink>
              </li>
              <li aria-hidden="true" className="text-muted">
                /
              </li>
              <li aria-current="page" className="text-muted">
                {project.title}
              </li>
            </ol>
          </nav>
        }
        description={<p>{project.summary}</p>}
      >
        {project.repoUrl || project.liveUrl ? (
          <div className="flex flex-wrap gap-3">
            {project.repoUrl ? (
              <ExternalLink href={project.repoUrl} className={buttonClasses("secondary", "sm")}>
                <GitHubIcon className="size-4" />
                Source code
              </ExternalLink>
            ) : null}
            {project.liveUrl ? (
              <ExternalLink href={project.liveUrl} className={buttonClasses("primary", "sm")}>
                <ExternalIcon className="size-4" />
                Live site
              </ExternalLink>
            ) : null}
          </div>
        ) : null}
      </PageHeader>

      <div className={`${containerClasses} flex flex-col gap-12 py-12 sm:py-16`}>
        <aside aria-label="Project facts" className="grid gap-4 sm:grid-cols-3">
          <div className={`${cardClasses} flex flex-col gap-2 p-5`}>
            <h2 className="text-sm font-semibold text-fg">Category</h2>
            <p className="font-mono text-sm text-accent">{project.category}</p>
          </div>
          <div className={`${cardClasses} flex flex-col gap-2 p-5`}>
            <h2 className="text-sm font-semibold text-fg">Technologies</h2>
            <TagList items={project.tech} label={`${project.title} technologies`} />
          </div>
          <div className={`${cardClasses} flex flex-col gap-2 p-5`}>
            <h2 className="text-sm font-semibold text-fg">Links</h2>
            {project.repoUrl || project.liveUrl ? (
              <ul className="flex flex-col gap-1 text-sm">
                {project.repoUrl ? (
                  <li>
                    <ExternalLink
                      href={project.repoUrl}
                      className="inline-flex min-h-6 items-center text-accent underline underline-offset-4"
                    >
                      Source code on GitHub
                    </ExternalLink>
                  </li>
                ) : null}
                {project.liveUrl ? (
                  <li>
                    <ExternalLink
                      href={project.liveUrl}
                      className="inline-flex min-h-6 items-center text-accent underline underline-offset-4"
                    >
                      Live site
                    </ExternalLink>
                  </li>
                ) : null}
              </ul>
            ) : (
              <p className="text-sm text-muted">No public link available</p>
            )}
          </div>
        </aside>

        {details ? (
          <div className="flex max-w-3xl flex-col gap-10">
            <CaseStudy details={details} />
          </div>
        ) : null}
      </div>

      {related.length > 0 ? (
        <nav aria-labelledby="more-projects" className="border-t border-border">
          <div className={`${containerClasses} flex flex-col gap-4 py-12`}>
            <h2 id="more-projects" className="font-display text-xl font-bold tracking-tight text-fg">
              More projects
            </h2>
            <ul className="flex flex-wrap gap-x-6 gap-y-2">
              {related.map((other) => (
                <li key={other.slug}>
                  <TextLink href={projectHref(other.slug)} className="inline-flex min-h-6 items-center">
                    {other.title}
                  </TextLink>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      ) : null}
    </article>
  );
}
