import './character-face.css';
import type { Color, PieceSymbol } from './game.ts';

interface Eye {
  readonly x: number;
  readonly y: number;
  readonly rx: number;
  readonly ry: number;
  readonly tilt: number;
  readonly fur: string;
  readonly ink?: string;
}

/** Eye positions are measured in the original 362 × 362 transparent artwork.
 * Keep these separate for each illustration: the two clubs have different poses.
 * In particular, the badger's lids sit inside its glasses, and the hare's far
 * eye is a narrow sliver rather than a second full-size eye.
 */
export const CHARACTER_EYES: Readonly<Record<Color, Readonly<Record<PieceSymbol, readonly Eye[]>>>> = {
  w: {
    p: [
      { x: 175.5, y: 167, rx: 9, ry: 11, tilt: -17, fur: '#edcb9b' },
      { x: 223, y: 151.5, rx: 7.5, ry: 10.6, tilt: 9, fur: '#f1d3a5' },
    ],
    r: [
      { x: 178.5, y: 148, rx: 6.7, ry: 8.7, tilt: 5, fur: '#eac596' },
      { x: 225, y: 150, rx: 6.4, ry: 8.7, tilt: 5, fur: '#eac18e' },
    ],
    n: [
      { x: 227, y: 154, rx: 9.4, ry: 9.4, tilt: -17, fur: '#e6bb8c' },
      { x: 268, y: 151, rx: 3.1, ry: 6.5, tilt: -7, fur: '#d5a879' },
    ],
    b: [
      { x: 190, y: 159, rx: 8, ry: 9.3, tilt: -15, fur: '#edcba3' },
      { x: 230.5, y: 146, rx: 6.4, ry: 9.1, tilt: 5, fur: '#eed0a4' },
    ],
    q: [
      { x: 172, y: 121, rx: 9.8, ry: 6.4, tilt: 19, fur: '#df9a59', ink: '#743f25' },
      { x: 204.5, y: 125, rx: 3.5, ry: 5, tilt: 11, fur: '#e29147', ink: '#743f25' },
    ],
    k: [
      { x: 185, y: 122, rx: 5.7, ry: 7.2, tilt: -14, fur: '#75614c', ink: '#302c28' },
      { x: 221, y: 108.5, rx: 3.4, ry: 5.2, tilt: -8, fur: '#7f6a53', ink: '#302c28' },
    ],
  },
  b: {
    p: [
      { x: 174, y: 168, rx: 9.4, ry: 11, tilt: -14, fur: '#e8c098' },
      { x: 224.5, y: 150, rx: 7.8, ry: 10.8, tilt: 7, fur: '#efd0a7' },
    ],
    r: [
      { x: 175, y: 146, rx: 7, ry: 8.7, tilt: 9, fur: '#e1bd97' },
      { x: 225, y: 151, rx: 6.6, ry: 8.8, tilt: 5, fur: '#e4c2a0' },
    ],
    n: [
      { x: 249, y: 153, rx: 9.5, ry: 9.4, tilt: -16, fur: '#e3c19c' },
      { x: 289, y: 148, rx: 2.8, ry: 5.8, tilt: -10, fur: '#d9ae7f' },
    ],
    b: [
      { x: 181, y: 161, rx: 8.4, ry: 9.7, tilt: -13, fur: '#edcba7' },
      { x: 223, y: 151, rx: 6.9, ry: 9.9, tilt: 5, fur: '#e5c09b' },
    ],
    q: [
      { x: 170, y: 119.5, rx: 10.2, ry: 6.1, tilt: 17, fur: '#d59c68', ink: '#6f412d' },
      { x: 204, y: 127, rx: 3.7, ry: 5.5, tilt: 10, fur: '#d58e50', ink: '#6f412d' },
    ],
    k: [
      { x: 185, y: 123, rx: 6, ry: 7.4, tilt: -13, fur: '#665e56', ink: '#282830' },
      { x: 222, y: 111, rx: 3.9, ry: 5.8, tilt: -7, fur: '#756859', ink: '#282830' },
    ],
  },
};

const SVG_NS = 'http://www.w3.org/2000/svg';
let faceId = 0;

function svg<Tag extends keyof SVGElementTagNameMap>(tag: Tag, attributes: Record<string, string | number>) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

/** Place immediately after the artwork inside .sketch-piece-body.
 * It shares the image's square, bottom-aligned contain geometry. There are no
 * timers or listeners to dispose: removing the SVG removes its CSS animation.
 * The PNG's eyes stay untouched/open between the brief eyelid appearances.
 */
export function createCharacterFace(color: Color, type: PieceSymbol, seed: number): SVGSVGElement {
  const face = svg('svg', {
    class: 'character-face',
    viewBox: '0 0 362 362',
    preserveAspectRatio: 'xMidYMax meet',
    'aria-hidden': 'true',
    focusable: 'false',
  });
  face.dataset.character = `${color}${type}`;
  const hash = Math.imul((seed >>> 0) ^ 0x9e3779b9, 0x85ebca6b) >>> 0;
  face.style.setProperty('--blink-duration', `${4.8 + (hash % 4200) / 1000}s`);
  face.style.setProperty('--blink-delay', `${-(hash % 4500) / 1000}s`);
  face.classList.toggle('character-face-double', hash % 4 === 0);
  const prefix = `paperwild-face-${++faceId}`;
  const defs = svg('defs', {});
  const blink = svg('g', { class: 'character-blink' });
  CHARACTER_EYES[color][type].forEach((eye, index) => {
    const gradientId = `${prefix}-${index}`;
    const gradient = svg('radialGradient', { id: gradientId });
    // A soft elliptical edge joins the lid to the painted fur without a box.
    gradient.append(
      svg('stop', { offset: '.78', 'stop-color': eye.fur }),
      svg('stop', { offset: '1', 'stop-color': eye.fur, 'stop-opacity': '0' }),
    );
    defs.append(gradient);
    const lid = svg('g', { transform: `translate(${eye.x} ${eye.y}) rotate(${eye.tilt})` });
    lid.append(svg('ellipse', {
      rx: eye.rx + 3,
      ry: eye.ry + 3,
      fill: `url(#${gradientId})`,
    }));
    const halfWidth = eye.rx * .87;
    lid.append(svg('path', {
      d: `M${-halfWidth} -.7 Q0 ${Math.min(eye.ry * .62, 4.4)} ${halfWidth} -.7`,
      fill: 'none',
      stroke: eye.ink ?? '#70503b',
      'stroke-width': type === 'k' ? 1.7 : 2.2,
      'stroke-linecap': 'round',
      opacity: '.86',
    }));
    // Two faint, short fur strokes keep a shut eye from becoming a flat sticker.
    lid.append(svg('path', {
      d: `M${-halfWidth * .48} ${-eye.ry * .58}l.6 -1.6 M${halfWidth * .3} ${-eye.ry * .53}l1 -1.4`,
      fill: 'none',
      stroke: eye.ink ?? '#8d694b',
      'stroke-width': '.65',
      'stroke-linecap': 'round',
      opacity: '.17',
    }));
    blink.append(lid);
  });
  face.append(defs, blink);
  return face;
}
