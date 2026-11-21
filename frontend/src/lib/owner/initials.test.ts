import { describe, expect, it } from "vitest";

import { initialsOf } from "./initials";

describe("initialsOf", () => {
  it("takes the first letters of the first two words", () => {
    expect(initialsOf("Jean Claude Ishimwe", "owner@example.com")).toBe("JC");
    expect(initialsOf("  ada   lovelace ", "owner@example.com")).toBe("AL");
  });

  it("falls back to the email's first letter when there is no name", () => {
    expect(initialsOf("", "owner@example.com")).toBe("O");
    expect(initialsOf("   ", "")).toBe("?");
  });
});
