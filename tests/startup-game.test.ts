import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/game.ts';
import { canRevisitFinishedGame, createStartupGame, preserveFinishedGame, restoreFinishedGame } from '../src/startup-game.ts';

test('unfinished games resume exactly, including captures and the pending turn', () => {
  const previous = createGame({ mode: 'local', difficulty: 'wildwood' });
  for (const [from, to] of [['e2', 'e4'], ['d7', 'd5'], ['e4', 'd5']]) {
    assert.ok(previous.move({ from, to }));
  }
  const saved = previous.serialize();
  const startup = createStartupGame(saved);
  assert.equal(startup.resumed, true);
  assert.equal(startup.finished, null);
  assert.deepEqual(startup.game.serialize(), saved);
  assert.equal(startup.game.chess.fen(), previous.chess.fen());
  assert.deepEqual(startup.game.captures(), previous.captures());
  assert.equal(startup.game.status().turn, 'b');
  assert.equal(startup.game.undoTurn().length, 1);
  assert.equal(startup.game.chess.get('e4')?.type, 'p');
  assert.equal(startup.game.chess.get('d5')?.color, 'b');
});

test('a completed checkmate study opens a full playable game on the next visit', () => {
  const previous = createGame({ fen: '7k/8/5KQ1/8/8/8/8/8 w - - 0 1', mode: 'local', difficulty: 'seedling' });
  assert.ok(previous.move({ from: 'g6', to: 'g7' }));
  assert.equal(previous.status().checkmate, true);
  const saved = previous.serialize();
  const startup = createStartupGame(saved, 'mate');
  assert.equal(startup.resumed, false);
  assert.equal(startup.game.status().over, false);
  assert.equal(startup.game.status().turn, 'w');
  assert.equal(startup.game.chess.board().flat().filter(Boolean).length, 32);
  assert.deepEqual(startup.game.chess.history(), []);
  assert.deepEqual(startup.game.captures(), []);
  assert.equal(startup.game.mode, 'local');
  assert.equal(startup.game.difficulty, 'seedling');
  assert.deepEqual(startup.finished, {game:saved,study:'mate'});
  assert.ok(startup.game.move({ from: 'e2', to: 'e4' }));
  assert.deepEqual(previous.serialize(), saved, 'startup must not mutate the finished game');
});

test('the finished archive restores exact captures, history and remembrance identities', () => {
  const previous = createGame({ fen: '7k/6r1/5KQ1/8/8/8/8/8 w - - 0 1', mode: 'local' });
  assert.ok(previous.move({from:'g6',to:'g7'}));
  assert.equal(previous.status().checkmate, true);
  assert.equal(previous.captures().length, 1);
  const startup = createStartupGame(previous.serialize(), 'mate');
  let stored = '';
  assert.equal(preserveFinishedGame(startup.finished,record=>{stored=JSON.stringify(record);}), true);
  const restored = restoreFinishedGame(JSON.parse(stored));
  assert.ok(restored);
  assert.equal(restored.study, 'mate');
  assert.deepEqual(restored.game.serialize(), previous.serialize());
  assert.deepEqual(restored.game.captures(), previous.captures());
  assert.deepEqual(restored.game.captureStories(), previous.captureStories());
});

test('invalid and unfinished records cannot become a finished-game archive', () => {
  for(const value of [null,[],{game:{history:'broken'}},{game:createGame().serialize(),study:'mate'}]){
    assert.equal(restoreFinishedGame(value), null);
  }
});

test('archive write failures are reported so the original terminal save stays protected', () => {
  const drawn=createGame({fen:'7k/8/8/8/8/8/8/7K w - - 0 1'});
  const startup=createStartupGame(drawn.serialize());
  assert.ok(startup.finished);
  assert.equal(preserveFinishedGame(startup.finished,()=>{throw new Error('Storage quota exceeded');}),false);
  assert.deepEqual(startup.finished.game,drawn.serialize());
  assert.equal(preserveFinishedGame(null,()=>{throw new Error('No archive should be written');}),true);
});

test('revisiting is allowed only from an untouched full starting board', () => {
  const fresh=createGame();
  assert.equal(canRevisitFinishedGame(fresh,false),true);
  assert.equal(canRevisitFinishedGame(fresh,true),false);
  assert.ok(fresh.move({from:'e2',to:'e4'}));
  assert.equal(canRevisitFinishedGame(fresh,false),false);
  const study=createGame({fen:'7k/P7/8/8/8/8/8/7K w - - 0 1'});
  assert.equal(canRevisitFinishedGame(study,false),false);
});

test('drawn games also open a fresh page, while unfinished studies keep their position', () => {
  const drawn = createGame({ fen: '7k/8/8/8/8/8/8/7K w - - 0 1', difficulty: 'wildwood' });
  assert.equal(drawn.status().draw, true);
  const fresh = createStartupGame(drawn.serialize());
  assert.equal(fresh.resumed, false);
  assert.equal(fresh.game.status().over, false);
  assert.equal(fresh.game.difficulty, 'wildwood');
  const study = createGame({ fen: '7k/P7/8/8/8/8/8/7K w - - 0 1', mode: 'local' });
  const resumed = createStartupGame(study.serialize());
  assert.equal(resumed.resumed, true);
  assert.deepEqual(resumed.game.serialize(), study.serialize());
});

test('missing or invalid saves open a legal starting board', () => {
  for (const value of [null, { history: 'broken' }, { initialFen: 'not chess' }]) {
    const startup = createStartupGame(value);
    assert.equal(startup.resumed, false);
    assert.equal(startup.game.status().over, false);
    assert.equal(startup.game.chess.board().flat().filter(Boolean).length, 32);
  }
});
