"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

declare global {
  interface Navigator {
    globalPrivacyControl?: boolean;
  }
}

/**
 * Reports one view per page the visitor actually opens (not prefetches) to
 * POST /api/v1/analytics/pageview. Nothing is reported when the browser asks not to be tracked
 * (Do Not Track or Global Privacy Control). The server decides what counts and stores no personal
 * data (see backend/app/services/analytics.py); this never delays or breaks the page.
 */
// Module state lasts for the whole visit, while the tracker remounts with each page (it lives in
// SiteShell): the external referrer belongs to the first view only, and a path is not reported
// twice in a row (React's development double-effect, or a re-render of the same page).
let firstView = true;
let lastReported: string | null = null;

export function PageViewTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || lastReported === pathname) return;
    lastReported = pathname;
    if (navigator.doNotTrack === "1" || navigator.globalPrivacyControl) return;
    const referrer = firstView && document.referrer ? document.referrer : null;
    firstView = false;
    void fetch("/api/v1/analytics/pageview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname, referrer }),
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => undefined);
  }, [pathname]);

  return null;
}
