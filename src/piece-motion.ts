import type { PieceSymbol, Square } from './game.ts';

export type MotionProfile = 'walk' | 'leap' | 'flutter' | 'shuffle' | 'pounce' | 'waddle';
export interface MotionFrame {
  offset: number;
  progress: number;
  /** Height above the paper in the board's 1000-unit coordinate system. */
  lift: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}
export interface FootContact { atMs: number; foot: 'left' | 'right' | 'both' }
export interface PieceMotionPlan {
  type: PieceSymbol;
  profile: MotionProfile;
  durationMs: number;
  landingTimeMs: number;
  direction: -1 | 1;
  contactTimesMs: readonly number[];
  contacts: readonly FootContact[];
  frames: readonly MotionFrame[];
}

const frame = (offset: number, progress: number, lift = 0, rotation = 0, scaleX = 1, scaleY = 1): MotionFrame => ({ offset, progress, lift, rotation, scaleX, scaleY });

/** Deterministic choreography shared by the renderer and its sound score. */
export function getPieceMotion(type: PieceSymbol, from: Square, to: Square): PieceMotionPlan {
  const dx = to.charCodeAt(0) - from.charCodeAt(0), dy = Number(to[1]) - Number(from[1]);
  const distance = Math.max(Math.abs(dx), Math.abs(dy));
  const direction: -1 | 1 = dx < 0 ? -1 : 1;
  let profile: MotionProfile, durationMs: number, landingOffset: number, frames: MotionFrame[], steps: readonly number[];
  switch (type) {
    case 'p':
      profile = 'walk'; durationMs = Math.min(790, 650 + distance * 35); landingOffset = .90; steps = [.24, .46, .68, .90];
      frames = [frame(0, 0), frame(.08, 0, 0, -3, 1.04, .92), frame(.16, .10, 5, -4), frame(.24, .23, 0, 4, 1.02, .97), frame(.35, .36, 6, 0), frame(.46, .48, 0, -4, 1.02, .97), frame(.57, .60, 6, 0), frame(.68, .73, 0, 4, 1.02, .97), frame(.79, .85, 5, 0), frame(.90, 1, 0, -3, 1.03, .96), frame(1, 1)];
      break;
    case 'n':
      profile = 'leap'; durationMs = 840; landingOffset = .78; steps = [.78];
      frames = [frame(0, 0), frame(.10, 0, 0, -6, 1.13, .82), frame(.17, 0, 0, -9, 1.19, .71), frame(.25, .09, 28, -6, .89, 1.15), frame(.43, .43, 80, -3, 1.08, .95), frame(.58, .73, 69, 6, 1.13, .91), frame(.73, .97, 18, 9, 1.01, 1.10), frame(.78, 1, 0, 5, 1.23, .73), frame(.88, 1, 0, -3, .94, 1.07), frame(1, 1)];
      break;
    case 'b':
      profile = 'flutter'; durationMs = 820; landingOffset = .92; steps = [.22, .38, .54, .70, .92];
      frames = [frame(0, 0), frame(.10, 0, 5, -2, .97, 1.02), frame(.22, .16, 26, -7, .96, 1.04), frame(.38, .35, 35, 5), frame(.54, .56, 26, -5, .97, 1.03), frame(.70, .77, 32, 5), frame(.84, .94, 14, -3), frame(.92, 1, 0, 0, 1.03, .97), frame(1, 1)];
      break;
    case 'r':
      profile = 'shuffle'; durationMs = Math.min(850, 740 + distance * 16); landingOffset = .91; steps = [.25, .47, .69, .91];
      frames = [frame(0, 0), frame(.10, 0, 0, -6, 1.02, .97), frame(.18, .10, 3, -8), frame(.25, .23, 0, 5, 1.04, .94), frame(.36, .36, 5, 8), frame(.47, .48, 0, -5, 1.04, .94), frame(.58, .60, 4, -8), frame(.69, .73, 0, 5, 1.04, .94), frame(.80, .86, 3, 7), frame(.91, 1, 0, 0, 1.05, .93), frame(1, 1)];
      break;
    case 'q':
      profile = 'pounce'; durationMs = 790; landingOffset = .87; steps = [.43, .87];
      frames = [frame(0, 0), frame(.10, 0, 0, -7, 1.11, .84), frame(.20, .10, 28, -10, 1.15, .90), frame(.31, .30, 34, 4, 1.11, .95), frame(.43, .49, 0, 7, 1.18, .81), frame(.51, .50, 0, -5, 1.06, .88), frame(.62, .64, 37, -8, 1.14, .93), frame(.75, .88, 27, 5, 1.09, .97), frame(.87, 1, 0, 4, 1.16, .84), frame(1, 1)];
      break;
    case 'k':
      profile = 'waddle'; durationMs = Math.min(850, 810 + distance * 20); landingOffset = .90; steps = [.28, .58, .90];
      frames = [frame(0, 0), frame(.10, 0, 0, -6, 1.05, .96), frame(.20, .13, 7, -10, .97, 1.02), frame(.28, .29, 0, 7, 1.07, .93), frame(.43, .44, 8, 10, .97, 1.02), frame(.58, .62, 0, -7, 1.07, .93), frame(.74, .81, 7, -10, .97, 1.02), frame(.90, 1, 0, 3, 1.10, .91), frame(1, 1)];
      break;
  }
  frames = frames.map(pose => ({ ...pose, rotation: pose.rotation * direction }));
  const contacts = steps.map((offset, index): FootContact => ({ atMs: Math.round(offset * durationMs), foot: type === 'n' || type === 'q' || type === 'b' ? 'both' : index % 2 ? 'right' : 'left' }));
  return { type, profile, durationMs, direction, landingTimeMs: Math.round(landingOffset * durationMs), contacts, contactTimesMs: contacts.map(contact => contact.atMs), frames };
}
