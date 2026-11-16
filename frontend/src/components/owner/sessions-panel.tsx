"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/feedback";
import { cardClasses } from "@/components/ui/section";
import { Badge } from "@/components/ui/tag";
import { describeDevice, formatUtc, ownerActions } from "@/lib/owner/actions";
import type { SessionSummary } from "@/lib/owner/types";

import { useOwnerAction } from "./use-owner-action";

/** Every active session of the owner, with a way to end any other one, or all of them. */
export function SessionsPanel({ sessions, csrfToken }: { sessions: SessionSummary[]; csrfToken: string }) {
  const router = useRouter();
  const run = useOwnerAction();
  const [busy, setBusy] = useState<number | "others" | null>(null);
  const [confirmOthers, setConfirmOthers] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const actions = ownerActions(csrfToken);
  const others = sessions.filter((session) => !session.current);

  async function revoke(id: number) {
    setBusy(id);
    const result = await run(() => actions.revokeSession(id));
    setBusy(null);
    setMessage(
      result.ok
        ? { tone: "success", text: "The session was ended." }
        : { tone: "danger", text: result.error?.message ?? "The session could not be ended." },
    );
    router.refresh();
  }

  async function revokeOthers() {
    setBusy("others");
    const result = await run(() => actions.revokeOtherSessions());
    setBusy(null);
    setConfirmOthers(false);
    setMessage(
      result.ok
        ? { tone: "success", text: `${result.value.revoked} other session(s) ended.` }
        : { tone: "danger", text: result.error?.message ?? "The sessions could not be ended." },
    );
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {message ? (
        <Alert tone={message.tone} role={message.tone === "danger" ? "alert" : "status"}>
          {message.text}
        </Alert>
      ) : null}
      <ul className="flex flex-col gap-3" aria-label="Active sessions">
        {sessions.map((session) => (
          <li
            key={session.id}
            className={`${cardClasses} flex flex-wrap items-center justify-between gap-4 p-4`}
          >
            <div className="flex min-w-0 flex-col gap-1">
              <p className="flex flex-wrap items-center gap-2 font-semibold text-fg">
                {describeDevice(session.user_agent)}
                {session.current ? <Badge tone="accent">This browser</Badge> : null}
              </p>
              <p className="text-sm text-muted">
                {session.ip_address ?? "Unknown address"} · signed in {formatUtc(session.created_at)} · last
                active {formatUtc(session.last_seen_at)}
              </p>
            </div>
            {session.current ? null : (
              <Button
                variant="ghost"
                size="sm"
                loading={busy === session.id}
                onClick={() => revoke(session.id)}
                aria-label={`End the session on ${describeDevice(session.user_agent)}, signed in ${formatUtc(session.created_at)}`}
              >
                End session
              </Button>
            )}
          </li>
        ))}
      </ul>
      {others.length > 0 ? (
        <div>
          <Button variant="danger" size="sm" onClick={() => setConfirmOthers(true)}>
            Sign out all other sessions
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted">No other session is active.</p>
      )}
      <ConfirmDialog
        open={confirmOthers}
        tone="danger"
        title="Sign out all other sessions?"
        description={`This ends ${others.length} other session(s). This browser stays signed in.`}
        confirmLabel="Sign them out"
        onConfirm={revokeOthers}
        onCancel={() => setConfirmOthers(false)}
      />
    </div>
  );
}
