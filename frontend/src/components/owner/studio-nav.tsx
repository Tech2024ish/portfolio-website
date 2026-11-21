"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import {
  ActivityIcon,
  BadgeIcon,
  BriefcaseIcon,
  ChartIcon,
  ChevronDownIcon,
  FolderIcon,
  GraduationIcon,
  HomeIcon,
  ImageIcon,
  InboxIcon,
  LayoutIcon,
  NoteIcon,
  SettingsIcon,
  ShieldIcon,
  UserIcon,
  WrenchIcon,
} from "@/components/ui/icons";
import { cx } from "@/lib/cx";

type StudioLink = { href: string; label: string; icon: typeof HomeIcon };

/** The Studio's sections, grouped as in the sidebar. */
export const STUDIO_GROUPS: readonly { label: string; links: readonly StudioLink[] }[] = [
  {
    label: "Overview",
    links: [
      { href: "/owner", label: "Dashboard", icon: HomeIcon },
      { href: "/owner/messages", label: "Messages", icon: InboxIcon },
    ],
  },
  {
    label: "Content",
    links: [
      { href: "/owner/profile", label: "Profile", icon: UserIcon },
      { href: "/owner/content/projects", label: "Projects", icon: FolderIcon },
      { href: "/owner/content/experiences", label: "Experience", icon: BriefcaseIcon },
      { href: "/owner/content/education", label: "Education", icon: GraduationIcon },
      { href: "/owner/content/certifications", label: "Certifications", icon: BadgeIcon },
      { href: "/owner/content/skill-categories", label: "Skill groups", icon: LayoutIcon },
      { href: "/owner/content/skills", label: "Skills", icon: WrenchIcon },
      { href: "/owner/content/articles", label: "Notes", icon: NoteIcon },
      { href: "/owner/media", label: "Media", icon: ImageIcon },
    ],
  },
  {
    label: "Insights",
    links: [
      { href: "/owner/analytics", label: "Analytics", icon: ChartIcon },
      { href: "/owner/activity", label: "Activity", icon: ActivityIcon },
    ],
  },
  {
    label: "Account",
    links: [
      { href: "/owner/settings", label: "Settings", icon: SettingsIcon },
      { href: "/owner/security", label: "Security", icon: ShieldIcon },
    ],
  },
];

export const STUDIO_LINKS = STUDIO_GROUPS.flatMap((group) => group.links);

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

/**
 * A left sidebar on wide screens: groups that open and close (the one holding the current page
 * starts open), an icon per link and the current section filled with the accent colour. Below the
 * lg breakpoint every link forms one row that scrolls sideways under the header (a sidebar would
 * take too much of a narrow screen): group headers are hidden there and the group wrappers step
 * aside (`display: contents`), so no link is ever folded away on a phone.
 */
export function StudioNav() {
  const current = currentStudioLink(usePathname());
  // Only the owner's own choices are stored; otherwise a group is open when it holds the page.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  return (
    <nav
      aria-label="Studio"
      className="flex gap-1 overflow-x-auto border-b border-border bg-surface px-4 py-2 sm:px-6 lg:flex-col lg:gap-2 lg:overflow-x-visible lg:border-b-0 lg:bg-transparent lg:px-3 lg:py-0"
    >
      {STUDIO_GROUPS.map((group) => {
        const slug = group.label.toLowerCase();
        const holdsCurrent = group.links.some((link) => link.href === current);
        const open = toggled[group.label] ?? (holdsCurrent || (current === null && slug === "overview"));
        return (
          <div key={group.label} className="contents lg:block">
            <button
              type="button"
              id={`studio-group-${slug}`}
              aria-expanded={open}
              aria-controls={`studio-links-${slug}`}
              onClick={() => setToggled((state) => ({ ...state, [group.label]: !open }))}
              className="hidden min-h-10 w-full items-center justify-between rounded-control px-4 text-xs font-semibold tracking-wider text-muted uppercase transition-colors hover:text-fg lg:flex"
            >
              {group.label}
              <ChevronDownIcon className={cx("size-4 transition-transform", open ? "" : "-rotate-90")} />
            </button>
            <ul
              id={`studio-links-${slug}`}
              aria-labelledby={`studio-group-${slug}`}
              className={cx("contents", open ? "lg:flex lg:flex-col lg:gap-1 lg:pb-2" : "lg:hidden")}
            >
              {group.links.map((link) => {
                const Icon = link.icon;
                const active = current === link.href;
                return (
                  <li key={link.href} className="shrink-0">
                    <Link
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "flex min-h-10 items-center gap-3 rounded-card px-3 text-sm transition-colors lg:min-h-11 lg:px-4 lg:text-[0.9375rem]",
                        active
                          ? "bg-accent font-semibold text-accent-ink"
                          : "text-muted hover:bg-raised hover:text-fg",
                      )}
                    >
                      <Icon className="size-5 max-lg:hidden" />
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
