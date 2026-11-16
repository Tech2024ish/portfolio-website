import "server-only";

import { notFound } from "next/navigation";

import type { Choices } from "@/components/owner/entity-editor";
import { collectionSpec, type CollectionSpec, type OwnerItem } from "@/lib/owner/content-schema";
import { ownerGet } from "@/lib/owner/session";

/** The collection named in the URL, or a 404 for anything else. */
export function specOr404(key: string): CollectionSpec {
  const spec = collectionSpec(key);
  if (!spec) notFound();
  return spec;
}

/** A positive integer id from the URL, or a 404. */
export function idOr404(raw: string): number {
  if (!/^[1-9]\d{0,9}$/.test(raw)) notFound();
  return Number(raw);
}

/** Options the editor needs from other collections: skill groups for a skill. */
export async function choicesFor(spec: CollectionSpec, returnTo: string): Promise<Choices> {
  if (spec.key !== "skills") return {};
  const categories = await ownerGet<OwnerItem[]>("/api/v1/owner/skill-categories", returnTo);
  return { categories: categories.map((item) => ({ value: String(item.id), label: String(item.name) })) };
}
