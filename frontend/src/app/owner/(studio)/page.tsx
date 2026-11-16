import type { Metadata } from "next";
import Link from "next/link";

import { StudioCard, StudioHeading, StudioUnavailable } from "@/components/owner/studio-ui";
import { TextLink } from "@/components/ui/link";
import { formatUtc } from "@/lib/owner/actions";
import { COLLECTIONS } from "@/lib/owner/content-schema";
import { OwnerApiUnavailableError, ownerGet, studioSession } from "@/lib/owner/session";
import { STUDIO_PATH, type OwnerDashboard } from "@/lib/owner/types";

export const metadata: Metadata = { title: { absolute: "Owner Studio" } };

const tile = "flex flex-col gap-1 rounded-control border border-border bg-surface p-4";

/**
 * The Studio home: what is published, what is still a draft, new messages and recent changes.
 * Rendered only for a session FastAPI has verified on this request.
 */
export default async function OwnerStudioPage() {
  const session = await studioSession(STUDIO_PATH);
  if (!session) return <StudioUnavailable retryHref={STUDIO_PATH} />;

  let dashboard: OwnerDashboard;
  try {
    dashboard = await ownerGet<OwnerDashboard>("/api/v1/owner/dashboard", STUDIO_PATH);
  } catch (error) {
    if (error instanceof OwnerApiUnavailableError) return <StudioUnavailable retryHref={STUDIO_PATH} />;
    throw error; // includes Next's redirect to sign-in
  }

  const counts = [
    { label: "New", value: dashboard.messages.new },
    { label: "Read", value: dashboard.messages.read },
    { label: "Archived", value: dashboard.messages.archived },
  ];
  const content = COLLECTIONS.filter((spec) => dashboard.content[spec.key]);

  return (
    <>
      <StudioHeading
        title={`Welcome, ${session.user.display_name}`}
        description={
          <p>
            Signed in as {session.user.email}. This session ends at {formatUtc(session.expires_at)} at the
            latest.
          </p>
        }
      />

      <StudioCard id="content" title="Content">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {content.map((spec) => {
            const count = dashboard.content[spec.key]!;
            return (
              <li key={spec.key} className={tile}>
                <TextLink
                  href={`/owner/content/${spec.key}`}
                  className="inline-flex min-h-6 items-center font-medium"
                >
                  {spec.label}
                </TextLink>
                <p className="text-sm text-muted">
                  {count.published} published · {count.draft} {count.draft === 1 ? "draft" : "drafts"}
                </p>
              </li>
            );
          })}
        </ul>
        <p className="text-sm text-muted">
          Also: <TextLink href="/owner/profile">profile</TextLink>,{" "}
          <TextLink href="/owner/content/skill-categories">skill groups</TextLink> and{" "}
          <TextLink href="/owner/content/skills">skills</TextLink>.
        </p>
      </StudioCard>

      <StudioCard id="messages" title="Contact messages">
        <dl className="grid gap-4 sm:grid-cols-3">
          {counts.map((count) => (
            <div key={count.label} className={tile}>
              <dt className="text-sm text-muted">{count.label}</dt>
              <dd className="font-display text-3xl font-bold text-fg">{count.value}</dd>
            </div>
          ))}
        </dl>
        {dashboard.recent_messages.length > 0 ? (
          <ul aria-label="Recent messages" className="flex flex-col divide-y divide-border">
            {dashboard.recent_messages.map((message) => (
              <li key={message.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                <span className="text-fg">
                  {message.subject} <span className="text-muted">from {message.name}</span>
                </span>
                <span className="text-muted">{formatUtc(message.created_at)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </StudioCard>

      <StudioCard id="recent-activity" title="Recent changes">
        {dashboard.recent_activity.length === 0 ? (
          <p className="text-muted">Nothing has changed yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {dashboard.recent_activity.map((event) => (
              <li key={event.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                <span className="text-fg">{event.summary}</span>
                <span className="text-muted">{formatUtc(event.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
        <p>
          <TextLink href="/owner/activity">All activity</TextLink>
        </p>
      </StudioCard>

      <p>
        <Link
          href="/"
          className="inline-flex min-h-6 items-center text-sm text-muted underline underline-offset-4 hover:text-fg"
        >
          View the public site
        </Link>
      </p>
    </>
  );
}
