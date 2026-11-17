import type { Metadata } from "next";
import Link from "next/link";

import { DailyChart, type Day } from "@/components/owner/daily-chart";
import { StudioCard, StudioHeading, StudioUnavailable } from "@/components/owner/studio-ui";
import { buttonClasses } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { Input } from "@/components/ui/form";
import { cx } from "@/lib/cx";
import { OwnerApiUnavailableError, ownerGet, studioSession } from "@/lib/owner/session";

export const metadata: Metadata = { title: "Analytics" };

const PATH = "/owner/analytics";
const PRESETS = [7, 30, 90, 365] as const;

type Item = { label: string; views: number; visitors: number };
type Summary = {
  start: string;
  end: string;
  recording_since: string | null;
  views: number;
  visitors: number;
  daily: Day[];
  pages: Item[];
  projects: Item[];
  referrers: Item[];
  devices: Item[];
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const iso = (date: Date) => date.toISOString().slice(0, 10);
const isIsoDate = (value: string | undefined): value is string =>
  !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
const longDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "UTC" });
const formatDay = (value: string) => longDate.format(new Date(`${value}T00:00:00Z`));

function rangeFor(search: Record<string, string | string[] | undefined>) {
  const today = new Date();
  const start = one(search.start);
  const end = one(search.end);
  if (isIsoDate(start) && isIsoDate(end)) return { start, end, preset: null };
  const days = PRESETS.find((n) => String(n) === one(search.days)) ?? 30;
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  return { start: iso(from), end: iso(today), preset: days };
}

/** One magnitude, one colour: bars share a scale within the list; numbers are text. */
function BarList({ items, empty, unit = "views" }: { items: Item[]; empty: string; unit?: string }) {
  if (items.length === 0) return <p className="text-muted">{empty}</p>;
  const max = Math.max(...items.map((item) => item.views));
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.label} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-fg">{item.label}</span>
            <span className="shrink-0 text-muted">
              {item.views} {unit} · {item.visitors} {item.visitors === 1 ? "visitor" : "visitors"}
            </span>
          </div>
          <div aria-hidden="true" className="h-2 rounded-full bg-raised">
            <div
              className="h-2 rounded-full bg-accent"
              style={{ width: `${Math.max(2, (item.views / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default async function AnalyticsPage({ searchParams }: Props) {
  const session = await studioSession(PATH);
  if (!session) return <StudioUnavailable retryHref={PATH} />;
  const range = rangeFor(await searchParams);

  let data: Summary;
  try {
    data = await ownerGet<Summary>(`/api/v1/owner/analytics?start=${range.start}&end=${range.end}`, PATH);
  } catch (error) {
    if (error instanceof OwnerApiUnavailableError) return <StudioUnavailable retryHref={PATH} />;
    throw error;
  }

  const tiles = [
    { label: "Page views", value: data.views, note: "Every page a visitor opened." },
    {
      label: "Visitors",
      value: data.visitors,
      note: "Distinct per day: someone who returns on another day counts again.",
    },
  ];

  return (
    <>
      <StudioHeading
        title="Analytics"
        description={
          <p>
            Recorded page views of the public site, from {formatDay(data.start)} to {formatDay(data.end)}.
            Bots, your own visits and visitors who ask not to be tracked are not counted, and no personal data
            is stored.
          </p>
        }
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <nav aria-label="Date range">
          <ul className="flex flex-wrap gap-2">
            {PRESETS.map((days) => (
              <li key={days}>
                <Link
                  href={`${PATH}?days=${days}`}
                  aria-current={range.preset === days ? "page" : undefined}
                  className={cx(
                    "inline-flex min-h-10 items-center rounded-control px-3 text-sm",
                    range.preset === days
                      ? "bg-accent-soft font-medium text-accent"
                      : "text-muted hover:bg-raised hover:text-fg",
                  )}
                >
                  Last {days} days
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <form action={PATH} method="get" className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm text-muted">
            From
            <Input type="date" name="start" defaultValue={data.start} required />
          </label>
          <label className="flex flex-col gap-1 text-sm text-muted">
            To
            <Input type="date" name="end" defaultValue={data.end} required />
          </label>
          <button type="submit" className={buttonClasses("secondary", "sm")}>
            Show
          </button>
        </form>
      </div>

      {data.recording_since === null ? (
        <Alert tone="info" title="Nothing recorded yet">
          Views are recorded from the moment this version of the site is live; there is no earlier data.
        </Alert>
      ) : data.recording_since > data.start ? (
        <Alert tone="info">
          Recording began on {formatDay(data.recording_since)}. Earlier days in this range were not measured.
        </Alert>
      ) : null}

      <dl className="grid gap-4 sm:grid-cols-2">
        {tiles.map((tile) => (
          <div key={tile.label} className="flex flex-col gap-1 rounded-card border border-border bg-card p-5">
            <dt className="text-sm text-muted">{tile.label}</dt>
            <dd className="font-display text-4xl font-bold text-fg">{tile.value.toLocaleString("en-GB")}</dd>
            <dd className="text-xs text-muted">{tile.note}</dd>
          </div>
        ))}
      </dl>

      <StudioCard id="daily" title="Page views per day">
        <DailyChart days={data.daily} recordingSince={data.recording_since} />
      </StudioCard>

      <div className="grid gap-8 lg:grid-cols-2">
        <StudioCard id="pages" title="Most viewed pages">
          <BarList items={data.pages} empty="No views in this range." />
        </StudioCard>
        <StudioCard id="projects" title="Project pages">
          <BarList items={data.projects} empty="No project page views in this range." />
        </StudioCard>
        <StudioCard id="referrers" title="Where visitors came from">
          <BarList items={data.referrers} empty="No views in this range." />
        </StudioCard>
        <StudioCard id="devices" title="Devices">
          <BarList items={data.devices} empty="No views in this range." />
        </StudioCard>
      </div>
    </>
  );
}
