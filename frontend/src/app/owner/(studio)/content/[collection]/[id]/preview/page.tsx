import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StudioUnavailable } from "@/components/owner/studio-ui";
import { ArticleView } from "@/components/site/notes";
import { ProjectDetail } from "@/components/site/project-detail";
import { Alert } from "@/components/ui/feedback";
import { TextLink } from "@/components/ui/link";
import { parseArticleBody } from "@/lib/content/body";
import { projectFromApi } from "@/lib/content/map";
import type { ApiProject } from "@/lib/content/types";
import type { OwnerItem } from "@/lib/owner/content-schema";
import { OwnerApiUnavailableError, ownerFind, studioSession } from "@/lib/owner/session";

import { idOr404, specOr404 } from "../../data";

type Props = { params: Promise<{ collection: string; id: string }> };

export const metadata: Metadata = { title: "Preview" };

const CASE_STUDY_FIELDS = [
  "overview",
  "problem",
  "objectives",
  "approach",
  "architecture",
  "decisions",
  "challenges",
  "outcomes",
  "scope_implemented",
  "scope_not_yet",
  "media",
] as const;

/**
 * The saved item rendered with the public components, drafts included: projects show their case
 * study whatever its status. Only the signed-in owner can open it, and it is never cached.
 */
export default async function PreviewPage({ params }: Props) {
  const { collection, id: rawId } = await params;
  const spec = specOr404(collection);
  if (!spec.previewable) notFound();
  const id = idOr404(rawId);
  const editPath = `/owner/content/${spec.key}/${id}`;
  const path = `${editPath}/preview`;
  const session = await studioSession(path);
  if (!session) return <StudioUnavailable retryHref={path} />;

  let item: OwnerItem | null;
  try {
    item = await ownerFind<OwnerItem>(`/api/v1/owner/${spec.key}/${id}`, path);
  } catch (error) {
    if (error instanceof OwnerApiUnavailableError) return <StudioUnavailable retryHref={path} />;
    throw error;
  }
  if (!item) notFound();

  let view;
  if (spec.key === "projects") {
    const caseStudy = Object.fromEntries(CASE_STUDY_FIELDS.map((field) => [field, item[field]]));
    const project = projectFromApi({
      ...(item as unknown as ApiProject),
      case_study: caseStudy as ApiProject["case_study"],
    });
    view = <ProjectDetail project={project} details={project.details} related={[]} />;
  } else {
    view = (
      <ArticleView
        article={{
          slug: String(item.slug),
          title: String(item.title),
          summary: String(item.summary),
          category: String(item.category),
          publishedOn:
            typeof item.published_on === "string" ? item.published_on : new Date().toISOString().slice(0, 10),
          body: parseArticleBody(String(item.body ?? "")),
          visibility: "draft",
        }}
      />
    );
  }

  return (
    <>
      <Alert tone="warning" title="Preview">
        This is how the saved version will look on the site.{" "}
        {item.status === "published" ? "It is published." : "It is a draft: nobody else can see it."}{" "}
        {spec.key === "projects" && item.case_study_status !== "published"
          ? "The case study is a draft and is shown here only. "
          : null}
        <TextLink href={editPath}>Back to editing</TextLink>
      </Alert>
      <div className="-mx-4 sm:-mx-6 lg:-mx-8">{view}</div>
    </>
  );
}
