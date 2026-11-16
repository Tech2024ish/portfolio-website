// Measure lab Core Web Vitals and page weight for the public pages, on a production build.
//
//   npm run build && npm run start -- --port 3100     (in another terminal)
//   node scripts/measure-vitals.mjs [--base http://127.0.0.1:3100] [--runs 3] [--check]
//
// Two profiles: "mobile" (390×844, 4× CPU slowdown, slow 4G: 150 ms RTT, 1.6 Mbps down) like
// Lighthouse's mobile defaults, and "desktop" (1440×900, no throttling). Each page is loaded
// `--runs` times in a fresh browser context (cold cache) and the median is reported.
//
// Metrics: TTFB, FCP, LCP, CLS (layout shifts until the page has been idle for 3 s) and TBT (the
// blocking part of long tasks between FCP and then), plus the transferred bytes, in total and for
// JavaScript. INP needs real interactions and is a field metric; TBT is its lab proxy.
// --check exits with 1 when a budget below is exceeded.

import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
};
const BASE = option("base", "http://127.0.0.1:3100").replace(/\/$/, "");
const RUNS = Number(option("runs", "3"));
const CHECK = args.includes("--check");
const PAGES = ["/", "/projects", "/projects/mosaic", "/projects/buzhub-platform"];

// "Good" thresholds from web.dev for LCP, CLS and TBT (mobile lab), and the JavaScript budget.
export const BUDGETS = { lcp: 2500, cls: 0.1, tbt: 200, jsKb: 250 };

const PROFILES = {
  mobile: {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    cpu: 4,
    network: {
      latency: 150,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
    },
  },
  desktop: {
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    cpu: 1,
    network: null,
  },
};

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

async function measure(browser, profile, path) {
  const context = await browser.newContext({
    viewport: profile.viewport,
    deviceScaleFactor: profile.deviceScaleFactor,
    isMobile: profile.isMobile,
    hasTouch: profile.hasTouch,
  });
  await context.addInitScript(() => {
    window.__vitals = { lcp: 0, cls: 0, longTasks: [] };
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__vitals.lcp = entry.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__vitals.cls += entry.value;
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        window.__vitals.longTasks.push([entry.startTime, entry.duration]);
    }).observe({ type: "longtask", buffered: true });
  });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  if (profile.network)
    await cdp.send("Network.emulateNetworkConditions", { offline: false, ...profile.network });
  if (profile.cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: profile.cpu });

  const types = new Map();
  let total = 0;
  let js = 0;
  cdp.on("Network.responseReceived", (event) => types.set(event.requestId, event.type));
  cdp.on("Network.loadingFinished", (event) => {
    total += event.encodedDataLength;
    if (types.get(event.requestId) === "Script") js += event.encodedDataLength;
  });

  await page.goto(BASE + path, { waitUntil: "load" });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3000);
  const result = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const fcp = performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? 0;
    const tbt = window.__vitals.longTasks
      .filter(([start]) => start >= fcp)
      .reduce((sum, [, duration]) => sum + Math.max(0, duration - 50), 0);
    return { ttfb: nav.responseStart, fcp, lcp: window.__vitals.lcp, cls: window.__vitals.cls, tbt };
  });
  await context.close();
  return { ...result, totalKb: total / 1024, jsKb: js / 1024 };
}

const browser = await chromium.launch();
const rows = [];
let failed = false;
for (const [name, profile] of Object.entries(PROFILES)) {
  for (const path of PAGES) {
    const runs = [];
    for (let run = 0; run < RUNS; run += 1) runs.push(await measure(browser, profile, path));
    const m = Object.fromEntries(Object.keys(runs[0]).map((key) => [key, median(runs.map((r) => r[key]))]));
    const over = [];
    if (name === "mobile") {
      if (m.lcp > BUDGETS.lcp) over.push("LCP");
      if (m.tbt > BUDGETS.tbt) over.push("TBT");
    }
    if (m.cls > BUDGETS.cls) over.push("CLS");
    if (m.jsKb > BUDGETS.jsKb) over.push("JS");
    if (over.length) failed = true;
    rows.push(
      `| ${name} | ${path} | ${Math.round(m.ttfb)} | ${Math.round(m.fcp)} | ${Math.round(m.lcp)} | ${m.cls.toFixed(3)} | ${Math.round(m.tbt)} | ${Math.round(m.jsKb)} | ${Math.round(m.totalKb)} | ${over.length ? `over: ${over.join(", ")}` : "within budget"} |`,
    );
  }
}
await browser.close();

console.log(`Median of ${RUNS} cold loads per page; times in ms, sizes in KB transferred.\n`);
console.log("| Profile | Page | TTFB | FCP | LCP | CLS | TBT | JS | Total | Budget |");
console.log("|---|---|---:|---:|---:|---:|---:|---:|---:|---|");
for (const row of rows) console.log(row);
console.log(
  `\nBudgets: LCP ≤ ${BUDGETS.lcp} ms and TBT ≤ ${BUDGETS.tbt} ms on mobile; CLS ≤ ${BUDGETS.cls}; JS ≤ ${BUDGETS.jsKb} KB.`,
);
if (CHECK && failed) process.exit(1);
