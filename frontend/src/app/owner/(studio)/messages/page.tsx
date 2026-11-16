import type { Metadata } from "next";
import Link from "next/link";

import { StudioHeading, StudioUnavailable } from "@/components/owner/studio-ui";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Input } from "@/components/ui/form";
import { cardClasses } from "@/components/ui/section";
import { Badge } from "@/components/ui/tag";
import { cx } from "@/lib/cx";
import { formatUtc } from "@/lib/owner/actions";
import { OwnerApiUnavailableError, ownerGet, studioSession } from "@/lib/owner/session";
import { MESSAGE_VIEWS, type MessagePage, type MessageSummary } from "@/lib/owner/types";

export const metadata: Metadata = { title: "Messages" };

const PATH = "/owner/messages";
const PAGE_SIZE = 20;

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function href(view: string, q: string, page = 1): string {
  const params = new URLSearchParams();
  if (view !== "inbox") params.set("status", view);
  if (q) params.set("q", q);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `${PATH}?${query}` : PATH;
}

function Notification({ item }: { item: MessageSummary }) {
  if (item.status === "spam") return null;
  if (item.notification === "failed") return <Badge tone="danger">Email not sent</Badge>;
  if (item.notification === "pending" || item.notification === "sending")
    return <Badge tone="warning">Email pending</Badge>;
  return null;
}

/** The inbox: newest first, with views, search and pages. */
export default async function MessagesPage({ searchParams }: Props) {
  const session = await studioSession(PATH);
  if (!session) return <StudioUnavailable retryHref={PATH} />;
  const search = await searchParams;
  const view = MESSAGE_VIEWS.find((option) => option.value === one(search.status))?.value ?? "inbox";
  const q = (one(search.q) ?? "").trim().slice(0, 100);
  const page = Math.max(1, Math.min(10_000, Number.parseInt(one(search.page) ?? "1", 10) || 1));

  let data: MessagePage;
  try {
    const params = new URLSearchParams({ status: view, page: String(page), page_size: String(PAGE_SIZE) });
    if (q) params.set("q", q);
    data = await ownerGet<MessagePage>(`/api/v1/owner/messages?${params.toString()}`, href(view, q, page));
  } catch (error) {
    if (error instanceof OwnerApiUnavailableError) return <StudioUnavailable retryHref={PATH} />;
    throw error;
  }
  const pages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  return (
    <>
      <StudioHeading
        title="Messages"
        description={<p>What visitors sent through the contact form. Spam is kept separately for review.</p>}
      />

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <nav aria-label="Message views">
          <ul className="flex flex-wrap gap-2">
            {MESSAGE_VIEWS.map((option) => (
              <li key={option.value}>
                <Link
                  href={href(option.value, q)}
                  aria-current={option.value === view ? "page" : undefined}
                  className={cx(
                    "inline-flex min-h-10 items-center rounded-control px-3 text-sm",
                    option.value === view
                      ? "bg-accent-soft font-medium text-accent"
                      : "text-muted hover:bg-raised hover:text-fg",
                  )}
                >
                  {option.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <form role="search" action={PATH} method="get" className="flex gap-2">
          {view !== "inbox" ? <input type="hidden" name="status" value={view} /> : null}
          <label htmlFor="message-search" className="sr-only">
            Search messages
          </label>
          <Input
            id="message-search"
            type="search"
            name="q"
            defaultValue={q}
            maxLength={100}
            placeholder="Name, email or text"
          />
          <button type="submit" className={buttonClasses("secondary", "sm")}>
            Search
          </button>
        </form>
      </div>

      <p className="text-sm text-muted" aria-live="polite">
        {data.total === 0
          ? "No messages."
          : `${data.total} ${data.total === 1 ? "message" : "messages"}${q ? ` matching “${q}”` : ""}.`}
      </p>

      {data.items.length === 0 ? (
        <EmptyState
          headingLevel={2}
          title={q ? "Nothing matches" : "No messages here"}
          description={
            q ? "Try other words, or another view." : "New messages from the contact form appear here."
          }
        />
      ) : (
        <ul aria-label="Messages" className="flex flex-col gap-3">
          {data.items.map((item) => (
            <li
              key={item.id}
              className={cx(
                cardClasses,
                "flex flex-col gap-1 p-4",
                item.status === "new" && "border-accent/60",
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`${PATH}/${item.id}`}
                  className={cx(
                    "text-fg underline-offset-4 hover:underline",
                    item.status === "new" && "font-semibold",
                  )}
                >
                  {item.subject}
                </Link>
                {item.status === "new" ? <Badge tone="accent">Unread</Badge> : null}
                {item.status === "spam" ? <Badge tone="warning">Spam</Badge> : null}
                <Notification item={item} />
              </div>
              <p className="text-sm text-muted">
                {item.name} · {item.email} · {formatUtc(item.created_at)}
              </p>
              <p className="line-clamp-2 text-sm text-muted">{item.snippet}</p>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <nav aria-label="Pages" className="flex items-center justify-between gap-4">
          {page > 1 ? (
            <Link href={href(view, q, page - 1)} className={buttonClasses("secondary", "sm")}>
              Newer
            </Link>
          ) : (
            <span />
          )}
          <p className="text-sm text-muted">
            Page {page} of {pages}
          </p>
          {page < pages ? (
            <Link href={href(view, q, page + 1)} className={buttonClasses("secondary", "sm")}>
              Older
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </>
  );
}
