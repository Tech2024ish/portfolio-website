"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { cardClasses } from "@/components/ui/section";
import { contentActions } from "@/lib/owner/actions";
import { collectionSpec, type OwnerItem } from "@/lib/owner/content-schema";
import { useHydrated } from "@/lib/use-hydrated";

import { StatusLabel } from "./studio-ui";
import { useOwnerAction } from "./use-owner-action";

/**
 * Every item of a collection, drafts included, in public order. Items can be moved up or down
 * and published or unpublished here; editing and deleting happen on the item's page.
 */
export function EntityList({
  collection,
  items,
  csrfToken,
  subtitles = {},
}: {
  collection: string;
  items: OwnerItem[];
  csrfToken: string;
  /** Display text for subtitle values, e.g. a skill's group id to the group's name. */
  subtitles?: Record<string, string>;
}) {
  const spec = collectionSpec(collection)!;
  const router = useRouter();
  const run = useOwnerAction();
  const hydrated = useHydrated();
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const actions = contentActions(csrfToken, collection);

  async function act(key: string, action: () => Promise<unknown>) {
    setBusy(key);
    setFailure(null);
    const result = await run(action);
    setBusy(null);
    if (result.ok) router.refresh();
    else if (result.error?.status !== 401)
      setFailure(result.error?.message ?? "That did not work. Try again.");
  }

  function move(index: number, offset: -1 | 1) {
    const ids = items.map((item) => item.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + offset, 0, moved!);
    return act(`move-${items[index]!.id}`, () => actions.reorder(ids));
  }

  if (items.length === 0) {
    return (
      <EmptyState
        headingLevel={2}
        title={`No ${spec.label.toLowerCase()} yet`}
        description={`Create the first ${spec.singular}; it stays a draft until you publish it.`}
        action={
          <Link href={`/owner/content/${collection}/new`} className="underline underline-offset-4">
            New {spec.singular}
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {failure ? <Alert tone="danger">{failure}</Alert> : null}
      <ol aria-label={`${spec.label} in display order`} className="flex flex-col gap-3">
        {items.map((item, index) => {
          const title = String(item[spec.titleField] ?? `Untitled ${spec.singular}`);
          const raw = spec.subtitleField ? item[spec.subtitleField] : undefined;
          const subtitle = raw === undefined || raw === null ? null : (subtitles[String(raw)] ?? String(raw));
          return (
            <li
              key={item.id}
              className={`${cardClasses} flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between`}
            >
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/owner/content/${collection}/${item.id}`}
                    className="font-medium text-fg underline-offset-4 hover:underline"
                  >
                    {title}
                  </Link>
                  <StatusLabel status={item.status} />
                  {item.visible === false ? <span className="text-xs text-muted">Hidden</span> : null}
                </div>
                {subtitle ? <p className="truncate text-sm text-muted">{subtitle}</p> : null}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Move ${title} up`}
                  disabled={!hydrated || index === 0}
                  loading={busy === `move-${item.id}`}
                  onClick={() => move(index, -1)}
                >
                  ↑
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Move ${title} down`}
                  disabled={!hydrated || index === items.length - 1}
                  onClick={() => move(index, 1)}
                >
                  ↓
                </Button>
                {item.status ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!hydrated}
                    loading={busy === `publish-${item.id}`}
                    aria-label={`${item.status === "published" ? "Unpublish" : "Publish"} ${title}`}
                    onClick={() =>
                      act(`publish-${item.id}`, () =>
                        actions.setPublished(item.id, item.status !== "published"),
                      )
                    }
                  >
                    {item.status === "published" ? "Unpublish" : "Publish"}
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
