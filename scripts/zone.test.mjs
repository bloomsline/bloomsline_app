// The booking screen's time-zone line (src/care/zone.ts). Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zoneCity, zoneDifference } from '../src/care/zone.ts';

const at = new Date('2026-10-12T06:00:00Z');

test('names both cities only when the clocks differ', () => {
  assert.deepEqual(zoneDifference('Asia/Kolkata', 'Europe/Paris', at), { phone: 'Kolkata', practitioner: 'Paris' });
  assert.equal(zoneDifference('Europe/Paris', 'Europe/Paris', at), null);
  // Different zones, same clock: nothing to say.
  assert.equal(zoneDifference('Europe/Madrid', 'Europe/Paris', at), null);
});

test('missing or unknown zones say nothing rather than guess', () => {
  assert.equal(zoneDifference(undefined, 'Europe/Paris', at), null);
  assert.equal(zoneDifference('Asia/Kolkata', '', at), null);
  assert.equal(zoneDifference('Not/AZone', 'Europe/Paris', at), null);
});

test('city names read as people write them', () => {
  assert.equal(zoneCity('America/New_York'), 'New York');
  assert.equal(zoneCity('Indian/Reunion'), 'Reunion');
  assert.equal(zoneCity('UTC'), 'UTC');
});
