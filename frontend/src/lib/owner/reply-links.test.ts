import { describe, expect, it } from "vitest";

import { gmailReply, mailtoReply, MAX_QUOTE_CHARS, replyBody, replySubject } from "./reply-links";

const message = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  subject: "Backend role",
  message: "Hello,\nare you available in January?",
  created_at: "2026-11-20T08:30:00Z",
};

/** What a mail app reads from a mailto link (RFC 6068). */
function parseMailto(href: string) {
  const url = new URL(href);
  return {
    to: decodeURIComponent(url.pathname),
    params: Object.fromEntries(new URLSearchParams(url.search)),
  };
}

describe("reply links", () => {
  it("titles the reply once with Re:", () => {
    expect(replySubject("Backend role")).toBe("Re: Backend role");
    expect(replySubject("RE: Backend role")).toBe("RE: Backend role");
  });

  it("greets the visitor and quotes the message, with CRLF line breaks", () => {
    const body = replyBody(message);
    expect(body.startsWith("Hello Ada Lovelace,\r\n")).toBe(true);
    expect(body).toContain(
      "you wrote through the contact form:\r\n> Hello,\r\n> are you available in January?",
    );
  });

  it("shortens a very long quote so the link stays usable", () => {
    const body = replyBody({ ...message, message: "x".repeat(MAX_QUOTE_CHARS + 500) });
    expect(body).toContain("[…]");
    expect(body.length).toBeLessThan(MAX_QUOTE_CHARS + 200);
  });

  it("opens the mail app addressed, titled and pre-filled", () => {
    const href = mailtoReply(message);
    expect(href.startsWith("mailto:ada@example.com?")).toBe(true);
    const { to, params } = parseMailto(href);
    expect(to).toBe("ada@example.com");
    expect(Object.keys(params)).toEqual(["subject", "body"]);
    expect(params.subject).toBe("Re: Backend role");
    expect(params.body).toBe(replyBody(message));
  });

  it("never lets visitor text add recipients or headers", () => {
    const crafted = {
      ...message,
      email: "ada@example.com?cc=attacker@example.net",
      subject: "Hi&bcc=attacker@example.net&body=pwned",
      message: "x\r\n&cc=attacker@example.net",
    };
    const { to, params } = parseMailto(mailtoReply(crafted));
    expect(Object.keys(params)).toEqual(["subject", "body"]);
    expect(to).toBe("ada@example.com?cc=attacker@example.net"); // one (invalid) address, no cc
    expect(params.subject).toBe("Re: Hi&bcc=attacker@example.net&body=pwned");
    const gmail = new URL(gmailReply(crafted));
    expect([...gmail.searchParams.keys()]).toEqual(["view", "fs", "to", "su", "body"]);
    expect(gmail.searchParams.get("su")).toBe("Re: Hi&bcc=attacker@example.net&body=pwned");
  });

  it("opens Gmail's compose window with the same reply", () => {
    const url = new URL(gmailReply(message));
    expect(url.origin + url.pathname).toBe("https://mail.google.com/mail/");
    expect(url.searchParams.get("view")).toBe("cm");
    expect(url.searchParams.get("to")).toBe("ada@example.com");
    expect(url.searchParams.get("su")).toBe("Re: Backend role");
    expect(url.searchParams.get("body")).toBe(replyBody(message).replace(/\r\n/g, "\n"));
  });
});
