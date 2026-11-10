/**
 * Contact-form contract shared by the form and its tests. Limits mirror the FastAPI schema
 * (`backend/app/schemas/contact.py`); the server stays the authority and re-validates.
 */
import { api, ApiError } from "@/lib/api/client";

export const CONTACT_LIMITS = {
  name: { min: 2, max: 100 },
  email: { max: 254 },
  subject: { min: 3, max: 150 },
  message: { min: 10, max: 5000 },
} as const;

export type ContactField = "name" | "email" | "subject" | "message";
export type ContactValues = Record<ContactField, string>;
export type FieldErrors = Partial<Record<ContactField, string>>;

export const CONTACT_FIELDS: readonly ContactField[] = ["name", "email", "subject", "message"];

// Deliberately simple: one "@", no spaces, a dot in the domain. The server does the strict check.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateContact(values: ContactValues): FieldErrors {
  const errors: FieldErrors = {};
  const name = values.name.trim();
  const email = values.email.trim();
  const subject = values.subject.trim();
  const message = values.message.trim();

  if (!name) errors.name = "Enter your name.";
  else if (name.length < CONTACT_LIMITS.name.min) errors.name = "Name must be at least 2 characters.";
  else if (name.length > CONTACT_LIMITS.name.max) errors.name = "Name must be at most 100 characters.";

  if (!email) errors.email = "Enter your email address.";
  else if (email.length > CONTACT_LIMITS.email.max || !EMAIL_PATTERN.test(email))
    errors.email = "Enter a valid email address, like name@example.com.";

  if (!subject) errors.subject = "Enter a subject.";
  else if (subject.length < CONTACT_LIMITS.subject.min)
    errors.subject = "Subject must be at least 3 characters.";
  else if (subject.length > CONTACT_LIMITS.subject.max)
    errors.subject = "Subject must be at most 150 characters.";

  if (!message) errors.message = "Enter a message.";
  else if (message.length < CONTACT_LIMITS.message.min)
    errors.message = "Message must be at least 10 characters.";
  else if (message.length > CONTACT_LIMITS.message.max)
    errors.message = "Message must be at most 5,000 characters.";

  return errors;
}

export type SubmitResult =
  | { ok: true }
  | { ok: false; kind: "validation"; fieldErrors: FieldErrors; message: string }
  | {
      ok: false;
      kind: "rate_limited" | "unavailable" | "network" | "timeout" | "unknown";
      message: string;
    };

/** A hung proxy or backend must not leave the visitor on "Sending…" indefinitely. */
export const SUBMIT_TIMEOUT_MS = 15_000;

const MESSAGES = {
  rateLimited: "You've sent several messages recently. Please wait a while before trying again.",
  unavailable: "The message service is temporarily unavailable, so your message was not sent.",
  network: "We couldn't reach the server, so your message was not sent. Check your connection.",
  // A timeout cannot prove the message was not stored, so this does not claim either way.
  timeout: "The server took too long to respond, so your message may not have been sent.",
  unknown: "Something went wrong and your message was not sent.",
  validation: "Some fields need attention.",
};

function isContactField(field: string): field is ContactField {
  return (CONTACT_FIELDS as readonly string[]).includes(field);
}

/** Posts to FastAPI and resolves success only when the API confirms the message was stored. */
export async function submitContact(
  values: ContactValues,
  website: string,
  client: Pick<typeof api, "post"> = api,
  timeoutMs: number = SUBMIT_TIMEOUT_MS,
): Promise<SubmitResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const receipt = await client.post<{ status?: unknown }>(
      "/api/v1/contact",
      {
        name: values.name.trim(),
        email: values.email.trim(),
        subject: values.subject.trim(),
        message: values.message.trim(),
        website,
      },
      { signal: controller.signal },
    );
    if (receipt?.status !== "received") return { ok: false, kind: "unknown", message: MESSAGES.unknown };
    return { ok: true };
  } catch (error) {
    if (controller.signal.aborted) return { ok: false, kind: "timeout", message: MESSAGES.timeout };
    if (!(error instanceof ApiError)) return { ok: false, kind: "unknown", message: MESSAGES.unknown };
    if (error.status === 422) {
      const fieldErrors: FieldErrors = {};
      for (const { field, message } of error.fields) {
        if (isContactField(field)) fieldErrors[field] = message;
      }
      return { ok: false, kind: "validation", fieldErrors, message: MESSAGES.validation };
    }
    if (error.status === 429) return { ok: false, kind: "rate_limited", message: MESSAGES.rateLimited };
    if (error.status === 0) return { ok: false, kind: "network", message: MESSAGES.network };
    // 500, 502, 503 and 504, including the Next.js proxy failing to reach FastAPI.
    if (error.status >= 500) return { ok: false, kind: "unavailable", message: MESSAGES.unavailable };
    return { ok: false, kind: "unknown", message: MESSAGES.unknown };
  } finally {
    clearTimeout(timer);
  }
}
