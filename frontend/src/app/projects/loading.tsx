import { Spinner } from "@/components/ui/feedback";
import { containerClasses } from "@/components/ui/section";

/** Shown while a projects page is being prepared during client-side navigation. */
export default function ProjectsLoading() {
  return (
    <div className={`${containerClasses} flex min-h-[50vh] items-center justify-center py-16 text-accent`}>
      <Spinner size="lg" label="Loading projects" />
    </div>
  );
}
