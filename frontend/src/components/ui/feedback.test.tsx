import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { axeViolations } from "@/test/axe";

import { Button } from "./button";
import { Card } from "./card";
import { Alert, EmptyState, ErrorState, Spinner } from "./feedback";
import { TextLink } from "./link";
import { Badge } from "./tag";

describe("Alert", () => {
  it("announces danger immediately and other tones politely", () => {
    render(
      <>
        <Alert tone="danger">Could not save.</Alert>
        <Alert tone="success">Saved.</Alert>
        <Alert tone="info" role="note">
          Static note.
        </Alert>
      </>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Could not save.");
    expect(screen.getByRole("status")).toHaveTextContent("Saved.");
    expect(screen.getByRole("note")).toHaveTextContent("Static note.");
  });

  it("shows a title and keeps its icon decorative", () => {
    const { container } = render(
      <Alert tone="warning" title="Unsaved changes">
        Leave anyway?
      </Alert>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Unsaved changesLeave anyway?");
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("accepts a ref and tabIndex so callers can move focus to it", () => {
    let element: HTMLDivElement | null = null;
    render(
      <Alert
        tone="danger"
        tabIndex={-1}
        ref={(node) => {
          element = node;
        }}
      >
        Failed.
      </Alert>,
    );
    expect(element).toBe(screen.getByRole("alert"));
    expect(screen.getByRole("alert")).toHaveAttribute("tabindex", "-1");
  });
});

describe("Spinner", () => {
  it("is decorative without a label", () => {
    const { container } = render(<Spinner />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("is announced as a status with a label", () => {
    render(<Spinner label="Loading projects" size="lg" />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading projects");
  });
});

describe("EmptyState and ErrorState", () => {
  it("render a heading at the requested level, a description and an action", () => {
    render(
      <>
        <EmptyState
          title="No projects yet"
          description="Projects you create appear here."
          action={<Button>Create project</Button>}
          headingLevel={2}
        />
        <ErrorState title="Projects could not be loaded" description="Check your connection." />
      </>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "No projects yet" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Projects could not be loaded" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create project" })).toBeInTheDocument();
  });
});

describe("Badge, Card and TextLink", () => {
  it("Badge conveys meaning in text; its dot is decorative", () => {
    const { container } = render(
      <Badge tone="success" dot>
        Published
      </Badge>,
    );
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it("Card adds hover feedback only when interactive", () => {
    render(
      <>
        <Card data-testid="static">A</Card>
        <Card data-testid="interactive" interactive>
          B
        </Card>
      </>,
    );
    expect(screen.getByTestId("static").className).not.toContain("hover:bg-raised");
    expect(screen.getByTestId("interactive").className).toContain("hover:bg-raised");
  });

  it("TextLink is underlined, not colour-only", () => {
    render(<TextLink href="/projects">All projects</TextLink>);
    const link = screen.getByRole("link", { name: "All projects" });
    expect(link).toHaveAttribute("href", "/projects");
    expect(link.className).toContain("underline");
  });
});

describe("feedback accessibility", () => {
  it("has no violations across all tones and states", async () => {
    const { container } = render(
      <main>
        {(["info", "success", "warning", "danger"] as const).map((tone) => (
          <Alert key={tone} tone={tone} title={`${tone} title`}>
            {tone} body
          </Alert>
        ))}
        <Spinner label="Loading" />
        <EmptyState title="Empty" description="Nothing here." headingLevel={2} />
        <ErrorState title="Failed" headingLevel={2} />
        {(["neutral", "accent", "success", "warning", "danger"] as const).map((tone) => (
          <Badge key={tone} tone={tone}>
            {tone}
          </Badge>
        ))}
      </main>,
    );
    expect(await axeViolations(container)).toEqual([]);
  });
});
