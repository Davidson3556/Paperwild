import type { PieceSymbol } from './game.ts';

/** One shared clock for the checkmate finisher. The soundtrack is an original
 * 128 BPM "edit" cue: a one-beat freeze, a four-beat build, half a beat of
 * silence, a drop on the winning strike, four beats of groove and an outro.
 * Every visual beat below lands on that grid, in milliseconds from the start. */
const BEAT = 60000 / 128;
export const FINALE = Object.freeze({
  beatMs: BEAT,
  freezeEndMs: Math.round(BEAT),
  titleMs: Math.round(BEAT * 1.3),
  buildEndMs: Math.round(BEAT * 5),
  dashMs: Math.round(BEAT * 5.12),
  dropMs: Math.round(BEAT * 5.5),
  stampMs: Math.round(BEAT * 6.1),
  grooveEndMs: Math.round(BEAT * 9.5),
  outroMs: Math.round(BEAT * 10.4),
  durationMs: Math.round(BEAT * 11.5),
});

/** Every role has its own finishing-move name for the title card. */
export const FINISHER_NAMES: Readonly<Record<PieceSymbol, string>> = Object.freeze({
  p: 'Seedling Strike!',
  n: 'Hare-Raising Leap!',
  b: 'Midnight Moth-ion!',
  r: 'Timber-r-r!',
  q: 'Foxfire Finale!',
  k: 'Royal Waddle!',
});

/** Kick drums of the groove, for the camera shake and the soundtrack. */
export function finaleKicksMs(): readonly number[] {
  return Object.freeze(Array.from({ length: 4 }, (_, index) => Math.round(FINALE.dropMs + index * BEAT)));
}
