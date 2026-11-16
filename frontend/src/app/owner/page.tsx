import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PasswordForm } from "@/components/owner/password-form";
import { SessionsPanel } from "@/components/owner/sessions-panel";
import { SignOutButton } from "@/components/owner/sign-out-button";
import { buttonClasses } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";
import { cardClasses, containerClasses } from "@/components/ui/section";
import { formatUtc } from "@/lib/owner/actions";
import { getOwnerSession, OwnerApiUnavailableError, ownerGet } from "@/lib/owner/session";
import { loginUrl, STUDIO_PATH, type OwnerOverview, type SessionSummary } from "@/lib/owner/types";

export const metadata: Metadata = { title: { absolute: "Owner Studio" } };

function Unavailable() {
  return (
    <main
      id="main"
      className={`${containerClasses} flex min-h-screen flex-col items-center justify-center gap-6 py-16`}
    >
      <h1 className="font-mono text-sm text-accent">Owner Studio</h1>
      <ErrorState
        headingLevel={2}
        title="The Studio is unavailable"
        description="The server could not be reached, so nothing can be shown or changed right now. Try again in a moment."
        action={
          <Link href={STUDIO_PATH} className={buttonClasses("primary", "sm")}>
            Try again
          </Link>
        }
      />
    </main>
  );
}

function SectionCard({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className={`${cardClasses} flex flex-col gap-5 p-5 sm:p-6`}>
      <h2 id={id} className="font-display text-xl font-bold tracking-tight text-fg">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * The Owner Studio home. Rendered only for a session FastAPI has verified on this request;
 * without one the visitor is sent to sign in, and if the API cannot answer nothing is shown.
 */
export default async function OwnerStudioPage() {
  const result = await getOwnerSession();
  if (result.status === "signed-out") redirect(loginUrl(STUDIO_PATH));
  if (result.status === "unavailable") return <Unavailable />;
  const { session } = result;

  let overview: OwnerOverview;
  let sessions: SessionSummary[];
  try {
    [overview, sessions] = await Promise.all([
      ownerGet<OwnerOverview>("/api/v1/owner/overview", STUDIO_PATH),
      ownerGet<SessionSummary[]>("/api/v1/auth/sessions", STUDIO_PATH),
    ]);
  } catch (error) {
    if (error instanceof OwnerApiUnavailableError) return <Unavailable />;
    throw error; // includes Next's redirect to sign-in
  }

  const counts = [
    { label: "New", value: overview.messages.new },
    { label: "Read", value: overview.messages.read },
    { label: "Archived", value: overview.messages.archived },
  ];

  return (
    <>
      <header className="border-b border-border bg-surface">
        <div className={`${containerClasses} flex h-16 items-center justify-between gap-4`}>
          <p className="font-display text-lg font-extrabold tracking-tight text-fg">
            JC<span className="text-accent">.</span>{" "}
            <span className="font-sans text-sm font-normal text-muted">Owner Studio</span>
          </p>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted sm:inline">{session.user.email}</span>
            <SignOutButton csrfToken={session.csrf_token} />
          </div>
        </div>
      </header>

      <main id="main" className={`${containerClasses} flex flex-col gap-8 py-10 sm:py-12`}>
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-fg">
            Welcome, {session.user.display_name}
          </h1>
          <p className="text-muted">
            Signed in as {session.user.email}. This session ends at {formatUtc(session.expires_at)} at the
            latest.
          </p>
        </div>

        <SectionCard id="messages" title="Contact messages">
          <dl className="grid gap-4 sm:grid-cols-3">
            {counts.map((count) => (
              <div
                key={count.label}
                className="flex flex-col gap-1 rounded-control border border-border bg-surface p-4"
              >
                <dt className="text-sm text-muted">{count.label}</dt>
                <dd className="font-display text-3xl font-bold text-fg">{count.value}</dd>
              </div>
            ))}
          </dl>
        </SectionCard>

        <SectionCard id="sessions" title="Active sessions">
          <SessionsPanel sessions={sessions} csrfToken={session.csrf_token} />
        </SectionCard>

        <SectionCard id="password" title="Change password">
          <PasswordForm csrfToken={session.csrf_token} />
        </SectionCard>

        <p>
          <Link
            href="/"
            className="inline-flex min-h-6 items-center text-sm text-muted underline underline-offset-4 hover:text-fg"
          >
            View the public site
          </Link>
        </p>
      </main>
    </>
  );
}
