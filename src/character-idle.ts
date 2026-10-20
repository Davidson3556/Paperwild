import './character-idle.css';
import type { Color, PieceSymbol } from './game.ts';
import { characterArt } from './character-art.ts';
import { AMBER_PARTS } from './character-rig-amber.ts';
import { INDIGO_PARTS } from './character-rig-indigo.ts';
import type { Point } from './character-rig-types.ts';
import { createMitten } from './character-mittens.ts';

const PARTS = { w: AMBER_PARTS, b: INDIGO_PARTS } as const;
const SIZE = 1254;
const percentage = (value: number) => `${value / SIZE * 100}%`;
const polygonPath = (outline: readonly Point[]) => outline.map(([x, y], index) => `${index ? 'L' : 'M'}${x} ${y}`).join(' ') + 'Z';

/** Every resident has its own painted appendages. CSS owns resting gestures;
 * the scene temporarily drives the same copies during chess movement. */
export function createCharacterIdle(color: Color, type: PieceSymbol, seed: number): { element: HTMLDivElement; mask: string } {
  const parts = PARTS[color][type];
  const element = document.createElement('div');
  element.className = `character-idle character-idle-${type}`;
  element.setAttribute('aria-hidden', 'true');
  element.dataset.ready = 'false';
  const hash = Math.imul((seed >>> 0) ^ 0x51ed270b, 0x85ebca6b) >>> 0;
  element.style.setProperty('--part-cycle', `${6.4 + (hash % 3600) / 1000}s`);
  element.style.setProperty('--part-phase', `${-(hash % 9200) / 1000}s`);
  const loaded = new Set<number>();
  let failed = false;
  parts.forEach((part, index) => {
    // The wrapper is the animated appendage. Its painted cutout and, for hands,
    // the team mitten share one transform, so every gesture moves them together.
    const limb = document.createElement('div');
    limb.className = `character-idle-part character-idle-${part.name}`;
    limb.dataset.part = part.name;
    limb.style.transformOrigin = `${percentage(part.origin[0])} ${percentage(part.origin[1])}`;
    const image = document.createElement('img');
    image.className = 'character-idle-paint';
    image.alt = ''; image.draggable = false; image.decoding = 'async';
    image.style.clipPath = `polygon(${part.outline.map(([x, y]) => `${percentage(x)} ${percentage(y)}`).join(',')})`;
    // Never expose complementary holes before every replacement is available.
    const decoded = () => { loaded.add(index); element.dataset.ready = String(!failed && loaded.size === parts.length); };
    image.onload = decoded;
    image.onerror = () => { failed = true; element.dataset.ready = 'false'; };
    image.src = characterArt(color, type);
    limb.append(image);
    if (part.name.endsWith('-hand')) limb.append(createMitten(color, part));
    element.append(limb);
    if (image.complete && image.naturalWidth > 0) decoded();
  });
  // Internal luminance masking produces transparent alpha holes. Overlapping
  // black shapes subtract their union; retained joints close the rotating seam.
  const holes = parts.map(part => `<path fill="black" d="${polygonPath(part.outline)}"/>`).join('');
  const joints = parts.filter(part => part.joint).map(part => `<circle cx="${part.origin[0]}" cy="${part.origin[1]}" r="${part.joint}" fill="white"/>`).join('');
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" preserveAspectRatio="xMidYMax meet"><defs><mask id="limbs" maskUnits="userSpaceOnUse" x="0" y="0" width="${SIZE}" height="${SIZE}" style="mask-type:luminance"><rect width="${SIZE}" height="${SIZE}" fill="white"/>${holes}${joints}</mask></defs><rect width="${SIZE}" height="${SIZE}" fill="white" mask="url(#limbs)"/></svg>`;
  return { element, mask: `url("data:image/svg+xml,${encodeURIComponent(source)}")` };
}
