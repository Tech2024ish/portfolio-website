import { Spinner } from "@/components/ui/feedback";
import { containerClasses } from "@/components/ui/section";
import { dictionary } from "@/i18n/dictionaries";
import { currentLocale } from "@/i18n/server";

/** Shown while a projects page is being prepared during client-side navigation. */
export default async function ProjectsLoading() {
  const t = dictionary(await currentLocale()).projects;
  return (
    <div className={`${containerClasses} flex min-h-[50vh] items-center justify-center py-16 text-accent`}>
      <Spinner size="lg" label={t.loading} />
    </div>
  );
}
