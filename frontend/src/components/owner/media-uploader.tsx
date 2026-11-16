"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/form";
import { mediaActions } from "@/lib/owner/actions";
import { MEDIA_FOLDERS, MEDIA_TYPES } from "@/lib/owner/types";
import { useHydrated } from "@/lib/use-hydrated";

import { useOwnerAction } from "./use-owner-action";

/** Catches the obvious mistakes before sending; the server validates the file's bytes again. */
export function checkImageFile(file: File | undefined, maxMb: number): string | null {
  if (!file) return "Choose an image.";
  if (!MEDIA_TYPES.includes(file.type)) return "Choose a JPEG, PNG or WebP image.";
  if (file.size > maxMb * 1024 * 1024) return `The image is larger than ${maxMb} MB.`;
  return null;
}

type Errors = Partial<Record<"file" | "alt_text" | "folder", string>>;

export function MediaUploader({ csrfToken, maxMb }: { csrfToken: string; maxMb: number }) {
  const router = useRouter();
  const run = useOwnerAction();
  const hydrated = useHydrated();
  const fileRef = useRef<HTMLInputElement>(null);
  const [folder, setFolder] = useState("projects");
  const [alt, setAlt] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFailure(null);
    setDone(null);
    const file = fileRef.current?.files?.[0];
    const problem = checkImageFile(file, maxMb);
    const found: Errors = {};
    if (problem) found.file = problem;
    if (!alt.trim()) found.alt_text = "Describe the image for people who cannot see it.";
    setErrors(found);
    if (Object.keys(found).length > 0 || !file) return;

    const form = new FormData();
    form.set("file", file);
    form.set("folder", folder);
    form.set("alt_text", alt.trim());
    setPending(true);
    const result = await run(() => mediaActions(csrfToken).upload(form));
    setPending(false);
    if (result.ok) {
      setDone(`Uploaded “${result.value.filename}”.`);
      setAlt("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
      return;
    }
    if (result.error?.status === 401) return;
    const fields: Errors = {};
    for (const item of result.error?.fields ?? []) {
      if (item.field === "file" || item.field === "alt_text" || item.field === "folder")
        fields[item.field] = item.message;
    }
    setErrors(fields);
    if (Object.keys(fields).length === 0)
      setFailure(result.error?.message ?? "The image could not be uploaded.");
  }

  return (
    <form
      aria-label="Upload an image"
      method="post"
      encType="multipart/form-data"
      noValidate
      onSubmit={onSubmit}
      data-ready={hydrated ? "true" : undefined}
      className="flex flex-col gap-5"
    >
      {done ? (
        <Alert tone="success" role="status">
          {done}
        </Alert>
      ) : null}
      {failure ? <Alert tone="danger">{failure}</Alert> : null}
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Image" hint={`JPEG, PNG or WebP, up to ${maxMb} MB.`} error={errors.file} required>
          {(props) => (
            <Input {...props} ref={fileRef} type="file" name="file" accept={MEDIA_TYPES.join(",")} />
          )}
        </Field>
        <Field label="Folder" error={errors.folder}>
          {(props) => (
            <Select
              {...props}
              name="folder"
              value={folder}
              onChange={(event) => setFolder(event.target.value)}
            >
              {MEDIA_FOLDERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>
      <Field
        label="Alternative text"
        hint="What the image shows, for screen readers and when it cannot load."
        error={errors.alt_text}
        required
      >
        {(props) => (
          <Input
            {...props}
            name="alt_text"
            maxLength={300}
            value={alt}
            onChange={(event) => setAlt(event.target.value)}
          />
        )}
      </Field>
      <div>
        <Button type="submit" loading={pending} disabled={!hydrated}>
          Upload
        </Button>
      </div>
    </form>
  );
}
