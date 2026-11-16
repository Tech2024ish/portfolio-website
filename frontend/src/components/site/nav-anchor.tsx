import Link from "next/link";
import type { ComponentProps } from "react";

/**
 * A navigation link: a plain anchor for in-page sections ("#about"), so the browser scrolls and
 * moves focus natively, and a Next.js Link for routes ("/projects", "/#about").
 */
export function NavAnchor({ href, ...props }: ComponentProps<"a"> & { href: string }) {
  if (href.startsWith("#")) return <a href={href} {...props} />;
  return <Link href={href} {...props} />;
}
