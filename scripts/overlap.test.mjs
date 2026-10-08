// Side-by-side calendar columns (src/practitioner/overlap.ts). Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overlapColumns } from '../src/practitioner/overlap.ts';

test('sessions that do not overlap keep the full width', () => {
  const p = overlapColumns([{ id: 'a', start: 0, end: 60 }, { id: 'b', start: 60, end: 120 }]);
  assert.deepEqual(p, { a: { col: 0, cols: 1 }, b: { col: 0, cols: 1 } });
});

test('two sessions at the same time sit side by side', () => {
  const p = overlapColumns([{ id: 'cancelled', start: 60, end: 120 }, { id: 'rebooked', start: 60, end: 120 }]);
  assert.equal(p.cancelled.cols, 2);
  assert.equal(p.rebooked.cols, 2);
  assert.notEqual(p.cancelled.col, p.rebooked.col);
});

test('a chain of overlaps shares one column count, and a free column is reused', () => {
  // a overlaps b, b overlaps c, a and c do not: two columns, c reuses a's.
  const p = overlapColumns([{ id: 'a', start: 0, end: 60 }, { id: 'b', start: 30, end: 90 }, { id: 'c', start: 60, end: 120 }]);
  assert.deepEqual(p, { a: { col: 0, cols: 2 }, b: { col: 1, cols: 2 }, c: { col: 0, cols: 2 } });
});

test('a later group is laid out on its own', () => {
  const p = overlapColumns([
    { id: 'a', start: 0, end: 60 }, { id: 'b', start: 0, end: 60 }, { id: 'c', start: 0, end: 60 },
    { id: 'd', start: 200, end: 260 },
  ]);
  assert.equal(p.a.cols, 3);
  assert.deepEqual(p.d, { col: 0, cols: 1 });
});
