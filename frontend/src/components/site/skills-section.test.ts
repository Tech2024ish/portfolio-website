import { describe, expect, it } from "vitest";

import { bundledContent } from "@/lib/content/map";

import { skillGroupIcon } from "./skills-section";

describe("skill group icons", () => {
  it("are the same in every language", () => {
    const icons = (lang: "en" | "fr" | "rw") =>
      bundledContent(lang).skillGroups.map((group) => skillGroupIcon(group.name));
    expect(icons("fr")).toEqual(icons("en"));
    expect(icons("rw")).toEqual(icons("en"));
  });
});
