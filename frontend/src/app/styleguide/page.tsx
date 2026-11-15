import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ExternalLink } from "@/components/ui/external-link";
import { Alert, EmptyState, ErrorState, Spinner } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { TextLink } from "@/components/ui/link";
import { containerClasses } from "@/components/ui/section";
import { Badge, StatusBadge, Tag } from "@/components/ui/tag";
import { spacingScale, tokenGroups, type Token, type TokenGroupId } from "@/design/tokens";

import { InteractiveDemos } from "./demos";

/**
 * Development-only design-system reference: every token and every reusable component, in
 * their main states. Production builds answer 404 (tested in e2e/design-tokens.spec.ts); the
 * page is never linked or indexed. Its components are exercised in a real browser by
 * e2e/components/*.spec.ts against the dev server.
 */
export const metadata: Metadata = {
  title: "Styleguide",
  robots: { index: false, follow: false },
};

function swatchStyle(group: TokenGroupId, token: Token): CSSProperties | undefined {
  const value = `var(${token.name})`;
  switch (group) {
    case "surface":
    case "border":
    case "text":
    case "accent":
    case "status":
      return { backgroundColor: value };
    case "focus":
      return token.name === "--color-focus" ? { backgroundColor: value } : undefined;
    case "radius":
      return { borderRadius: value };
    case "shadow":
      return { boxShadow: value };
    default:
      return undefined;
  }
}

function hasSwatch(group: TokenGroupId, token: Token): boolean {
  return swatchStyle(group, token) !== undefined;
}

function TokenRow({ group, token }: { group: TokenGroupId; token: Token }) {
  return (
    <li className="flex items-center gap-4 rounded-control border border-border bg-card p-3">
      {hasSwatch(group, token) ? (
        <span
          aria-hidden="true"
          className="size-10 shrink-0 rounded-control border border-border-strong bg-raised"
          style={swatchStyle(group, token)}
        />
      ) : null}
      <span className="flex min-w-0 flex-col">
        <code className="font-mono text-sm text-fg">{token.name}</code>
        <span className="text-sm text-muted">{token.purpose}</span>
      </span>
    </li>
  );
}

