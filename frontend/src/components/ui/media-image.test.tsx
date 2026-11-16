import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { checkImageFile } from "@/components/owner/media-uploader";
import { contentFromApi } from "@/lib/content/map";
import type { ApiPortfolio } from "@/lib/content/types";

import { MediaImage } from "./media-image";

const variants = [
  { width: 480, height: 320, url: "https://x.supabase.co/storage/v1/object/public/media/a/w480.webp" },
  { width: 960, height: 640, url: "https://x.supabase.co/storage/v1/object/public/media/a/w960.webp" },
];

describe("MediaImage", () => {
  it("serves library images with their stored sizes in srcset, lazily and without layout shift", () => {
    render(
      <MediaImage
        src="https://x.supabase.co/storage/v1/object/public/media/a/original.png"
        alt="A dashboard"
        width={2000}
        height={1333}
        variants={variants}
        sizes="100vw"
      />,
    );
    const image = screen.getByRole("img", { name: "A dashboard" });
    expect(image.getAttribute("srcset")).toBe(
      `${variants[0]!.url} 480w, ${variants[1]!.url} 960w, https://x.supabase.co/storage/v1/object/public/media/a/original.png 2000w`,
    );
    expect(image).toHaveAttribute("width", "2000");
    expect(image).toHaveAttribute("height", "1333");
    expect(image).toHaveAttribute("loading", "lazy");
  });

  it("loads the hero image eagerly with high priority", () => {
    render(
      <MediaImage
        src="/api/v1/media/files/x.png"
        alt="Portrait"
        width={800}
        height={1000}
        sizes="320px"
        priority
      />,
    );
    const image = screen.getByRole("img", { name: "Portrait" });
    expect(image).toHaveAttribute("loading", "eager");
    expect(image).toHaveAttribute("fetchpriority", "high");
  });
});

describe("checkImageFile", () => {
  const file = (type: string, bytes: number) => new File([new Uint8Array(bytes)], "x", { type });

  it("accepts JPEG, PNG and WebP within the size limit", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"])
      expect(checkImageFile(file(type, 10), 8)).toBeNull();
  });

  it("refuses other types, oversized files and no file", () => {
    expect(checkImageFile(file("image/svg+xml", 10), 8)).toMatch(/JPEG, PNG or WebP/);
    expect(checkImageFile(file("image/gif", 10), 8)).toMatch(/JPEG, PNG or WebP/);
    expect(checkImageFile(file("image/png", 2 * 1024 * 1024), 1)).toMatch(/larger than 1 MB/);
    expect(checkImageFile(undefined, 8)).toBe("Choose an image.");
  });
});

describe("responsive images from the API", () => {
  it("passes the portrait's and case-study images' sizes to the pages", () => {
    const profile = {
      name: "A B",
      initials: "AB",
      title: "t",
      location: "l",
      availability: "a",
      headline: "h",
      summary: "s",
      about_lead: "a",
      about_body: [],
      email: "a@b.c",
      cv_href: "/cv.pdf",
      portrait_src: "https://x/original.png",
      portrait_alt: "Portrait",
      contact_intro: "c",
      social: [],
      principles: [],
    };
    const study = {
      overview: [],
      problem: null,
      objectives: [],
      approach: null,
      architecture: [],
      decisions: [],
      challenges: [],
      outcomes: [],
      scope_implemented: [],
      scope_not_yet: [],
      media: [{ src: "https://x/s.png", alt: "Screen", caption: null, width: 2000, height: 1000, variants }],
    };
    const content = contentFromApi({
      profile,
      portrait: { width: 1200, height: 1500, variants },
      skill_groups: [],
      experience: [],
      education: [],
      certifications: [],
      projects: [
        {
          slug: "p",
          title: "P",
          category: "c",
          summary: "s",
          tech: [],
          featured: false,
          repo_url: null,
          live_url: null,
          case_study: study,
        },
      ],
      articles: [],
    } satisfies ApiPortfolio);
    expect(content.profile.portraitImage).toEqual({ width: 1200, height: 1500, variants });
    expect(content.projects[0]?.details?.media?.[0]?.variants).toEqual(variants);
  });
});
