import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/client";

import { submitContact, validateContact, type ContactValues } from "./contact";

const valid: ContactValues = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  subject: "Backend role",
  message: "I would like to talk about a backend role.",
};

function client(post: (...args: unknown[]) => Promise<unknown>) {
  return { post: vi.fn(post) } as unknown as Parameters<typeof submitContact>[2] & {
    post: ReturnType<typeof vi.fn>;
  };
}

describe("validateContact", () => {
  it("accepts a complete, valid message", () => {
    expect(validateContact(valid)).toEqual({});
  });

  it("requires every field, ignoring surrounding whitespace", () => {
    expect(validateContact({ name: " ", email: "", subject: "\n", message: "  " })).toEqual({
      name: "Enter your name.",
      email: "Enter your email address.",
      subject: "Enter a subject.",
      message: "Enter a message.",
    });
  });

  it.each(["ada", "ada@", "ada@example", "a da@example.com", "ada@@example.com"])(
    "rejects the email %s",
    (email) => {
      expect(validateContact({ ...valid, email }).email).toMatch(/valid email/);
    },
  );

  it("enforces the server's length limits", () => {
    const errors = validateContact({
      name: "A",
      email: "ada@example.com",
      subject: "x".repeat(151),
      message: "m".repeat(5001),
    });
    expect(errors.name).toMatch(/at least 2/);
    expect(errors.subject).toMatch(/at most 150/);
    expect(errors.message).toMatch(/at most 5,000/);
    expect(validateContact({ ...valid, message: "too short" }).message).toMatch(/at least 10/);
  });
});

describe("submitContact", () => {
  it("posts trimmed values and the honeypot to the FastAPI endpoint", async () => {
    const api = client(async () => ({ status: "received" }));
    const result = await submitContact({ ...valid, name: "  Ada Lovelace " }, "", api);
    expect(result).toEqual({ ok: true });
    expect(api.post).toHaveBeenCalledWith(
      "/api/v1/contact",
      { ...valid, website: "" },
      { signal: expect.any(AbortSignal) },
    );
  });

  it("does not report success unless the API confirms receipt", async () => {
    const result = await submitContact(
      valid,
      "",
      client(async () => ({})),
    );
    expect(result.ok).toBe(false);
  });

  it("maps server field errors onto the form fields", async () => {
    const api = client(async () => {
      throw new ApiError({
        status: 422,
        code: "validation_error",
        message: "Some fields need attention.",
        fields: [
          { field: "email", message: "Enter a valid email address." },
          { field: "status", message: "Unexpected field." },
        ],
      });
    });
    const result = await submitContact(valid, "", api);
    expect(result).toMatchObject({ ok: false, kind: "validation" });
    expect(result.ok === false && result.kind === "validation" && result.fieldErrors).toEqual({
      email: "Enter a valid email address.",
    });
  });

  it.each([
    [429, "rate_limited"],
    [503, "unavailable"],
    [500, "unavailable"],
    [502, "unavailable"],
    [0, "network"],
    [400, "unknown"],
  ] as const)("maps HTTP %i to %s", async (status, kind) => {
    const api = client(async () => {
      throw new ApiError({ status, code: "x", message: "x" });
    });
    expect(await submitContact(valid, "", api)).toMatchObject({ ok: false, kind });
  });

  it("gives up after the timeout and does not claim the message was or was not stored", async () => {
    const api = client(
      (_path: unknown, _body: unknown, init: unknown) =>
        new Promise((_resolve, reject) => {
          (init as { signal: AbortSignal }).signal.addEventListener("abort", () =>
            reject(new ApiError({ status: 0, code: "network_error", message: "aborted" })),
          );
        }),
    );
    const result = await submitContact(valid, "", api, 20);
    expect(result).toMatchObject({ ok: false, kind: "timeout" });
    expect(result.ok === false && result.message).toMatch(/may not have been sent/);
  });
});
