import { Chess } from 'chess.js';

export const PIECE_NAMES = Object.freeze({
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
});

const MODES = new Set(['computer', 'local']);
const DEPTHS = Object.freeze({ seedling: 1, garden: 2, wildwood: 3 });
const PROMOTIONS = new Set(['q', 'r', 'b', 'n']);
const SQUARE = /^[a-h][1-8]$/;

function validatePreferences(mode, difficulty) {
  if (!MODES.has(mode)) throw new TypeError(`Unknown game mode: ${mode}`);
  if (!Object.hasOwn(DEPTHS, difficulty)) {
    throw new TypeError(`Unknown difficulty: ${difficulty}`);
  }
}

function moveCoordinates(move) {
  const result = { from: move.from, to: move.to };
  if (move.promotion) result.promotion = move.promotion;
  return result;
}

class ConservatoryGame {
  #initialFen;
  #mode;
  #difficulty;

  constructor({ fen, mode = 'computer', difficulty = 'garden' } = {}) {
    validatePreferences(mode, difficulty);
    this.chess = new Chess(fen);
    this.#initialFen = this.chess.fen();
    this.#mode = mode;
    this.#difficulty = difficulty;
  }

  get mode() { return this.#mode; }
  set mode(value) {
    validatePreferences(value, this.#difficulty);
    this.#mode = value;
  }

  get difficulty() { return this.#difficulty; }
  set difficulty(value) {
    validatePreferences(this.#mode, value);
    this.#difficulty = value;
  }

  moves(square) {
    if (square !== undefined && (typeof square !== 'string' || !SQUARE.test(square))) return [];
    if (this.chess.isGameOver()) return [];
    return this.chess.moves({ ...(square === undefined ? {} : { square }), verbose: true });
  }

  move(input) {
    if (!input || typeof input !== 'object' || this.chess.isGameOver()) return null;
    const { from, to, promotion } = input;
    if (typeof from !== 'string' || !SQUARE.test(from)
      || typeof to !== 'string' || !SQUARE.test(to)
      || (promotion !== undefined && !PROMOTIONS.has(promotion))) return null;
    try {
      // Queen is the default for callers without a promotion chooser.
      return this.chess.move({ from, to, promotion: promotion ?? 'q' });
    } catch {
      return null;
    }
  }

  undoTurn() {
    const last = this.chess.history({ verbose: true }).at(-1);
    if (!last) return [];
    const count = this.#mode === 'computer' && last.color === 'b' ? 2 : 1;
    const undone = [];
    for (let i = 0; i < count; i += 1) {
      const move = this.chess.undo();
      if (move) undone.push(move);
    }
    return undone;
  }

  reset({ fen, mode = this.#mode, difficulty = this.#difficulty } = {}) {
    validatePreferences(mode, difficulty);
    // Validate everything before replacing a game that might be in progress.
    const replacement = new Chess(fen);
    this.chess = replacement;
    this.#initialFen = replacement.fen();
    this.#mode = mode;
    this.#difficulty = difficulty;
    return this;
  }

  status() {
    const turn = this.chess.turn();
    const check = this.chess.isCheck();
    const checkmate = this.chess.isCheckmate();
    const stalemate = this.chess.isStalemate();
    const draw = this.chess.isDraw();
    const over = this.chess.isGameOver();
    const winner = checkmate ? (turn === 'w' ? 'b' : 'w') : null;
    let text;
    if (checkmate) text = `Checkmate · ${winner === 'w' ? 'White' : 'Black'} wins`;
    else if (stalemate) text = 'Draw · stalemate';
    else if (this.chess.isThreefoldRepetition()) text = 'Draw · threefold repetition';
    else if (this.chess.isInsufficientMaterial()) text = 'Draw · insufficient material';
    else if (this.chess.isDrawByFiftyMoves()) text = 'Draw · fifty-move rule';
    else if (draw) text = 'Draw';
    else text = `${turn === 'w' ? 'White' : 'Black'} to move${check ? ' · check' : ''}`;
    return { turn, over, check, checkmate, stalemate, draw, winner, text };
  }

  captures() {
    return this.chess.history({ verbose: true })
      .filter((move) => move.captured)
      .map((move) => ({
        color: move.color === 'w' ? 'b' : 'w',
        type: move.captured,
        by: move.color,
        moveNumber: Number(move.before.split(' ')[5]),
      }));
  }

  serialize() {
    return {
      initialFen: this.#initialFen,
      history: this.chess.history({ verbose: true }).map(moveCoordinates),
      mode: this.#mode,
      difficulty: this.#difficulty,
    };
  }
}

export function createGame(options) {
  return new ConservatoryGame(options);
}

export function restoreGame(data) {
  try {
    if (!data || typeof data !== 'object' || Array.isArray(data)
      || typeof data.initialFen !== 'string' || !Array.isArray(data.history)
      || !MODES.has(data.mode) || !Object.hasOwn(DEPTHS, data.difficulty)) return null;
    const game = createGame({ fen: data.initialFen, mode: data.mode, difficulty: data.difficulty });
    for (const move of data.history) {
      if (!move || typeof move !== 'object' || Array.isArray(move) || !game.move(move)) return null;
    }
    return game;
  } catch {
    return null;
  }
}

const VALUES = Object.freeze({ p: 100, n: 320, b: 335, r: 500, q: 900, k: 0 });
const MATE = 100_000;
const SEARCH_LIMIT = Symbol('search limit');

function evaluate(chess) {
  const board = chess.board();
  let material = 0;
  for (const row of board) {
    for (const piece of row) {
      if (piece && piece.type !== 'p') material += VALUES[piece.type];
    }
  }
  const endgame = material < 2_600;
  let score = 0;
  for (let row = 0; row < 8; row += 1) {
    for (let file = 0; file < 8; file += 1) {
      const piece = board[row][file];
      if (!piece) continue;
      const rank = piece.color === 'w' ? 7 - row : row;
      const centrality = 7 - Math.abs(file - 3.5) - Math.abs(row - 3.5);
      let position = 0;
      switch (piece.type) {
        case 'p':
          position = rank * (endgame ? 12 : 7) + (3.5 - Math.abs(file - 3.5)) * 4;
          break;
        case 'n': position = centrality * 11 - (rank === 0 ? 12 : 0); break;
        case 'b': position = centrality * 5 + (rank > 0 ? 12 : 0); break;
        case 'r': position = rank === 6 ? 22 : rank * 2; break;
        case 'q': position = centrality * 3; break;
        case 'k':
          position = endgame
            ? centrality * 9
            : -centrality * 8 + (rank === 0 && (file <= 2 || file >= 6) ? 35 : 0);
          break;
      }
      score += (VALUES[piece.type] + position) * (piece.color === 'w' ? 1 : -1);
    }
  }
  return score * (chess.turn() === 'w' ? 1 : -1);
}

function orderMoves(moves) {
  const priority = (move) => (move.captured ? 10 * VALUES[move.captured] - VALUES[move.piece] : 0)
    + (move.promotion ? VALUES[move.promotion] : 0)
    + (move.san.includes('+') || move.san.includes('#') ? 45 : 0)
    + (move.flags.includes('k') || move.flags.includes('q') ? 25 : 0);
  return moves.sort((a, b) => priority(b) - priority(a));
}

/** Returns a legal move from an isolated position, with a bounded alpha-beta search. */
export function chooseComputerMove(fen, difficulty = 'garden') {
  let chess;
  try { chess = new Chess(fen); } catch { return null; }
  if (chess.isGameOver()) return null;
  const targetDepth = DEPTHS[difficulty] ?? DEPTHS.garden;
  const candidates = orderMoves(chess.moves({ verbose: true }));
  let best = candidates[0];
  let nodes = 0;
  const deadline = Date.now() + 850;

  function search(depth, alpha, beta, ply) {
    nodes += 1;
    if (nodes > 30_000 || (nodes % 64 === 0 && Date.now() > deadline)) throw SEARCH_LIMIT;
    if (chess.isCheckmate()) return -MATE + ply;
    if (chess.isDraw()) return 0;
    if (depth === 0) return evaluate(chess);
    let value = -Infinity;
    for (const move of orderMoves(chess.moves({ verbose: true }))) {
      chess.move(moveCoordinates(move));
      let child;
      try { child = -search(depth - 1, -beta, -alpha, ply + 1); }
      finally { chess.undo(); }
      value = Math.max(value, child);
      alpha = Math.max(alpha, child);
      if (alpha >= beta) break;
    }
    return value;
  }

  // Iterative deepening keeps a fully evaluated answer if the browser budget expires.
  for (let depth = 1; depth <= targetDepth; depth += 1) {
    let iterationBest = best;
    let alpha = -Infinity;
    try {
      const ordered = [best, ...candidates.filter((move) => move !== best)];
      for (const move of ordered) {
        chess.move(moveCoordinates(move));
        let score;
        try { score = -search(depth - 1, -Infinity, -alpha, 1); }
        finally { chess.undo(); }
        if (score > alpha) {
          alpha = score;
          iterationBest = move;
        }
      }
      best = iterationBest;
      if (alpha >= MATE - 100) break;
    } catch (error) {
      if (error !== SEARCH_LIMIT) throw error;
      break;
    }
  }
  return best ? moveCoordinates(best) : null;
}
