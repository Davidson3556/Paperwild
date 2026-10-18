import type { PieceSymbol, Square } from './game.ts';
import { getPieceMotion } from './piece-motion.ts';

export type CaptureMotionPhase = 'approach' | 'faceoff' | 'scuffle' | 'victory' | 'claim';
export interface CaptureMotionPoint { readonly x: number; readonly y: number }
export interface CaptureMotionFrame extends CaptureMotionPoint {
  readonly offset: number;
  readonly rotation: number;
  readonly scaleX: number;
  readonly scaleY: number;
}
/** Painted hands, ears and wings follow named gestures in each phase. */
export type CaptureGesture = 'guard' | 'jab' | 'flail' | 'cheer' | 'dazed' | 'wave';
export interface CaptureMotionPlan {
  readonly type: PieceSymbol;
  readonly defenderType: PieceSymbol;
  readonly from: Square;
  readonly to: Square;
  readonly victimSquare: Square;
  readonly durationMs: number;
  /** Board coordinates: files increase x; ranks increase toward negative y. */
  readonly delta: CaptureMotionPoint;
  readonly victimDelta: CaptureMotionPoint;
  readonly direction: -1 | 1;
  readonly phases: readonly Readonly<{ name: CaptureMotionPhase; startMs: number; endMs: number }>[];
  readonly impactTimesMs: readonly number[];
  /** Where the dust cloud forms, relative to the victim's square. */
  readonly clash: CaptureMotionPoint;
  /** Where the dazed loser sits for the stretcher crew, relative to its square. */
  readonly defenderRest: CaptureMotionPoint;
  /** Cell offsets relative to the attacker's original square. */
  readonly attackerFrames: readonly CaptureMotionFrame[];
  /** Cell offsets relative to the victim's original square, including en passant. */
  readonly defenderFrames: readonly CaptureMotionFrame[];
  readonly attackerGestures: readonly Readonly<{ gesture: CaptureGesture; startMs: number; endMs: number }>[];
  readonly defenderGestures: readonly Readonly<{ gesture: CaptureGesture; startMs: number; endMs: number }>[];
  /** Hand-lettered sound effects that pop out of the cloud, one per impact. */
  readonly words: readonly string[];
  readonly victoryWord: string;
}

export const CAPTURE_MOTION_DURATION_MS = 2560;
/** The stretcher crew's separate trip: arrive, lift the loser, and carry it off. */
export const CAPTURE_PICKUP = Object.freeze({ durationMs: 1700, arriveMs: 560, liftMs: 820, departMs: 1000 });
const PHASES: CaptureMotionPlan['phases'] = Object.freeze([
  Object.freeze({ name: 'approach', startMs: 0, endMs: 560 }),
  Object.freeze({ name: 'faceoff', startMs: 560, endMs: 840 }),
  Object.freeze({ name: 'scuffle', startMs: 840, endMs: 1700 }),
  Object.freeze({ name: 'victory', startMs: 1700, endMs: 2200 }),
  Object.freeze({ name: 'claim', startMs: 2200, endMs: CAPTURE_MOTION_DURATION_MS }),
]);
const IMPACTS = Object.freeze([930, 1070, 1210, 1350, 1480, 1610]);
const CELL_UNITS = 107.5;

interface Style {
  readonly tussleLift: number; readonly victoryLift: number; readonly tilt: number; readonly squash: number;
  /** How far the winner bounces in and out of the scuffle. */
  readonly reach: number;
  readonly words: readonly string[];
  readonly victoryWord: string;
}
const STYLES: Readonly<Record<PieceSymbol, Style>> = {
  p: { tussleLift: .06, victoryLift: .30, tilt: 9, squash: .08, reach: .30, words: ['bonk!', 'pip!', 'bop!', 'nut!', 'boing!', 'pif!'], victoryWord: 'acorn power!' },
  n: { tussleLift: .16, victoryLift: .46, tilt: 12, squash: .12, reach: .36, words: ['thump!', 'boing!', 'thwap!', 'hop!', 'whump!', 'bip!'], victoryWord: 'hop-hooray!' },
  b: { tussleLift: .14, victoryLift: .40, tilt: 9, squash: .05, reach: .28, words: ['flutter!', 'fwip!', 'swish!', 'puff!', 'flap!', 'zip!'], victoryWord: 'by moonlight!' },
  r: { tussleLift: .04, victoryLift: .20, tilt: 7, squash: .10, reach: .24, words: ['thwack!', 'clonk!', 'bonk!', 'thud!', 'tok!', 'whack!'], victoryWord: 'rooted!' },
  q: { tussleLift: .13, victoryLift: .38, tilt: 12, squash: .10, reach: .38, words: ['pounce!', 'swat!', 'pow!', 'zing!', 'whisk!', 'pif!'], victoryWord: 'fabulous!' },
  k: { tussleLift: .05, victoryLift: .24, tilt: 8, squash: .08, reach: .22, words: ['harrumph!', 'oof!', 'bonk!', 'hmph!', 'thud!', 'pomp!'], victoryWord: 'quite right!' },
};

