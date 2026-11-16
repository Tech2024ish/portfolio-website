"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Alert } from "@/components/ui/feedback";
import { contentActions } from "@/lib/owner/actions";

import { useOwnerAction } from "./use-owner-action";

/** Publish/unpublish and delete for one saved item. Publishing applies to the saved version. */
export function ItemActions({
  collection,
  id,
  title,
  status,
  csrfToken,
  listHref,
}: {
  collection: string;
  id: number;
  title: string;
  status?: "draft" | "published";
  csrfToken: string;
  listHref: string;
}) {
  const router = useRouter();
  const run = useOwnerAction();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const actions = contentActions(csrfToken, collection);

  async function toggle() {
    setPending(true);
    setFailure(null);
    const result = await run(() => actions.setPublished(id, status !== "published"));
    setPending(false);
    if (result.ok) router.refresh();
    else if (result.error?.status !== 401)
      setFailure(result.error?.message ?? "That did not work. Try again.");
  }

  async function remove() {
    const result = await run(() => actions.remove(id));
    if (result.ok) {
      setConfirming(false);
      // Not router.refresh(): that would reload this page, whose item no longer exists.
      router.replace(listHref);
    } else {
      setConfirming(false);
      if (result.error?.status !== 401)
        setFailure(result.error?.message ?? "It could not be deleted. Try again.");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        {status ? (
          <Button
            variant={status === "published" ? "secondary" : "primary"}
            size="sm"
            loading={pending}
            onClick={toggle}
          >
            {status === "published" ? "Unpublish" : "Publish"}
          </Button>
        ) : null}
        <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
          Delete
        </Button>
      </div>
      {failure ? <Alert tone="danger">{failure}</Alert> : null}
      <ConfirmDialog
        open={confirming}
        tone="danger"
        title={`Delete “${title}”?`}
        description="It disappears from the Studio and the public site. This cannot be undone here."
        confirmLabel="Delete"
        onConfirm={remove}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
