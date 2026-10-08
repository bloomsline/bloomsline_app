// Which copy of a session note opens (src/notes/restore-rule.ts). Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localWins } from '../src/notes/restore-rule.ts';

const S1 = '2026-10-08T10:00:00.000Z';
const S2 = '2026-10-08T12:00:00.000Z';

test('a copy written on the version the server still has wins, whatever the phone clock says', () => {
  // The phone clock is far behind: still the newer writing.
  assert.equal(localWins({ savedAt: '2020-01-01T00:00:00.000Z', baseAt: S1 }, S1), true);
  // A note with no server version yet, and still none.
  assert.equal(localWins({ savedAt: S1, baseAt: null }, null), true);
});

test('a copy loses once the server has moved on, even with a phone clock running fast', () => {
  // Written on S1; the web saved S2 since. The phone clock says next year.
  assert.equal(localWins({ savedAt: '2027-01-01T00:00:00.000Z', baseAt: S1 }, S2), false);
  // Started on an empty note; someone wrote one since.
  assert.equal(localWins({ savedAt: '2027-01-01T00:00:00.000Z', baseAt: null }, S2), false);
});

test('offline, the copy is the only writing there is', () => {
  assert.equal(localWins({ savedAt: S1, baseAt: S1 }, undefined), true);
});

test('an older build\'s copy keeps the old rule, on instants rather than strings', () => {
  assert.equal(localWins({ savedAt: S2 }, S1), true);
  assert.equal(localWins({ savedAt: S1 }, S2), false);
  assert.equal(localWins({ savedAt: S1 }, null), true);
  // Same instant written two ways: not "newer".
  assert.equal(localWins({ savedAt: '2026-10-08T12:00:00Z' }, S2), false);
});
