"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/feedback";
import { Field, Input, Select } from "@/components/ui/form";
import { mediaActions } from "@/lib/owner/actions";
import { MEDIA_FOLDERS, MEDIA_TYPES, type OwnerMediaDetail } from "@/lib/owner/types";
import { useHydrated } from "@/lib/use-hydrated";

import { checkImageFile } from "./media-uploader";
import { useOwnerAction } from "./use-owner-action";

/** Alt text, folder, replacing the file and deleting, for one library image. */
export function MediaDetails({
  asset,
  csrfToken,
  maxMb,
}: {
  asset: OwnerMediaDetail;
  csrfToken: string;
  maxMb: number;
}) {
  const router = useRouter();
  const run = useOwnerAction();
  const hydrated = useHydrated();
  const actions = mediaActions(csrfToken);
  const fileRef = useRef<HTMLInputElement>(null);
  const [alt, setAlt] = useState(asset.alt_text);
  const [folder, setFolder] = useState<string>(asset.folder);
  const [message, setMessage] = useState<{ tone: "success" | "danger"; text: string } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [pending, setPending] = useState<"save" | "replace" | null>(null);
  const [confirming, setConfirming] = useState(false);

  const failed = (error: { status: number; message: string } | null, fallback: string) => {
    if (error?.status !== 401) setMessage({ tone: "danger", text: error?.message ?? fallback });
  };

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setPending("save");
    const result = await run(() =>
      actions.update(asset.id, { alt_text: alt.trim(), folder, version: asset.version }),
    );
    setPending(null);
    if (result.ok) {
      setMessage({ tone: "success", text: "Saved." });
      router.refresh();
    } else failed(result.error, "The changes could not be saved.");
  }

  async function replace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const file = fileRef.current?.files?.[0];
    const problem = checkImageFile(file, maxMb);
    setFileError(problem);
    if (problem || !file) return;
    const form = new FormData();
    form.set("file", file);
    form.set("version", String(asset.version));
    setPending("replace");
    const result = await run(() => actions.replace(asset.id, form));
    setPending(null);
    if (result.ok) {
      if (fileRef.current) fileRef.current.value = "";
      setMessage({
        tone: "success",
        text: asset.used_by.length
          ? `Replaced. ${asset.used_by.join(", ")} now ${asset.used_by.length === 1 ? "uses" : "use"} the new image.`
          : "Replaced.",
      });
      router.refresh();
    } else {
      const field = result.error?.fields.find((item) => item.field === "file");
      if (field) setFileError(field.message);
      else failed(result.error, "The image could not be replaced.");
    }
  }

  async function remove() {
    const result = await run(() => actions.remove(asset.id));
    setConfirming(false);
    if (result.ok) router.replace("/owner/media");
    else failed(result.error, "The image could not be deleted.");
  }

  return (
    <div className="flex flex-col gap-8">
      {message ? (
        <Alert tone={message.tone} role={message.tone === "success" ? "status" : undefined}>
          {message.text}
        </Alert>
      ) : null}

      <form aria-label="Image details" noValidate onSubmit={save} className="flex flex-col gap-5">
        <Field
          label="Alternative text"
          hint="What the image shows, for screen readers and when it cannot load."
        >
          {(props) => (
            <Input {...props} maxLength={300} value={alt} onChange={(event) => setAlt(event.target.value)} />
          )}
        </Field>
        <Field label="Folder">
          {(props) => (
            <Select {...props} value={folder} onChange={(event) => setFolder(event.target.value)}>
              {MEDIA_FOLDERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div>
          <Button type="submit" loading={pending === "save"} disabled={!hydrated}>
            Save details
          </Button>
        </div>
      </form>

      <form
        aria-label="Replace the image"
        encType="multipart/form-data"
        noValidate
        onSubmit={replace}
        className="flex flex-col gap-5 border-t border-border pt-6"
      >
        <Field
          label="New image file"
          hint={`The address changes; content that uses this image is updated automatically. JPEG, PNG or WebP, up to ${maxMb} MB.`}
          error={fileError}
        >
          {(props) => <Input {...props} ref={fileRef} type="file" accept={MEDIA_TYPES.join(",")} />}
        </Field>
        <div>
          <Button type="submit" variant="secondary" loading={pending === "replace"} disabled={!hydrated}>
            Replace image
          </Button>
        </div>
      </form>

      <div className="flex flex-col gap-3 border-t border-border pt-6">
        <p className="text-sm text-muted">
          {asset.used_by.length
            ? `Used by ${asset.used_by.join(", ")}: choose another image there before deleting this one.`
            : "Not used by any content."}
        </p>
        <div>
          <Button
            variant="danger"
            size="sm"
            disabled={!hydrated || asset.used_by.length > 0}
            onClick={() => setConfirming(true)}
          >
            Delete image
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirming}
        tone="danger"
        title={`Delete “${asset.filename}”?`}
        description="The image and all its sizes are removed from storage. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={remove}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
