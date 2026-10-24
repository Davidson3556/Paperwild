import type { MoveCoordinates, SavedGame } from './game.ts';
import type { OnlineRoomSnapshot } from './online-types.ts';

export interface DisplayedOnlineGame {
  code: string;
  round: number;
  game: SavedGame;
}

export type OnlineSyncPlan =
  | { kind: 'same' }
  | { kind: 'append'; moves: MoveCoordinates[] }
  | { kind: 'restore'; reason: 'first' | 'round' | 'rewind' | 'diverged' };

/** Decide which authoritative moves can safely pass through the normal animation path. */
export function planOnlineSync(
  displayed: DisplayedOnlineGame | null,
  incoming: Pick<OnlineRoomSnapshot, 'code' | 'round' | 'game'>,
): OnlineSyncPlan {
  if (!displayed || displayed.code !== incoming.code) return { kind: 'restore', reason: 'first' };
  if (displayed.round !== incoming.round) return { kind: 'restore', reason: 'round' };
  if (displayed.game.initialFen !== incoming.game.initialFen) return { kind: 'restore', reason: 'diverged' };

  const previous = displayed.game.history;
  const next = incoming.game.history;
  for (let index = 0; index < Math.min(previous.length, next.length); index += 1) {
    const before = previous[index];
    const after = next[index];
    if (before.from !== after.from || before.to !== after.to || before.promotion !== after.promotion) {
      return { kind: 'restore', reason: 'diverged' };
    }
  }
  if (next.length < previous.length) return { kind: 'restore', reason: 'rewind' };
  if (next.length === previous.length) return { kind: 'same' };
  return { kind: 'append', moves: next.slice(previous.length).map((move) => ({ ...move })) };
}
