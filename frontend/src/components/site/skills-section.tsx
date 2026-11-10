import { cardClasses, Section } from "@/components/ui/section";
import { TagList } from "@/components/ui/tag";
import { skillGroups } from "@/content/profile";

export function SkillsSection() {
  return (
    <Section id="skills" eyebrow="Skills" title="Technical expertise">
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {skillGroups.map((group) => (
          <li key={group.name} className={`${cardClasses} flex flex-col gap-4 p-5`}>
            <h3 className="font-display text-base font-semibold text-fg">{group.name}</h3>
            <TagList items={group.skills} label={group.name} />
          </li>
        ))}
      </ul>
    </Section>
  );
}
