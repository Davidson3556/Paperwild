import type { Color } from './game.ts';
import type { IdlePart, Point } from './character-rig-types.ts';

/** Knitted club mittens. Amber and indigo match each side's scarf, so every
 * resident carries its team on both hands as well as around its neck. */
export const TEAM_COLORS: Readonly<Record<Color, Readonly<{ palm: string; shade: string; cuff: string; knit: string; ink: string; wash: string }>>> = {
  w: { palm: '#ff9b2b', shade: '#e8691a', cuff: '#c24d1c', knit: '#8a3410', ink: '#7a3d1c', wash: '#f6a13c' },
  b: { palm: '#6681cb', shade: '#4762ad', cuff: '#33478c', knit: '#202f68', ink: '#26315a', wash: '#5d70b8' },
};

const SVG_NS = 'http://www.w3.org/2000/svg';
let mittenId = 0;

/** The paw's centre and the direction from the joint, in 1254px source units. */
export function handPlacement(part: IdlePart): { x: number; y: number; angle: number; scale: number } {
  const [ox, oy] = part.origin;
  const distance = ([x, y]: Point) => Math.hypot(x - ox, y - oy);
  const reach = Math.max(...part.outline.map(distance));
  // The outer 45% of the cutout is the paw itself; its centroid sits under the palm.
  const distal = part.outline.filter(point => distance(point) >= reach * .55);
  const x = distal.reduce((sum, [px]) => sum + px, 0) / distal.length;
  const y = distal.reduce((sum, [, py]) => sum + py, 0) / distal.length;
  const angle = Math.atan2(y - oy, x - ox) * 180 / Math.PI;
  return { x, y, angle, scale: Math.min(1.06, Math.max(.9, reach / 220)) };
}

/** One mitten drawn in a 1254px square, ready to share its hand's transform. */
export function createMitten(color: Color, part: IdlePart): SVGSVGElement {
  const team = TEAM_COLORS[color];
  const { x, y, angle, scale } = handPlacement(part);
  const id = `paperwild-mitten-${++mittenId}`;
  // Keep the thumb on the upper edge however the arm points.
  const flip = Math.cos(angle * Math.PI / 180) < 0 ? -1 : 1;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'character-mitten');
  svg.setAttribute('viewBox', '0 0 1254 1254');
  svg.setAttribute('preserveAspectRatio', 'xMidYMax meet');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.dataset.team = color;
  svg.innerHTML = `<defs><radialGradient id="${id}" cx="38%" cy="32%" r="78%"><stop offset="0" stop-color="#fff6dd" stop-opacity=".55"/><stop offset=".32" stop-color="${team.palm}"/><stop offset="1" stop-color="${team.shade}"/></radialGradient></defs>
  <g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${angle.toFixed(1)}) scale(${(scale * 1.08).toFixed(3)} ${(scale * 1.08 * flip).toFixed(3)})" stroke="${team.ink}" stroke-linecap="round" stroke-linejoin="round">
    <path class="mitten-cuff" d="M-96-42q-8 42 0 86l48 4q-7-47 0-94Z" fill="${team.cuff}" stroke-width="1.15" vector-effect="non-scaling-stroke"/>
    <path d="M-86-38q-4 38 1 78m12-80q-5 40 0 82m13-82q-4 41 0 83" fill="none" stroke="${team.knit}" stroke-width=".7" opacity=".7" vector-effect="non-scaling-stroke"/>
    <path class="mitten-thumb" d="M-26-34q-10-38 18-46 30-7 33 18 2 20-19 31" fill="url(#${id})" stroke-width="1.1" vector-effect="non-scaling-stroke"/>
    <path class="mitten-palm" d="M-52-44q32-22 84-20 46 3 56 38 9 34-14 62-26 30-74 26-34-3-52-16-12-44 0-90Z" fill="url(#${id})" stroke-width="1.2" vector-effect="non-scaling-stroke"/>
    <path d="M18-38q24 2 36 18m-24 52q22-4 34-20" fill="none" stroke="${team.knit}" stroke-width=".65" opacity=".45" vector-effect="non-scaling-stroke"/>
    <path d="M-30-38q20-9 44-8" fill="none" stroke="#fff8e6" stroke-width="1.1" opacity=".75" vector-effect="non-scaling-stroke"/>
  </g>`;
  return svg;
}

const ARM_REACH: Readonly<Record<string, number>> = { p: 80, r: 72, n: 46, b: 50, q: 48, k: 50 };

/** Degrees that rotate a hand toward the sky, clamped so tucked paws stay near the chest. */
export function handRaise(part: IdlePart, type: string): number {
  const { angle } = handPlacement(part);
  let turn = -90 - angle;
  while (turn > 180) turn -= 360;
  while (turn <= -180) turn += 360;
  const limit = ARM_REACH[type] ?? 50;
  return Math.max(-limit, Math.min(limit, turn));
}

/** A standalone mitten for cartoon dust clouds, pointing right from its cuff. */
export function mittenGlyph(color: Color, className = 'pop-mitten'): SVGSVGElement {
  const team = TEAM_COLORS[color];
  const id = `paperwild-glyph-${++mittenId}`;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('viewBox', '-110 -90 220 180');
  svg.setAttribute('aria-hidden', 'true');
  svg.dataset.team = color;
  svg.innerHTML = `<defs><radialGradient id="${id}" cx="38%" cy="32%" r="78%"><stop offset="0" stop-color="#fff6dd" stop-opacity=".6"/><stop offset=".32" stop-color="${team.palm}"/><stop offset="1" stop-color="${team.shade}"/></radialGradient></defs>
  <g stroke="${team.ink}" stroke-linecap="round" stroke-linejoin="round" stroke-width="5">
    <path d="M-96-42q-8 42 0 86l48 4q-7-47 0-94Z" fill="${team.cuff}"/>
    <path d="M-86-38q-4 38 1 78m12-80q-5 40 0 82" fill="none" stroke="${team.knit}" stroke-width="3" opacity=".7"/>
    <path d="M-26-34q-10-38 18-46 30-7 33 18 2 20-19 31" fill="url(#${id})"/>
    <path d="M-52-44q32-22 84-20 46 3 56 38 9 34-14 62-26 30-74 26-34-3-52-16-12-44 0-90Z" fill="url(#${id})"/>
    <path d="M-30-38q20-9 44-8" fill="none" stroke="#fff8e6" stroke-width="5" opacity=".75"/>
  </g>`;
  return svg;
}
