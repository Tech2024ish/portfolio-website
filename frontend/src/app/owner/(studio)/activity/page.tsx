import type { Metadata } from "next";
import Link from "next/link";

import { StudioHeading, StudioUnavailable } from "@/components/owner/studio-ui";
import { cardClasses } from "@/components/ui/section";
import { cx } from "@/lib/cx";
import { formatUtc } from "@/lib/owner/actions";
import { OwnerApiUnavailableError, ownerGet, studioSession } from "@/lib/owner/session";
import type { AuditEvent } from "@/lib/owner/types";

export const metadata: Metadata = { title: "Activity" };

const PATH = "/owner/activity";

const KINDS = [
  { value: undefined, label: "All" },
  { value: "content", label: "Content" },
  { value: "media", label: "Media" },
  { value: "messages", label: "Messages" },
  { value: "settings", label: "Settings" },
  { value: "auth", label: "Sign-ins and security" },
] as const;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * The audit trail: who changed what and when, including sign-ins and session changes. It records
 * field names, never their contents, and never credentials, tokens or addresses.
 */
export default async function ActivityPage({ searchParams }: Props) {
  const session = await studioSession(PATH);
  if (!session) return <StudioUnavailable retryHref={PATH} />;
  const raw = (await searchParams).kind;
  const kind = KINDS.find((option) => option.value && option.value === raw)?.value;
  let events: AuditEvent[];
  try {
    events = await ownerGet<AuditEvent[]>(
      `/api/v1/owner/activity?limit=100${kind ? `&kind=${kind}` : ""}`,
      kind ? `${PATH}?kind=${kind}` : PATH,
    );
  } catch (error) {
    if (error instanceof OwnerApiUnavailableError) return <StudioUnavailable retryHref={PATH} />;
    throw error;
  }
  return (
    <>
      <StudioHeading title="Activity" description={<p>The latest 100 recorded actions, newest first.</p>} />
      <nav aria-label="Activity filter">
        <ul className="flex flex-wrap gap-2">
          {KINDS.map((option) => (
            <li key={option.label}>
              <Link
                href={option.value ? `${PATH}?kind=${option.value}` : PATH}
                aria-current={option.value === kind ? "page" : undefined}
                className={cx(
                  "inline-flex min-h-10 items-center rounded-control px-3 text-sm",
                  option.value === kind
                    ? "bg-accent-soft font-medium text-accent"
                    : "text-muted hover:bg-raised hover:text-fg",
                )}
              >
                {option.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {events.length === 0 ? (
        <p className="text-muted">Nothing has changed yet.</p>
      ) : (
        <ol className={`${cardClasses} flex flex-col divide-y divide-border`}>
          {events.map((event) => (
            <li key={event.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:justify-between sm:gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-fg">{event.summary}</span>
                {event.changed_fields.length > 0 ? (
                  <span className="text-sm text-muted">Changed: {event.changed_fields.join(", ")}</span>
                ) : null}
              </div>
              <span className="shrink-0 text-sm text-muted">{formatUtc(event.created_at)}</span>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
