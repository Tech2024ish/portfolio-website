import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MediaDetails } from "@/components/owner/media-details";
import { StudioHeading, StudioUnavailable } from "@/components/owner/studio-ui";
import { TextLink } from "@/components/ui/link";
import { formatUtc } from "@/lib/owner/actions";
import { OwnerApiUnavailableError, ownerFind, studioSession } from "@/lib/owner/session";
import { MAX_IMAGE_MB, type OwnerMediaDetail } from "@/lib/owner/types";

export const metadata: Metadata = { title: "Image" };

type Props = { params: Promise<{ id: string }> };

export default async function MediaItemPage({ params }: Props) {
  const { id } = await params;
  if (!/^[1-9]\d{0,9}$/.test(id)) notFound();
  const path = `/owner/media/${id}`;
  const session = await studioSession(path);
  if (!session) return <StudioUnavailable retryHref={path} />;

  let asset: OwnerMediaDetail | null;
  try {
    asset = await ownerFind<OwnerMediaDetail>(`/api/v1/owner/media/${id}`, path);
  } catch (error) {
    if (error instanceof OwnerApiUnavailableError) return <StudioUnavailable retryHref={path} />;
    throw error;
  }
  if (!asset) notFound();

  return (
    <>
      <p>
        <TextLink href="/owner/media">← Media</TextLink>
      </p>
      <StudioHeading
        title={asset.filename}
        description={
          <p>
            {asset.width} × {asset.height}, {asset.content_type.replace("image/", "").toUpperCase()}, uploaded
            or replaced {formatUtc(asset.updated_at)}. Sizes stored:{" "}
            {[...asset.variants.map((variant) => variant.width), asset.width].join(", ")} px wide.
          </p>
        }
      />
      <div className="grid gap-8 lg:grid-cols-2">
        <figure className="flex flex-col gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- owner-only preview of the stored original */}
          <img
            src={asset.url}
            alt={asset.alt_text}
            width={asset.width}
            height={asset.height}
            className="h-auto w-full rounded-card border border-border"
          />
          <figcaption className="text-sm break-all text-muted">
            Address: <code>{asset.url}</code>
          </figcaption>
        </figure>
        <MediaDetails asset={asset} csrfToken={session.csrf_token} maxMb={MAX_IMAGE_MB} />
      </div>
    </>
  );
}
