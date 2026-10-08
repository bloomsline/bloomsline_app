// The to-do list's order (src/care/todo-order.ts). Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderTodo } from '../src/care/todo-order.ts';

const it = (id, status, dueAt = null) => ({ id, status, dueAt });

test('open work comes before finished work, whatever the server order', () => {
  // Newest first, as the server sends it: a finished one on top, the redo under it.
  const got = orderTodo([it('done-new', 'completed'), it('redo', 'in_progress'), it('done-old', 'completed'), it('todo', 'assigned')]);
  assert.deepEqual(got.map((x) => x.id), ['redo', 'todo', 'done-new', 'done-old']);
});

test('among open work the nearest due day leads, and no day keeps the server order', () => {
  const got = orderTodo([it('a', 'assigned'), it('late', 'assigned', '2026-10-20T12:00:00.000Z'), it('b', 'assigned'), it('soon', 'in_progress', '2026-10-10T12:00:00.000Z'), it('bad', 'assigned', 'not a date')]);
  assert.deepEqual(got.map((x) => x.id), ['soon', 'late', 'a', 'b', 'bad']);
});

test('nothing in, nothing out, and the input is not changed', () => {
  assert.deepEqual(orderTodo([]), []);
  const input = [it('d', 'completed'), it('o', 'assigned')];
  orderTodo(input);
  assert.deepEqual(input.map((x) => x.id), ['d', 'o']);
});
