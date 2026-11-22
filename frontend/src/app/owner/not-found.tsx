import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { containerClasses } from "@/components/ui/section";

export default function StudioNotFound() {
  return (
    <main id="main" className={`${containerClasses} flex min-h-[60vh] items-center justify-center py-16`}>
      <EmptyState
        title="Page not found"
        description="This Studio page does not exist."
        action={
          <Link href="/owner" className={buttonClasses("primary", "sm")}>
            Go to the dashboard
          </Link>
        }
      />
    </main>
  );
}
