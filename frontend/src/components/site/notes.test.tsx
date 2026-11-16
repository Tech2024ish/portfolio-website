import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Article } from "@/content/profile";
import { axeViolations } from "@/test/axe";

import { ArticleView, NotesIndex, PublishedDate } from "./notes";

const article: Article = {
  slug: "designing-apis",
  title: "Designing APIs",
  summary: "How I design REST APIs.",
  category: "API design",
  publishedOn: "2026-11-03",
  body: [
    { type: "paragraph", text: "An opening paragraph." },
    { type: "heading", text: "Contracts first" },
    { type: "list", items: ["One", "Two"] },
    { type: "code", language: "python", code: "def handler():\n    return {}" },
  ],
  visibility: "published",
};

describe("NotesIndex", () => {
  it("shows an empty state when no note is published", () => {
    render(<NotesIndex articles={[]} />);
    expect(screen.getByRole("heading", { level: 2, name: "No notes published yet" })).toBeInTheDocument();
  });

  it("lists notes with their category, date and a link to each", () => {
    render(<NotesIndex articles={[article]} />);
    const card = screen.getByRole("article", { name: "Designing APIs" });
    expect(within(card).getByRole("link", { name: "Designing APIs" })).toHaveAttribute(
      "href",
      "/notes/designing-apis",
    );
    expect(within(card).getByText("API design")).toBeInTheDocument();
    expect(within(card).getByText("3 November 2026")).toHaveAttribute("dateTime", "2026-11-03");
  });
});

describe("ArticleView", () => {
  it("renders each block with the right element", () => {
    render(<ArticleView article={article} />);
    expect(screen.getByRole("heading", { level: 1, name: "Designing APIs" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Contracts first" })).toBeInTheDocument();
    expect(screen.getByText("An opening paragraph.")).toBeInTheDocument();
    expect(screen.getByText("Two").closest("ul")).not.toBeNull();
    expect(screen.getByLabelText("python code")).toHaveTextContent("def handler():");
  });

  it("renders text, never markup", () => {
    const { container } = render(
      <ArticleView
        article={{ ...article, body: [{ type: "paragraph", text: "<img src=x onerror=alert(1)>" }] }}
      />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<ArticleView article={article} />);
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe("PublishedDate", () => {
  it("formats the date in UTC, so it never shifts by a day", () => {
    render(<PublishedDate isoDate="2026-01-01" />);
    expect(screen.getByText("1 January 2026")).toHaveAttribute("dateTime", "2026-01-01");
  });
});
