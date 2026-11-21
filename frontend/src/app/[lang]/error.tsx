"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { buttonClasses } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";
import { containerClasses } from "@/components/ui/section";
import { DEFAULT_LOCALE, isLocale, localePath } from "@/i18n/config";
import { dictionary } from "@/i18n/dictionaries";

/**
 * Fallback for unexpected rendering errors in any page, in the page's language. It offers a retry
 * and a way home, and never shows the error itself to visitors.
 */
export default function ErrorPage({ retry }: { error: unknown; retry: () => void }) {
  const param = useParams<{ lang?: string }>()?.lang;
  const lang = isLocale(param) ? param : DEFAULT_LOCALE;
  const t = dictionary(lang).errors;
  return (
    <main id="main" className={`${containerClasses} flex min-h-[60vh] items-center justify-center py-16`}>
      <ErrorState
        headingLevel={2}
        title={t.loadTitle}
        description={t.loadBody}
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <button type="button" onClick={() => retry()} className={buttonClasses("primary", "sm")}>
              {t.tryAgain}
            </button>
            <Link href={localePath(lang, "/")} className={buttonClasses("secondary", "sm")}>
              {t.goHome}
            </Link>
          </div>
        }
      />
    </main>
  );
}
