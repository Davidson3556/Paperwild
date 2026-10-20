import test from 'node:test';
import assert from 'node:assert/strict';
import { CAPTURE_PAGEANT_DURATION_MS, CapturePageantState, capturePageantDuration, capturePageantPhases, createCapturePageantState } from '../src/capture-pageant-state.ts';
import type { Capture } from '../src/game.ts';

const pawn: Capture = { color: 'b', type: 'p', by: 'w', moveNumber: 2 };
const knight: Capture = { color: 'w', type: 'n', by: 'b', moveNumber: 5 };
const bishop: Capture = { color: 'b', type: 'b', by: 'w', moveNumber: 6 };
const rook: Capture = { color: 'w', type: 'r', by: 'b', moveNumber: 8 };

test('a saved capture snapshot materializes memorials without replaying ceremonies', () => {
  const state = createCapturePageantState([pawn, knight]);
  assert.equal(state.snapshot.phase, 'idle');
  assert.equal(state.snapshot.pendingCount, 0);
  assert.deepEqual(state.snapshot.memorials.map(item => item.capture), [pawn, knight]);
  state.advance(60000);
  assert.equal(state.snapshot.active, null);
  assert.equal(state.snapshot.memorials.length, 2);
});

test('new captures enter one ceremony at a time with exact phase boundaries', () => {
  const state = new CapturePageantState([pawn]);
  state.sync([pawn, knight, bishop]);
  assert.equal(state.snapshot.active?.capture.type, 'n');
  assert.equal(state.snapshot.phase, 'arrival');
  assert.equal(state.snapshot.queued[0].capture.type, 'b');
  assert.equal(state.snapshot.pendingCount, 2);
  const [arrival, sermon, burial, memorial] = capturePageantPhases('n').map(phase => phase.durationMs);
  assert.equal(state.advance(arrival).phase, 'sermon');
  assert.equal(state.snapshot.active?.phaseElapsedMs, 0);
  assert.equal(state.advance(sermon).phase, 'burial');
  assert.equal(state.advance(burial).phase, 'memorial');
  const next = state.advance(memorial);
  assert.equal(next.phase, 'arrival');
  assert.equal(next.active?.capture.type, 'b');
  assert.equal(next.active?.elapsedMs, 0);
  assert.deepEqual(next.memorials.map(item => item.capture.type), ['p', 'n']);
  assert.equal(state.advance(CAPTURE_PAGEANT_DURATION_MS).phase, 'idle');
  assert.equal(state.snapshot.memorials.length, 3);
});

test('repeated cloned renders preserve progress and cannot duplicate or replay a capture', () => {
  const state = new CapturePageantState();
  state.sync([pawn]); state.advance(3000);
  const key = state.snapshot.active!.key;
  for (let index = 0; index < 4; index++) state.sync([{ ...pawn }]);
  assert.equal(state.snapshot.active?.key, key);
  assert.equal(state.snapshot.active?.elapsedMs, 3000);
  assert.equal(state.snapshot.phase, 'sermon');
  assert.equal(state.snapshot.queued.length, 0);
  state.advance(capturePageantDuration('p') - 3000); state.sync([{ ...pawn }]);
  assert.equal(state.snapshot.active, null);
  assert.equal(state.snapshot.memorials.length, 1);
  assert.equal(state.snapshot.memorials[0].key, key);
});

test('undo removes an active ceremony and its waiting suffix without resurrecting them', () => {
  const state = new CapturePageantState([pawn]);
  state.sync([pawn, knight, bishop]); state.advance(2600);
  const removedKey = state.snapshot.active!.key;
  state.sync([pawn]); state.advance(60000);
  assert.equal(state.snapshot.active, null);
  assert.equal(state.snapshot.queued.length, 0);
  assert.deepEqual(state.snapshot.memorials.map(item => item.capture), [pawn]);
  assert.ok(!state.snapshot.memorials.some(item => item.key === removedKey));
});

test('undoing a queued capture leaves the surviving active ceremony at its current progress', () => {
  const state = new CapturePageantState();
  state.sync([pawn, knight, bishop]); state.advance(1000);
  const activeKey = state.snapshot.active!.key;
  state.sync([pawn, knight]);
  assert.equal(state.snapshot.active?.key, activeKey);
  assert.equal(state.snapshot.active?.elapsedMs, 1000);
  assert.deepEqual(state.snapshot.queued.map(item => item.capture), [knight]);
  state.advance(capturePageantDuration('p') + capturePageantDuration('n'));
  assert.equal(state.snapshot.phase, 'idle');
  assert.deepEqual(state.snapshot.memorials.map(item => item.capture), [pawn, knight]);
});

