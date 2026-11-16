import type { Metadata } from "next";

import { EntityEditor, type Choices } from "@/components/owner/entity-editor";
import { StudioHeading, StudioUnavailable } from "@/components/owner/studio-ui";
import { TextLink } from "@/components/ui/link";
import { collectionSpec } from "@/lib/owner/content-schema";
import { OwnerApiUnavailableError, studioSession } from "@/lib/owner/session";

import { choicesFor, specOr404 } from "../data";

type Props = { params: Promise<{ collection: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { collection } = await params;
  const spec = collectionSpec(collection);
  return { title: spec ? `New ${spec.singular}` : "Not found" };
}

export default async function NewItemPage({ params }: Props) {
  const { collection } = await params;
  const spec = specOr404(collection);
  const list = `/owner/content/${spec.key}`;
  const path = `${list}/new`;
  const session = await studioSession(path);
  if (!session) return <StudioUnavailable retryHref={path} />;

  let choices: Choices;
  try {
    choices = await choicesFor(spec, path);
  } catch (error) {
    if (error instanceof OwnerApiUnavailableError) return <StudioUnavailable retryHref={path} />;
    throw error;
  }

  return (
    <>
      <p>
        <TextLink href={list}>← {spec.label}</TextLink>
      </p>
      <StudioHeading title={`New ${spec.singular}`} />
      <EntityEditor collection={spec.key} item={null} csrfToken={session.csrf_token} choices={choices} />
    </>
  );
}
