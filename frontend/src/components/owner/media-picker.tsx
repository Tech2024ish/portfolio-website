"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Alert, Spinner } from "@/components/ui/feedback";
import { mediaActions } from "@/lib/owner/actions";
import { thumbnailOf, type OwnerMedia } from "@/lib/owner/types";

import { useOwnerAction } from "./use-owner-action";

/**
 * "Choose from library": a dialog listing the library's images. Choosing one hands it to
 * `onChoose`, which decides how it is used (set a field, add a line).
 */
export function MediaPicker({
  csrfToken,
  label,
  onChoose,
}: {
  csrfToken: string;
  label: string;
  onChoose: (asset: OwnerMedia) => void;
}) {
  const run = useOwnerAction();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<OwnerMedia[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  async function show() {
    setOpen(true);
    setFailure(null);
    const result = await run(() => mediaActions(csrfToken).list());
    if (result.ok) setItems(result.value);
    else if (result.error?.status !== 401)
      setFailure(result.error?.message ?? "The library could not be loaded.");
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={show}>
        {label}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Choose an image" size="lg">
        {failure ? <Alert tone="danger">{failure}</Alert> : null}
        {!items && !failure ? <Spinner label="Loading images" /> : null}
        {items && items.length === 0 ? (
          <p className="text-muted">
            The library is empty. Upload images in{" "}
            <Link href="/owner/media" className="underline">
              Media
            </Link>
            .
          </p>
        ) : null}
        {items && items.length > 0 ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {items.map((asset) => (
              <li key={asset.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChoose(asset);
                    setOpen(false);
                  }}
                  className="flex w-full flex-col gap-2 rounded-control border border-border p-2 text-left hover:border-accent focus-visible:border-accent"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- owner-only thumbnail of a stored variant */}
                  <img
                    src={thumbnailOf(asset)}
                    alt=""
                    width={asset.width}
                    height={asset.height}
                    loading="lazy"
                    className="aspect-video w-full rounded-control object-cover"
                  />
                  <span className="truncate text-sm text-fg">{asset.alt_text || asset.filename}</span>
                  <span className="text-xs text-muted">
                    {asset.width} × {asset.height}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </Dialog>
    </>
  );
}
