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

/** Fitted to the 480 × 480 delivery canvas for the watercolor paintings.
 * The 1254px originals have identical framing. Every painting has its own map:
 * both hare eyes are now visible, and badger lids stay inside the wire lenses.
 * The radii include each eye's pale painted edge, not just its dark pupil.
 */
export const CHARACTER_EYES: Readonly<Record<Color, Readonly<Record<PieceSymbol, readonly Eye[]>>>> = {
  w: {
    p: [
      { x: 207, y: 251, rx: 25, ry: 31, tilt: -10, fur: '#f5d393' },
      { x: 319, y: 233, rx: 24, ry: 31, tilt: 9, fur: '#f9dca2' },
    ],
    r: [
      { x: 176, y: 219, rx: 24, ry: 29, tilt: 15, fur: '#dda36a' },
      { x: 280, y: 238, rx: 26, ry: 30, tilt: 12, fur: '#dda774' },
    ],
    n: [
      { x: 235, y: 213, rx: 17.5, ry: 21, tilt: -13, fur: '#f6dfb0' },
      { x: 311, y: 200, rx: 14.5, ry: 20, tilt: -17, fur: '#f5dcac' },
    ],
    b: [
      { x: 219, y: 197, rx: 21, ry: 25, tilt: -12, fur: '#f5e5bd' },
      { x: 301, y: 188, rx: 17.5, ry: 24, tilt: -10, fur: '#f4e1b5' },
    ],
    q: [
      { x: 163, y: 198, rx: 27, ry: 28, tilt: -10, fur: '#ffc17c', ink: '#75462f' },
      { x: 262, y: 178, rx: 24, ry: 29, tilt: -11, fur: '#ffc184', ink: '#75462f' },
    ],
    k: [
      { x: 186, y: 170, rx: 17, ry: 22, tilt: 17, fur: '#e9d9bf', ink: '#51483c' },
      { x: 285, y: 192, rx: 18, ry: 21, tilt: 22, fur: '#e7d8bc', ink: '#51483c' },
    ],
  },
  b: {
    p: [
      { x: 190, y: 250, rx: 24, ry: 29, tilt: 15, fur: '#f6d493' },
      { x: 295, y: 269, rx: 24, ry: 28, tilt: 18, fur: '#f9d99a' },
    ],
    r: [
      { x: 179, y: 213, rx: 25, ry: 32, tilt: 11, fur: '#e7b27b' },
      { x: 283, y: 230, rx: 28, ry: 31, tilt: 15, fur: '#e2ac78' },
    ],
    n: [
      { x: 250, y: 217, rx: 18, ry: 20, tilt: -9, fur: '#f5dfb6' },
      { x: 331, y: 204, rx: 13, ry: 20, tilt: -18, fur: '#f4d8a7' },
    ],
    b: [
      { x: 205, y: 213, rx: 16.5, ry: 21, tilt: 8, fur: '#f6e6c5' },
      { x: 274, y: 222, rx: 18, ry: 20, tilt: 15, fur: '#f7e8cc' },
    ],
    q: [
      { x: 159, y: 203, rx: 25, ry: 26, tilt: -17, fur: '#ffc181', ink: '#75462f' },
      { x: 262, y: 185, rx: 24, ry: 29, tilt: -7, fur: '#ffc486', ink: '#75462f' },
    ],
    k: [
      { x: 214, y: 166, rx: 18, ry: 19, tilt: -10, fur: '#e8deca', ink: '#51483c' },
      { x: 305, y: 152, rx: 17, ry: 22, tilt: -15, fur: '#e7ddc7', ink: '#51483c' },
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
    viewBox: '0 0 480 480',
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
  const joy = svg('g', { class: 'character-joy' });
  const squeeze = svg('g', { class: 'character-squeeze' });
  const angry = svg('g', { class: 'character-brows-angry' });
  const sad = svg('g', { class: 'character-brows-sad' });
  const tears = svg('g', { class: 'character-tears' });
  const flush = svg('g', { class: 'character-flush' });
  const eyes = CHARACTER_EYES[color][type];
  const centre = eyes.reduce((sum, eye) => sum + eye.x, 0) / eyes.length;
  eyes.forEach((eye, index) => {
    const gradientId = `${prefix}-${index}`;
    const gradient = svg('radialGradient', { id: gradientId });
    // A soft elliptical edge joins the lid to the painted fur without a box.
    gradient.append(
      svg('stop', { offset: '.94', 'stop-color': eye.fur }),
      svg('stop', { offset: '1', 'stop-color': eye.fur, 'stop-opacity': '0' }),
    );
    defs.append(gradient);
    const lid = svg('g', { 'data-eye': index, transform: `translate(${eye.x} ${eye.y}) rotate(${eye.tilt})` });
    lid.append(svg('ellipse', {
      rx: eye.rx + 2,
      ry: eye.ry + 2,
      fill: `url(#${gradientId})`,
    }));
    const halfWidth = eye.rx * .87;
    lid.append(svg('path', {
      d: `M${-halfWidth} -.7 Q0 ${Math.min(eye.ry * .46, 5.8)} ${halfWidth} -.7`,
      fill: 'none',
      stroke: eye.ink ?? '#70503b',
      'stroke-width': type === 'k' ? 2.2 : 2.7,
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
    // Happy, squeezed-shut eyes: the same lid with the crease turned upward.
    const smile = svg('g', { 'data-eye': index, transform: `translate(${eye.x} ${eye.y}) rotate(${eye.tilt * .6})` });
    smile.append(svg('ellipse', { rx: eye.rx + 2.5, ry: eye.ry + 2.5, fill: `url(#${gradientId})` }));
    smile.append(svg('path', {
      d: `M${-halfWidth * 1.02} ${eye.ry * .22} Q0 ${-eye.ry * .78} ${halfWidth * 1.02} ${eye.ry * .22}`,
      fill: 'none', stroke: eye.ink ?? '#70503b', 'stroke-width': type === 'k' ? 2.6 : 3.2, 'stroke-linecap': 'round', opacity: '.9',
    }));
    joy.append(smile);
    // Scrunched "> <" eyes for a refusal: chevrons point toward the nose.
    const scrunch = svg('g', { 'data-eye': index, transform: `translate(${eye.x} ${eye.y}) rotate(${eye.tilt * .4})` });
    scrunch.append(svg('ellipse', { rx: eye.rx + 2.5, ry: eye.ry + 2.5, fill: `url(#${gradientId})` }));
    const side = eye.x < centre ? 1 : -1, reach = halfWidth * .85, rise = eye.ry * .42;
    scrunch.append(svg('path', {
      d: `M${-side * reach} ${-rise} L${side * reach * .75} 0 L${-side * reach} ${rise}`,
      fill: 'none', stroke: eye.ink ?? '#70503b', 'stroke-width': type === 'k' ? 2.6 : 3.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: '.92',
    }));
    squeeze.append(scrunch);
    // Eyebrows, drawn like thick marker strokes above each eye. Local +x points
    // toward the nose, so one shape serves both eyes.
    const browWidth = eye.rx * 1.05, browHeight = eye.ry * .5, ink = eye.ink ?? '#5c4130';
    const brow = (className: string, d: string) => {
      const group = svg('g', { class: `character-brow ${className}`, transform: `translate(${eye.x} ${eye.y - eye.ry * 1.42}) rotate(${eye.tilt * .5}) scale(${side} 1)` });
      group.append(svg('path', { d, fill: 'none', stroke: ink, 'stroke-width': type === 'k' ? 7 : 8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
      return group;
    };
    angry.append(brow('angry', `M${-browWidth} ${-browHeight * .7} Q0 ${-browHeight * .15} ${browWidth * .95} ${browHeight * .75}`));
    sad.append(brow('sad', `M${-browWidth} ${browHeight * .45} Q${-browWidth * .1} ${-browHeight * .2} ${browWidth * .9} ${-browHeight * .85}`));
    // Tears well under each eye and roll down the cheek.
    // The group places the tear; the scene animates only the inner drop, because
    // a CSS transform on an SVG element would replace its placement attribute.
    const seat = svg('g', { transform: `translate(${eye.x + side * eye.rx * .3} ${eye.y + eye.ry * .95}) scale(2.3)` });
    seat.append(svg('path', { class: 'character-tear', d: 'M0 -11C6 -3 9 5 0 11-9 5-6 -3 0 -11Z', fill: '#a6d6f2', stroke: '#4a7fae', 'stroke-width': 1.1 }));
    tears.append(seat);
  });
  // A red flush across the cheeks for real anger.
  const flushId = `${prefix}-flush`;
  const span = Math.max(...eyes.map(eye => eye.x)) - Math.min(...eyes.map(eye => eye.x));
  const cheekY = eyes.reduce((sum, eye) => sum + eye.y + eye.ry * 1.25, 0) / eyes.length;
  const flushGradient = svg('radialGradient', { id: flushId });
  flushGradient.append(svg('stop', { offset: '0', 'stop-color': '#e2483a', 'stop-opacity': '.55' }), svg('stop', { offset: '1', 'stop-color': '#e2483a', 'stop-opacity': '0' }));
  defs.append(flushGradient);
  flush.append(svg('ellipse', { cx: centre, cy: cheekY, rx: span * .95, ry: span * .42, fill: `url(#${flushId})` }));
  face.append(defs, blink, joy, squeeze, flush, angry, sad, tears);
  return face;
}
