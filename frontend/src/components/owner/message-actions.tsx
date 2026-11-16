"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/feedback";
import { Field, Textarea } from "@/components/ui/form";
import { inboxActions } from "@/lib/owner/actions";
import type { MessageStatus } from "@/lib/owner/types";
import { useHydrated } from "@/lib/use-hydrated";

import { useOwnerAction } from "./use-owner-action";

const MOVES: { to: MessageStatus; label: string; from: MessageStatus[] }[] = [
  { to: "new", label: "Mark as unread", from: ["read"] },
  { to: "archived", label: "Archive", from: ["new", "read"] },
  { to: "read", label: "Move to inbox", from: ["archived", "spam"] },
  { to: "spam", label: "Mark as spam", from: ["new", "read", "archived"] },
];

/**
 * Status changes and deletion for one message. Opening an unread message marks it as read
 * (once, after the page has loaded in the browser: never on a server render or a prefetch).
 */
export function MessageActions({
  id,
  status,
  csrfToken,
}: {
  id: number;
  status: MessageStatus;
  csrfToken: string;
}) {
  const router = useRouter();
  const run = useOwnerAction();
  const hydrated = useHydrated();
  const [busy, setBusy] = useState<MessageStatus | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const markedRead = useRef(false);
  const actions = inboxActions(csrfToken);

  useEffect(() => {
    if (status !== "new" || markedRead.current) return;
    markedRead.current = true;
    void inboxActions(csrfToken)
      .setStatus(id, "read")
      .then(() => router.refresh())
      .catch(() => undefined); // it stays unread; nothing else depends on it
  }, [id, status, csrfToken, router]);

  async function move(to: MessageStatus) {
    setBusy(to);
    setFailure(null);
    const result = await run(() => actions.setStatus(id, to));
    setBusy(null);
    if (result.ok) {
      if (to === "new") markedRead.current = true; // do not undo "Mark as unread"
      router.refresh();
    } else if (result.error?.status !== 401)
      setFailure(result.error?.message ?? "That did not work. Try again.");
  }

  async function remove() {
    const result = await run(() => actions.remove(id));
    setConfirming(false);
    if (result.ok) router.replace("/owner/messages");
    else if (result.error?.status !== 401) setFailure(result.error?.message ?? "It could not be deleted.");
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {MOVES.filter((item) => item.from.includes(status)).map((item) => (
          <Button
            key={item.to}
            variant="secondary"
            size="sm"
            disabled={!hydrated}
            loading={busy === item.to}
            onClick={() => move(item.to)}
          >
            {item.label}
          </Button>
        ))}
        <Button variant="danger" size="sm" disabled={!hydrated} onClick={() => setConfirming(true)}>
          Delete
        </Button>
      </div>
      {failure ? <Alert tone="danger">{failure}</Alert> : null}
      <ConfirmDialog
        open={confirming}
        tone="danger"
        title="Delete this message?"
        description="The message and its email history are removed for good, including the sender's details."
        confirmLabel="Delete"
        onConfirm={remove}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}

export function RetryButton({ deliveryId, csrfToken }: { deliveryId: number; csrfToken: string }) {
  const router = useRouter();
  const run = useOwnerAction();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function retry() {
    setPending(true);
    setFailure(null);
    const result = await run(() => inboxActions(csrfToken).retry(deliveryId));
    setPending(false);
    if (result.ok) router.refresh();
    else if (result.error?.status !== 401) setFailure(result.error?.message ?? "It could not be sent again.");
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button variant="secondary" size="sm" loading={pending} onClick={retry}>
          Send again
        </Button>
      </div>
      {failure ? <Alert tone="danger">{failure}</Alert> : null}
    </div>
  );
}

export function ReplyForm({ id, to, csrfToken }: { id: number; to: string; csrfToken: string }) {
  const router = useRouter();
  const run = useOwnerAction();
  const hydrated = useHydrated();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    if (body.trim().length < 2) {
      setError("Write a reply.");
      return;
    }
    setError(null);
    setPending(true);
    const result = await run(() => inboxActions(csrfToken).reply(id, body));
    setPending(false);
    if (result.ok) {
      setBody("");
      // Queued, not "sent": the email history below shows what the provider did.
      setNotice("Reply queued. Its delivery status is shown under Email history.");
      router.refresh();
      return;
    }
    if (result.error?.status === 401) return;
    const field = result.error?.fields.find((item) => item.field === "body");
    setError(field?.message ?? result.error?.message ?? "The reply could not be queued.");
  }

  return (
    <form aria-label="Reply" method="post" noValidate onSubmit={onSubmit} className="flex flex-col gap-4">
      {notice ? (
        <Alert tone="success" role="status">
          {notice}
        </Alert>
      ) : null}
      <Field
        label={`Reply to ${to}`}
        error={error}
        hint="Sent as plain text by email; the sender can answer you directly."
      >
        {(props) => (
          <Textarea
            {...props}
            rows={6}
            maxLength={10_000}
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        )}
      </Field>
      <div>
        <Button type="submit" loading={pending} disabled={!hydrated}>
          Send reply
        </Button>
      </div>
    </form>
  );
}