test('same-count history replacements remove obsolete plots and cancel replaced active ceremonies', () => {
  const state = new CapturePageantState([pawn, knight]);
  const oldPlot = state.snapshot.memorials[1].key;
  state.sync([pawn, bishop]); state.advance(5000);
  const replacedActive = state.snapshot.active!.key;
  assert.deepEqual(state.snapshot.memorials.map(item => item.capture), [pawn]);
  state.sync([pawn, rook]);
  assert.equal(state.snapshot.active?.capture.type, 'r');
  assert.equal(state.snapshot.active?.elapsedMs, 0);
  assert.notEqual(state.snapshot.active?.key, replacedActive);
  state.advance(capturePageantDuration('r'));
  assert.deepEqual(state.snapshot.memorials.map(item => item.capture), [pawn, rook]);
  assert.ok(state.snapshot.memorials.every(item => item.key !== oldPlot && item.key !== replacedActive));
});

test('a restart clears every memorial and a later identical capture starts a new ceremony', () => {
  const state = new CapturePageantState([pawn, knight]);
  state.sync([]);
  assert.equal(state.snapshot.totalCount, 0);
  assert.equal(state.snapshot.memorials.length, 0);
  assert.equal(state.snapshot.pendingCount, 0);
  state.sync([pawn]);
  assert.equal(state.snapshot.phase, 'arrival');
  assert.equal(state.snapshot.active?.elapsedMs, 0);
  assert.equal(state.snapshot.memorials.length, 0);
});

test('an explicit story reset cancels an identical in-progress capture without replaying it', () => {
  const state = new CapturePageantState();
  state.sync([pawn]); state.advance(3000);
  state.reset([{ ...pawn }]);
  assert.equal(state.snapshot.active, null);
  assert.equal(state.snapshot.phase, 'idle');
  assert.equal(state.snapshot.memorials.length, 1);
  state.sync([{ ...pawn }]);
  assert.equal(state.snapshot.pendingCount, 0);
  state.reset();
  assert.equal(state.snapshot.totalCount, 0);
  assert.equal(state.snapshot.memorials.length, 0);
});

test('settling immediately honors reduced motion and never replays when movement resumes', () => {
  const state = new CapturePageantState();
  state.sync([pawn, knight]); state.advance(4000); state.settle();
  assert.equal(state.snapshot.pendingCount, 0);
  assert.equal(state.snapshot.memorials.length, 2);
  state.sync([pawn, knight]); state.advance(8000);
  assert.equal(state.snapshot.phase, 'idle');
  state.sync([pawn, knight, bishop], { settle: true });
  assert.equal(state.snapshot.phase, 'idle');
  assert.equal(state.snapshot.memorials.length, 3);
  assert.equal(state.snapshot.queued.length, 0);
});

test('rapid appends and a long visible frame carry time sequentially without skipping captures', () => {
  const state = new CapturePageantState();
  state.sync([pawn]); state.advance(7000);
  state.sync([pawn, knight]); state.sync([pawn, knight, bishop]);
  assert.equal(state.snapshot.active?.elapsedMs, 7000);
  const next = state.advance(capturePageantDuration('p') - 7000 + capturePageantDuration('n'));
  assert.deepEqual(next.memorials.map(item => item.capture), [pawn, knight]);
  assert.equal(next.active?.capture.type, 'b');
  assert.equal(next.active?.elapsedMs, 0);
  assert.equal(next.pendingCount, 1);
  assert.equal(new Set([...next.memorials, next.active!].map(item => item.key)).size, 3);
});

test('capture snapshots are immutable copies and identical records still receive unique keys', () => {
  const original = { ...pawn };
  const state = new CapturePageantState();
  state.sync([original, { ...original }]);
  original.type = 'q';
  assert.equal(state.snapshot.active?.capture.type, 'p');
  assert.notEqual(state.snapshot.active?.key, state.snapshot.queued[0].key);
  assert.ok(Object.isFrozen(state.snapshot));
  assert.ok(Object.isFrozen(state.snapshot.queued));
  assert.ok(Object.isFrozen(state.snapshot.active?.capture));
  for (const elapsed of [-1, Number.NaN, Number.POSITIVE_INFINITY]) assert.throws(() => state.advance(elapsed), RangeError);
  assert.equal(state.snapshot.active?.elapsedMs, 0);
});

test('ceremonies scale with importance: humble acorns, standard hares and moths, a tolled stump, a state fox', () => {
  const length = (type: Parameters<typeof capturePageantDuration>[0]) => capturePageantDuration(type);
  assert.ok(length('p') < length('n'));
  assert.equal(length('n'), length('b'));
  assert.equal(length('n'), CAPTURE_PAGEANT_DURATION_MS);
  assert.ok(length('r') > length('n') && length('q') > length('r'));
  for (const type of ['p', 'n', 'b', 'r', 'q', 'k'] as const) {
    assert.deepEqual(capturePageantPhases(type).map(phase => phase.phase), ['arrival', 'sermon', 'burial', 'memorial']);
    assert.ok(capturePageantPhases(type)[1].durationMs >= 4000, 'every sermon is long enough to read');
  }
  const state = new CapturePageantState();
  state.sync([{ ...pawn, type: 'q' }]);
  assert.equal(state.advance(length('q') - 1).phase, 'memorial');
  assert.equal(state.advance(1).phase, 'idle');
});
