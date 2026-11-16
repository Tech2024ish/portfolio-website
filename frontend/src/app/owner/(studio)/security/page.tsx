import type { Metadata } from "next";

import { PasswordForm } from "@/components/owner/password-form";
import { SessionsPanel } from "@/components/owner/sessions-panel";
import { StudioCard, StudioHeading, StudioUnavailable } from "@/components/owner/studio-ui";
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
  return (
    <>
      <StudioHeading title="Security" description={<p>Where you are signed in, and your password.</p>} />
      <StudioCard id="sessions" title="Active sessions">
        <SessionsPanel sessions={sessions} csrfToken={session.csrf_token} />
      </StudioCard>
      <StudioCard id="password" title="Change password">
        <PasswordForm csrfToken={session.csrf_token} />
      </StudioCard>
    </>
  );
}
