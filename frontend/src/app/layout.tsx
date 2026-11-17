import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";

import { getPublicContent } from "@/lib/content/portfolio";
import { DEFAULT_SETTINGS } from "@/lib/content/settings";
import { siteName, siteUrl } from "@/lib/site";

import "./globals.css";

// Self-hosted at build time by next/font: no runtime request to Google.
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-plus-jakarta",
  display: "swap",
});
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
// Monospace is used only for small labels, so it is not preloaded: on slow connections the
// preloaded fonts compete with the page itself for bandwidth. It still loads, with a metric-matched
// fallback until then, so swapping it in does not shift the layout.
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  display: "swap",
  preload: false,
});

/** Default title and description come from the owner's settings (defaults if unavailable). */
export async function generateMetadata(): Promise<Metadata> {
  let { seoTitle: title, seoDescription: description } = DEFAULT_SETTINGS;
  try {
    ({ seoTitle: title, seoDescription: description } = (await getPublicContent()).settings);
  } catch {
    // The content API is unreachable: the defaults keep every page (and the Studio) working.
  }
  return {
    metadataBase: siteUrl,
    title: { default: title, template: `%s · ${siteName}` },
    description,
    applicationName: siteName,
    authors: [{ name: siteName }],
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      siteName,
      title,
      description,
      url: "/",
      locale: "en_US",
      // The sharing image is generated (app/opengraph-image.tsx and per project and note).
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export const viewport: Viewport = {
  themeColor: "#080d17",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${inter.variable} ${jetbrains.variable} antialiased`}>
      <body id="top">{children}</body>
    </html>
  );
}
