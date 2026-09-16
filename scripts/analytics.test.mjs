// The analytics promises, as tests.
//
// Two of them are worth failing a build over: nothing a patient writes can be
// sent as a property, and no id or invite token can be sent as a screen name.
// The third catches the slow rot — an event declared and never fired, or fired
// and never declared, which is how an event list stops describing the app.
//
// Run with `npm test` (Node's own runner, reading the TypeScript directly).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { safeProperties } from '../src/analytics/events.ts';
import { screenName } from '../src/analytics/screens.ts';

test('a property that could carry what someone wrote is dropped', () => {
  const { props, dropped } = safeProperties({
    firstName: 'Léa',
    email: 'lea@example.com',
    noteText: 'Sleep is still broken',
    momentCaption: 'the move',
    comment: 'anything',
    kind: 'voice',
    moodCount: 2,
    shared: true,
  });
  assert.deepEqual(props, { kind: 'voice', moodCount: 2, shared: true });
  assert.deepEqual(
    dropped.sort(),
    ['comment', 'email', 'firstName', 'momentCaption', 'noteText'],
  );
});

test('an innocent key still cannot carry prose or an address', () => {
  const long = 'a'.repeat(65);
  const { props, dropped } = safeProperties({ kind: long, from: 'someone@example.com', step: 'ready' });
  assert.deepEqual(props, { step: 'ready' });
  assert.deepEqual(dropped.sort(), ['from', 'kind']);
});

test('null, numbers and booleans pass; anything else does not', () => {
  const { props, dropped } = safeProperties({ a: null, b: 3, c: false, d: { nested: 1 }, e: [1, 2] });
  assert.deepEqual(props, { a: null, b: 3, c: false });
  assert.deepEqual(dropped.sort(), ['d', 'e']);
});

test('screen names keep the route and lose the identifiers', () => {
  assert.equal(screenName('/(app)/(tabs)/moments'), '/(app)/(tabs)/moments');
  assert.equal(screenName('/resource/3f6a8b0c-4b1e-4a0a-9f3d-2c9a1b8e7d55'), '/resource/:id');
  assert.equal(screenName('/(app)/resource/482'), '/(app)/resource/:id');
  assert.equal(screenName('/journal-entry?id=3f6a8b0c-4b1e-4a0a-9f3d-2c9a1b8e7d55'), '/journal-entry');
  assert.equal(screenName('/'), '/index');
});

test('an invite token never becomes a screen name', () => {
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
  assert.equal(screenName(`/invite/${token}`), '/invite/:id');
  assert.ok(!screenName(`/invite/${token}`).includes(token));
});

// Every declared event is fired somewhere, and every fired event is declared.
// The care app has the same test; an event list nobody can trust is worse than
// no list, because it is what the privacy policy describes.
test('the event list and the call sites agree', () => {
  const root = new URL('..', import.meta.url).pathname;
  const declared = new Set(
    [...readFileSync(join(root, 'src/analytics/events.ts'), 'utf8').matchAll(/^\s*\|\s*'([a-z0-9_]+)'/gm)].map((m) => m[1]),
  );
  assert.ok(declared.size > 10, 'the event union should have been read');

  const fired = new Set();
  const named = new Set();
  for (const file of walk(join(root, 'src')).concat(walk(join(root, 'app')))) {
    if (file.includes('/analytics/')) continue; // the module itself, not a call site
    // Not just `track('x')`: several call sites choose between two names with a
    // ternary, e.g. `track(shared ? 'moment_shared' : 'moment_unshared')`. Read
    // the whole call and take every quoted name in it.
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/\btrack\(/g)) {
      const call = text.slice(m.index, m.index + 240);
      // Only names we already declared: a call also quotes its property values,
      // and `'voice'` is not an event.
      for (const q of call.matchAll(/'([a-z0-9_]+)'/g)) if (declared.has(q[1])) fired.add(q[1]);
    }
    // The other direction needs the strict shape, where the name is the first
    // argument — that is what catches a typo or an event nobody declared.
    for (const m of text.matchAll(/\btrack\(\s*'([a-z0-9_]+)'/g)) named.add(m[1]);
  }
  // The consent event is fired by the provider, which is inside src/analytics.
  fired.add('analytics_consent_granted');

  const neverFired = [...declared].filter((e) => !fired.has(e)).sort();
  const undeclared = [...named].filter((e) => !declared.has(e)).sort();
  assert.deepEqual(neverFired, [], `declared but never fired: ${neverFired.join(', ')}`);
  assert.deepEqual(undeclared, [], `fired but not declared: ${undeclared.join(', ')}`);
});

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}
