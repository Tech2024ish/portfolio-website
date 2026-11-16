import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MessageActions, ReplyForm, RetryButton } from "@/components/owner/message-actions";
import { StudioCard, StudioHeading, StudioUnavailable } from "@/components/owner/studio-ui";
import { Alert } from "@/components/ui/feedback";
import { TextLink } from "@/components/ui/link";
import { cardClasses } from "@/components/ui/section";
import { Badge, type BadgeTone } from "@/components/ui/tag";
import { formatUtc } from "@/lib/owner/actions";
import { OwnerApiUnavailableError, ownerFind, studioSession } from "@/lib/owner/session";
import { DELIVERY_LABELS, type Delivery, type MessageDetail } from "@/lib/owner/types";

export const metadata: Metadata = { title: "Message" };

type Props = { params: Promise<{ id: string }> };

const TONES: Record<Delivery["status"], BadgeTone> = {
  pending: "warning",
  sending: "warning",
  sent: "success",
  failed: "danger",
  skipped: "neutral",
};

function DeliveryRow({ delivery, csrfToken }: { delivery: Delivery; csrfToken: string }) {
  const what = delivery.kind === "notification" ? "Notification to you" : `Reply to ${delivery.recipient}`;
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-fg">{what}</span>
        <Badge tone={TONES[delivery.status]}>{DELIVERY_LABELS[delivery.status]}</Badge>
      </div>
      <p className="text-sm text-muted">
        Queued {formatUtc(delivery.created_at)}
        {delivery.sent_at ? ` · sent ${formatUtc(delivery.sent_at)}` : ""}
        {delivery.attempts
          ? ` · ${delivery.attempts} ${delivery.attempts === 1 ? "attempt" : "attempts"}`
          : ""}
        {delivery.status === "pending" && delivery.next_attempt_at
          ? ` · next attempt ${formatUtc(delivery.next_attempt_at)}`
          : ""}
      </p>
      {delivery.last_error ? <p className="text-sm text-muted">Last problem: {delivery.last_error}</p> : null}
      {delivery.kind === "reply" ? (
        <details className="text-sm">
          <summary className="cursor-pointer text-muted">Show the reply</summary>
          <p className="mt-2 whitespace-pre-wrap text-fg">{delivery.body}</p>
        </details>
      ) : null}
      {delivery.status === "failed" || delivery.status === "skipped" ? (
        <RetryButton deliveryId={delivery.id} csrfToken={csrfToken} />
      ) : null}
    </li>
  );
}

export default async function MessagePage({ params }: Props) {
  const { id } = await params;
  if (!/^[1-9]\d{0,17}$/.test(id)) notFound();
  const path = `/owner/messages/${id}`;
  const session = await studioSession(path);
  if (!session) return <StudioUnavailable retryHref={path} />;

  let message: MessageDetail | null;
  try {
    message = await ownerFind<MessageDetail>(`/api/v1/owner/messages/${id}`, path);
  } catch (error) {
    if (error instanceof OwnerApiUnavailableError) return <StudioUnavailable retryHref={path} />;
    throw error;
  }
  if (!message) notFound();

  return (
    <>
      <p>
        <TextLink href="/owner/messages">← Messages</TextLink>
      </p>
      <StudioHeading
        title={message.subject}
        description={
          <p>
            From {message.name} (
            <a href={`mailto:${message.email}`} className="underline underline-offset-4">
              {message.email}
            </a>
            ), {formatUtc(message.created_at)}.
          </p>
        }
        actions={<MessageActions id={message.id} status={message.status} csrfToken={session.csrf_token} />}
      />
      {message.status === "spam" ? (
        <Alert tone="warning" title="Filed as spam">
          Reason: {message.spam_reason ?? "marked by you"}. No notification was sent for it.
        </Alert>
      ) : null}

      <section aria-label="Message" className={`${cardClasses} p-5 sm:p-6`}>
        {/* Rendered as text: whatever a visitor typed can never become markup. */}
        <p className="whitespace-pre-wrap text-fg">{message.message}</p>
      </section>

      <StudioCard id="reply" title="Reply">
        {message.email_configured ? (
          <ReplyForm id={message.id} to={message.email} csrfToken={session.csrf_token} />
        ) : (
          <p className="text-muted">
            Email is not configured on the server, so replies cannot be sent from here. You can write to{" "}
            <a href={`mailto:${message.email}`} className="underline underline-offset-4">
              {message.email}
            </a>{" "}
            from your own mailbox.
          </p>
        )}
      </StudioCard>

      <StudioCard id="email-history" title="Email history">
        {message.deliveries.length === 0 ? (
          <p className="text-muted">No emails for this message.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {message.deliveries.map((delivery) => (
              <DeliveryRow key={delivery.id} delivery={delivery} csrfToken={session.csrf_token} />
            ))}
          </ul>
        )}
      </StudioCard>
    </>
  );
}
