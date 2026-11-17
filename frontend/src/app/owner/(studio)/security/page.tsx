import type { Metadata } from "next";

import { PasswordForm } from "@/components/owner/password-form";
import { SessionsPanel } from "@/components/owner/sessions-panel";
import { StudioCard, StudioHeading, StudioUnavailable } from "@/components/owner/studio-ui";
import { TextLink } from "@/components/ui/link";
import { describeDevice, formatUtc } from "@/lib/owner/actions";
import { OwnerApiUnavailableError, ownerGet, studioSession } from "@/lib/owner/session";
import type { SessionSummary } from "@/lib/owner/types";

export const metadata: Metadata = { title: "Security" };

const PATH = "/owner/security";

export default async function SecurityPage() {
  const session = await studioSession(PATH);
  if (!session) return <StudioUnavailable retryHref={PATH} />;
  let sessions: SessionSummary[];
  try {
    sessions = await ownerGet<SessionSummary[]>("/api/v1/auth/sessions", PATH);
  } catch (error) {
    if (error instanceof OwnerApiUnavailableError) return <StudioUnavailable retryHref={PATH} />;
    throw error;
  }
  const current = sessions.find((row) => row.current);
  return (
    <>
      <StudioHeading title="Security" description={<p>Where you are signed in, and your password.</p>} />
      {current ? (
        <StudioCard id="this-session" title="This session">
          <dl className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <dt className="text-sm text-muted">Signed in</dt>
              <dd className="text-fg">{formatUtc(current.created_at)}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-sm text-muted">Device</dt>
              <dd className="text-fg">{describeDevice(current.user_agent)}</dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-sm text-muted">Ends at the latest</dt>
              <dd className="text-fg">{formatUtc(session.expires_at)}</dd>
            </div>
          </dl>
          <p className="text-sm text-muted">
            Sessions also end after two hours without activity. Sign-ins and session changes are listed in{" "}
            <TextLink href="/owner/activity?kind=auth">Activity</TextLink>.
          </p>
        </StudioCard>
      ) : null}
      <StudioCard id="sessions" title="Active sessions">
        <SessionsPanel sessions={sessions} csrfToken={session.csrf_token} />
      </StudioCard>
      <StudioCard id="password" title="Change password">
        <PasswordForm csrfToken={session.csrf_token} />
      </StudioCard>
    </>
  );
}
