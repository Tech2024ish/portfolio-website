"use client";

import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";
import { containerClasses } from "@/components/ui/section";

/**
 * Fallback for unexpected rendering errors in any page. It offers a retry and a way home, and
 * never shows the error itself to visitors.
 */
export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main id="main" className={`${containerClasses} flex min-h-[60vh] items-center justify-center py-16`}>
      <ErrorState
        headingLevel={2}
        title="This page could not be loaded"
        description="Something went wrong on our side. Try again, or go back to the home page."
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <button type="button" onClick={() => retry()} className={buttonClasses("primary", "sm")}>
              Try again
            </button>
            <Link href="/" className={buttonClasses("secondary", "sm")}>
              Go to the home page
            </Link>
          </div>
        }
      />
    </main>
  );
}
