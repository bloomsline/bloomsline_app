import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stemSlices } from '../src/moments/stem-slices.ts';

// The Moments tab opened blank on the web after the first moment: the stem's
// last slice was a full 1200 tall under a 222-tall line, and "pin to today"
// scrolled to the bottom of that empty overflow.

test('the slices cover the line exactly, never past its end', () => {
  for (const total of [222, 1200, 1201, 2486, 5000]) {
    const s = stemSlices(total, 1200);
    const last = s.at(-1);
    assert.equal(last.top + last.height, total, `total ${total}`);
    assert.equal(s.reduce((n, x) => n + x.height, 0), total);
  }
});

test('one moment: a single slice as tall as the line', () => {
  assert.deepEqual(stemSlices(222, 1200), [{ top: 0, height: 222 }]);
});

test('no line, no slices', () => {
  assert.deepEqual(stemSlices(0, 1200), []);
});
