import { Inter, JetBrains_Mono } from "next/font/google";

/**
 * Fonts shared by the two root layouts (the public site in app/[lang] and the Owner Studio).
 * Self-hosted at build time by next/font: no runtime request to Google. Inter (variable, every
 * weight) sets both headings and text, as in the reference design.
 */
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

export const fontClasses = `${inter.variable} ${jetbrains.variable} antialiased`;
