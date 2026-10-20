import { Chess } from 'chess.js';
import type { Color, Move, PieceSymbol, Square } from 'chess.js';

export type { Color, Move, PieceSymbol, Square };
export type GameMode = 'computer' | 'local';
export type Difficulty = 'seedling' | 'garden' | 'wildwood';
export type PromotionPiece = 'q' | 'r' | 'b' | 'n';

export interface MoveInput {
  from: string;
  to: string;
  promotion?: string;
}

export interface MoveCoordinates {
  from: Square;
  to: Square;
  promotion?: PieceSymbol;
}

export interface GameOptions {
  fen?: string;
  mode?: GameMode;
  difficulty?: Difficulty;
}

export interface GameStatus {
  turn: Color;
  over: boolean;
  check: boolean;
  checkmate: boolean;
  stalemate: boolean;
  draw: boolean;
  winner: Color | null;
  text: string;
}

export interface Capture {
  color: Color;
  type: PieceSymbol;
  by: Color;
  moveNumber: number;
}

/** Everything a send-off needs to tell the fallen piece's own story. */
export interface CaptureStory extends Capture {
  /** Where it fell. For en passant this differs from the capturing move's destination. */
  square: Square;
  /** Its starting square in this game, which gives every resident a lasting identity. */
  origin: Square;
  /** The piece it started as; a promoted pawn keeps its pawn identity. */
  originType: PieceSymbol;
  capturer: PieceSymbol;
  capturerOrigin: Square;
  capturerOriginType: PieceSymbol;
  /** How many moves it made, and how many squares it travelled, before falling. */
  moves: number;
  steps: number;
}

export interface SavedGame {
  initialFen: string;
  history: MoveCoordinates[];
  mode: GameMode;
  difficulty: Difficulty;
}

export const PIECE_NAMES: Readonly<Record<PieceSymbol, string>> = Object.freeze({
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
});

const MODES: ReadonlySet<string> = new Set<GameMode>(['computer', 'local']);
const DEPTHS: Readonly<Record<Difficulty, number>> = Object.freeze({ seedling: 1, garden: 2, wildwood: 3 });
const PROMOTIONS: ReadonlySet<string> = new Set<PromotionPiece>(['q', 'r', 'b', 'n']);
const SQUARE = /^[a-h][1-8]$/;

export const isGameMode = (value: unknown): value is GameMode => typeof value === 'string' && MODES.has(value);
export const isDifficulty = (value: unknown): value is Difficulty => typeof value === 'string' && Object.hasOwn(DEPTHS, value);
const isSquare = (value: unknown): value is Square => typeof value === 'string' && SQUARE.test(value);

function validatePreferences(mode: unknown, difficulty: unknown): void {
  if (!isGameMode(mode)) throw new TypeError(`Unknown game mode: ${String(mode)}`);
  if (!isDifficulty(difficulty)) {
    throw new TypeError(`Unknown difficulty: ${String(difficulty)}`);
  }
}

function moveCoordinates(move: Move): MoveCoordinates {
  const result: MoveCoordinates = { from: move.from, to: move.to };
  if (move.promotion) result.promotion = move.promotion;
  return result;
}

export class ConservatoryGame {
  chess: Chess;
  #initialFen: string;
  #mode: GameMode;
  #difficulty: Difficulty;

  constructor({ fen, mode = 'computer', difficulty = 'garden' }: GameOptions = {}) {
    validatePreferences(mode, difficulty);
    this.chess = new Chess(fen);
    this.#initialFen = this.chess.fen();
    this.#mode = mode;
    this.#difficulty = difficulty;
  }

