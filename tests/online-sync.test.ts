import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/game.ts';
import type { MoveCoordinates, SavedGame } from '../src/game.ts';
import { planOnlineSync } from '../src/online-sync.ts';

const CODE = 'ABCDEFGHJK23';
const first: MoveCoordinates = { from: 'e2', to: 'e4' };
const second: MoveCoordinates = { from: 'e7', to: 'e5' };
const third: MoveCoordinates = { from: 'g1', to: 'f3' };

function game(...history: MoveCoordinates[]): SavedGame {
  return { ...createGame({ mode: 'local' }).serialize(), history };
}

function snapshot(...history: MoveCoordinates[]) {
  return { code: CODE, round: 0, game: game(...history) };
}

test('first contact and changing rooms restore instead of replaying another room’s history', () => {
  assert.deepEqual(planOnlineSync(null, snapshot(first, second)), { kind: 'restore', reason: 'first' });
  assert.deepEqual(planOnlineSync(snapshot(first), { ...snapshot(first, second), code: '23456789ABCD' }),
    { kind: 'restore', reason: 'first' });
});

test('echoed histories and preference changes keep the displayed board', () => {
  const displayed = snapshot(first, second);
  const incoming = { ...snapshot({ ...first }, { ...second }),
    game: { ...game({ ...first }, { ...second }), difficulty: 'wildwood' as const } };
  assert.deepEqual(planOnlineSync(displayed, incoming), { kind: 'same' });
  assert.deepEqual(planOnlineSync(snapshot(), snapshot()), { kind: 'same' });
});

test('an authoritative extension returns only missing moves in their original order', () => {
  assert.deepEqual(planOnlineSync(snapshot(first), snapshot(first, second, third)),
    { kind: 'append', moves: [second, third] });
  assert.deepEqual(planOnlineSync(snapshot(), snapshot(first, second)),
    { kind: 'append', moves: [first, second] });
});

test('promotion choices survive append and distinguish otherwise matching histories', () => {
  const knight: MoveCoordinates = { from: 'a7', to: 'a8', promotion: 'n' };
  const queen: MoveCoordinates = { ...knight, promotion: 'q' };
  assert.deepEqual(planOnlineSync(snapshot(), snapshot(knight)), { kind: 'append', moves: [knight] });
  assert.deepEqual(planOnlineSync(snapshot(knight), snapshot(queen)), { kind: 'restore', reason: 'diverged' });
  assert.deepEqual(planOnlineSync(snapshot(knight), snapshot({ from: 'a7', to: 'a8' })),
    { kind: 'restore', reason: 'diverged' });
});

test('an accepted undo restores only when the incoming history is a proper prefix', () => {
  assert.deepEqual(planOnlineSync(snapshot(first, second, third), snapshot(first, second)),
    { kind: 'restore', reason: 'rewind' });
  assert.deepEqual(planOnlineSync(snapshot(first), snapshot()), { kind: 'restore', reason: 'rewind' });
  assert.deepEqual(planOnlineSync(snapshot(first, second), snapshot({ from: 'd2', to: 'd4' })),
    { kind: 'restore', reason: 'diverged' });
});

test('nonmatching moves and starting positions require an authoritative restore', () => {
  assert.deepEqual(planOnlineSync(snapshot(first), snapshot({ from: 'e2', to: 'e3' }, second)),
    { kind: 'restore', reason: 'diverged' });
  const incoming = snapshot(first);
  incoming.game.initialFen = '7k/8/8/8/8/8/8/7K w - - 0 1';
  assert.deepEqual(planOnlineSync(snapshot(first), incoming), { kind: 'restore', reason: 'diverged' });
});

test('a new rematch round always resets even when its history matches a previous position', () => {
  assert.deepEqual(planOnlineSync(snapshot(), { ...snapshot(), round: 1 }), { kind: 'restore', reason: 'round' });
  assert.deepEqual(planOnlineSync(snapshot(first), { ...snapshot(first), round: 1 }), { kind: 'restore', reason: 'round' });
});

test('returned animation moves cannot mutate the authoritative snapshot', () => {
  const incoming = snapshot(first, second);
  const result = planOnlineSync(snapshot(first), incoming);
  assert.equal(result.kind, 'append');
  if (result.kind !== 'append') return;
  result.moves[0].to = 'e6';
  assert.equal(incoming.game.history[1].to, 'e5');
  assert.equal(incoming.game.history.length, 2);
});
