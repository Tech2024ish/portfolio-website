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

const inputClasses =
  "w-full rounded-control border border-border-strong bg-surface px-3.5 py-2.5 text-base text-fg " +
  "placeholder:text-muted transition-colors hover:border-accent/50 " +
  "focus-visible:border-accent aria-invalid:border-danger-fg disabled:opacity-60";

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
  const errorId = (field: ContactField) => `${id}-${field}-error`;

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
        className={`${cardClasses} flex flex-col items-start gap-4 self-start border-success/40 p-6 sm:p-8`}
      >
        <h3 className="font-display text-xl font-semibold text-fg">Message sent</h3>
        <p className="text-base text-muted">Thank you. Your message has been received and saved.</p>
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
      className={`${cardClasses} relative flex flex-col gap-5 p-6 sm:p-8`}
    >
      <div>
        <h3 id={`${id}-title`} className="font-display text-xl font-semibold text-fg">
          Send a message
        </h3>
        <p className="mt-1 text-sm text-muted">All fields are required.</p>
      </div>

      {failure ? (
        <div
          ref={alertRef}
          tabIndex={-1}
          role="alert"
          className="rounded-control border border-danger-fg/40 bg-danger/10 px-4 py-3 text-sm text-fg"
        >
          <p>{failure.message}</p>
          {failure.kind !== "validation" ? (
            <p className="mt-1 text-muted">
              Your text is still here. You can try again later, or email me directly at{" "}
              <a href={`mailto:${email}`} className="text-accent underline underline-offset-2">
                {email}
              </a>
              .
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          field="name"
          label="Full name"
          autoComplete="name"
          maxLength={CONTACT_LIMITS.name.max}
          {...{ values, errors, onChange, fieldId, errorId, disabled: submitting }}
        />
        <TextField
          field="email"
          label="Email address"
          type="email"
          autoComplete="email"
          inputMode="email"
          maxLength={CONTACT_LIMITS.email.max}
          {...{ values, errors, onChange, fieldId, errorId, disabled: submitting }}
        />
      </div>
      <TextField
        field="subject"
        label="Subject"
        maxLength={CONTACT_LIMITS.subject.max}
        {...{ values, errors, onChange, fieldId, errorId, disabled: submitting }}
      />

      <div className="flex flex-col gap-2">
        <label htmlFor={fieldId("message")} className="text-sm font-medium text-fg">
          Message
        </label>
        <textarea
          id={fieldId("message")}
          name="message"
          rows={6}
          required
          maxLength={CONTACT_LIMITS.message.max}
          value={values.message}
          onChange={onChange}
          disabled={submitting}
          aria-invalid={errors.message ? true : undefined}
          aria-describedby={`${errors.message ? `${errorId("message")} ` : ""}${id}-message-count`}
          className={`${inputClasses} min-h-36 resize-y`}
        />
        <div className="flex items-start justify-between gap-4">
          <FieldError id={errorId("message")} message={errors.message} />
          <p id={`${id}-message-count`} className="ml-auto shrink-0 font-mono text-xs text-muted">
            {messageLength} / {CONTACT_LIMITS.message.max}
          </p>
        </div>
      </div>

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
      <Button type="submit" loading={submitting} disabled={!hydrated} className="w-full sm:w-fit">
        {submitting ? "Sending…" : "Send message"}
      </Button>
      <p className="sr-only" role="status" aria-live="polite">
        {submitting ? "Sending your message." : ""}
      </p>
    </form>
  );
}

type SharedFieldProps = {
  values: ContactValues;
  errors: FieldErrors;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  fieldId: (field: ContactField) => string;
  errorId: (field: ContactField) => string;
  disabled: boolean;
};

function TextField({
  field,
  label,
  type = "text",
  autoComplete,
  inputMode,
  maxLength,
  values,
  errors,
  onChange,
  fieldId,
  errorId,
  disabled,
}: SharedFieldProps & {
  field: Exclude<ContactField, "message">;
  label: string;
  type?: "text" | "email";
  autoComplete?: string;
  inputMode?: "email";
  maxLength: number;
}) {
  const error = errors[field];
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={fieldId(field)} className="text-sm font-medium text-fg">
        {label}
      </label>
      <input
        id={fieldId(field)}
        name={field}
        type={type}
        required
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        value={values[field]}
        onChange={onChange}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId(field) : undefined}
        className={inputClasses}
      />
      <FieldError id={errorId(field)} message={error} />
    </div>
  );
}

function FieldError({ id, message }: { id: string; message: string | undefined }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-danger-fg">
      {message}
    </p>
  );
}
