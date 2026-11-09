import { buttonClasses } from "@/components/ui/button";
import { ExternalLink } from "@/components/ui/external-link";
import { DownloadIcon, GitHubIcon, LinkedInIcon, MailIcon, MapPinIcon } from "@/components/ui/icons";
import { cardClasses, Section } from "@/components/ui/section";
import { StatusBadge } from "@/components/ui/tag";
import { profile } from "@/content/profile";

const social = Object.fromEntries(profile.social.map((link) => [link.label, link.href]));

const rowClasses =
  "flex min-h-16 items-center gap-4 rounded-card border border-border bg-card px-5 py-3 transition-colors hover:border-accent/60 hover:bg-raised";

/**
 * Direct contact channels. There is no contact form until the backend endpoint
 * exists, so nothing here pretends to send a message.
 */
export function ContactSection() {
  return (
    <Section id="contact" eyebrow="Contact" title="Let's build something reliable">
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div className={`${cardClasses} flex flex-col gap-5 p-6 sm:p-8`}>
          <StatusBadge>{profile.availability}</StatusBadge>
          <p className="text-base text-fg sm:text-body">{profile.contactIntro}</p>
          <p className="flex items-center gap-2 text-sm text-muted">
            <MapPinIcon className="size-4 text-accent" />
            Based in {profile.location}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a href={`mailto:${profile.email}`} className={buttonClasses("primary")}>
              <MailIcon className="size-4" />
              Email me
            </a>
            <a href={profile.cvHref} download className={buttonClasses("secondary")}>
              <DownloadIcon className="size-4" />
              Download CV
            </a>
          </div>
        </div>

        <ul className="flex flex-col gap-3" aria-label="Contact channels">
          <li>
            <a href={`mailto:${profile.email}`} className={rowClasses}>
              <MailIcon className="text-accent" />
              <span className="flex min-w-0 flex-col">
                <span className="text-sm text-muted">Email</span>
                <span className="truncate text-fg">{profile.email}</span>
              </span>
            </a>
          </li>
          {social.LinkedIn ? (
            <li>
              <ExternalLink href={social.LinkedIn} className={rowClasses}>
                <LinkedInIcon className="text-accent" />
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm text-muted">LinkedIn</span>
                  <span className="truncate text-fg">{profile.name}</span>
                </span>
              </ExternalLink>
            </li>
          ) : null}
          {social.GitHub ? (
            <li>
              <ExternalLink href={social.GitHub} className={rowClasses}>
                <GitHubIcon className="text-accent" />
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm text-muted">GitHub</span>
                  <span className="truncate text-fg">{social.GitHub.replace("https://", "")}</span>
                </span>
              </ExternalLink>
            </li>
          ) : null}
        </ul>
      </div>
    </Section>
  );
}
