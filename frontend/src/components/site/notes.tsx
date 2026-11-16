import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { TextLink } from "@/components/ui/link";
import { cardClasses, containerClasses } from "@/components/ui/section";
import type { Article, ArticleBlock } from "@/content/profile";

import { PageHeader } from "./page-header";

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" });

/** An ISO date (YYYY-MM-DD) as a <time> element, e.g. "16 November 2026". */
export function PublishedDate({ isoDate }: { isoDate: string }) {
  return <time dateTime={isoDate}>{dateFormat.format(new Date(`${isoDate}T00:00:00Z`))}</time>;
}

export function noteHref(slug: string): string {
  return `/notes/${slug}`;
}

/** The Engineering Notes listing, newest first, or an empty state. */
export function NotesIndex({ articles }: { articles: readonly Article[] }) {
  return (
    <section aria-label="All notes" className={`${containerClasses} py-12 sm:py-16`}>
      {articles.length === 0 ? (
        <EmptyState
          headingLevel={2}
          title="No notes published yet"
          description="Engineering Notes appear here once they are written and published."
          action={
            <Link href="/projects" className={buttonClasses("secondary", "sm")}>
              See the projects
            </Link>
          }
        />
      ) : (
        <ul className="grid gap-5 md:grid-cols-2">
          {articles.map((article) => (
            <li key={article.slug}>
              <article
                aria-labelledby={`note-${article.slug}`}
                className={`${cardClasses} flex h-full flex-col gap-3 p-5`}
              >
                <p className="flex flex-wrap gap-x-3 font-mono text-xs text-accent">
                  <span>{article.category}</span>
                  <PublishedDate isoDate={article.publishedOn} />
                </p>
                <h2 id={`note-${article.slug}`} className="font-display text-lg font-semibold text-fg">
                  <TextLink
                    href={noteHref(article.slug)}
                    className="inline-flex min-h-6 items-center text-fg"
                  >
                    {article.title}
                  </TextLink>
                </h2>
                <p className="text-sm text-muted">{article.summary}</p>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Block({ block }: { block: ArticleBlock }) {
  switch (block.type) {
    case "heading":
      return <h2 className="mt-4 font-display text-2xl font-bold tracking-tight text-fg">{block.text}</h2>;
    case "list":
      return (
        <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-accent">
          {block.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      );
    case "code":
      return (
        <pre
          tabIndex={0}
          aria-label={`${block.language} code`}
          className="overflow-x-auto rounded-card border border-border bg-surface p-4 font-mono text-sm text-fg"
        >
          <code>{block.code}</code>
        </pre>
      );
    default:
      return <p>{block.text}</p>;
  }
}

/** One note, in a reading-width column. Every block is rendered as text, never as HTML. */
export function ArticleView({ article }: { article: Article }) {
  const titleId = "note-title";
  return (
    <article aria-labelledby={titleId}>
      <PageHeader
        titleId={titleId}
        title={article.title}
        eyebrow={
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <TextLink href="/notes" className="inline-flex min-h-6 items-center">
                  Engineering Notes
                </TextLink>
              </li>
              <li aria-hidden="true" className="text-muted">
                /
              </li>
              <li aria-current="page" className="text-muted">
                {article.title}
              </li>
            </ol>
          </nav>
        }
        description={<p>{article.summary}</p>}
      >
        <p className="flex flex-wrap gap-x-3 font-mono text-sm text-muted">
          <span>{article.category}</span>
          <PublishedDate isoDate={article.publishedOn} />
        </p>
      </PageHeader>
      <div className={`${containerClasses} py-12 sm:py-16`}>
        <div className="flex max-w-prose flex-col gap-5 text-body text-muted">
          {article.body.map((block, index) => (
            <Block key={index} block={block} />
          ))}
        </div>
      </div>
    </article>
  );
}
