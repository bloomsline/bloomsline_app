// The care profile decides what the app offers (src/care/shape.ts, guardian
// plan phase 6). Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shapeOf, can, profilesFrom, headersFor, profileLabel } from '../src/care/shape.ts';

const link = (over = {}) => ({ linkId: 'm1', practitionerId: 'p1', practitionerName: 'Dr Anna', photoUrl: null, role: 'patient', child: false, childFirstName: null, ...over });

test('a patient, a child and a guardian are three different apps', () => {
  const [patient, child, guardian] = profilesFrom({ links: [link(), link({ linkId: 'm2', child: true }), link({ linkId: 'm3', role: 'guardian', childFirstName: 'Mila' })] });
  assert.equal(shapeOf(patient), 'patient');
  assert.equal(shapeOf(child), 'child');
  assert.equal(shapeOf(guardian), 'guardian');
  assert.equal(shapeOf(null), 'none');
});

test('the child sees sessions but never books or changes them, and has no documents', () => {
  for (const f of ['book', 'changeSessions', 'documents']) assert.equal(can('child', f), false, f);
  for (const f of ['sessions', 'share', 'fromPractitioner']) assert.equal(can('child', f), true, f);
});

test('the guardian books and signs, and gets none of the child\'s own material or any sharing', () => {
  for (const f of ['book', 'changeSessions', 'documents', 'sessions']) assert.equal(can('guardian', f), true, f);
  for (const f of ['share', 'fromPractitioner']) assert.equal(can('guardian', f), false, f);
});

test('an adult patient has everything, as before', () => {
  for (const f of ['book', 'changeSessions', 'share', 'fromPractitioner', 'documents', 'sessions']) assert.equal(can('patient', f), true, f);
});

test('a server from before roles: practitioners become patient profiles, keyed by practitioner', () => {
  const ps = profilesFrom({ practitioners: [{ id: 'p1', name: 'Dr Anna', photoUrl: null }] });
  assert.deepEqual(ps.map((p) => [p.key, p.role, p.child]), [['p1', 'patient', false]]);
});

test('the link header is sent only for a guardian\'s view, the practitioner header only when there is a choice', () => {
  const one = profilesFrom({ links: [link()] });
  assert.deepEqual(headersFor(one, one[0]), { practitionerId: null, linkId: null });
  const mixed = profilesFrom({ links: [link(), link({ linkId: 'kid', role: 'guardian', childFirstName: 'Mila' })] });
  assert.deepEqual(headersFor(mixed, mixed[0]), { practitionerId: 'p1', linkId: null });
  assert.deepEqual(headersFor(mixed, mixed[1]), { practitionerId: 'p1', linkId: 'kid' });
  // A guardian of one child, and nothing else, still names the child.
  const only = profilesFrom({ links: [link({ linkId: 'kid', role: 'guardian', childFirstName: 'Mila' })] });
  assert.deepEqual(headersFor(only, only[0]), { practitionerId: null, linkId: 'kid' });
});

test('the switcher names the child for a guardian\'s profile', () => {
  const [g] = profilesFrom({ links: [link({ role: 'guardian', childFirstName: 'Mila' })] });
  assert.deepEqual(profileLabel(g), { title: 'Mila', subtitle: 'Dr Anna' });
});

import { selectionKeyFor, pickProfile, turnedAway } from '../src/care/shape.ts';

test('a guardian of one child still gets a reload key, so My Care loads the child once /me names them', () => {
  const only = profilesFrom({ links: [link({ linkId: 'kid', role: 'guardian', childFirstName: 'Mila' })] });
  assert.equal(selectionKeyFor(only, only[0]), 'kid');
  const one = profilesFrom({ links: [link()] });
  assert.equal(selectionKeyFor(one, one[0]), '');
  assert.equal(selectionKeyFor([], null), '');
});

test('a profile just accepted wins over the one on screen, which wins over the remembered one', () => {
  const list = profilesFrom({ links: [link({ linkId: 'own' }), link({ linkId: 'kid', role: 'guardian', childFirstName: 'Mila' })] });
  assert.equal(pickProfile(list, { next: 'kid', current: 'own', stored: 'own' }), 'kid');
  assert.equal(pickProfile(list, { next: 'gone', current: 'own', stored: 'kid' }), 'own');
  assert.equal(pickProfile(list, { stored: 'kid' }), 'kid');
  // A practitioner id remembered from before profiles means the patient's own care.
  assert.equal(pickProfile(list, { stored: 'p1' }), 'own');
  assert.equal(pickProfile(list, {}), 'own');
  assert.equal(pickProfile([], {}), null);
});

test('only a child\'s or a guardian\'s view is turned away from a screen; a patient or an unlinked account never', () => {
  assert.equal(turnedAway('guardian', 'fromPractitioner'), true);
  assert.equal(turnedAway('guardian', 'share'), true);
  assert.equal(turnedAway('child', 'book'), true);
  assert.equal(turnedAway('child', 'documents'), true);
  assert.equal(turnedAway('guardian', 'documents'), false);
  assert.equal(turnedAway('patient', 'book'), false);
  assert.equal(turnedAway('none', 'fromPractitioner'), false);
});