function SpacingScale() {
  return (
    // On narrow screens the table scrolls sideways; a scrollable region must be reachable and
    // named for keyboard and screen-reader users (WCAG 2.1.1).
    <div
      role="region"
      aria-label="Spacing scale"
      tabIndex={0}
      className="overflow-x-auto rounded-card border border-border"
    >
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Approved spacing steps</caption>
        <thead className="bg-surface text-muted">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium">
              Step
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Size
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              Use
            </th>
            <th scope="col" className="px-4 py-2 font-medium">
              <span className="sr-only">Sample</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {spacingScale.map(({ step, px, role }) => (
            <tr key={step} className="border-t border-border">
              <th scope="row" className="px-4 py-2 font-mono font-normal text-fg">
                {step}
              </th>
              <td className="px-4 py-2 font-mono whitespace-nowrap text-muted">
                {px / 16}rem / {px}px
              </td>
              <td className="px-4 py-2 text-muted">{role}</td>
              <td className="px-4 py-2">
                <span
                  aria-hidden="true"
                  data-spacing-sample={step}
                  className="block h-3 rounded-control bg-accent"
                  style={{ width: step === "px" ? "1px" : `calc(var(--spacing) * ${step})` }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function StyleguidePage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main id="main" className={`${containerClasses} flex flex-col gap-12 py-12`}>
      <header className="flex flex-col gap-2">
        <p className="font-mono text-sm text-accent">Development only</p>
        <h1 className="font-display text-title font-bold text-fg">Design system</h1>
        <p className="max-w-2xl text-muted">
          Every reusable component and every token from <code className="font-mono">src/app/globals.css</code>
          . Values live only there; this page renders them live.
        </p>
      </header>

      <section aria-labelledby="type-samples" className="flex flex-col gap-4">
        <h2 id="type-samples" className="font-display text-xl font-semibold text-fg">
          Type samples
        </h2>
        <p className="font-display text-display font-extrabold">Display 50px</p>
        <p className="font-display text-title font-semibold">Title 28px</p>
        <p className="text-body">Body 18px, regular</p>
        <p className="font-mono text-sm">JetBrains Mono, 400</p>
      </section>

      <section aria-labelledby="components" className="flex flex-col gap-10">
        <h2 id="components" className="font-display text-title font-bold text-fg">
          Components
        </h2>

        <div className="flex flex-col gap-4">
          <h3 className="font-display text-lg font-semibold text-fg">Buttons</h3>
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button size="sm">Small</Button>
            <Button loading>Saving</Button>
            <Button disabled>Disabled</Button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="font-display text-lg font-semibold text-fg">Links</h3>
          <p className="text-muted">
            An in-site <TextLink href="#components">text link</TextLink> and an{" "}
            <ExternalLink href="https://nextjs.org" className="text-accent underline underline-offset-4">
              external link
            </ExternalLink>
            .
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="font-display text-lg font-semibold text-fg">Badges, tags and status</h3>
          <div className="flex flex-wrap items-center gap-3">
            <Badge>Neutral</Badge>
            <Badge tone="accent">Featured</Badge>
            <Badge tone="success" dot>
              Published
            </Badge>
            <Badge tone="warning" dot>
              Draft
            </Badge>
            <Badge tone="danger">Failed</Badge>
            <Tag>FastAPI</Tag>
            <StatusBadge>Available</StatusBadge>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="font-display text-lg font-semibold text-fg">Cards</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="p-5">A static card groups related content.</Card>
            <Card interactive className="p-5">
              An interactive card adds hover feedback.
            </Card>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="font-display text-lg font-semibold text-fg">Form controls</h3>
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Project title" hint="Shown on the projects page." required>
              {(control) => <Input {...control} defaultValue="MOSAIC" />}
            </Field>
            <Field label="Repository URL" error="Enter a full https:// URL." required>
              {(control) => <Input {...control} type="url" defaultValue="github.com/example" />}
            </Field>
            <Field label="Status">
              {(control) => (
                <Select {...control} defaultValue="draft">
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </Select>
              )}
            </Field>
            <Field label="Disabled">
              {(control) => <Input {...control} defaultValue="Read only" disabled />}
            </Field>
            <Field label="Summary" aside="38 / 280" className="md:col-span-2">
              {(control) => (
                <Textarea {...control} rows={3} defaultValue="A short description of the project." />
              )}
            </Field>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="font-display text-lg font-semibold text-fg">Feedback</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <Alert tone="info" title="Heads up" role="note">
              Changes are visible after publishing.
            </Alert>
            <Alert tone="success" title="Saved" role="note">
              The project was saved as a draft.
            </Alert>
            <Alert tone="warning" title="Unpublished changes" role="note">
              The public page still shows the previous version.
            </Alert>
            <Alert tone="danger" title="Could not save" role="note">
              The server could not be reached. Your changes are still here.
            </Alert>
          </div>
          <div className="flex items-center gap-6 text-accent">
            <Spinner />
            <Spinner size="md" />
            <Spinner size="lg" label="Loading example" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <EmptyState
              title="No projects yet"
              description="Projects you create appear here."
              action={<Button size="sm">Create project</Button>}
              headingLevel={4}
            />
            <ErrorState
              title="Projects could not be loaded"
              description="Check your connection and try again."
              action={
                <Button size="sm" variant="secondary">
                  Try again
                </Button>
              }
              headingLevel={4}
            />
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="font-display text-lg font-semibold text-fg">Dialogs, menus and notifications</h3>
          <InteractiveDemos />
        </div>
      </section>

      {tokenGroups.map((group) => (
        <section key={group.id} aria-labelledby={`tokens-${group.id}`} className="flex flex-col gap-4">
          <h2 id={`tokens-${group.id}`} className="font-display text-xl font-semibold text-fg">
            {group.title}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.tokens.map((token) => (
              <TokenRow key={token.name} group={group.id} token={token} />
            ))}
          </ul>
          {group.id === "spacing" ? <SpacingScale /> : null}
        </section>
      ))}
    </main>
  );
}
