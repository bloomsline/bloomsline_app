// Search folding (src/ui/fold.ts). Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fold } from '../src/ui/fold.ts';

test('accents and case do not stand between a search and a name', () => {
  for (const [name, typed] of [['Léa Testeuse', 'lea'], ['Inès Benali', 'INES'], ['Chloé Fontaine', 'chloe f'], ['Zoé', 'zoe'], ['Œuvre', 'œ']]) {
    assert.ok(fold(name).includes(fold(typed)), `${typed} → ${name}`);
  }
  assert.ok(!fold('Marie Dupont').includes(fold('lea')));
});
