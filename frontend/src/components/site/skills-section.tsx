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
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { dictionary } from "@/i18n/dictionaries";

/**
 * Group names come from the Studio, in the page's language, so the icon is chosen from words in
 * the name in English, French or Kinyarwanda.
 */
const groupIcons: [RegExp, typeof CodeIcon][] = [
  [/language|langage|indimi/i, CodeIcon],
  [/backend|api|server|serveur/i, ApiIcon],
  [/data|donn[ée]es|amakuru/i, DatabaseIcon],
  [/front|ui|web/i, LayoutIcon],
  [/tool|outil|ibikoresho|devops|cloud/i, WrenchIcon],
  [/practi|pratique|imikorere|design|architect/i, ArchitectureIcon],
];

export function skillGroupIcon(name: string): typeof CodeIcon {
  return groupIcons.find(([pattern]) => pattern.test(name))?.[1] ?? CodeIcon;
}

export function SkillsSection({
  skillGroups,
  lang = DEFAULT_LOCALE,
}: {
  skillGroups: SkillGroup[];
  lang?: Locale;
}) {
  return (
    <Section id="skills" title={dictionary(lang).sections.skills} tone="band">
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
