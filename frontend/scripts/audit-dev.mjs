// Audit every dependency (development tools included) and fail on high or critical advisories,
// except the ones listed, with a reason and an expiry date, in audit-exceptions.json.
//
//   node scripts/audit-dev.mjs
//
// Equivalent to `npm audit --audit-level=high` plus those exceptions. An exception that has
// expired fails again; one that no longer matches anything is reported so it can be removed.
// Production dependencies are audited separately (`npm audit --omit=dev`) with no exceptions.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const FAILING = new Set(["high", "critical"]);
const today = new Date().toISOString().slice(0, 10);

const { exceptions } = JSON.parse(readFileSync(new URL("../audit-exceptions.json", import.meta.url), "utf8"));
const allowed = new Map(exceptions.map((entry) => [entry.advisory, entry]));

// A fixed command line (no arguments from outside), run through the shell so `npm` resolves
// to npm.cmd on Windows.
const run = spawnSync("npm audit --json", {
  encoding: "utf8",
  shell: true,
  maxBuffer: 64 * 1024 * 1024,
});
let report;
try {
  report = JSON.parse(run.stdout);
} catch {
  console.error("npm audit did not return a report:", run.stderr.trim());
  process.exit(1);
}
if (report.error) {
  console.error("npm audit failed:", report.error.summary ?? report.error);
  process.exit(1);
}

// Each advisory appears in the `via` list of the package it affects.
const advisories = new Map();
for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
  for (const via of vulnerability.via) {
    if (typeof via !== "object") continue;
    const id =
      String(via.url ?? "")
        .split("/")
        .pop() || String(via.source);
    advisories.set(id, { id, name: via.name, severity: via.severity, title: via.title });
  }
}

const failures = [];
const used = new Set();
for (const advisory of advisories.values()) {
  if (!FAILING.has(advisory.severity)) continue;
  const exception = allowed.get(advisory.id);
  if (exception) used.add(advisory.id);
  const line = `${advisory.severity} ${advisory.id} ${advisory.name}: ${advisory.title}`;
  if (exception && exception.package === advisory.name && exception.expires >= today) {
    console.log(`allowed until ${exception.expires}: ${line}`);
  } else if (exception) {
    failures.push(`${line} (exception expired on ${exception.expires} or names another package)`);
  } else {
    failures.push(line);
  }
}
for (const id of allowed.keys()) {
  if (!used.has(id)) console.log(`exception ${id} no longer matches any advisory; remove it`);
}

if (failures.length > 0) {
  console.error(`\n${failures.length} high or critical advisory(ies) without a valid exception:`);
  for (const line of failures) console.error(`  ${line}`);
  console.error("\nRun `npm audit` for details.");
  process.exit(1);
}
console.log(`No high or critical advisories without a valid exception (${today}).`);
