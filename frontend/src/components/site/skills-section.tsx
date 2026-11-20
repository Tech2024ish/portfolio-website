import {
  ApiIcon,
  ArchitectureIcon,
  CodeIcon,
  DatabaseIcon,
  LayoutIcon,
  WrenchIcon,
} from "@/components/ui/icons";
import { cardClasses, Section } from "@/components/ui/section";
import { TagList } from "@/components/ui/tag";
import type { SkillGroup } from "@/content/profile";

/** Group names come from the Studio, so the icon is chosen from words in the name. */
const groupIcons: [RegExp, typeof CodeIcon][] = [
  [/language/i, CodeIcon],
  [/backend|api|server/i, ApiIcon],
  [/data/i, DatabaseIcon],
  [/front|ui|web/i, LayoutIcon],
  [/tool|devops|cloud/i, WrenchIcon],
  [/practice|design|architect/i, ArchitectureIcon],
];

export function skillGroupIcon(name: string): typeof CodeIcon {
  return groupIcons.find(([pattern]) => pattern.test(name))?.[1] ?? CodeIcon;
}

export function SkillsSection({ skillGroups }: { skillGroups: SkillGroup[] }) {
  return (
    <Section id="skills" title="Technical expertise" tone="band">
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {skillGroups.map((group) => {
          const Icon = skillGroupIcon(group.name);
          return (
            <li key={group.name} className={`${cardClasses} flex flex-col gap-4 p-6`}>
              <h3 className="flex items-center gap-3 text-base font-medium text-fg">
                <Icon className="size-5 text-fg" />
                {group.name}
              </h3>
              <TagList items={group.skills} label={group.name} />
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
