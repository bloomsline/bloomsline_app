// What the phone counts as an answer (src/resources/answers.ts). It has to agree
// with the server's `coerceAnswer` (apps/care/src/lib/resources/answers.ts): the
// worksheet screen marks every missing required question from this before the
// server is asked, and a disagreement would mark a filled field red or let an
// empty one through to a refusal. Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filesOf, fileAnswer, urlsByKey, readDate, isoOf, isAnswered, missingRequired, MAX_FILES } from '../src/resources/answers.ts';
import { parseTypedNumber } from '../src/resources/number.ts';

const readNumber = (v) => (typeof v === 'number' ? v : typeof v === 'string' ? parseTypedNumber(v, 'en') : undefined);
const f = (n) => ({ key: `resource-responses/u/${n}/f${n}.jpg`, name: `f${n}.jpg`, type: 'image/jpeg', size: n * 10 });

test('filesOf reads the single shape, the array shape, and nothing', () => {
  assert.deepEqual(filesOf(undefined), []);
  assert.deepEqual(filesOf(null), []);
  assert.deepEqual(filesOf(f(1)), [f(1)]);
  assert.deepEqual(filesOf([f(1), f(2)]), [f(1), f(2)]);
  // Unreadable entries are skipped, duplicates kept once, and the list capped.
  assert.deepEqual(filesOf([f(1), { name: 'no key' }, f(1), 'x']), [f(1)]);
  assert.equal(filesOf([1, 2, 3, 4, 5, 6, 7].map(f)).length, MAX_FILES);
});

test('fileAnswer writes none, one bare descriptor, or an array', () => {
  assert.equal(fileAnswer([]), undefined);
  assert.deepEqual(fileAnswer([f(1)]), f(1));
  assert.deepEqual(fileAnswer([f(1), f(2), f(3)]), [f(1), f(2), f(3)]);
  assert.deepEqual(filesOf(fileAnswer([f(1), f(2)])), [f(1), f(2)]);
});

test('urlsByKey follows the server order, and falls back to the first-file url', () => {
  assert.deepEqual(urlsByKey([f(1), f(2)], ['u1', 'u2']), { [f(1).key]: 'u1', [f(2).key]: 'u2' });
  assert.deepEqual(urlsByKey(f(1), undefined, 'm1'), { [f(1).key]: 'm1' });
  assert.deepEqual(urlsByKey(undefined, ['u1']), {});
  // A file the server could not sign keeps its slot as '': no link, no shift.
  assert.deepEqual(urlsByKey([f(1), f(2), f(3)], ['', 'u2', 'u3']), { [f(2).key]: 'u2', [f(3).key]: 'u3' });
  // Aligned with the server's own reading, which does not skip a bad entry's slot.
  assert.deepEqual(urlsByKey([{ name: 'broken' }, f(2)], ['', 'u2']), { [f(2).key]: 'u2' });
});

test('readDate takes the stored ISO form and the old day-first form', () => {
  assert.deepEqual(readDate('2026-09-14'), { y: 2026, m: 9, d: 14 });
  assert.deepEqual(readDate('14/09/2026'), { y: 2026, m: 9, d: 14 });
  assert.deepEqual(readDate('4.9.1987'), { y: 1987, m: 9, d: 4 });
  assert.equal(readDate('31/04/2026'), null);
  assert.equal(readDate('2026-02-30'), null);
  assert.equal(readDate('last week'), null);
  assert.equal(readDate(20260914), null);
  assert.equal(isoOf({ y: 1987, m: 9, d: 4 }), '1987-09-04');
});

test('isAnswered agrees with the server on the edge cases', () => {
  assert.equal(isAnswered({ id: 'a', type: 'short_text' }, '   ', readNumber), false);
  assert.equal(isAnswered({ id: 'a', type: 'number' }, 'abc', readNumber), false);
  assert.equal(isAnswered({ id: 'a', type: 'number' }, '3.5', readNumber), true);
  assert.equal(isAnswered({ id: 'a', type: 'scale' }, undefined, readNumber), false);
  assert.equal(isAnswered({ id: 'a', type: 'scale' }, 0, readNumber), true);
  const choice = { id: 'a', type: 'multi_choice', options: [{ id: 'x' }] };
  assert.equal(isAnswered(choice, [], readNumber), false);
  assert.equal(isAnswered(choice, ['gone'], readNumber), false);
  assert.equal(isAnswered(choice, ['x'], readNumber), true);
  const table = { id: 't', type: 'table', columns: [{ id: 'c1', type: 'text' }, { id: 'c2', type: 'number' }] };
  assert.equal(isAnswered(table, [{}, {}], readNumber), false);
  assert.equal(isAnswered(table, [{ c1: '  ' }], readNumber), false);
  assert.equal(isAnswered(table, [{}, { c2: 4 }], readNumber), true);
  assert.equal(isAnswered({ id: 'f', type: 'file_upload' }, [f(1)], readNumber), true);
  assert.equal(isAnswered({ id: 'f', type: 'file_upload' }, { key: 'elsewhere/x', name: 'x' }, readNumber), false);
  assert.equal(isAnswered({ id: 'd', type: 'date' }, '14/09/2026', readNumber), true);
});

test('missingRequired lists every gap in order, and only required ones', () => {
  const blocks = [
    { id: 'h', type: 'heading', required: true },
    { id: 'a', type: 'short_text', required: true },
    { id: 'b', type: 'scale', required: false },
    { id: 'c', type: 'date', required: true },
    { id: 'd', type: 'yes_no', required: true },
  ];
  const interactive = new Set(['short_text', 'scale', 'date', 'yes_no']);
  assert.deepEqual(missingRequired(blocks, { d: 'yes' }, readNumber, interactive), ['a', 'c']);
  assert.deepEqual(missingRequired(blocks, { a: 'hi', c: '2026-01-01', d: 'no' }, readNumber, interactive), []);
});
