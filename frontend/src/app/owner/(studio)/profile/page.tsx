import type { Metadata } from "next";

import { EntityEditor } from "@/components/owner/entity-editor";
import { StudioHeading, StudioUnavailable } from "@/components/owner/studio-ui";
import { Alert } from "@/components/ui/feedback";
import type { OwnerItem } from "@/lib/owner/content-schema";
import { OwnerApiUnavailableError, ownerFind, studioSession } from "@/lib/owner/session";

export const metadata: Metadata = { title: "Profile" };

const PATH = "/owner/profile";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ProfilePage({ searchParams }: Props) {
  const session = await studioSession(PATH);
  if (!session) return <StudioUnavailable retryHref={PATH} />;
  let profile: OwnerItem | null;
  try {
    profile = await ownerFind<OwnerItem>("/api/v1/owner/profile", PATH);
  } catch (error) {
    if (error instanceof OwnerApiUnavailableError) return <StudioUnavailable retryHref={PATH} />;
    throw error;
  }
  return (
    <>
      <StudioHeading
        title="Profile"
        description={
          <p>
            Your name, introduction and contact details as the public site shows them. Changes are public as
            soon as you save.
          </p>
        }
      />
      {profile && (await searchParams).saved === String(profile.version) ? (
        <Alert tone="success" role="status">
          Saved.
        </Alert>
      ) : null}
      <EntityEditor
        key={profile?.version ?? 0}
        collection="profile"
        item={profile}
        csrfToken={session.csrf_token}
      />
    </>
  );
}
