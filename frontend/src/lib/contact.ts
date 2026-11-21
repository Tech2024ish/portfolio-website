/**
 * Contact-form contract shared by the form and its tests. Limits mirror the FastAPI schema
 * (`backend/app/schemas/contact.py`); the server stays the authority and re-validates.
 */
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { dictionary } from "@/i18n/dictionaries";
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

export function validateContact(values: ContactValues, lang: Locale = DEFAULT_LOCALE): FieldErrors {
  const t = dictionary(lang).contact.errors;
  const errors: FieldErrors = {};
  const name = values.name.trim();
  const email = values.email.trim();
  const subject = values.subject.trim();
  const message = values.message.trim();

  if (!name) errors.name = t.nameRequired;
  else if (name.length < CONTACT_LIMITS.name.min) errors.name = t.nameShort;
  else if (name.length > CONTACT_LIMITS.name.max) errors.name = t.nameLong;

  if (!email) errors.email = t.emailRequired;
  else if (email.length > CONTACT_LIMITS.email.max || !EMAIL_PATTERN.test(email))
    errors.email = t.emailInvalid;

  if (!subject) errors.subject = t.subjectRequired;
  else if (subject.length < CONTACT_LIMITS.subject.min) errors.subject = t.subjectShort;
  else if (subject.length > CONTACT_LIMITS.subject.max) errors.subject = t.subjectLong;

  if (!message) errors.message = t.messageRequired;
  else if (message.length < CONTACT_LIMITS.message.min) errors.message = t.messageShort;
  else if (message.length > CONTACT_LIMITS.message.max) errors.message = t.messageLong;

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

function isContactField(field: string): field is ContactField {
  return (CONTACT_FIELDS as readonly string[]).includes(field);
}

/** Posts to FastAPI and resolves success only when the API confirms the message was stored. */
export async function submitContact(
  values: ContactValues,
  website: string,
  client: Pick<typeof api, "post"> = api,
  timeoutMs: number = SUBMIT_TIMEOUT_MS,
  lang: Locale = DEFAULT_LOCALE,
): Promise<SubmitResult> {
  // A timeout cannot prove the message was not stored, so its text does not claim either way.
  const MESSAGES = dictionary(lang).contact.failures;
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
