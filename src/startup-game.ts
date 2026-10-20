import { createGame, restoreGame } from './game.ts';
import type { ConservatoryGame, SavedGame } from './game.ts';
import { DEFAULT_POSITION } from 'chess.js';

export interface FinishedGameRecord { game: SavedGame; study: string | null }

/** A revisit must never replace an in-progress game or an untouched study. */
export function canRevisitFinishedGame(game: ConservatoryGame, hasActiveStudy: boolean): boolean {
  return !hasActiveStudy && !game.chess.history().length && game.chess.fen() === DEFAULT_POSITION;
}

/** Revalidate an archive instead of trusting persisted board or study data. */
export function restoreFinishedGame(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as { game?: unknown; study?: unknown };
  const game = restoreGame(record.game);
  if (!game?.status().over) return null;
  return { game, study: typeof record.study === 'string' ? record.study : null };
}

/** The original terminal save must survive if the archive cannot be written. */
export function preserveFinishedGame(record: FinishedGameRecord | null, write: (record: FinishedGameRecord) => void): boolean {
  if (!record) return true;
  try { write(record); return true; }
  catch { return false; }
}

/** Resume an unfinished chapter; a completed one should not greet a returning
 * player with a locked board or a game-over dialog. Keep their play settings. */
export function createStartupGame(saved: unknown, study: unknown = null) {
  const restored = restoreGame(saved);
  if (restored && !restored.status().over) return { game: restored, resumed: true, finished: null };
  return {
    game: createGame(restored ? { mode: restored.mode, difficulty: restored.difficulty } : undefined),
    resumed: false,
    finished: restored ? { game: restored.serialize(), study: typeof study === 'string' ? study : null } : null,
  };
}
