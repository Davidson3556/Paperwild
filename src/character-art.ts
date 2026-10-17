import type { Color, PieceSymbol } from './game.ts';

/** One cast is shared by the board, promotion choices and sideline portraits. */
export function characterArt(color: Color, type: PieceSymbol): string {
  return `/art/watercolor/web/${color}${type}.png`;
}
