// Moments keeps the picture links it already has when the tab reads its first
// page again (src/moments/keep-links.ts), so returning to the tab does not make
// every photo blink. Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keepFreshLinks, REUSE_MS } from '../src/moments/keep-links.ts';

const moment = (id, link, extra = {}) => ({
  id, type: 'photo', textContent: 'walk', caption: null, moods: ['calm'], capturedAt: '2026-09-14T10:00:00Z',
  sharedWithPractitioner: false, sharedWith: [], sharedWithIds: [],
  media: [{ id: `${id}-m`, kind: 'image', mimeType: 'image/jpeg', width: 10, height: 10, durationSeconds: null, url: link, thumbnailUrl: `${link}-thumb` }],
  ...extra,
});

test('an unchanged moment read again is the same object, old links and all', () => {
  const linksAt = new Map();
  const first = keepFreshLinks([], [moment('a', 'link-1')], linksAt, 0);
  const again = keepFreshLinks(first, [moment('a', 'link-2')], linksAt, 60_000);
  assert.equal(again[0], first[0]);
  assert.equal(again[0].media[0].url, 'link-1');
});

test('a moment that changed takes the change but keeps its links', () => {
  const linksAt = new Map();
  const first = keepFreshLinks([], [moment('a', 'link-1')], linksAt, 0);
  const again = keepFreshLinks(first, [moment('a', 'link-2', { sharedWithPractitioner: true })], linksAt, 60_000);
  assert.notEqual(again[0], first[0]);
  assert.equal(again[0].sharedWithPractitioner, true);
  assert.equal(again[0].media[0].url, 'link-1');
});

test('links older than the reuse window are replaced, and the clock restarts', () => {
  const linksAt = new Map();
  const first = keepFreshLinks([], [moment('a', 'link-1')], linksAt, 0);
  const later = keepFreshLinks(first, [moment('a', 'link-2')], linksAt, REUSE_MS + 1);
  assert.equal(later[0].media[0].url, 'link-2');
  const soonAfter = keepFreshLinks(later, [moment('a', 'link-3')], linksAt, REUSE_MS + 60_000);
  assert.equal(soonAfter[0].media[0].url, 'link-2');
});

test('different files, or a moment never seen, take the new links', () => {
  const linksAt = new Map();
  const first = keepFreshLinks([], [moment('a', 'link-1')], linksAt, 0);
  const swapped = moment('a', 'link-2');
  swapped.media[0].id = 'other-file';
  assert.equal(keepFreshLinks(first, [swapped], linksAt, 1000)[0].media[0].url, 'link-2');
  assert.equal(keepFreshLinks(first, [moment('b', 'link-9')], linksAt, 1000)[0].media[0].url, 'link-9');
});

test('a moment whose links were never recorded is not trusted with old ones', () => {
  const prev = [moment('a', 'link-1')];
  const next = keepFreshLinks(prev, [moment('a', 'link-2')], new Map(), 1000);
  assert.equal(next[0].media[0].url, 'link-2');
});
