import type { Metadata } from "next";
import Link from "next/link";

import { MediaUploader } from "@/components/owner/media-uploader";
import { StudioCard, StudioHeading, StudioUnavailable } from "@/components/owner/studio-ui";
import { EmptyState } from "@/components/ui/feedback";
import { cardClasses } from "@/components/ui/section";
import { cx } from "@/lib/cx";
import { OwnerApiUnavailableError, ownerGet, studioSession } from "@/lib/owner/session";
import { MAX_IMAGE_MB, MEDIA_FOLDERS, thumbnailOf, type OwnerMedia } from "@/lib/owner/types";

export const metadata: Metadata = { title: "Media" };

const PATH = "/owner/media";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function size(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** The media library: upload images and find them by folder. */
export default async function MediaPage({ searchParams }: Props) {
  const session = await studioSession(PATH);
  if (!session) return <StudioUnavailable retryHref={PATH} />;
  const raw = (await searchParams).folder;
  const folder = MEDIA_FOLDERS.find((option) => option.value === raw)?.value;

  let list: OwnerMedia[];
  try {
    list = await ownerGet<OwnerMedia[]>(`/api/v1/owner/media${folder ? `?folder=${folder}` : ""}`, PATH);
  } catch (error) {
    if (error instanceof OwnerApiUnavailableError) return <StudioUnavailable retryHref={PATH} />;
    throw error;
  }
  const filters = [{ value: undefined, label: "All" }, ...MEDIA_FOLDERS];

  return (
    <>
      <StudioHeading
        title="Media"
        description={
          <p>
            Images for the profile, projects and notes. Each upload is checked, stripped of metadata such as
            location, and stored in several sizes so pages load quickly.
          </p>
        }
      />
      <StudioCard id="upload" title="Upload an image">
        <MediaUploader csrfToken={session.csrf_token} maxMb={MAX_IMAGE_MB} />
      </StudioCard>

      <nav aria-label="Folders">
        <ul className="flex flex-wrap gap-2">
          {filters.map((option) => {
            const current = option.value === folder;
            return (
              <li key={option.label}>
                <Link
                  href={option.value ? `${PATH}?folder=${option.value}` : PATH}
                  aria-current={current ? "page" : undefined}
                  className={cx(
                    "inline-flex min-h-10 items-center rounded-control px-3 text-sm",
                    current
                      ? "bg-accent-soft font-medium text-accent"
                      : "text-muted hover:bg-raised hover:text-fg",
                  )}
                >
                  {option.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {list.length === 0 ? (
        <EmptyState
          headingLevel={2}
          title="No images yet"
          description={folder ? "Nothing in this folder yet." : "Upload the first image above."}
        />
      ) : (
        <ul aria-label="Images" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((asset) => (
            <li key={asset.id} className={`${cardClasses} flex flex-col gap-3 p-3`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- owner-only thumbnail of a stored variant */}
              <img
                src={thumbnailOf(asset)}
                alt=""
                width={asset.width}
                height={asset.height}
                loading="lazy"
                className="aspect-video w-full rounded-control object-cover"
              />
              <Link
                href={`${PATH}/${asset.id}`}
                className="truncate font-medium text-fg underline-offset-4 hover:underline"
              >
                {asset.alt_text || asset.filename}
              </Link>
              <p className="text-xs text-muted">
                {asset.width} × {asset.height} · {size(asset.byte_size)} ·{" "}
                {MEDIA_FOLDERS.find((option) => option.value === asset.folder)?.label}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
