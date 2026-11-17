"use client";

import { useState } from "react";

export type Day = { day: string; views: number; visitors: number };

const dateLabel = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const format = (iso: string) => dateLabel.format(new Date(`${iso}T00:00:00Z`));

/**
 * Daily page views: one series, so no legend (the heading names it). Bars rise from the baseline
 * with rounded tops and a gap between them. Hovering or focusing a bar shows its date, views and
 * visitors; the same numbers are in the table below the chart. Days before recording began are
 * drawn as a faint baseline marker and labelled as not measured, never as zero traffic.
 */
export function DailyChart({ days, recordingSince }: { days: Day[]; recordingSince: string | null }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((day) => day.views));
  const width = 720;
  const height = 180;
  const step = width / days.length;
  const gap = step > 6 ? 2 : 0;
  const bar = Math.max(1, step - gap);
  const measured = (day: Day) => recordingSince !== null && day.day >= recordingSince;
  const shown = active === null ? null : days[active];

  return (
    <figure className="flex flex-col gap-3">
      <p aria-live="polite" className="min-h-6 text-sm text-fg">
        {shown
          ? measured(shown)
            ? `${format(shown.day)}: ${shown.views} ${shown.views === 1 ? "view" : "views"}, ${shown.visitors} ${shown.visitors === 1 ? "visitor" : "visitors"}`
            : `${format(shown.day)}: not measured (before recording began)`
          : "Hover or focus a bar for its numbers."}
      </p>
      <svg
        viewBox={`0 0 ${width} ${height + 24}`}
        className="h-auto w-full overflow-visible"
        role="group"
        aria-label="Page views per day"
      >
        {/* Recessive guides: the baseline and the maximum. */}
        <line x1={0} x2={width} y1={height} y2={height} className="stroke-border" strokeWidth={1} />
        <line
          x1={0}
          x2={width}
          y1={0}
          y2={0}
          className="stroke-border"
          strokeWidth={1}
          strokeDasharray="2 4"
        />
        <text x={width} y={-6} textAnchor="end" className="fill-muted text-[11px]">
          {max} {max === 1 ? "view" : "views"}
        </text>
        {days.map((day, index) => {
          const x = index * step + gap / 2;
          const known = measured(day);
          const h = known && day.views > 0 ? Math.max(2, (day.views / max) * height) : 0;
          const r = Math.min(4, bar / 2, h);
          const path =
            h > 0
              ? `M${x},${height} V${height - h + r} Q${x},${height - h} ${x + r},${height - h} H${x + bar - r} Q${x + bar},${height - h} ${x + bar},${height - h + r} V${height} Z`
              : "";
          return (
            <g
              key={day.day}
              tabIndex={0}
              role="img"
              aria-label={
                known
                  ? `${format(day.day)}: ${day.views} views, ${day.visitors} visitors`
                  : `${format(day.day)}: not measured`
              }
              onMouseEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              onMouseLeave={() => setActive(null)}
              onBlur={() => setActive(null)}
              className="cursor-default outline-none focus-visible:[&>rect]:stroke-accent"
            >
              {/* A hit target taller than the bar. */}
              <rect x={x} y={0} width={bar} height={height} fill="transparent" strokeWidth={2} />
              {path ? (
                <path d={path} className={active === index ? "fill-accent-hover" : "fill-accent"} />
              ) : (
                <rect
                  x={x}
                  y={height - 1}
                  width={bar}
                  height={1}
                  className={known ? "fill-border-strong" : "fill-border"}
                />
              )}
            </g>
          );
        })}
        <text x={0} y={height + 18} className="fill-muted text-[11px]">
          {days[0] ? format(days[0].day) : ""}
        </text>
        <text x={width} y={height + 18} textAnchor="end" className="fill-muted text-[11px]">
          {days.at(-1) ? format(days.at(-1)!.day) : ""}
        </text>
      </svg>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted">Show the numbers as a table</summary>
        <div className="mt-3 max-h-80 overflow-y-auto" tabIndex={0} role="region" aria-label="Daily numbers">
          <table className="w-full text-left">
            <caption className="sr-only">Page views and visitors per day</caption>
            <thead>
              <tr className="text-muted">
                <th scope="col" className="py-1 font-normal">
                  Day
                </th>
                <th scope="col" className="py-1 text-right font-normal">
                  Views
                </th>
                <th scope="col" className="py-1 text-right font-normal">
                  Visitors
                </th>
              </tr>
            </thead>
            <tbody>
              {days.map((day) => (
                <tr key={day.day} className="border-t border-border">
                  <th scope="row" className="py-1 font-normal text-fg">
                    {format(day.day)}
                  </th>
                  <td className="py-1 text-right text-fg">{measured(day) ? day.views : "—"}</td>
                  <td className="py-1 text-right text-fg">{measured(day) ? day.visitors : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
