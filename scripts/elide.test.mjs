// French elision before a child's first name, as the family screens write it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frElide } from '../src/i18n/elide.ts';

test('elides before a vowel or an h, not before a consonant', () => {
  assert.equal(frElide('de', 'Adi'), 'd’Adi');
  assert.equal(frElide('que', 'Adi'), 'qu’Adi');
  assert.equal(frElide('que', 'Élise'), 'qu’Élise');
  assert.equal(frElide('de', 'Hugo'), 'd’Hugo');
  assert.equal(frElide('de', 'Mila'), 'de Mila');
  assert.equal(frElide('que', ' votre enfant '), 'que votre enfant');
});
