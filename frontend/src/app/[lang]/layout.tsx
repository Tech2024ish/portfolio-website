import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import Script from "next/script";

import { themeScript } from "@/components/site/theme-toggle";
import { isLocale, LOCALES, OG_LOCALES } from "@/i18n/config";
import { alternatesFor } from "@/i18n/seo";
import { getPublicContent } from "@/lib/content/portfolio";
import { DEFAULT_SETTINGS } from "@/lib/content/settings";
import { siteName, siteUrl } from "@/lib/site";

import { fontClasses } from "../fonts";

import "../globals.css";

// Declared here rather than with Next's generated LayoutProps<...>: those types exist only after
// `next dev` or `next build`, and CI type-checks a fresh checkout before building.
type LangProps = { params: Promise<{ lang: string }> };

/** Every page is generated once per language. */
export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

/** Default title and description come from the owner's settings (defaults if unavailable). */
export async function generateMetadata({ params }: LangProps): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  let { seoTitle: title, seoDescription: description } = DEFAULT_SETTINGS;
  try {
    ({ seoTitle: title, seoDescription: description } = (await getPublicContent(lang)).settings);
  } catch {
    // The content API is unreachable: the defaults keep every page working.
  }
  const alternates = alternatesFor(lang, "/");
  return {
    metadataBase: siteUrl,
    title: { default: title, template: `%s · ${siteName}` },
    description,
    applicationName: siteName,
    authors: [{ name: siteName }],
    alternates,
    openGraph: {
      type: "website",
      siteName,
      title,
      description,
      url: alternates.canonical,
      locale: OG_LOCALES[lang],
      // The sharing image is generated (app/[lang]/opengraph-image.tsx and per project and note).
    },
    twitter: { card: "summary_large_image", title, description },
    // The site translates itself (EN / FR / RW menu): browsers must not offer their own translation
    // on top of it ("Translated to English" bars). Chrome reads this meta tag; others, translate="no".
    other: { google: "notranslate" },
  };
}

// Light is the default theme; the browser colour follows it (the toggle may switch the page to dark).
export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light dark",
};

/** The public site's root layout: `<html lang>` is the page's language. */
export default async function RootLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode }> & LangProps) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  return (
    // suppressHydrationWarning: the theme script may set data-theme on <html> before React hydrates.
    <html lang={lang} translate="no" className={fontClasses} suppressHydrationWarning>
      <body id="top">
        {/* Applies a stored dark choice before the first paint, so the page never flashes.
            Next injects it into the HTML itself (a plain <script> rendered by React would not run
            on client-side renders, and React warns about it). */}
        <Script id="theme" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
