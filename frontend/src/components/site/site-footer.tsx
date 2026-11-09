import { ExternalLink } from "@/components/ui/external-link";
import { containerClasses } from "@/components/ui/section";
import { StatusBadge } from "@/components/ui/tag";
import { navigation, profile } from "@/content/profile";

import { Logo } from "./site-header";

const footerLink = "inline-flex min-h-8 items-center text-sm text-muted transition-colors hover:text-fg";

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border bg-surface">
      <div className={`${containerClasses} grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4`}>
        <div className="flex flex-col gap-3 lg:col-span-2">
          <Logo />
          <p className="max-w-sm text-sm text-muted">
            {profile.name} — {profile.title} in {profile.location}.
          </p>
          <StatusBadge>{profile.availability}</StatusBadge>
        </div>

        <nav aria-label="Footer">
          <h2 className="mb-3 text-sm font-semibold text-fg">Navigate</h2>
          <ul className="flex flex-col gap-1">
            {navigation.map((item) => (
              <li key={item.href}>
                <a href={item.href} className={footerLink}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-fg">Connect</h2>
          <ul className="flex flex-col gap-1">
            <li>
              <a href={`mailto:${profile.email}`} className={footerLink}>
                Email
              </a>
            </li>
            {profile.social.map((link) => (
              <li key={link.label}>
                <ExternalLink href={link.href} className={footerLink}>
                  {link.label}
                </ExternalLink>
              </li>
            ))}
            <li>
              <a href={profile.cvHref} download className={footerLink}>
                Download CV
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <p className={`${containerClasses} py-5 text-xs text-muted`}>
          © {year} {profile.name}
        </p>
      </div>
    </footer>
  );
}
