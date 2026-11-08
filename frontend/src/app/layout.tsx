import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";

import { siteDescription, siteName, siteTitle, siteUrl } from "@/lib/site";

import "./globals.css";

// Self-hosted at build time by next/font: no runtime request to Google.
const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-plus-jakarta",
  display: "swap",
});
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: { default: siteTitle, template: `%s · ${siteName}` },
  description: siteDescription,
  applicationName: siteName,
  authors: [{ name: siteName }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName,
    title: siteTitle,
    description: siteDescription,
    url: "/",
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title: siteTitle, description: siteDescription },
};

export const viewport: Viewport = {
  themeColor: "#080d17",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${inter.variable} ${jetbrains.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
