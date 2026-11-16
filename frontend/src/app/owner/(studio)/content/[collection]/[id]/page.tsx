import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EntityEditor, type Choices } from "@/components/owner/entity-editor";
import { ItemActions } from "@/components/owner/item-actions";
import { StatusLabel, StudioHeading, StudioUnavailable } from "@/components/owner/studio-ui";
import { Alert } from "@/components/ui/feedback";
import { TextLink } from "@/components/ui/link";
import { formatUtc } from "@/lib/owner/actions";
import type { OwnerItem } from "@/lib/owner/content-schema";
import { OwnerApiUnavailableError, ownerFind, studioSession } from "@/lib/owner/session";

import { choicesFor, idOr404, specOr404 } from "../data";

type Props = {
  params: Promise<{ collection: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = { title: "Edit" };

export default async function EditItemPage({ params, searchParams }: Props) {
  const { collection, id: rawId } = await params;
  const spec = specOr404(collection);
  const id = idOr404(rawId);
  const list = `/owner/content/${spec.key}`;
  const path = `${list}/${id}`;
  const session = await studioSession(path);
  if (!session) return <StudioUnavailable retryHref={path} />;

  let item: OwnerItem | null;
  let choices: Choices;
  try {
    [item, choices] = await Promise.all([
      ownerFind<OwnerItem>(`/api/v1/owner/${spec.key}/${id}`, path),
      choicesFor(spec, path),
    ]);
  } catch (error) {
    if (error instanceof OwnerApiUnavailableError) return <StudioUnavailable retryHref={path} />;
    throw error;
  }
  if (!item) notFound();

  const title = String(item[spec.titleField] ?? spec.singular);
  const publicPath = spec.publicPath?.(item) ?? null;
  const search = await searchParams;
  const created = search.created === "1";
  const saved = !created && search.saved === String(item.version);

  return (
    <>
      <p>
        <TextLink href={list}>← {spec.label}</TextLink>
      </p>
      <StudioHeading
        title={title}
        description={
          <p className="flex flex-wrap items-center gap-2">
            <StatusLabel status={item.status} />
            <span>Last saved {formatUtc(item.updated_at)}.</span>
            {spec.previewable ? <TextLink href={`${path}/preview`}>Preview</TextLink> : null}
            {publicPath ? <TextLink href={publicPath}>View on the site</TextLink> : null}
          </p>
        }
        actions={
          <ItemActions
            collection={spec.key}
            id={item.id}
            title={title}
            status={item.status}
            csrfToken={session.csrf_token}
            listHref={list}
          />
        }
      />
      {saved ? (
        <Alert tone="success" role="status">
          Saved.
        </Alert>
      ) : null}
      {created ? (
        <Alert tone="success" role="status">
          Created{spec.publishable ? " as a draft: it is not public until you publish it" : ""}.
        </Alert>
      ) : null}
      <EntityEditor
        key={item.version}
        collection={spec.key}
        item={item}
        csrfToken={session.csrf_token}
        choices={choices}
      />
    </>
  );
}
