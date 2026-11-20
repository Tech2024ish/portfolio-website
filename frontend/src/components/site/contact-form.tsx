"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type ChangeEvent,
  type FormEvent,
} from "react";

import { Button } from "@/components/ui/button";
import { CheckCircleIcon } from "@/components/ui/icons";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/form";
import { cardClasses } from "@/components/ui/section";
import {
  CONTACT_FIELDS,
  CONTACT_LIMITS,
  submitContact,
  validateContact,
  type ContactField,
  type ContactValues,
  type FieldErrors,
  type SubmitResult,
} from "@/lib/contact";

const EMPTY: ContactValues = { name: "", email: "", subject: "", message: "" };

type Status = "idle" | "submitting" | "success";

const noop = () => () => {};
/** False during server rendering and hydration, true once React controls the form. */
function useHydrated() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

/**
 * The public contact form. It posts to FastAPI through the typed client and shows success
 * only when the API confirms the message was stored. Everything else keeps the user's input.
 */
export function ContactForm({ email }: { email: string }) {
  const id = useId();
  const hydrated = useHydrated();
  const [values, setValues] = useState<ContactValues>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>("idle");
  const [failure, setFailure] = useState<Extract<SubmitResult, { ok: false }> | null>(null);
  const [attempted, setAttempted] = useState(false);
  // Synchronous guard: state updates are async, so a fast double-submit could slip through.
  const inFlight = useRef(false);
  const honeypot = useRef<HTMLInputElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  // Where focus should go once the next render has committed (fields may be disabled until then).
  const pendingFocus = useRef<"success" | "alert" | "first-field" | FieldErrors | null>(null);

  const fieldId = (field: ContactField) => `${id}-${field}`;

  function focusFirstInvalid(fieldErrors: FieldErrors) {
    const first = CONTACT_FIELDS.find((field) => fieldErrors[field]);
    if (first) document.getElementById(fieldId(first))?.focus();
  }

  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    if (target === "success") successRef.current?.focus();
    else if (target === "alert") alertRef.current?.focus();
    else if (target === "first-field") document.getElementById(fieldId("name"))?.focus();
    else focusFirstInvalid(target);
  });

  function onChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const field = event.target.name as ContactField;
    const next = { ...values, [field]: event.target.value };
    setValues(next);
    // After the first submit attempt, re-check the edited field so errors clear as they are fixed.
    if (attempted) setErrors((current) => ({ ...current, [field]: validateContact(next)[field] }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;

    setAttempted(true);
    setFailure(null);
    const clientErrors = validateContact(values);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) {
      focusFirstInvalid(clientErrors);
      return;
    }

    inFlight.current = true;
    setStatus("submitting");
    const result = await submitContact(values, honeypot.current?.value ?? "");
    inFlight.current = false;

    if (result.ok) {
      setStatus("success");
      setValues(EMPTY);
      setErrors({});
      setAttempted(false);
      pendingFocus.current = "success";
      return;
    }

    setStatus("idle");
    setFailure(result);
    if (result.kind === "validation" && Object.keys(result.fieldErrors).length > 0) {
      setErrors(result.fieldErrors);
      pendingFocus.current = result.fieldErrors;
    } else {
      pendingFocus.current = "alert";
    }
  }

  if (status === "success") {
    return (
      <div
        ref={successRef}
        tabIndex={-1}
        role="status"
        className="flex flex-col items-start gap-4 rounded-card border border-success/40 bg-success-soft p-6"
      >
        <h3 className="flex items-center gap-2 text-lg font-medium text-success-fg">
          <CheckCircleIcon className="size-5" />
          Message sent
        </h3>
        <p className="text-base text-fg">Thank you. Your message has been received and saved.</p>
        <Button
          variant="secondary"
          onClick={() => {
            // The success panel (which has focus) is about to unmount; continue in the new form.
            pendingFocus.current = "first-field";
            setStatus("idle");
          }}
        >
          Send another message
        </Button>
      </div>
    );
  }

  const submitting = status === "submitting";
  const messageLength = values.message.trim().length;

  return (
    <form
      noValidate
      // POST, never the default GET: a submission before hydration must not put the message in the URL.
      method="post"
      onSubmit={onSubmit}
      data-ready={hydrated || undefined}
      aria-labelledby={`${id}-title`}
      aria-busy={submitting || undefined}
      className={`${cardClasses} relative flex flex-col gap-4 p-6`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id={`${id}-title`} className="text-lg font-medium text-fg">
          Send a message
        </h3>
        <p className="text-sm text-muted">All fields are required.</p>
      </div>

      {failure ? (
        <Alert ref={alertRef} tabIndex={-1} tone="danger">
          <p>{failure.message}</p>
          {failure.kind !== "validation" ? (
            <p className="text-muted">
              Your text is still here. You can try again later, or email me directly at{" "}
              <a href={`mailto:${email}`} className="text-accent underline underline-offset-2">
                {email}
              </a>
              .
            </p>
          ) : null}
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" id={fieldId("name")} error={errors.name} required>
          {(control) => (
            <Input
              {...control}
              name="name"
              autoComplete="name"
              maxLength={CONTACT_LIMITS.name.max}
              value={values.name}
              onChange={onChange}
              disabled={submitting}
            />
          )}
        </Field>
        <Field label="Email address" id={fieldId("email")} error={errors.email} required>
          {(control) => (
            <Input
              {...control}
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              maxLength={CONTACT_LIMITS.email.max}
              value={values.email}
              onChange={onChange}
              disabled={submitting}
            />
          )}
        </Field>
      </div>
      <Field label="Subject" id={fieldId("subject")} error={errors.subject} required>
        {(control) => (
          <Input
            {...control}
            name="subject"
            maxLength={CONTACT_LIMITS.subject.max}
            value={values.subject}
            onChange={onChange}
            disabled={submitting}
          />
        )}
      </Field>
      {/* On wide screens the message box takes the remaining height, so the form ends level with
          the contact cards beside it (the section's grid stretches both columns to one height). */}
      <Field
        label="Message"
        id={fieldId("message")}
        error={errors.message}
        aside={`${messageLength} / ${CONTACT_LIMITS.message.max}`}
        required
        className="flex-1"
      >
        {(control) => (
          <Textarea
            {...control}
            name="message"
            rows={6}
            className="min-h-36 flex-1 basis-0 lg:min-h-24"
            maxLength={CONTACT_LIMITS.message.max}
            value={values.message}
            onChange={onChange}
            disabled={submitting}
          />
        )}
      </Field>

      {/* Honeypot: invisible to people and skipped by keyboard and screen readers. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={`${id}-website`}>Leave this field empty</label>
        <input
          ref={honeypot}
          id={`${id}-website`}
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {/* Disabled until hydrated, so it can only ever submit through the API client. */}
      <Button type="submit" loading={submitting} disabled={!hydrated} className="w-full">
        {submitting ? "Sending…" : "Send message"}
      </Button>
      <p className="sr-only" role="status" aria-live="polite">
        {submitting ? "Sending your message." : ""}
      </p>
    </form>
  );
}