  get mode(): GameMode { return this.#mode; }
  set mode(value: GameMode) {
    validatePreferences(value, this.#difficulty);
    this.#mode = value;
  }

  get difficulty(): Difficulty { return this.#difficulty; }
  set difficulty(value: Difficulty) {
    validatePreferences(this.#mode, value);
    this.#difficulty = value;
  }

  moves(square?: unknown): Move[] {
    if (square !== undefined && !isSquare(square)) return [];
    if (this.chess.isGameOver()) return [];
    return square === undefined
      ? this.chess.moves({ verbose: true })
      : this.chess.moves({ square, verbose: true });
  }

  move(input: unknown): Move | null {
    if (!input || typeof input !== 'object' || this.chess.isGameOver()) return null;
    const { from, to, promotion } = input as Partial<Record<keyof MoveInput, unknown>>;
    if (!isSquare(from) || !isSquare(to)
      || (promotion !== undefined && (typeof promotion !== 'string' || !PROMOTIONS.has(promotion)))) return null;
    try {
      // Queen is the default for callers without a promotion chooser.
      return this.chess.move({ from, to, promotion: promotion ?? 'q' });
    } catch {
      return null;
    }
  }

  undoTurn(): Move[] {
    const last = this.chess.history({ verbose: true }).at(-1);
    if (!last) return [];
    const count = this.#mode === 'computer' && last.color === 'b' ? 2 : 1;
    const undone: Move[] = [];
    for (let i = 0; i < count; i += 1) {
      const move = this.chess.undo();
      if (move) undone.push(move);
    }
    return undone;
  }

  reset({ fen, mode = this.#mode, difficulty = this.#difficulty }: GameOptions = {}): this {
    validatePreferences(mode, difficulty);
    // Validate everything before replacing a game that might be in progress.
    const replacement = new Chess(fen);
    this.chess = replacement;
    this.#initialFen = replacement.fen();
    this.#mode = mode;
    this.#difficulty = difficulty;
    return this;
  }

  status(): GameStatus {
    const turn = this.chess.turn();
    const check = this.chess.isCheck();
    const checkmate = this.chess.isCheckmate();
    const stalemate = this.chess.isStalemate();
    const draw = this.chess.isDraw();
    const over = this.chess.isGameOver();
    const winner: Color | null = checkmate ? (turn === 'w' ? 'b' : 'w') : null;
    let text: string;
    if (checkmate) text = `Checkmate · ${winner === 'w' ? 'White' : 'Black'} wins`;
    else if (stalemate) text = 'Draw · stalemate';
    else if (this.chess.isThreefoldRepetition()) text = 'Draw · threefold repetition';
    else if (this.chess.isInsufficientMaterial()) text = 'Draw · insufficient material';
    else if (this.chess.isDrawByFiftyMoves()) text = 'Draw · fifty-move rule';
    else if (draw) text = 'Draw';
    else text = `${turn === 'w' ? 'White' : 'Black'} to move${check ? ' · check' : ''}`;
    return { turn, over, check, checkmate, stalemate, draw, winner, text };
  }

  captures(): Capture[] {
    return this.chess.history({ verbose: true })
      .filter((move): move is Move & { captured: PieceSymbol } => Boolean(move.captured))
      .map((move) => ({
        color: move.color === 'w' ? 'b' : 'w',
        type: move.captured,
        by: move.color,
        moveNumber: Number(move.before.split(' ')[5]),
      }));
  }

  /** Replays the game from its start, following each piece from its starting
   * square through moves, castling, promotion and en passant. */
  captureStories(): CaptureStory[] {
    interface Identity { origin: Square; originType: PieceSymbol; moves: number; steps: number }
    const start = new Chess(this.#initialFen);
    const identities = new Map<Square, Identity>();
    for (const row of start.board()) for (const piece of row) {
      if (piece) identities.set(piece.square, { origin: piece.square, originType: piece.type, moves: 0, steps: 0 });
    }
    const relocate = (from: Square, to: Square) => {
      const identity = identities.get(from);
      if (!identity) return;
      identities.delete(from);
      identity.moves += 1;
      identity.steps += Math.max(Math.abs(from.charCodeAt(0) - to.charCodeAt(0)), Math.abs(Number(from[1]) - Number(to[1])));
      identities.set(to, identity);
    };
    const stories: CaptureStory[] = [];
    for (const move of this.chess.history({ verbose: true })) {
      if (move.captured) {
        const square = (move.flags.includes('e') ? `${move.to[0]}${move.from[1]}` : move.to) as Square;
        const victim = identities.get(square) ?? { origin: square, originType: move.captured, moves: 0, steps: 0 };
        const capturer = identities.get(move.from) ?? { origin: move.from, originType: move.piece, moves: 0, steps: 0 };
        stories.push({
          color: move.color === 'w' ? 'b' : 'w', type: move.captured, by: move.color,
          moveNumber: Number(move.before.split(' ')[5]),
          square, origin: victim.origin, originType: victim.originType,
          capturer: move.piece, capturerOrigin: capturer.origin, capturerOriginType: capturer.originType,
          moves: victim.moves, steps: victim.steps,
        });
        identities.delete(square);
      }
      relocate(move.from, move.to);
      if (move.flags.includes('k') || move.flags.includes('q')) {
        const rank = move.from[1], kingSide = move.flags.includes('k');
        relocate(`${kingSide ? 'h' : 'a'}${rank}` as Square, `${kingSide ? 'f' : 'd'}${rank}` as Square);
      }
    }
    return stories;
  }

  serialize(): SavedGame {
    return {
      initialFen: this.#initialFen,
      history: this.chess.history({ verbose: true }).map(moveCoordinates),
      mode: this.#mode,
      difficulty: this.#difficulty,
    };
  }
}

export function createGame(options?: GameOptions): ConservatoryGame {
  return new ConservatoryGame(options);
}

export function restoreGame(data: unknown): ConservatoryGame | null {
  try {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const { initialFen, history, mode, difficulty } = data as Partial<Record<keyof SavedGame, unknown>>;
    if (typeof initialFen !== 'string' || !Array.isArray(history)
      || !isGameMode(mode) || !isDifficulty(difficulty)) return null;
    const game = createGame({ fen: initialFen, mode, difficulty });
    for (const move of history) {
      if (!move || typeof move !== 'object' || Array.isArray(move) || !game.move(move)) return null;
    }
    return game;
  } catch {
    return null;
  }
}

const VALUES: Readonly<Record<PieceSymbol, number>> = Object.freeze({ p: 100, n: 320, b: 335, r: 500, q: 900, k: 0 });
const MATE = 100_000;
const SEARCH_LIMIT = Symbol('search limit');

function evaluate(chess: Chess): number {
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

function orderMoves(moves: Move[]): Move[] {
  const priority = (move: Move) => (move.captured ? 10 * VALUES[move.captured] - VALUES[move.piece] : 0)
    + (move.promotion ? VALUES[move.promotion] : 0)
    + (move.san.includes('+') || move.san.includes('#') ? 45 : 0)
    + (move.flags.includes('k') || move.flags.includes('q') ? 25 : 0);
  return moves.sort((a, b) => priority(b) - priority(a));
}

/** Returns a legal move from an isolated position, with a bounded alpha-beta search. */
export function chooseComputerMove(fen: string, difficulty: Difficulty = 'garden'): MoveCoordinates | null {
  let chess: Chess;
  try { chess = new Chess(fen); } catch { return null; }
  if (chess.isGameOver()) return null;
  const targetDepth = DEPTHS[difficulty] ?? DEPTHS.garden;
  const candidates = orderMoves(chess.moves({ verbose: true }));
  let best: Move | undefined = candidates[0];
  let nodes = 0;
  const deadline = Date.now() + 850;

  function search(depth: number, alpha: number, beta: number, ply: number): number {
    nodes += 1;
    if (nodes > 30_000 || (nodes % 64 === 0 && Date.now() > deadline)) throw SEARCH_LIMIT;
    if (chess.isCheckmate()) return -MATE + ply;
    if (chess.isDraw()) return 0;
    if (depth === 0) return evaluate(chess);
    let value = -Infinity;
    for (const move of orderMoves(chess.moves({ verbose: true }))) {
      chess.move(moveCoordinates(move));
      let child: number;
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
    let iterationBest: Move | undefined = best;
    let alpha = -Infinity;
    try {
      const ordered: (Move | undefined)[] = [best, ...candidates.filter((move) => move !== best)];
      for (const move of ordered) {
        if (!move) continue;
        chess.move(moveCoordinates(move));
        let score: number;
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
