import type { Metadata } from "next";

import { StudioHeading, StudioUnavailable } from "@/components/owner/studio-ui";
import { cardClasses } from "@/components/ui/section";
import { formatUtc } from "@/lib/owner/actions";
import { OwnerApiUnavailableError, ownerGet, studioSession } from "@/lib/owner/session";
import type { AuditEvent } from "@/lib/owner/types";

export const metadata: Metadata = { title: "Activity" };

const PATH = "/owner/activity";

/** The audit trail: who changed what and when. It records field names, never their contents. */
export default async function ActivityPage() {
  const session = await studioSession(PATH);
  if (!session) return <StudioUnavailable retryHref={PATH} />;
  let events: AuditEvent[];
  try {
    events = await ownerGet<AuditEvent[]>("/api/v1/owner/activity?limit=100", PATH);
  } catch (error) {
    if (error instanceof OwnerApiUnavailableError) return <StudioUnavailable retryHref={PATH} />;
    throw error;
  }
  return (
    <>
      <StudioHeading
        title="Activity"
        description={<p>The latest 100 changes to the portfolio content, newest first.</p>}
      />
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
