import { buttonClasses } from "@/components/ui/button";
import { DownloadIcon } from "@/components/ui/icons";
import { containerClasses } from "@/components/ui/section";
import { navigation, profile } from "@/content/profile";

import { MobileNav } from "./mobile-nav";

export function Logo() {
  return (
    <a
      href="#top"
      className="rounded-control font-display text-xl font-extrabold tracking-tight text-fg"
      aria-label={`${profile.name}, back to top`}
    >
      {profile.initials}
      <span className="text-accent">.</span>
    </a>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-canvas/85 backdrop-blur-md">
      <div className={`${containerClasses} relative flex h-16 items-center justify-between gap-6`}>
        <Logo />

        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-1 lg:gap-2">
            {navigation.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="rounded-control px-3 py-2 text-sm text-muted transition-colors hover:text-fg"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Wrapper owns visibility: buttonClasses sets display, which would override `hidden`. */}
        <div className="hidden md:block">
          <a href={profile.cvHref} download className={buttonClasses("primary", "sm")}>
            <DownloadIcon className="size-4" />
            Download CV
          </a>
        </div>

        <MobileNav items={navigation} cvHref={profile.cvHref} />
      </div>
    </header>
  );
}
