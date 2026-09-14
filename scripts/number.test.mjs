// The phone's reading of a typed number (src/resources/number.ts). It must read
// every number the way the server does (apps/care/src/lib/resources/answers.ts
// `parseTypedNumber`, tested there with the same cases): the field says "Read as
// …" under what is typed, and the server stores the answer. Run with
// `npm test` (Node's own test runner, which reads the TypeScript directly).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseTypedNumber, formatReadNumber } from '../src/resources/number.ts';

test('plain numbers and a decimal point or comma', () => {
  assert.equal(parseTypedNumber('12', 'fr'), 12);
  assert.equal(parseTypedNumber('-3', 'en'), -3);
  assert.equal(parseTypedNumber('3,5', 'fr'), 3.5);
  assert.equal(parseTypedNumber('3.5', 'fr'), 3.5);
  assert.equal(parseTypedNumber(',5', 'en'), 0.5);
});

test('"1,234" is a thousand in English and one and a bit in French', () => {
  assert.equal(parseTypedNumber('1,234', 'en'), 1234);
  assert.equal(parseTypedNumber('-12,500', 'en'), -12500);
  assert.equal(parseTypedNumber('1,234', 'fr'), 1.234);
  assert.equal(parseTypedNumber('1,5', 'en'), 1.5);
  assert.equal(parseTypedNumber('1,2345', 'en'), 1.2345);
});

test('grouping with spaces, repeated separators, or both separators', () => {
  assert.equal(parseTypedNumber('1 234,5', 'fr'), 1234.5);
  assert.equal(parseTypedNumber('1 234', 'fr'), 1234);
  assert.equal(parseTypedNumber('12,345,678', 'en'), 12345678);
  assert.equal(parseTypedNumber('1.234.567', 'fr'), 1234567);
  assert.equal(parseTypedNumber('1.234,5', 'fr'), 1234.5);
  assert.equal(parseTypedNumber('1,234.5', 'en'), 1234.5);
});

test('refuses what cannot be told apart rather than guessing', () => {
  for (const bad of ['', '-', 'abc', '1,234,5', '12 34', '1.2.3,4.5', '3,5,']) {
    assert.equal(parseTypedNumber(bad, 'fr'), undefined, bad);
  }
});

test('says the number back in the patient\'s language', () => {
  assert.equal(formatReadNumber(1234.5, 'en'), '1,234.5');
  assert.match(formatReadNumber(1234.5, 'fr'), /^1\s234,5$/u);
});
