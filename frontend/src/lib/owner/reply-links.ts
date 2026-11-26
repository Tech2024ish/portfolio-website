import { formatUtc } from "@/lib/owner/actions";
import type { MessageDetail } from "@/lib/owner/types";

/**
 * Reply links for when the server cannot send email (no domain for a provider yet): the owner
 * answers from their own mailbox, with the reply already addressed, titled and quoting the
 * visitor's message. Every visitor-written value is percent-encoded, so a crafted subject or
 * address can never add recipients or headers (`&bcc=`, `?cc=`) to the link (RFC 6068).
 */

type Source = Pick<MessageDetail, "name" | "email" | "subject" | "message" | "created_at">;

/** Long links are cut by some mail apps and browsers: the quote is shortened past this. */
export const MAX_QUOTE_CHARS = 1500;

export function replySubject(subject: string): string {
  const trimmed = subject.trim();
  return /^re:/i.test(trimmed) ? trimmed : `Re: ${trimmed}`;
}

export function replyBody(source: Source): string {
  const text = source.message.trim();
  const quote = text.length > MAX_QUOTE_CHARS ? `${text.slice(0, MAX_QUOTE_CHARS).trimEnd()} […]` : text;
  return [
    `Hello ${source.name.trim()},`,
    "",
    "",
    "",
    `On ${formatUtc(source.created_at)}, you wrote through the contact form:`,
    ...quote.split(/\r?\n/).map((line) => `> ${line}`),
  ].join("\r\n"); // RFC 6068: line breaks in a mailto body are CRLF
}

const encode = encodeURIComponent;

/** Opens the default mail app. The address keeps its "@" readable; everything else is encoded. */
export function mailtoReply(source: Source): string {
  const to = encode(source.email.trim()).replace(/%40/g, "@");
  return `mailto:${to}?subject=${encode(replySubject(source.subject))}&body=${encode(replyBody(source))}`;
}

/** Opens Gmail's compose window in the browser: works without a mail app installed. */
export function gmailReply(source: Source): string {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: source.email.trim(),
    su: replySubject(source.subject),
    body: replyBody(source).replace(/\r\n/g, "\n"),
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}
