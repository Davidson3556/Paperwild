import test from 'node:test';
import assert from 'node:assert/strict';
import { entryPolicy } from '../src/entry-policy.ts';
import type { EntryPolicyInput } from '../src/entry-policy.ts';
import { createGame } from '../src/game.ts';
import { createStartupGame } from '../src/startup-game.ts';

const firstVisit: EntryPolicyInput = {
  resumed: false,
  hasHistory: false,
  hasStudy: false,
  opponentChosen: undefined,
  hasSeenGuide: undefined,
  hasActiveSeat: false,
  hasInvitation: false,
};

test('a new player must see the guide and choose before the local game is ready', () => {
  assert.deepEqual(entryPolicy(firstVisit), {
    entry: 'choose', localConfirmed: false, localReady: false, showGuide: true, requireChoice: true,
  });
});

test('an automatically saved untouched board does not bypass opponent selection', () => {
  const startup = createStartupGame(createGame().serialize());
  assert.equal(startup.resumed, true);
  assert.deepEqual(entryPolicy({ ...firstVisit, resumed: startup.resumed }), {
    entry: 'choose', localConfirmed: false, localReady: false, showGuide: true, requireChoice: true,
  });
});

test('only an explicit boolean choice restores an untouched confirmed game', () => {
  assert.deepEqual(entryPolicy({ ...firstVisit, resumed: true, opponentChosen: true }), {
    entry: 'local', localConfirmed: true, localReady: true, showGuide: false, requireChoice: false,
  });
  for (const opponentChosen of [false, 'true', 1, {}, [], null]) {
    assert.equal(entryPolicy({ ...firstVisit, resumed: true, opponentChosen }).entry, 'choose');
  }
});

test('invalid or finished saves cannot unlock play with a persisted choice marker', () => {
  const finished = createGame({ fen: '7k/8/8/8/8/8/8/7K w - - 0 1' });
  for (const saved of [null, { initialFen: 'not chess' }, { history: 'broken' }, finished.serialize()]) {
    const startup = createStartupGame(saved);
    assert.equal(startup.resumed, false);
    assert.deepEqual(entryPolicy({
      ...firstVisit, resumed: startup.resumed, hasHistory: true,
      hasStudy: true, opponentChosen: true,
    }), { entry: 'choose', localConfirmed: false, localReady: false, showGuide: true, requireChoice: true });
  }
});

test('a legacy game with moves resumes the pending club turn without a new guide or choice', () => {
  const previous = createGame({ mode: 'computer' });
  assert.ok(previous.move({ from: 'e2', to: 'e4' }));
  const startup = createStartupGame(previous.serialize());
  assert.equal(startup.game.status().turn, 'b');
  assert.deepEqual(entryPolicy({
    ...firstVisit, resumed: startup.resumed, hasHistory: startup.game.chess.history().length > 0,
  }), { entry: 'local', localConfirmed: true, localReady: true, showGuide: false, requireChoice: false });
  assert.deepEqual(startup.game.serialize(), previous.serialize());
});

test('a validated legacy study is meaningful even before its first move', () => {
  const study = createGame({ fen: '7k/P7/8/8/8/8/8/7K w - - 0 1', mode: 'local' });
  const startup = createStartupGame(study.serialize(), 'promotion');
  assert.deepEqual(entryPolicy({ ...firstVisit, resumed: startup.resumed, hasStudy: true }), {
    entry: 'local', localConfirmed: true, localReady: true, showGuide: false, requireChoice: false,
  });
});

test('remembering the guide never substitutes for choosing an opponent', () => {
  assert.deepEqual(entryPolicy({ ...firstVisit, resumed: true, hasSeenGuide: true }), {
    entry: 'choose', localConfirmed: false, localReady: false, showGuide: false, requireChoice: true,
  });
  for (const hasSeenGuide of ['true', 1, {}, [], null]) {
    assert.equal(entryPolicy({ ...firstVisit, hasSeenGuide }).showGuide, true);
  }
});

test('an invitation takes precedence over a local save without unlocking its board', () => {
  assert.deepEqual(entryPolicy({ ...firstVisit, hasInvitation: true }), {
    entry: 'invite', localConfirmed: false, localReady: false, showGuide: true, requireChoice: false,
  });
  assert.deepEqual(entryPolicy({
    ...firstVisit, resumed: true, opponentChosen: true, hasInvitation: true,
  }), { entry: 'invite', localConfirmed: true, localReady: false, showGuide: false, requireChoice: false });
});

test('an active seat resumes before an invitation and remains gated until the server responds', () => {
  assert.deepEqual(entryPolicy({
    ...firstVisit, resumed: true, hasHistory: true, hasActiveSeat: true, hasInvitation: true,
  }), { entry: 'resume-online', localConfirmed: true, localReady: false, showGuide: false, requireChoice: false });
});
