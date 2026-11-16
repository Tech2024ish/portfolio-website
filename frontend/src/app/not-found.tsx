import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/site/page-header";
import { SiteShell } from "@/components/site/site-shell";
import { buttonClasses } from "@/components/ui/button";
import { containerClasses } from "@/components/ui/section";

export const metadata: Metadata = { title: "Page not found" };

/**
 * Shown for unknown URLs and for anything unpublished (Next.js answers 404 and adds noindex).
 * It says nothing about whether the page exists as a draft.
 */
export default function NotFound() {
  return (
    <SiteShell page="other">
      <PageHeader
        eyebrow="404"
        title="Page not found"
        description={<p>This page does not exist or is not public.</p>}
      />
      <div className={`${containerClasses} flex flex-wrap gap-3 py-12`}>
        <Link href="/" className={buttonClasses("primary", "sm")}>
          Go to the home page
        </Link>
        <Link href="/projects" className={buttonClasses("secondary", "sm")}>
          See the projects
        </Link>
      </div>
    </SiteShell>
  );
}
