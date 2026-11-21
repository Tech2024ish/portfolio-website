import type { Metadata, Viewport } from "next";
import Script from "next/script";
import type { ReactNode } from "react";

import { themeScript } from "@/components/site/theme-toggle";
import { siteUrl } from "@/lib/site";

import { fontClasses } from "../fonts";

import "../globals.css";

/**
 * The Owner Studio: a root layout of its own (the public site's is app/[lang]/layout.tsx), in
 * English. Never indexed (also sent as X-Robots-Tag, with Cache-Control: no-store, by
 * next.config.ts). Each page verifies the session on the server before rendering anything.
 */
export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: { default: "Owner Studio", template: "%s · Owner Studio" },
  robots: { index: false, follow: false },
  // No browser translation offers on top of the Studio (see app/[lang]/layout.tsx).
  other: { google: "notranslate" },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light dark",
};

export default function OwnerLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: the theme script may set data-theme on <html> before React hydrates.
    <html lang="en" translate="no" className={fontClasses} suppressHydrationWarning>
      <body>
        <Script id="theme" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeScript }} />
        <div className="min-h-screen bg-canvas">{children}</div>
      </body>
    </html>
  );
}
