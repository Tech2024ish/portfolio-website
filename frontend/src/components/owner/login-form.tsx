"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form";
import { ApiError } from "@/lib/api/client";
import { signIn } from "@/lib/owner/actions";
import { useHydrated } from "@/lib/use-hydrated";

type Errors = { email?: string; password?: string };

const GENERIC_FAILURE = "Signing in did not work. Check your connection and try again.";

/**
 * Owner sign-in. Credentials go to FastAPI, which sets the HttpOnly session cookie; nothing
 * about the session is stored by this page. The form stays disabled until it is hydrated, and
 * posts with method="post", so a password can never end up in a URL.
 */
export function LoginForm({ next, expired = false }: { next: string; expired?: boolean }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const alertRef = useRef<HTMLDivElement>(null);
  const focusAlert = useRef(false);

  useEffect(() => {
    if (focusAlert.current) {
      focusAlert.current = false;
      alertRef.current?.focus();
    }
  });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const found: Errors = {};
    if (!email.trim()) found.email = "Enter your email address.";
    if (!password) found.password = "Enter your password.";
    setErrors(found);
    setFailure(null);
    if (found.email || found.password) {
      document.getElementById(found.email ? "owner-email" : "owner-password")?.focus();
      return;
    }

    inFlight.current = true;
    setPending(true);
    try {
      await signIn(email.trim(), password);
      router.replace(next);
      router.refresh();
    } catch (error) {
      inFlight.current = false;
      setPending(false);
      setPassword("");
      if (error instanceof ApiError && error.status === 422) {
        const fields: Errors = {};
        for (const item of error.fields) {
          if (item.field === "email" || item.field === "password") fields[item.field] = item.message;
        }
        setErrors(fields);
        if (fields.email || fields.password) return;
      }
      // 401, 403 and 429 carry safe, user-facing messages from the server.
      const known = error instanceof ApiError && [401, 403, 429].includes(error.status);
      setFailure(known ? (error as ApiError).message : GENERIC_FAILURE);
      focusAlert.current = true;
    }
  }

  return (
    <form
      aria-label="Sign in"
      method="post"
      noValidate
      onSubmit={onSubmit}
      data-ready={hydrated || undefined}
      className="flex flex-col gap-5"
    >
      {expired && !failure ? (
        <Alert tone="info" role="status">
          Your session has ended. Sign in again to continue.
        </Alert>
      ) : null}
      {failure ? (
        <Alert ref={alertRef} tabIndex={-1} tone="danger">
          {failure}
        </Alert>
      ) : null}
      <Field label="Email" id="owner-email" error={errors.email} required>
        {(control) => (
          <Input
            {...control}
            name="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={pending}
          />
        )}
      </Field>
      <Field label="Password" id="owner-password" error={errors.password} required>
        {(control) => (
          <Input
            {...control}
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={pending}
          />
        )}
      </Field>
      <Button type="submit" loading={pending} disabled={!hydrated} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
