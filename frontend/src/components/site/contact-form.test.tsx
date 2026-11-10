import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ContactForm } from "./contact-form";

const EMAIL = "owner@example.com";

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function mockFetch(...responses: Array<Response | Error | Promise<Response>>) {
  const fetchMock = vi.fn();
  for (const response of responses) {
    if (response instanceof Error) fetchMock.mockRejectedValueOnce(response);
    else fetchMock.mockResolvedValueOnce(response);
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function fill(values: Partial<Record<"name" | "email" | "subject" | "message", string>> = {}) {
  const all = {
    name: "Ada Lovelace",
    email: "ada@example.com",
    subject: "Backend role",
    message: "I would like to talk about a backend role.",
    ...values,
  };
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: all.name } });
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: all.email } });
  fireEvent.change(screen.getByLabelText("Subject"), { target: { value: all.subject } });
  fireEvent.change(screen.getByLabelText("Message"), { target: { value: all.message } });
}

const submit = () => fireEvent.click(screen.getByRole("button", { name: /send message|sending/i }));

afterEach(() => vi.unstubAllGlobals());

describe("ContactForm", () => {
  it("renders a labelled form with every field and a submit button", () => {
    render(<ContactForm email={EMAIL} />);
    expect(screen.getByRole("form", { name: "Send a message" })).toBeInTheDocument();
    for (const label of ["Full name", "Email address", "Subject", "Message"]) {
      expect(screen.getByLabelText(label)).toBeRequired();
    }
    expect(screen.getByLabelText("Email address")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Full name")).toHaveAttribute("autocomplete", "name");
    expect(screen.getByRole("button", { name: "Send message" })).toHaveAttribute("type", "submit");
  });

  it("cannot submit before hydration, and never by GET", async () => {
    const { renderToString } = await import("react-dom/server");
    const html = renderToString(<ContactForm email={EMAIL} />);
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(doc.querySelector("form")?.getAttribute("method")).toBe("post");
    expect(doc.querySelector("form")?.hasAttribute("data-ready")).toBe(false);
    expect(doc.querySelector('button[type="submit"]')?.hasAttribute("disabled")).toBe(true);
  });

  it("hides the honeypot from people and assistive technology", () => {
    const { container } = render(<ContactForm email={EMAIL} />);
    const honeypot = container.querySelector<HTMLInputElement>('input[name="website"]');
    expect(honeypot).toHaveAttribute("tabindex", "-1");
    expect(honeypot?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.queryByRole("textbox", { name: "Leave this field empty" })).toBeNull();
  });

  it("shows required-field errors, links them to the fields and focuses the first", async () => {
    const fetchMock = mockFetch();
    render(<ContactForm email={EMAIL} />);
    submit();

    const name = screen.getByLabelText("Full name");
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription("Enter your name.");
    expect(screen.getByLabelText("Message")).toHaveAccessibleDescription(/Enter a message\./);
    expect(name).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates the email format before sending", () => {
    const fetchMock = mockFetch();
    render(<ContactForm email={EMAIL} />);
    fill({ email: "ada@example" });
    submit();
    expect(screen.getByLabelText("Email address")).toHaveAccessibleDescription(/valid email address/);
    expect(screen.getByLabelText("Email address")).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clears a field's error once it is corrected", () => {
    mockFetch();
    render(<ContactForm email={EMAIL} />);
    submit();
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Ada Lovelace" } });
    expect(screen.getByLabelText("Full name")).not.toHaveAttribute("aria-invalid");
  });

  it("shows success only after the API confirms, then resets", async () => {
    const fetchMock = mockFetch(jsonResponse(201, { status: "received" }));
    render(<ContactForm email={EMAIL} />);
    fill();
    submit();

    expect(await screen.findByRole("heading", { name: "Message sent" })).toBeInTheDocument();
    // Receipt only: no reply is promised while there is no notification or owner inbox.
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Your message has been received and saved.");
    expect(status).not.toHaveTextContent(/reply|respond|get back/i);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/api\/v1\/contact$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      name: "Ada Lovelace",
      email: "ada@example.com",
      subject: "Backend role",
      message: "I would like to talk about a backend role.",
      website: "",
    });

    fireEvent.click(screen.getByRole("button", { name: "Send another message" }));
    expect(screen.getByLabelText("Full name")).toHaveValue("");
  });

  it("moves focus to Full name when starting another message", async () => {
    mockFetch(jsonResponse(201, { status: "received" }));
    render(<ContactForm email={EMAIL} />);
    fill();
    submit();
    // Wait for the success panel itself (the form's live region is also a "status" while sending).
    await screen.findByRole("heading", { name: "Message sent" });
    const success = screen.getByRole("status");
    await waitFor(() => expect(success).toHaveFocus());

    fireEvent.click(screen.getByRole("button", { name: "Send another message" }));

    // Without this, focus would fall back to <body> when the success panel unmounts.
    await waitFor(() => expect(screen.getByLabelText("Full name")).toHaveFocus());
    expect(document.body).not.toHaveFocus();
  });

  it("shows a loading state and ignores duplicate submissions while sending", async () => {
    let resolve!: (response: Response) => void;
    const pending = new Promise<Response>((r) => (resolve = r));
    const fetchMock = vi.fn().mockReturnValue(pending);
    vi.stubGlobal("fetch", fetchMock);

    render(<ContactForm email={EMAIL} />);
    fill();
    const form = screen.getByRole("form", { name: "Send a message" });
    fireEvent.submit(form);
    fireEvent.submit(form);
    fireEvent.submit(form);

    const button = screen.getByRole("button", { name: "Sending…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(screen.getByLabelText("Message")).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledOnce();

    await act(async () => resolve(jsonResponse(201, { status: "received" })));
    expect(await screen.findByRole("heading", { name: "Message sent" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("keeps the text and offers email when the API is unavailable", async () => {
    mockFetch(
      jsonResponse(503, { error: { code: "service_unavailable", message: "Temporarily unavailable." } }),
    );
    render(<ContactForm email={EMAIL} />);
    fill();
    submit();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/temporarily unavailable, so your message was not sent/);
    expect(alert.querySelector("a")).toHaveAttribute("href", `mailto:${EMAIL}`);
    expect(screen.getByLabelText("Subject")).toHaveValue("Backend role");
    expect(screen.queryByRole("heading", { name: "Message sent" })).toBeNull();
    expect(screen.getByRole("button", { name: "Send message" })).toBeEnabled();
  });

  it("explains a network failure", async () => {
    mockFetch(new TypeError("Failed to fetch"));
    render(<ContactForm email={EMAIL} />);
    fill();
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn't reach the server/);
  });

  it("explains the rate limit", async () => {
    mockFetch(
      jsonResponse(429, { error: { code: "rate_limited", message: "Too many." } }, { "Retry-After": "3600" }),
    );
    render(<ContactForm email={EMAIL} />);
    fill();
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent(/sent several messages recently/);
  });

  it("moves focus to the alert when a server error names no visible field", async () => {
    mockFetch(
      jsonResponse(422, {
        error: {
          code: "validation_error",
          message: "Some fields need attention.",
          fields: [{ field: "website", message: "Must be at most 200 characters." }],
        },
      }),
    );
    render(<ContactForm email={EMAIL} />);
    fill();
    submit();
    const alert = await screen.findByRole("alert");
    await waitFor(() => expect(alert).toHaveFocus());
  });

  it("shows the server's field errors on the matching fields", async () => {
    mockFetch(
      jsonResponse(422, {
        error: {
          code: "validation_error",
          message: "Some fields need attention.",
          fields: [{ field: "message", message: "Contains characters that are not allowed." }],
        },
      }),
    );
    render(<ContactForm email={EMAIL} />);
    fill();
    submit();
    await waitFor(() =>
      expect(screen.getByLabelText("Message")).toHaveAccessibleDescription(
        /Contains characters that are not allowed\./,
      ),
    );
    await waitFor(() => expect(screen.getByLabelText("Message")).toHaveFocus());
  });
});
