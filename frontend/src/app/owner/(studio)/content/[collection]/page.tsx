import type { Metadata } from "next";
import Link from "next/link";

import { EntityList } from "@/components/owner/entity-list";
import { StudioHeading, StudioUnavailable } from "@/components/owner/studio-ui";
import { buttonClasses } from "@/components/ui/button";
import { collectionSpec, type OwnerItem } from "@/lib/owner/content-schema";
import { OwnerApiUnavailableError, ownerGet, studioSession } from "@/lib/owner/session";

import { choicesFor, specOr404 } from "./data";

type Props = { params: Promise<{ collection: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { collection } = await params;
  return { title: collectionSpec(collection)?.label ?? "Not found" };
}

export default async function CollectionPage({ params }: Props) {
  const { collection } = await params;
  const spec = specOr404(collection);
  const path = `/owner/content/${spec.key}`;
  const session = await studioSession(path);
  if (!session) return <StudioUnavailable retryHref={path} />;

  let items: OwnerItem[];
  let subtitles: Record<string, string> = {};
  try {
    const [list, choices] = await Promise.all([
      ownerGet<OwnerItem[]>(`/api/v1/owner/${spec.key}`, path),
      choicesFor(spec, path),
    ]);
    items = list;
    subtitles = Object.fromEntries((choices.categories ?? []).map((option) => [option.value, option.label]));
  } catch (error) {
    if (error instanceof OwnerApiUnavailableError) return <StudioUnavailable retryHref={path} />;
    throw error;
  }

  return (
    <>
      <StudioHeading
        title={spec.label}
        description={
          <p>
            {spec.publishable
              ? "Drafts are visible only here. The public site shows published items in this order."
              : "The public site shows these in this order."}
          </p>
        }
        actions={
          <Link href={`${path}/new`} className={buttonClasses("primary", "sm")}>
            New {spec.singular}
          </Link>
        }
      />
      <EntityList collection={spec.key} items={items} csrfToken={session.csrf_token} subtitles={subtitles} />
    </>
  );
}
