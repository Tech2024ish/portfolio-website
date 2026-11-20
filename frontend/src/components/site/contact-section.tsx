import { ExternalLink } from "@/components/ui/external-link";
import { DownloadIcon, GitHubIcon, LinkedInIcon, MailIcon, MapPinIcon } from "@/components/ui/icons";
import { Section } from "@/components/ui/section";
import { StatusBadge } from "@/components/ui/tag";
import type { Profile } from "@/content/profile";

import { ContactForm } from "./contact-form";

const staticRowClasses =
  "flex min-h-16 flex-1 items-center gap-4 rounded-card border border-border bg-card px-5 py-3 text-fg";
const rowClasses = `${staticRowClasses} transition-colors hover:border-border-strong hover:bg-raised`;

/**
 * The contact form (stored by FastAPI) with direct channels kept alongside as alternatives.
 * Only the form is a client component; the rest of the section renders on the server.
 */
export function ContactSection({
  profile,
  showForm = true,
  showCv = true,
}: {
  profile: Profile;
  /** Off: the email and links stay; the form is replaced by a note. */
  showForm?: boolean;
  showCv?: boolean;
}) {
  const social = Object.fromEntries(profile.social.map((link) => [link.label, link.href]));
  return (
    <Section id="contact" title="Let's build something reliable" description={profile.contactIntro}>
      {/* Above both columns, so the first card and the form start on the same line. */}
      <div className="mb-5 flex justify-center">
        <StatusBadge>{profile.availability}</StatusBadge>
      </div>
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-2 lg:gap-8">
        <div className="flex flex-col">
          {/* The cards share any extra height, so this column ends level with the form beside it. */}
          <ul className="flex flex-1 flex-col gap-3" aria-label="Other ways to reach me">
            <li className="flex flex-1">
              <a href={`mailto:${profile.email}`} className={rowClasses}>
                <MailIcon />
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium text-fg">Email</span>
                  <span className="truncate text-muted">{profile.email}</span>
                </span>
              </a>
            </li>
            {social.LinkedIn ? (
              <li className="flex flex-1">
                <ExternalLink href={social.LinkedIn} className={rowClasses}>
                  <LinkedInIcon />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium text-fg">LinkedIn</span>
                    <span className="truncate text-muted">{profile.name}</span>
                  </span>
                </ExternalLink>
              </li>
            ) : null}
            {social.GitHub ? (
              <li className="flex flex-1">
                <ExternalLink href={social.GitHub} className={rowClasses}>
                  <GitHubIcon />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium text-fg">GitHub</span>
                    <span className="truncate text-muted">{social.GitHub.replace("https://", "")}</span>
                  </span>
                </ExternalLink>
              </li>
            ) : null}
            <li className="flex flex-1">
              <p className={staticRowClasses}>
                <MapPinIcon />
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium text-fg">Location</span>
                  <span className="truncate text-muted">{profile.location}</span>
                </span>
              </p>
            </li>
            {showCv ? (
              <li className="flex flex-1">
                <a href={profile.cvHref} download className={rowClasses}>
                  <DownloadIcon />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium text-fg">CV</span>
                    <span className="truncate text-muted">Download as PDF</span>
                  </span>
                </a>
              </li>
            ) : null}
          </ul>
        </div>

        {showForm ? (
          <ContactForm email={profile.email} />
        ) : (
          <p className="text-muted">
            The contact form is closed for now. Please write to{" "}
            <a href={`mailto:${profile.email}`} className="text-fg underline underline-offset-4">
              {profile.email}
            </a>
            .
          </p>
        )}
      </div>
    </Section>
  );
}
