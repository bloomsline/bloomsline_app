// Dependency audit gate (mirrors the care app's S8 gate).
//
// Runs `npm audit` on SHIPPED deps and fails on any high/critical advisory —
// EXCEPT explicitly allowlisted ones below. Every exception must carry a reason
// and a revisit trigger, and the gate PRINTS what it ignored (no silent
// suppression). Anything high/critical not on the list still fails the build.
//
// Better than a bare `npm audit --audit-level=high`, which is all-or-nothing and
// can't waive a single unfixable advisory without disabling the gate.
import { execSync } from 'node:child_process';

// GHSA IDs we knowingly accept, with justification. Keep this list SHORT and
// re-review whenever `npm audit` changes.
const ALLOWLIST = {
  // js-yaml quadratic CPU on `!!omap` parsing (CVE-2026-59870).
  //
  // Reaches us only through BUILD tooling, twice:
  //   expo → @expo/cli → @expo/xcpretty (js-yaml ^4.1.0)  — iOS build log formatting
  //   react-native → babel-jest → babel-plugin-istanbul
  //     → @istanbuljs/load-nyc-config (js-yaml ^3.13.1)   — coverage config
  // npm counts both as "shipped" because expo and react-native are runtime
  // dependencies, but neither tool is in the bundle: grepping the deployed
  // web bundle for js-yaml / xcpretty / istanbul returns zero. The app parses
  // no YAML at runtime, so there is no untrusted document to be quadratic over.
  //
  // Not fixable in place: the advisory is clear only at js-yaml 5.x, and both
  // consumers pin ^4 and ^3 respectively — an override would be a major bump to
  // build tools we cannot exercise here (xcpretty only runs during an EAS iOS
  // build), traded for a DoS that cannot reach us.
  //
  // Revisit: when Expo and React Native bump their transitive js-yaml, drop this
  // and let the gate fail again if anything is left.
  'GHSA-5p4m-2wfm-xmqj': 'js-yaml quadratic !!omap parse — build tooling only, absent from the bundle; consumers pin js-yaml ^3/^4',
};

const BLOCKING = new Set(['high', 'critical']);
const ghsaOf = (url) => (url && url.match(/GHSA-[\w-]+/)?.[0]) || null;

let report;
try {
  const out = execSync('npm audit --omit=dev --json', { encoding: 'utf8' });
  report = JSON.parse(out);
} catch (err) {
  // npm audit exits non-zero when vulnerabilities exist; the JSON is on stdout.
  if (!err.stdout) throw err;
  report = JSON.parse(err.stdout);
}

const blocking = [];
const ignored = [];
for (const vuln of Object.values(report.vulnerabilities ?? {})) {
  for (const via of vuln.via ?? []) {
    if (typeof via !== 'object' || !via.url) continue; // string = ref to another pkg
    if (!BLOCKING.has(via.severity)) continue;
    const id = ghsaOf(via.url);
    const entry = { id, severity: via.severity, pkg: via.name, title: via.title };
    if (id && ALLOWLIST[id]) ignored.push(entry);
    else blocking.push(entry);
  }
}

if (ignored.length) {
  console.log(`Audit gate: ignoring ${ignored.length} allowlisted advisory occurrence(s):`);
  for (const e of ignored) console.log(`  - [${e.severity}] ${e.pkg} ${e.id} — ${ALLOWLIST[e.id]}`);
}

if (blocking.length) {
  console.error(`\nAudit gate FAILED: ${blocking.length} un-allowlisted high/critical advisory occurrence(s):`);
  for (const e of blocking) console.error(`  - [${e.severity}] ${e.pkg} ${e.id ?? '(no id)'} — ${e.title}`);
  process.exit(1);
}

console.log('Audit gate passed (no un-allowlisted high/critical advisories).');
