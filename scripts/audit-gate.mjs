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
// re-review whenever `npm audit` changes. (Empty today — the app ships only the
// Expo/React Native runtime, no server SDKs.)
const ALLOWLIST = {};

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
