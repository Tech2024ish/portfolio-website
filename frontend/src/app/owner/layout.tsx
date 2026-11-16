import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * The Owner Studio. Never indexed (also sent as X-Robots-Tag, with Cache-Control: no-store, by
 * next.config.ts). Each page verifies the session on the server before rendering anything.
 */
export const metadata: Metadata = {
  title: { default: "Owner Studio", template: "%s · Owner Studio" },
  robots: { index: false, follow: false },
};

export default function OwnerLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-canvas">{children}</div>;
}
