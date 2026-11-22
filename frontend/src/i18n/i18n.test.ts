import { describe, expect, it } from "vitest";

import { isLocale, localePath, LOCALES, parsePath } from "./config";
import { dictionary } from "./dictionaries";
import { alternatesFor } from "./seo";

describe("localePath", () => {
  it("keeps the same address in every language (the language is the visitor's choice)", () => {
    for (const lang of LOCALES) {
      expect(localePath(lang, "/projects")).toBe("/projects");
      expect(localePath(lang, "/#about")).toBe("/#about");
    }
  });
});

describe("parsePath", () => {
  it("finds the language and the path without its prefix", () => {
    expect(parsePath("/fr/projects/mosaic")).toEqual({ lang: "fr", path: "/projects/mosaic" });
    expect(parsePath("/rw")).toEqual({ lang: "rw", path: "/" });
    expect(parsePath("/projects")).toEqual({ lang: "en", path: "/projects" });
    expect(parsePath("/")).toEqual({ lang: "en", path: "/" });
  });

  it("removes the internal /en prefix Next reports on English pages", () => {
    // Otherwise the language menu linked to /fr/en/projects and analytics recorded /en/projects.
    expect(parsePath("/en/projects")).toEqual({ lang: "en", path: "/projects" });
    expect(parsePath("/en")).toEqual({ lang: "en", path: "/" });
  });

  it("gives the visible address for every internal path", () => {
    for (const lang of LOCALES) {
      for (const path of ["/", "/projects", "/notes/a-note"]) {
        expect(parsePath(`/${lang}${path === "/" ? "" : path}`)).toEqual({ lang, path });
      }
    }
  });

  it("accepts only the supported languages", () => {
    expect(LOCALES.every(isLocale)).toBe(true);
    expect(isLocale("de")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe("dictionaries", () => {
  /** Every key path of an object, with the type of each value. */
  function shape(value: unknown, prefix = ""): string[] {
    if (value && typeof value === "object") {
      return Object.entries(value).flatMap(([key, inner]) => shape(inner, `${prefix}${key}.`));
    }
    return [`${prefix.slice(0, -1)}:${typeof value}`];
  }

  it.each(["fr", "rw"] as const)("%s has exactly the English keys, with the same kinds of values", (lang) => {
    expect(shape(dictionary(lang))).toEqual(shape(dictionary("en")));
  });

  it.each(LOCALES)("%s has no empty text", (lang) => {
    const empty = shape(dictionary(lang)).filter((entry) => {
      const path = entry.split(":")[0]!.split(".");
      const value = path.reduce<unknown>(
        (node, key) => (node as Record<string, unknown>)[key],
        dictionary(lang),
      );
      return typeof value === "string" && value.trim() === "";
    });
    expect(empty).toEqual([]);
  });

  it("fills in names in sentences", () => {
    expect(dictionary("fr").projects.sourceFor("MOSAIC")).toBe("Code source de MOSAIC");
    expect(dictionary("rw").hero.profileLink("GitHub")).toContain("GitHub");
  });
});

describe("alternatesFor", () => {
  it("uses the one shared address as canonical in every language", () => {
    for (const lang of LOCALES) expect(alternatesFor(lang, "/projects")).toEqual({ canonical: "/projects" });
  });
});
