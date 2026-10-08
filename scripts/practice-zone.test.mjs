// The practice timezone shared across practitioner screens (src/practitioner/practice-zone.ts). Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rememberPracticeZone, currentPracticeZone, resetPracticeZone } from '../src/practitioner/practice-zone.ts';

test('keeps the zone the first response carried, and ignores junk', () => {
  resetPracticeZone();
  assert.equal(currentPracticeZone(), null);
  rememberPracticeZone(undefined);
  rememberPracticeZone('');
  rememberPracticeZone(42);
  assert.equal(currentPracticeZone(), null);
  rememberPracticeZone('Europe/Paris');
  assert.equal(currentPracticeZone(), 'Europe/Paris');
});

test('a late-night session reads as the practice day, not the phone day', () => {
  // 23:30 in Paris on 12 Oct is 03:00 on 13 Oct in Kolkata: the record must say the 12th.
  const iso = '2026-10-12T21:30:00Z';
  const day = (timeZone) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone });
  assert.equal(day('Europe/Paris'), '12 Oct');
  assert.equal(day('Asia/Kolkata'), '13 Oct');
});
