import type { Metadata } from "next";

import { EntityEditor } from "@/components/owner/entity-editor";
import { StudioHeading, StudioUnavailable } from "@/components/owner/studio-ui";
import { Alert } from "@/components/ui/feedback";
import { TextLink } from "@/components/ui/link";
import type { OwnerItem } from "@/lib/owner/content-schema";
import { OwnerApiUnavailableError, ownerGet, studioSession } from "@/lib/owner/session";

export const metadata: Metadata = { title: "Settings" };

const PATH = "/owner/settings";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SettingsPage({ searchParams }: Props) {
  const session = await studioSession(PATH);
  if (!session) return <StudioUnavailable retryHref={PATH} />;
  let settings: OwnerItem;
  try {
    settings = await ownerGet<OwnerItem>("/api/v1/owner/settings", PATH);
  } catch (error) {
    if (error instanceof OwnerApiUnavailableError) return <StudioUnavailable retryHref={PATH} />;
    throw error;
  }
  const saved = settings.version > 0 && (await searchParams).saved === String(settings.version);

  return (
    <>
      <StudioHeading
        title="Settings"
        description={
          <p>
            How the public site presents itself. Your name, social and contact links are in{" "}
            <TextLink href="/owner/profile">Profile</TextLink>.
          </p>
        }
      />
      {settings.version === 0 ? (
        <Alert tone="info">These are the defaults; nothing has been saved yet.</Alert>
      ) : null}
      {saved ? (
        <Alert tone="success" role="status">
          Saved.
        </Alert>
      ) : null}
      <EntityEditor
        key={settings.version}
        collection="settings"
        item={settings}
        csrfToken={session.csrf_token}
      />
    </>
  );
}
