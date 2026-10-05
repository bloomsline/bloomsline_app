// Session places on the phone (src/care/session-format.ts). A place key must
// never show as raw text, and must never be treated as the practice: a home
// visit offering "Open in Maps" to the practice is the bug this guards.
// Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatWords, formatKindOf, formatIconKey, sessionWayThere, formatForAnalytics } from '../src/care/session-format.ts';

const practice = { mapsUrl: 'https://maps.app/practice', address: '1 place Bellecour' };

test('words: the server label first, the app\'s own words, never the raw key', () => {
  assert.equal(formatWords('place:home', 'fr', 'À domicile'), 'À domicile');
  assert.equal(formatWords('place:home', 'en'), 'At home');
  assert.equal(formatWords('in_person', 'fr'), 'Au cabinet');
  assert.equal(formatWords('place:7f3c2a10', 'en'), 'Other place');
  assert.equal(formatWords('carrier_pigeon', 'fr'), 'Séance');
});

test('a home visit offers Maps to its own address, never to the practice', () => {
  const way = sessionWayThere({ sessionFormat: 'place:home', formatKind: 'place', location: '12 rue des Lilas' }, practice);
  assert.equal(way.kind, 'maps');
  assert.match(way.url, /query=12%20rue%20des%20Lilas$/);
  assert.equal(way.place, true);
});

test('a place with no location, or an unknown key from an older server, offers nothing', () => {
  assert.deepEqual(sessionWayThere({ sessionFormat: 'place:outdoors' }, practice), { kind: 'none' });
  assert.deepEqual(sessionWayThere({ sessionFormat: 'something_new' }, practice), { kind: 'none' });
});

test('the built-in formats behave as before', () => {
  assert.deepEqual(sessionWayThere({ sessionFormat: 'in_person' }, practice), { kind: 'maps', url: practice.mapsUrl, place: false });
  assert.deepEqual(sessionWayThere({ sessionFormat: 'in_person' }, { mapsUrl: null, address: practice.address }), { kind: 'address', text: practice.address });
  assert.deepEqual(sessionWayThere({ sessionFormat: 'video', meetLink: 'https://meet/x' }, practice), { kind: 'join', url: 'https://meet/x' });
  assert.deepEqual(sessionWayThere({ sessionFormat: 'phone' }, practice), { kind: 'phone' });
  // A room on a session at the practice keeps the practice's Maps link.
  assert.deepEqual(sessionWayThere({ sessionFormat: 'in_person', formatKind: 'in_person', location: 'Salle 2' }, practice), { kind: 'maps', url: practice.mapsUrl, place: false });
});

test('icons and analytics', () => {
  assert.equal(formatIconKey('place:home'), 'home');
  assert.equal(formatIconKey('place:abc'), 'pin');
  assert.equal(formatKindOf('place:abc'), 'place');
  assert.equal(formatForAnalytics('place:7f3c2a10'), 'place');
});
