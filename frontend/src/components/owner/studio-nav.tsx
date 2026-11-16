"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cx } from "@/lib/cx";

export const STUDIO_LINKS = [
  { href: "/owner", label: "Dashboard" },
  { href: "/owner/messages", label: "Messages" },
  { href: "/owner/profile", label: "Profile" },
  { href: "/owner/content/projects", label: "Projects" },
  { href: "/owner/content/experiences", label: "Experience" },
  { href: "/owner/content/education", label: "Education" },
  { href: "/owner/content/certifications", label: "Certifications" },
  { href: "/owner/content/skill-categories", label: "Skill groups" },
  { href: "/owner/content/skills", label: "Skills" },
  { href: "/owner/content/articles", label: "Notes" },
  { href: "/owner/media", label: "Media" },
  { href: "/owner/activity", label: "Activity" },
  { href: "/owner/security", label: "Security" },
] as const;

/** The section a path belongs to: the longest matching link ("/owner" only for itself). */
export function currentStudioLink(pathname: string): string | null {
  let best: string | null = null;
  for (const { href } of STUDIO_LINKS) {
    const matches =
      href === "/owner" ? pathname === "/owner" : pathname === href || pathname.startsWith(`${href}/`);
    if (matches && (!best || href.length > best.length)) best = href;
  }
  return best;
}

export function StudioNav() {
  const current = currentStudioLink(usePathname());
  return (
    <nav aria-label="Studio" className="border-b border-border bg-surface">
      <ul className="mx-auto flex w-full max-w-page gap-1 overflow-x-auto px-4 py-2 sm:px-6 lg:px-8">
        {STUDIO_LINKS.map((link) => (
          <li key={link.href} className="shrink-0">
            <Link
              href={link.href}
              aria-current={current === link.href ? "page" : undefined}
              className={cx(
                "inline-flex min-h-10 items-center rounded-control px-3 text-sm",
                current === link.href
                  ? "bg-accent-soft font-medium text-accent"
                  : "text-muted hover:bg-raised hover:text-fg",
              )}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
