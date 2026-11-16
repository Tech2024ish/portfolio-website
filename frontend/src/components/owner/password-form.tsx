"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";
import { ownerActions } from "@/lib/owner/actions";
import { useHydrated } from "@/lib/use-hydrated";

import { useOwnerAction } from "./use-owner-action";

type Values = { current: string; next: string; confirm: string };
type Errors = Partial<Record<keyof Values, string>>;

const EMPTY: Values = { current: "", next: "", confirm: "" };
const MIN_LENGTH = 12;

/**
 * Changes the owner's password. The server enforces the policy (length, character mix, not the
 * current password) and ends every other session; this form only catches obvious mistakes early.
 */
export function PasswordForm({ csrfToken }: { csrfToken: string }) {
  const router = useRouter();
  const run = useOwnerAction();
  const hydrated = useHydrated();
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [done, setDone] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function set(field: keyof Values, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found: Errors = {};
    if (!values.current) found.current = "Enter your current password.";
    if (values.next.length < MIN_LENGTH) found.next = `Use at least ${MIN_LENGTH} characters.`;
    if (values.confirm !== values.next) found.confirm = "The new passwords do not match.";
    setErrors(found);
    setDone(false);
    setFailure(null);
    if (Object.keys(found).length > 0) return;

    setPending(true);
    const result = await run(() => ownerActions(csrfToken).changePassword(values.current, values.next));
    setPending(false);
    if (result.ok) {
      setValues(EMPTY);
      setDone(true);
      router.refresh();
      return;
    }
    const error = result.error;
    if (error?.status === 401) return; // redirected to sign in
    const fields: Errors = {};
    for (const item of error?.fields ?? []) {
      if (item.field === "current_password") fields.current = item.message;
      if (item.field === "new_password") fields.next = item.message;
    }
    if (Object.keys(fields).length > 0) setErrors(fields);
    else setFailure(error?.message ?? "The password could not be changed. Try again.");
  }

  return (
    <form
      aria-label="Change password"
      method="post"
      noValidate
      onSubmit={onSubmit}
      className="flex max-w-md flex-col gap-5"
    >
      {done ? (
        <Alert tone="success" role="status">
          Password changed. Every other session was signed out.
        </Alert>
      ) : null}
      {failure ? <Alert tone="danger">{failure}</Alert> : null}
      <Field label="Current password" error={errors.current} required>
        {(control) => (
          <Input
            {...control}
            type="password"
            autoComplete="current-password"
            value={values.current}
            onChange={(event) => set("current", event.target.value)}
          />
        )}
      </Field>
      <Field
        label="New password"
        hint="At least 12 characters, mixing at least three of: lowercase, uppercase, digits, symbols."
        error={errors.next}
        required
      >
        {(control) => (
          <Input
            {...control}
            type="password"
            autoComplete="new-password"
            value={values.next}
            onChange={(event) => set("next", event.target.value)}
          />
        )}
      </Field>
      <Field label="Repeat the new password" error={errors.confirm} required>
        {(control) => (
          <Input
            {...control}
            type="password"
            autoComplete="new-password"
            value={values.confirm}
            onChange={(event) => set("confirm", event.target.value)}
          />
        )}
      </Field>
      <div>
        <Button type="submit" loading={pending} disabled={!hydrated}>
          Change password
        </Button>
      </div>
    </form>
  );
}
