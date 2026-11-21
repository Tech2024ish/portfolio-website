import { buttonClasses } from "@/components/ui/button";
import { ExternalLink } from "@/components/ui/external-link";
import { ArrowRightIcon, DownloadIcon, GitHubIcon, LinkedInIcon, MailIcon } from "@/components/ui/icons";
import { MediaImage } from "@/components/ui/media-image";
import { containerClasses } from "@/components/ui/section";
import { StatusBadge } from "@/components/ui/tag";
import type { Profile } from "@/content/profile";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { dictionary } from "@/i18n/dictionaries";

const socialIcons = { GitHub: GitHubIcon, LinkedIn: LinkedInIcon } as const;

const roundLink =
  "inline-flex size-11 items-center justify-center rounded-pill border border-border-strong text-fg transition-colors hover:bg-raised";

export function Hero({
  profile,
  showCv = true,
  lang = DEFAULT_LOCALE,
}: {
  profile: Profile;
  showCv?: boolean;
  lang?: Locale;
}) {
  const t = dictionary(lang).hero;
  return (
    <section aria-labelledby="hero-heading" className="relative overflow-hidden">
      {/* Decorative: a soft light behind the portrait, from the surface tokens. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_70%_45%,var(--color-raised),transparent_55%)]"
      />
      <div
        className={`${containerClasses} relative grid items-center gap-10 pt-10 pb-8 sm:pt-14 sm:pb-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-16 lg:pt-16 lg:pb-12`}
      >
        <div className="flex flex-col gap-6">
          <StatusBadge>{profile.availability}</StatusBadge>

          <h1
            id="hero-heading"
            className="text-[2.5rem] leading-[1.08] font-normal tracking-tight text-balance text-fg sm:text-6xl"
          >
            {t.greeting} <span className="block">{profile.name}</span>
          </h1>

          <p className="max-w-xl text-xl text-muted sm:text-2xl">
            <span className="text-fg">{profile.title}</span>. {profile.headline}
          </p>

          <p className="max-w-xl text-base text-muted">{profile.summary}</p>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {showCv ? (
              <a href={profile.cvHref} download className={buttonClasses("primary")}>
                <DownloadIcon className="size-4" />
                {t.downloadCv}
              </a>
            ) : null}
            <a href="#projects" className={buttonClasses("secondary")}>
              {t.viewProjects}
              <ArrowRightIcon className="size-4" />
            </a>
          </div>

          <ul className="flex items-center gap-3" aria-label={t.profiles}>
            {profile.social.map((link) => {
              const Icon = socialIcons[link.label];
              return (
                <li key={link.label}>
                  <ExternalLink
                    href={link.href}
                    aria-label={t.profileLink(link.label)}
                    className={roundLink}
                    lang={lang}
                  >
                    <Icon className="size-5" />
                  </ExternalLink>
                </li>
              );
            })}
            <li>
              <a href={`mailto:${profile.email}`} aria-label={t.email} className={roundLink}>
                <MailIcon className="size-5" />
              </a>
            </li>
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-[18rem] sm:max-w-[20rem] lg:max-w-none">
          <div className="overflow-hidden rounded-full border-4 border-card bg-raised shadow-overlay">
            <MediaImage
              src={profile.portraitSrc}
              width={profile.portraitImage?.width ?? 987}
              height={profile.portraitImage?.height ?? 1070}
              variants={profile.portraitImage?.variants}
              alt={profile.portraitAlt}
              sizes="(min-width: 1024px) 352px, (min-width: 640px) 320px, 288px"
              className="aspect-square h-auto w-full object-cover object-top"
              priority
            />
          </div>
          <p className="absolute right-0 bottom-4 flex items-center gap-2 rounded-card border border-border bg-card px-4 py-2.5 text-sm text-fg shadow-raised sm:-right-4">
            <span aria-hidden="true" className="size-2.5 rounded-full bg-success" />
            {t.availableForHire}
          </p>
        </div>
      </div>
    </section>
  );
}
