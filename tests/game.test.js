import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, restoreGame, chooseComputerMove } from '../src/game.js';

function play(game, ...moves) {
  for (const [from, to, promotion] of moves) {
    assert.ok(game.move({ from, to, promotion }), `${from}-${to} should be legal`);
  }
}

test('legal moves are exposed and invalid attempts leave the board untouched', () => {
  const game = createGame();
  const initial = game.chess.fen();
  assert.deepEqual(game.moves('e2').map((move) => move.to).sort(), ['e3', 'e4']);
  assert.deepEqual(game.moves('invalid'), []);
  assert.equal(game.move({ from: 'e2', to: 'e5' }), null);
  assert.equal(game.move({ from: 'e7', to: 'e5' }), null);
  assert.equal(game.move(null), null);
  assert.equal(game.chess.fen(), initial);
  play(game, ['e2', 'e4']);
  assert.equal(game.status().turn, 'b');
  assert.equal(game.chess.get('e4').type, 'p');
});

test('castling moves the rook and undo restores both pieces', () => {
  const game = createGame({ fen: 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', mode: 'local' });
  const initial = game.chess.fen();
  play(game, ['e1', 'g1']);
  assert.equal(game.chess.get('f1').type, 'r');
  assert.equal(game.chess.get('g1').type, 'k');
  assert.equal(game.undoTurn().length, 1);
  assert.equal(game.chess.fen(), initial);
});

test('en passant records the captured pawn and the correct side', () => {
  const game = createGame({ mode: 'local' });
  play(game, ['e2', 'e4'], ['a7', 'a6'], ['e4', 'e5'], ['d7', 'd5'], ['e5', 'd6']);
  assert.equal(game.chess.get('d5'), undefined);
  assert.deepEqual(game.captures(), [{ color: 'b', type: 'p', by: 'w', moveNumber: 3 }]);
  game.undoTurn();
  assert.deepEqual(game.captures(), []);
  assert.equal(game.chess.get('d5').type, 'p');
});

test('promotion supports a chosen piece and defaults to a queen', () => {
  const options = { fen: '7k/P7/8/8/8/8/8/7K w - - 0 1' };
  const game = createGame(options);
  play(game, ['a7', 'a8', 'n']);
  assert.equal(game.chess.get('a8').type, 'n');
  const queenGame = createGame(options);
  play(queenGame, ['a7', 'a8']);
  assert.equal(queenGame.chess.get('a8').type, 'q');
});

test('mate reports a winner and rejects further play', () => {
  const game = createGame();
  play(game, ['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']);
  assert.equal(game.status().checkmate, true);
  assert.equal(game.status().over, true);
  assert.equal(game.status().winner, 'b');
  assert.equal(game.status().draw, false);
  assert.equal(game.move({ from: 'e2', to: 'e3' }), null);
  assert.deepEqual(game.moves(), []);
});

test('stalemate is a draw with no winner', () => {
  const game = createGame({ fen: '7k/5K2/6Q1/8/8/8/8/8 b - - 0 1' });
  assert.deepEqual(game.status(), {
    turn: 'b', over: true, check: false, checkmate: false, stalemate: true,
    draw: true, winner: null, text: 'Draw · stalemate',
  });
});

test('undo removes a completed computer turn, a pending human move, or one local ply', () => {
  const computer = createGame();
  const start = computer.chess.fen();
  play(computer, ['e2', 'e4'], ['e7', 'e5']);
  assert.equal(computer.undoTurn().length, 2);
  assert.equal(computer.chess.fen(), start);
  play(computer, ['d2', 'd4']);
  assert.equal(computer.undoTurn().length, 1);
  assert.equal(computer.chess.fen(), start);
  assert.deepEqual(computer.undoTurn(), []);

  const local = createGame({ mode: 'local' });
  play(local, ['e2', 'e4'], ['e7', 'e5']);
  assert.equal(local.undoTurn().length, 1);
  assert.equal(local.chess.turn(), 'b');
  assert.equal(local.chess.history().length, 1);
});

test('saved games preserve full history, preferences, repetition and undo', () => {
  const game = createGame({ mode: 'local', difficulty: 'wildwood' });
  const cycle = [['g1', 'f3'], ['g8', 'f6'], ['f3', 'g1'], ['f6', 'g8']];
  play(game, ...cycle, ...cycle);
  assert.equal(game.chess.isThreefoldRepetition(), true);
  const restored = restoreGame(JSON.parse(JSON.stringify(game.serialize())));
  assert.ok(restored);
  assert.equal(restored.chess.fen(), game.chess.fen());
  assert.deepEqual(restored.serialize(), game.serialize());
  assert.equal(restored.status().over, true);
  assert.match(restored.status().text, /threefold/);
  restored.undoTurn();
  assert.equal(restored.status().over, false);
  assert.equal(restored.chess.history().length, 7);
});

test('restore rejects broken preferences, FENs and illegal or malformed histories', () => {
  const saved = createGame().serialize();
  for (const data of [
    null,
    {},
    { ...saved, mode: 'online' },
    { ...saved, difficulty: 'impossible' },
    { ...saved, initialFen: 'not a position' },
    { ...saved, history: {} },
    { ...saved, history: [null] },
    { ...saved, history: [{ from: 'e2', to: 'e5' }] },
    { ...saved, history: [{ from: 'e2', to: 'e4', promotion: 'k' }] },
  ]) assert.equal(restoreGame(data), null);
});

test('custom starts retain fullmove numbers and promotions through serialization', () => {
  const game = createGame({ fen: '7k/P7/8/8/8/8/8/7K w - - 0 42' });
  play(game, ['a7', 'a8', 'r']);
  const restored = restoreGame(game.serialize());
  assert.ok(restored);
  assert.equal(restored.chess.fen(), game.chess.fen());
  assert.equal(restored.chess.history({ verbose: true })[0].promotion, 'r');
});

test('reset preserves preferences and rejects invalid changes atomically', () => {
  const game = createGame({ mode: 'local', difficulty: 'seedling' });
  play(game, ['e2', 'e4']);
  const before = game.chess.fen();
  assert.throws(() => game.reset({ fen: 'broken' }));
  assert.equal(game.chess.fen(), before);
  game.reset();
  assert.equal(game.chess.history().length, 0);
  assert.equal(game.mode, 'local');
  assert.equal(game.difficulty, 'seedling');
});

test('each computer difficulty returns a legal move without changing the live game', () => {
  const game = createGame();
  play(game, ['e2', 'e4']);
  const before = game.chess.fen();
  for (const difficulty of ['seedling', 'garden', 'wildwood']) {
    const move = chooseComputerMove(before, difficulty);
    assert.ok(move);
    assert.ok(game.moves().some((candidate) => candidate.from === move.from && candidate.to === move.to));
    assert.equal(game.chess.fen(), before);
  }
  assert.equal(chooseComputerMove('broken'), null);
  assert.equal(chooseComputerMove('7k/5K2/6Q1/8/8/8/8/8 b - - 0 1'), null);
});

test('computer takes an immediate checkmate', () => {
  const game = createGame({ fen: '7k/8/5KQ1/8/8/8/8/8 w - - 0 1' });
  const move = chooseComputerMove(game.chess.fen(), 'garden');
  assert.ok(game.move(move));
  assert.equal(game.status().checkmate, true);
});
