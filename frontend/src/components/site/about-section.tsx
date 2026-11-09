import { ApiIcon, ArchitectureIcon, DatabaseIcon, ShieldIcon } from "@/components/ui/icons";
import { cardClasses, Section } from "@/components/ui/section";
import { principles, profile, type Principle } from "@/content/profile";

const principleIcons: Record<Principle["icon"], typeof ApiIcon> = {
  architecture: ArchitectureIcon,
  database: DatabaseIcon,
  api: ApiIcon,
  quality: ShieldIcon,
};

export function AboutSection() {
  return (
    <Section id="about" eyebrow="About" title="Engineering philosophy" description={profile.aboutLead}>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-14">
        <div className="flex flex-col gap-4 text-base text-muted">
          {profile.aboutBody.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>

        <ul className="grid gap-4 sm:grid-cols-2">
          {principles.map((principle) => {
            const Icon = principleIcons[principle.icon];
            return (
              <li key={principle.title} className={`${cardClasses} flex flex-col gap-3 p-5`}>
                <span className="inline-flex size-10 items-center justify-center rounded-control bg-accent-soft text-accent">
                  <Icon />
                </span>
                <h3 className="font-display text-lg font-semibold text-fg">{principle.title}</h3>
                <p className="text-sm text-muted">{principle.body}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </Section>
  );
}