function displacement(from: Square, to: Square): CaptureMotionPoint {
  return Object.freeze({ x: to.charCodeAt(0) - from.charCodeAt(0), y: Number(from[1]) - Number(to[1]) });
}

/** A cartoon duel in five beats: the attacker sets off in its own gait, the two
 * square up, a dust cloud full of mittens and sound effects tumbles across the
 * square, the winner celebrates while the loser sees stars, and the winner
 * hops into the square it has earned. Positions use cell units, so the scene
 * can resize or cancel without this plan retaining layout or animation state.
 */
export function getCaptureMotion(type: PieceSymbol, from: Square, to: Square, victimSquare: Square = to, defenderType: PieceSymbol = 'p'): CaptureMotionPlan {
  const delta = displacement(from, to), victimDelta = displacement(from, victimSquare);
  const distance = Math.hypot(victimDelta.x, victimDelta.y);
  const direction: -1 | 1 = (victimDelta.x || delta.x) < 0 ? -1 : 1;
  const forward = distance ? { x: victimDelta.x / distance, y: victimDelta.y / distance } : { x: direction, y: 0 };
  // Multiply the perpendicular by facing so horizontal reflections preserve
  // exactly the same height and timing while reversing x and lean angles.
  const side = { x: -forward.y * direction, y: forward.x * direction };
  const gap = Math.min(.62, distance * .62);
  const stance = { x: victimDelta.x - forward.x * gap, y: victimDelta.y - forward.y * gap };
  const style = STYLES[type];
  const frame = (time: number, x: number, y: number, rotation = 0, scaleX = 1, scaleY = 1): CaptureMotionFrame => Object.freeze({
    offset: time / CAPTURE_MOTION_DURATION_MS, x, y, rotation: rotation === 0 ? 0 : rotation * direction, scaleX, scaleY,
  });
  const attacker = (time: number, reach = 0, sway = 0, lift = 0, lean = 0, scaleX = 1, scaleY = 1) => frame(
    time, stance.x + forward.x * reach + side.x * sway,
    stance.y + forward.y * reach + side.y * sway - lift, lean, scaleX, scaleY,
  );
  const defender = (time: number, retreat = 0, sway = 0, lift = 0, lean = 0, scaleX = 1, scaleY = 1) => frame(
    time, forward.x * retreat + side.x * sway,
    forward.y * retreat + side.y * sway - lift, lean, scaleX, scaleY,
  );

  // Approach in the attacker's own gait: acorns toddle, hares bound, moths
  // flutter, stumps shuffle, foxes pounce twice and badgers waddle.
  const approachEnd = PHASES[0].endMs;
  const gait = getPieceMotion(type, from, to);
  const attackerFrames: CaptureMotionFrame[] = [];
  for (const pose of gait.frames) {
    const time = pose.offset * approachEnd;
    if (time >= approachEnd) break;
    attackerFrames.push(frame(time, stance.x * pose.progress, stance.y * pose.progress - Math.min(.6, pose.lift / CELL_UNITS),
      pose.rotation * gait.direction, pose.scaleX, pose.scaleY));
  }
  attackerFrames.push(
    attacker(approachEnd, 0, 0, 0, 0, 1 + style.squash, 1 - style.squash),
    // Face-off: lean back, bump mittens, and settle into a ready crouch.
    attacker(640, -.09, 0, 0, -style.tilt * .8, .97, 1.04),
    attacker(700, .08, 0, style.tussleLift * .4, style.tilt * .5, 1.04, .96),
    attacker(770, -.05, 0, 0, -style.tilt * .4),
    attacker(840, 0, 0, 0, 0, 1 + style.squash * .7, 1 - style.squash * .7),
  );
  // Scuffle: dart into the cloud for each impact, wind up and bounce out again.
  IMPACTS.forEach((impact, index) => {
    const sway = (index % 2 ? 1 : -1) * .07;
    attackerFrames.push(
      attacker(impact - 55, style.reach * .35, -sway, 0, -style.tilt, 1 + style.squash * .6, 1 - style.squash * .6),
      attacker(impact, style.reach, sway, style.tussleLift * (index % 3 === 2 ? 1.6 : 1), style.tilt, 1.06, .94),
    );
  });
  attackerFrames.push(
    attacker(1700, .12, 0, 0, -style.tilt * .3),
    // Victory: crouch, leap with mittens raised, land, and add a smaller hop.
    attacker(1790, 0, 0, 0, 0, 1 + style.squash * 1.6, 1 - style.squash * 1.6),
    attacker(1930, 0, 0, style.victoryLift, -style.tilt * .5, .9, 1.13),
    attacker(2040, 0, 0, 0, style.tilt * .3, 1 + style.squash * 1.4, 1 - style.squash * 1.4),
    attacker(2120, 0, 0, style.victoryLift * .35, -style.tilt * .2, .97, 1.05),
    attacker(2200),
    // Claim: one proud hop into the centre of the square.
    attacker(2260, 0, 0, 0, -style.tilt * .4, 1 + style.squash, 1 - style.squash),
    frame(2400, stance.x + (delta.x - stance.x) * .55, stance.y + (delta.y - stance.y) * .55 - .24, style.tilt * .3, .95, 1.07),
    frame(2500, delta.x, delta.y, 0, 1 + style.squash * 1.3, 1 - style.squash * 1.3),
    frame(CAPTURE_MOTION_DURATION_MS, delta.x, delta.y),
  );

  // The loser startles, raises its guard, is drawn into the cloud, tumbles out
  // and sits beside the square with stars in its eyes.
  const rest = { x: forward.x * .3 + side.x * .34, y: forward.y * .3 + side.y * .34 };
  const toRest = (time: number, progress: number, lift = 0, lean = 0, scaleX = 1, scaleY = 1) =>
    frame(time, rest.x * progress, rest.y * progress - lift, lean, scaleX, scaleY);
  const defenderFrames: CaptureMotionFrame[] = [
    frame(0, 0, 0),
    defender(180, 0, 0, 0, 0, 1.06, .92),
    defender(250, 0, 0, .16, -4, .92, 1.1),
    defender(340, 0, 0, 0, 2, 1.07, .93),
    defender(450, .03, 0, 0, -5),
    defender(560, .02, 0, 0, -3, 1.03, .97),
    defender(700, .1, 0, .03, 8, .96, 1.04),
    defender(840, 0, 0, 0, -2),
  ];
  IMPACTS.forEach((impact, index) => {
    const sway = (index % 2 ? -1 : 1) * .06;
    defenderFrames.push(
      defender(impact - 55, -.12, sway, 0, 5, 1.03, .97),
      defender(impact, .06, -sway, .05 * (index % 2 + 1), -9 - index, .94, 1.06),
    );
  });
  defenderFrames.push(
    defender(1700, -.04, 0, 0, 4),
    toRest(1770, .45, .3, -24, .95, 1.05),
    toRest(1860, 1, 0, 14, 1.12, .86),
    toRest(1960, 1, 0, -11, .98, 1.02),
    toRest(2080, 1, 0, 9),
    toRest(2200, 1, 0, -7),
    toRest(2330, 1, 0, 5),
    toRest(2460, 1, 0, -3),
    toRest(CAPTURE_MOTION_DURATION_MS, 1),
  );
  const clash = { x: -forward.x * gap * .45, y: -forward.y * gap * .45 - .1 };
  return Object.freeze({
    type, defenderType, from, to, victimSquare, durationMs: CAPTURE_MOTION_DURATION_MS, delta, victimDelta, direction,
    phases: PHASES, impactTimesMs: IMPACTS,
    clash: Object.freeze(clash), defenderRest: Object.freeze(rest),
    attackerFrames: Object.freeze(attackerFrames), defenderFrames: Object.freeze(defenderFrames),
    attackerGestures: Object.freeze([
      Object.freeze({ gesture: 'guard' as const, startMs: 560, endMs: 840 }),
      Object.freeze({ gesture: 'jab' as const, startMs: 840, endMs: 1700 }),
      Object.freeze({ gesture: 'cheer' as const, startMs: 1700, endMs: 2240 }),
      Object.freeze({ gesture: 'wave' as const, startMs: 2240, endMs: CAPTURE_MOTION_DURATION_MS }),
    ]),
    defenderGestures: Object.freeze([
      Object.freeze({ gesture: 'flail' as const, startMs: 180, endMs: 560 }),
      Object.freeze({ gesture: 'guard' as const, startMs: 560, endMs: 840 }),
      Object.freeze({ gesture: 'flail' as const, startMs: 840, endMs: 1700 }),
      Object.freeze({ gesture: 'dazed' as const, startMs: 1700, endMs: CAPTURE_MOTION_DURATION_MS }),
    ]),
    words: Object.freeze(style.words), victoryWord: style.victoryWord,
  });
}
