import Image from "next/image";

import { buttonClasses } from "@/components/ui/button";
import { ExternalLink } from "@/components/ui/external-link";
import { ArrowRightIcon, DownloadIcon, GitHubIcon, LinkedInIcon, MapPinIcon } from "@/components/ui/icons";
import { containerClasses } from "@/components/ui/section";
import { StatusBadge } from "@/components/ui/tag";
import { profile } from "@/content/profile";

const socialIcons = { GitHub: GitHubIcon, LinkedIn: LinkedInIcon } as const;

export function Hero() {
  return (
    <section aria-labelledby="hero-heading" className="relative overflow-hidden">
      {/* Decorative glow behind the hero, from the accent token. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 right-0 h-[28rem] w-[28rem] rounded-full bg-accent/10 blur-3xl"
      />
      <div
        className={`${containerClasses} relative grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-16 lg:py-24`}
      >
        <div className="flex flex-col gap-6">
          <StatusBadge>{profile.availability}</StatusBadge>

          <h1 id="hero-heading" className="flex flex-col gap-4">
            <span className="font-mono text-sm font-medium text-accent sm:text-base">
              {profile.name} · {profile.title}
            </span>
            <span className="font-display text-[2.125rem] leading-[1.12] font-extrabold tracking-tight text-balance text-fg sm:text-5xl lg:text-display">
              {profile.headline}
            </span>
          </h1>

          <p className="max-w-xl text-base text-muted sm:text-body">{profile.summary}</p>

          <p className="flex items-center gap-2 text-sm text-muted">
            <MapPinIcon className="size-4 text-accent" />
            {profile.location}
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <a href="#projects" className={buttonClasses("primary")}>
              View projects
              <ArrowRightIcon className="size-4" />
            </a>
            <a href={profile.cvHref} download className={buttonClasses("secondary")}>
              <DownloadIcon className="size-4" />
              Download CV
            </a>
            <ul className="flex items-center gap-1 sm:ml-2" aria-label="Profiles">
              {profile.social.map((link) => {
                const Icon = socialIcons[link.label];
                return (
                  <li key={link.label}>
                    <ExternalLink
                      href={link.href}
                      aria-label={`${link.label} profile`}
                      className="inline-flex size-11 items-center justify-center rounded-control text-muted transition-colors hover:bg-raised hover:text-fg"
                    >
                      <Icon />
                    </ExternalLink>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[20rem] sm:max-w-sm lg:max-w-none">
          <div
            aria-hidden="true"
            className="absolute inset-0 translate-x-3 translate-y-3 rounded-card border border-accent/50"
          />
          <div className="relative overflow-hidden rounded-card border border-border-strong bg-accent-soft">
            <Image
              src="/ishimwe-jean-claude.png"
              width={987}
              height={1070}
              alt={`Portrait of ${profile.name}`}
              sizes="(min-width: 1024px) 384px, (min-width: 640px) 384px, 320px"
              className="aspect-[4/5] h-auto w-full object-cover object-top"
              loading="eager"
              fetchPriority="high"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
