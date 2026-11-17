import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ContactSection } from "@/components/site/contact-section";
import { Hero } from "@/components/site/hero";
import { ProjectsSection } from "@/components/site/projects-section";
import { profile, publicProjects } from "@/content/profile";
import { siteNavigation } from "@/lib/navigation";

import { DEFAULT_SETTINGS, hiddenSections, settingsFromApi } from "./settings";

const pathname = { value: "/" };
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));

describe("website settings", () => {
  it("default to the site as it was, and map from the API", () => {
    expect(settingsFromApi(undefined)).toBe(DEFAULT_SETTINGS);
    expect(
      settingsFromApi({
        seo_title: "T",
        seo_description: "D",
        show_skills: false,
        show_experience: true,
        show_contact_form: false,
        show_cv_download: true,
        home_project_count: 2,
      }),
    ).toMatchObject({ showSkills: false, showContactForm: false, homeProjectCount: 2 });
  });

  it("remove links to switched-off sections from the navigation", () => {
    const hidden = hiddenSections({ ...DEFAULT_SETTINGS, showSkills: false, showExperience: false });
    expect(hidden).toEqual(["#skills", "#experience"]);
    const labels = siteNavigation("home", 0, hidden).map((link) => link.label);
    expect(labels).toEqual(["About", "Projects", "Contact"]);
    expect(siteNavigation("other", 0, hidden).map((link) => link.href)).not.toContain("/#skills");
  });

  it("replace the contact form with the email address when it is closed", () => {
    render(<ContactSection profile={profile} showForm={false} />);
    expect(screen.queryByRole("form", { name: "Send a message" })).not.toBeInTheDocument();
    expect(screen.getByText(/The contact form is closed/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: profile.email }).length).toBeGreaterThan(0);
  });

  it("hide the CV download everywhere when switched off", () => {
    render(
      <>
        <Hero profile={profile} showCv={false} />
        <ContactSection profile={profile} showCv={false} />
      </>,
    );
    expect(screen.queryByRole("link", { name: /download cv/i })).not.toBeInTheDocument();
  });

  it("feature as many projects on the home page as chosen", () => {
    render(<ProjectsSection projects={publicProjects} limit={1} />);
    expect(screen.getAllByRole("article")).toHaveLength(1);
  });
});

describe("page-view reporting", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  async function tracker() {
    return (await import("@/components/site/page-view-tracker")).PageViewTracker;
  }

  it("reports each page once, with the external referrer only on the first", async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    Object.defineProperty(document, "referrer", { value: "https://www.linkedin.com/", configurable: true });
    const PageViewTracker = await tracker();
    pathname.value = "/";
    const { rerender } = render(<PageViewTracker />);
    rerender(<PageViewTracker />);
    pathname.value = "/projects";
    rerender(<PageViewTracker />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    const bodies = fetch.mock.calls.map((call) =>
      JSON.parse(String((call as unknown as [string, RequestInit])[1].body)),
    );
    expect(bodies).toEqual([
      { path: "/", referrer: "https://www.linkedin.com/" },
      { path: "/projects", referrer: null },
    ]);
  });

  it("reports nothing when the browser asks not to be tracked", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    Object.defineProperty(navigator, "doNotTrack", { value: "1", configurable: true });
    const PageViewTracker = await tracker();
    pathname.value = "/projects/mosaic";
    render(<PageViewTracker />);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fetch).not.toHaveBeenCalled();
    Object.defineProperty(navigator, "doNotTrack", { value: null, configurable: true });
  });
});
