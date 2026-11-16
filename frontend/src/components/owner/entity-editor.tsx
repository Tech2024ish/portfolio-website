"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { contentActions, saveProfile } from "@/lib/owner/actions";
import {
  collectionSpec,
  fieldOf,
  fromFormValues,
  PROFILE_SPEC,
  toFormValues,
  type CollectionSpec,
  type FieldSpec,
  type FormValues,
  type OwnerItem,
} from "@/lib/owner/content-schema";
import { useHydrated } from "@/lib/use-hydrated";

import { useOwnerAction } from "./use-owner-action";

export type Choices = Record<string, { value: string; label: string }[]>;

type Props = {
  /** A collection key, or "profile". */
  collection: string;
  /** The saved item; null creates a new one. */
  item: OwnerItem | null;
  csrfToken: string;
  choices?: Choices;
};

function specFor(collection: string): CollectionSpec {
  const spec = collection === "profile" ? PROFILE_SPEC : collectionSpec(collection);
  if (!spec) throw new Error(`Unknown collection: ${collection}`);
  return spec;
}

function groups(fields: FieldSpec[]): [string | undefined, FieldSpec[]][] {
  const result: [string | undefined, FieldSpec[]][] = [];
  for (const field of fields) {
    const last = result.at(-1);
    if (last && last[0] === field.group) last[1].push(field);
    else result.push([field.group, [field]]);
  }
  return result;
}

const ROWS: Partial<Record<FieldSpec["kind"], number>> = {
  textarea: 4,
  lines: 4,
  paragraphs: 6,
  pairs: 4,
  body: 18,
};

/**
 * The form for one content item, generated from its collection's fields. The server validates
 * everything again; its field errors appear under the fields. Saving sends the version that was
 * loaded, so a change made elsewhere in the meantime is never overwritten silently.
 */
export function EntityEditor({ collection, item, csrfToken, choices = {} }: Props) {
  const spec = specFor(collection);
  const router = useRouter();
  const run = useOwnerAction();
  const hydrated = useHydrated();
  const [values, setValues] = useState<FormValues>(() => toFormValues(spec, item));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<{ message: string; conflict: boolean } | null>(null);
  const [pending, setPending] = useState(false);

  const set = (name: string, value: string | boolean) => {
    setValues((current) => ({ ...current, [name]: value }));
  };

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const missing: Record<string, string> = {};
    for (const field of spec.fields) {
      if (field.required && field.kind !== "checkbox" && String(values[field.name] ?? "").trim() === "") {
        missing[field.name] = `Enter the ${field.label.toLowerCase()}.`;
      }
    }
    setErrors(missing);
    setFailure(null);
    if (Object.keys(missing).length > 0) return;

    const payload = fromFormValues(spec, values);
    setPending(true);
    const result = await run(() => {
      if (collection === "profile")
        return saveProfile(csrfToken, { ...payload, version: item?.version ?? 0 });
      const actions = contentActions(csrfToken, collection);
      return item ? actions.update(item.id, { ...payload, version: item.version }) : actions.create(payload);
    });
    setPending(false);

    if (result.ok) {
      // The page reloads the saved item (and its new version) and confirms from the URL, so the
      // notice survives the editor being re-created with the new version.
      const target =
        collection === "profile"
          ? `/owner/profile?saved=${result.value.version}`
          : item
            ? `/owner/content/${collection}/${item.id}?saved=${result.value.version}`
            : `/owner/content/${collection}/${result.value.id}?created=1`;
      router.replace(target);
      router.refresh();
      return;
    }
    const error = result.error;
    if (error?.status === 401) return; // redirected to sign in
    const fields: Record<string, string> = {};
    const other: string[] = [];
    for (const entry of error?.fields ?? []) {
      const name = fieldOf(spec, entry.field);
      if (name && !fields[name]) fields[name] = entry.message;
      else if (!name) other.push(entry.message);
    }
    setErrors(fields);
    const conflict = error?.status === 409 && Object.keys(fields).length === 0;
    if (other.length > 0 || Object.keys(fields).length === 0) {
      setFailure({
        message: other.length
          ? other.join(" ")
          : (error?.message ?? "The changes could not be saved. Try again."),
        conflict,
      });
    }
  }

  function control(field: FieldSpec) {
    const value = values[field.name];
    const label = field.required ? field.label : `${field.label} (optional)`;
    if (field.kind === "checkbox") {
      return (
        <label key={field.name} className="flex min-h-10 items-center gap-3 text-sm text-fg">
          <input
            type="checkbox"
            name={field.name}
            checked={value === true}
            onChange={(event) => set(field.name, event.target.checked)}
            className="size-5 accent-(--color-accent)"
          />
          {field.label}
        </label>
      );
    }
    const options = field.options ?? (field.choices ? choices[field.choices] : undefined) ?? [];
    return (
      <Field
        key={field.name}
        label={field.kind === "select" ? field.label : label}
        hint={field.help}
        error={errors[field.name]}
        required={field.required}
      >
        {(props) => {
          const text = typeof value === "string" ? value : "";
          const onChange = (event: { target: { value: string } }) => set(field.name, event.target.value);
          if (field.kind === "select") {
            return (
              <Select {...props} name={field.name} value={text} onChange={onChange}>
                {field.choices ? <option value="">Choose…</option> : null}
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            );
          }
          if (ROWS[field.kind]) {
            return (
              <Textarea
                {...props}
                name={field.name}
                rows={ROWS[field.kind]}
                value={text}
                onChange={onChange}
                className={field.kind === "body" ? "font-mono text-sm" : undefined}
                spellCheck={field.kind !== "pairs"}
              />
            );
          }
          return (
            <Input
              {...props}
              name={field.name}
              type={
                field.kind === "month"
                  ? "month"
                  : field.kind === "date"
                    ? "date"
                    : field.kind === "url"
                      ? "url"
                      : "text"
              }
              inputMode={field.kind === "url" ? "url" : undefined}
              maxLength={field.maxLength}
              value={text}
              onChange={onChange}
            />
          );
        }}
      </Field>
    );
  }

  const noun = spec.singular;
  return (
    <form
      aria-label={item ? `Edit ${noun}` : `New ${noun}`}
      method="post"
      noValidate
      onSubmit={onSubmit}
      data-ready={hydrated ? "true" : undefined}
      className="flex flex-col gap-8"
    >
      {failure ? (
        <Alert tone="danger" title={failure.conflict ? "Not saved" : undefined}>
          {failure.message}{" "}
          {failure.conflict ? (
            <button type="button" className="underline underline-offset-4" onClick={() => router.refresh()}>
              Load the latest version
            </button>
          ) : null}
        </Alert>
      ) : null}
      {groups(spec.fields).map(([group, fields]) =>
        group ? (
          <fieldset key={group} className="flex flex-col gap-5 border-t border-border pt-6">
            <legend className="pr-3 font-display text-lg font-bold text-fg">{group}</legend>
            {fields.map(control)}
          </fieldset>
        ) : (
          <div key="fields" className="flex flex-col gap-5">
            {fields.map(control)}
          </div>
        ),
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={pending} disabled={!hydrated}>
          {item ? "Save changes" : `Create ${noun}`}
        </Button>
        {!item && spec.publishable ? (
          <p className="text-sm text-muted">New items are drafts until you publish them.</p>
        ) : null}
      </div>
    </form>
  );
}
