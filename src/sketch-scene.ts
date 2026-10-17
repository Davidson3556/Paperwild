import './sketch-scene.css';
import type { Conservatory, ConservatoryOptions, CreatureName, LastMove, SquareProjection, SyncOptions } from './scene.ts';
import type { Capture, Color, PieceSymbol, Square } from './game.ts';
import { getPieceMotion } from './piece-motion.ts';
import type { PieceMotionPlan } from './piece-motion.ts';

export interface SketchMotionEvent {
  id: number;
  phase: 'start' | 'land' | 'capture' | 'cancel';
  type: PieceSymbol;
  from: Square;
  to: Square;
  durationMs: number;
  contactTimesMs: readonly number[];
  capture: boolean;
}
export interface SketchSceneOptions extends ConservatoryOptions { onMotion?: (event: SketchMotionEvent) => void }
export interface SketchScene extends Conservatory {
  whenSettled(): Promise<void>;
  settle(): void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const FILES = 'abcdefgh';
const LEFT = 70, TOP = 50, CELL = 107.5;
const SYMBOLS: Record<Color, Record<PieceSymbol, string>> = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};
type BoardPiece = NonNullable<NonNullable<SyncOptions['board']>[number][number]>;
interface Point { x: number; y: number }
interface Sprite {
  element: HTMLDivElement;
  body: HTMLDivElement;
  image: HTMLImageElement;
  fallback: HTMLSpanElement;
  emote: HTMLSpanElement;
  shadow: SVGSVGElement;
  limbs: SVGSVGElement;
  parts: Map<string, HTMLElement | SVGElement>;
  fragments: HTMLImageElement[];
  pendingArtwork: boolean;
  square: Square;
  color: Color;
  type: PieceSymbol;
}

let instance = 0;
function svg<Tag extends keyof SVGElementTagNameMap>(tag: Tag, attributes: Record<string, string | number> = {}) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}
function position(square: string): Point {
  return { x: LEFT + (FILES.indexOf(square[0]) + .5) * CELL, y: TOP + (8.5 - Number(square[1])) * CELL };
}
function capturedPosition(index: number): Point {
  // A second little row peeks between the first; both fit inside the paper.
  return { x: 112 + (index % 15) * 54 + (index < 15 ? 0 : 20), y: index < 15 ? 967 : 973 };
}

/** A flat sheet of pencilled chess, with all input owned by the semantic board. */
export function createSketchScene(container: HTMLElement, { onSquare, onCreature, onReady, onMotion, reducedMotion = false }: SketchSceneOptions = {}): SketchScene {
  const prefix = `marginwood-board-${++instance}`;
  const root = document.createElement('div'); root.className = 'sketch-scene';
  root.setAttribute('aria-hidden', 'true'); root.dataset.motion = reducedMotion ? 'still' : 'gentle';
  root.dataset.atmosphere = 'day'; root.dataset.weather = 'clear';
  const sheet = svg('svg', { viewBox: '0 0 1000 1000', preserveAspectRatio: 'none', class: 'sketch-board-ink' });
  const defs = svg('defs'); sheet.append(defs);
  const tiles = svg('g', { class: 'sketch-board-tiles' });
  const grid = svg('g', { class: 'sketch-board-grid', fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  const coordinates = svg('g', { class: 'sketch-coordinates' });
  const marks = svg('g', { class: 'sketch-board-marks' });
  const traces = svg('g', { class: 'sketch-motion-traces' });
  sheet.append(tiles, grid, coordinates, traces, marks);
  const cast = document.createElement('div'); cast.className = 'sketch-cast';
  const collection = document.createElement('div'); collection.className = 'sketch-sidelines';
  const flights = document.createElement('div'); flights.className = 'sketch-departures';
  const hello = document.createElement('span'); hello.className = 'sketch-hello'; hello.textContent = '♪';
  root.append(sheet, collection, cast, flights, hello); container.append(root);
  let width = 1, height = 1, destroyed = false, ready = false, signature = '', captureKey = '', previousCaptures = -1, resident = 0;
  const sprites = new Map<Square, Sprite>();
  const running = new Map<Animation, ((cancelled: boolean) => void) | undefined>();
  const motions = new Set<Animation>();
  const settlers = new Set<() => void>();
  let motionId = 0;
  let gridIntroduced = false;

  // A child has coloured these in, gone over the lines, and missed a few bits.
  // The nominal grid remains exact underneath the wavering pencil marks.
  const pencilRandom = (seed: number) => {
    let state = seed;
    return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  };
  for (let row = 0; row < 8; row++) for (let file = 0; file < 8; file++) {
    const x = LEFT + file * CELL, y = TOP + row * CELL;
    const random = pencilRandom(83 + row * 479 + file * 83);
    const dark = (file + 8 - row) % 2 === 1;
    const clip = svg('clipPath', { id: `${prefix}-${row}-${file}` });
    const outline = `M${x + 3},${y + 2 + random() * 3} Q${x + CELL * .5},${y + random() * 4} ${x + CELL - 2},${y + 4} L${x + CELL - 3},${y + CELL - 3} Q${x + CELL * .5},${y + CELL - random() * 4} ${x + 2},${y + CELL - 4} Z`;
    clip.append(svg('path', { d: outline })); defs.append(clip);
    tiles.append(svg('path', { d: outline, class: dark ? 'sketch-square-wash' : 'sketch-paper-wash', opacity: dark ? .075 + random() * .035 : .035 }));
    if (dark) {
      const scribbles = svg('g', { 'clip-path': `url(#${prefix}-${row}-${file})`, class: 'sketch-square-scribbles', fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
      // Long, slightly scruffy strokes run in different directions on each
      // square. Their lengths and pressure leave paper showing between them.
      const backwards = random() > .5;
      for (let line = -6; line < 24; line++) {
        const startX = x + line * 5.3 + random() * 4;
        const startY = y + CELL - 4 - random() * 17;
        const length = 49 + random() * 69;
        const rise = length * (.72 + random() * .38);
        const endX = startX + (backwards ? -length : length), endY = startY - rise;
        scribbles.append(svg('path', {
          d: `M${startX} ${startY} Q${(startX + endX) / 2 + (random() - .5) * 7} ${(startY + endY) / 2 + (random() - .5) * 6} ${endX} ${endY}`,
          class: line % 5 === 0 ? 'sketch-pencil-colour second-colour' : 'sketch-pencil-colour',
          'stroke-width': .85 + random() * 1.8, opacity: .16 + random() * .28,
        }));
        if (line % 4 === 0) scribbles.append(svg('path', { d: `M${startX + 1.6} ${startY - 2} l${(backwards ? -1 : 1) * length * .53} ${-rise * .53}`, class: 'sketch-pencil-colour', 'stroke-width': .65, opacity: .16 }));
      }
      // A few back-and-forth scrubs show where the pencil changed grip.
      for (let scrub = 0; scrub < 4; scrub++) {
        const sx = x + 8 + random() * 36, sy = y + 12 + random() * 76, reach = 20 + random() * 43;
        scribbles.append(svg('path', { d: `M${sx} ${sy} q${reach * .5} -4 ${reach} 1 l${-reach + 4} 5 q${reach * .6} -3 ${reach - 2} 1 l${-reach + 10} 5`, class: 'sketch-pencil-colour soft-scrub', 'stroke-width': .9 + random() * 1.2, opacity: .12 + random() * .12 }));
      }
      tiles.append(scribbles);
    }
  }
  for (let index = 0; index <= 8; index++) for (const vertical of [true, false]) {
    const nominal = (vertical ? LEFT : TOP) + index * CELL;
    for (let pass = 0; pass < 3; pass++) {
      const random = pencilRandom(349 + index * 739 + pass * 191 + (vertical ? 10007 : 0));
      const nodes: Point[] = [];
      for (let node = 0; node <= 8; node++) {
        const wobble = (random() - .5) * (pass === 0 ? 7 : 9);
        const along = (vertical ? TOP : LEFT) + node * CELL + (node === 0 ? -random() * 5 : node === 8 ? random() * 5 : (random() - .5) * 3);
        nodes.push(vertical ? { x: nominal + wobble, y: along } : { x: along, y: nominal + wobble });
      }
      let line = `M${nodes[0].x} ${nodes[0].y}`;
      for (let node = 1; node < nodes.length; node++) {
        const a = nodes[node - 1], b = nodes[node];
        const bend = nominal + (random() - .5) * 9;
        line += vertical ? ` Q${bend} ${(a.y + b.y) / 2} ${b.x} ${b.y}` : ` Q${(a.x + b.x) / 2} ${bend} ${b.x} ${b.y}`;
      }
      grid.append(svg('path', {
        d: line, class: `sketch-graphite-pass graphite-${pass}`,
        'stroke-width': pass === 0 ? 1.55 + random() * .7 : pass === 1 ? .72 + random() * .45 : .55,
        opacity: pass === 0 ? .62 + random() * .14 : pass === 1 ? .28 : .24,
        'stroke-dasharray': pass === 0 ? `${87 + index * 5} 1.3 ${65 + index * 3} 2.2 109 .7` : pass === 1 ? 'none' : '13 83 31 128 9 94 26 116',
      }));
    }
  }
  for (let index = 0; index < 8; index++) {
    const random = pencilRandom(617 + index * 911);
    const fx = LEFT + (index + .5) * CELL + (random() - .5) * 8, fy = 939 + (random() - .5) * 8;
    const rx = 40 + (random() - .5) * 5, ry = TOP + (index + .5) * CELL + 9 + (random() - .5) * 8;
    const file = svg('text', { x: fx, y: fy, class: index % 3 ? 'pencil-blue' : 'pencil-red', 'font-size': 30 + random() * 8, transform: `rotate(${(random() - .5) * 20} ${fx} ${fy})` }); file.textContent = FILES[index];
    const rank = svg('text', { x: rx, y: ry, class: index % 3 ? 'pencil-red' : 'pencil-blue', 'font-size': 29 + random() * 9, transform: `rotate(${(random() - .5) * 22} ${rx} ${ry})` }); rank.textContent = String(8 - index);
    coordinates.append(file, rank);
  }
  const doodles = svg('g', { class: 'sketch-board-doodles', fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  doodles.append(svg('path', { d: 'M29 33 40 10 45 37 21 22 52 23 29 33m6 4 6-15m914 3 5-16 5 19-16-10 23-1-17 8', class: 'pencil-blue', 'stroke-width': 1.5, opacity: .57 }));
  doodles.append(svg('path', { d: 'm948 906 13 2-12 4 17 1-14 4 15 2m-648 32 23 2-19 3 30-1', class: 'pencil-red', 'stroke-width': 1.35, opacity: .40 }));
  sheet.append(doodles);

  function retire(animation: Animation, cancelled: boolean) {
    if (!running.has(animation)) return;
    const cleanup = running.get(animation); running.delete(animation);
    cleanup?.(cancelled); animation.cancel();
  }
  function track(animation: Animation, cleanup?: (cancelled: boolean) => void) {
    running.set(animation, cleanup);
    if (document.hidden) animation.pause();
    animation.finished.then(() => retire(animation, false), () => retire(animation, true));
    return animation;
  }
  function finishAnimations() {
    for (const animation of [...running.keys()]) retire(animation, true);
  }
  function revealPencilGrid() {
    if (gridIntroduced || destroyed) return;
    gridIntroduced = true;
    if (reducedMotion) return;
    grid.querySelectorAll<SVGPathElement>('.graphite-0').forEach((path, index) => {
      const length = path.getTotalLength();
      if (!Number.isFinite(length) || length <= 0) return;
      const pressure = path.getAttribute('stroke-dasharray');
      path.setAttribute('stroke-dasharray', `${length} ${length}`);
      track(path.animate([{ strokeDashoffset: String(length) }, { strokeDashoffset: '0' }], {
        duration: 720, delay: index * 35, fill: 'backwards', easing: 'cubic-bezier(.3,.08,.6,.98)',
      }), () => {
        if (pressure === null) path.removeAttribute('stroke-dasharray');
        else path.setAttribute('stroke-dasharray', pressure);
      });
    });
  }
  function trackMotion(animation: Animation, event: SketchMotionEvent, cleanup?: () => void) {
    motions.add(animation);
    track(animation, cancelled => {
      cleanup?.(); motions.delete(animation);
      onMotion?.({ ...event, phase: cancelled ? 'cancel' : 'land' });
      if (!motions.size) { for (const settle of settlers) settle(); settlers.clear(); }
    });
    onMotion?.(event);
  }
  function whenSettled() {
    return motions.size ? new Promise<void>(resolve => settlers.add(resolve)) : Promise.resolve();
  }
  function locate(sprite: Sprite, square: Square) {
    const p = position(square);
    sprite.square = square; sprite.element.style.left = `${p.x / 10}%`; sprite.element.style.top = `${p.y / 10}%`;
    sprite.element.style.zIndex = String(20 + 8 - Number(square[1])); sprite.element.dataset.square = square;
  }
  function artwork(image: HTMLImageElement, color: Color, type: PieceSymbol, fallback: HTMLElement) {
    image.hidden = false; fallback.hidden = true;
    image.onload = () => { if (!destroyed) { image.hidden = false; fallback.hidden = true; } };
    image.onerror = () => { if (!destroyed) { image.hidden = true; fallback.hidden = false; } };
    image.src = `/art/pieces/${color}${type}.png`;
  }
  function createSprite(piece: BoardPiece) {
    const element = document.createElement('div'); element.className = `sketch-piece sketch-${piece.type}`; element.dataset.color = piece.color;
    const body = document.createElement('div'); body.className = 'sketch-piece-body';
    const image = document.createElement('img'); image.alt = ''; image.draggable = false; image.className = 'sketch-piece-art'; image.decoding = 'async';
    const fallback = document.createElement('span'); fallback.className = 'sketch-piece-fallback'; fallback.textContent = SYMBOLS[piece.color][piece.type]; fallback.hidden = true;
    const emote = document.createElement('span'); emote.className = 'sketch-piece-emote'; emote.textContent = '!';
    const shadow = svg('svg', { viewBox: '0 0 100 100', preserveAspectRatio: 'none', class: 'sketch-ground-shadow' });
    shadow.append(svg('ellipse', { cx: 50, cy: 89, rx: 24, ry: 3, fill: '#706b48', opacity: .18 }), svg('path', { d: 'M30 89q20 3 39-1m-34 4 28-1', fill: 'none', stroke: '#746e4c', 'stroke-width': .7, opacity: .3 }));
    const limbs = svg('svg', { viewBox: '0 0 100 100', preserveAspectRatio: 'none', class: 'sketch-moving-limbs' });
    body.append(image, fallback); element.append(shadow, limbs, body, emote); cast.append(element);
    const sprite: Sprite = { element, body, image, fallback, emote, shadow, limbs, parts: new Map(), fragments: [], pendingArtwork: false, square: piece.square, color: piece.color, type: piece.type };
    element.style.setProperty('--idle-delay', `${-((piece.square.charCodeAt(0) + Number(piece.square[1]) * 3) % 17) / 3}s`);
    artwork(image, piece.color, piece.type, fallback); articulate(sprite); locate(sprite, piece.square); return sprite;
  }
  function articulate(sprite: Sprite) {
    for (const fragment of sprite.fragments) fragment.remove();
    sprite.fragments.length = 0; sprite.parts.clear(); sprite.limbs.replaceChildren();
    const type = sprite.type;
    const joint = (name: string, x: number, y: number, parent: SVGElement = sprite.limbs) => {
      const group = svg('g', { class: `sketch-joint sketch-joint-${name}` });
      group.style.transformOrigin = `${x}% ${y}%`; group.style.transformBox = 'view-box';
      parent.append(group); sprite.parts.set(name, group); return group;
    };
    const fragment = (name: string, clip: string, origin: string) => {
      const image = document.createElement('img'); image.alt = ''; image.draggable = false;
      image.className = `sketch-art-fragment sketch-fragment-${name}`; image.src = sprite.image.src;
      image.style.clipPath = clip; image.style.transformOrigin = origin;
      sprite.body.append(image); sprite.fragments.push(image); sprite.parts.set(name, image);
    };
    if (type === 'p' || type === 'r' || type === 'k' || type === 'q') {
      for (const [side, sign] of [['left', -1], ['right', 1]] as const) {
        const x = type === 'r' ? 50 + sign * 20 : type === 'p' ? 49 + sign * 7 : 50 + sign * 12;
        const hipY = type === 'k' ? 78 : 75;
        const kneeX = x + sign * 2, footX = x + sign * 5;
        const leg = joint(`${side}-leg`, x, hipY);
        if (type === 'r') leg.append(svg('path', { d: `M${x - 5} ${hipY - 1}q8-1 10 4l-3 8-7 1q4-8 0-13`, class: 'sketch-root-leg' }));
        else leg.append(svg('path', { d: `M${x} ${hipY}Q${x + sign * 3} 78 ${kneeX} 83`, class: `sketch-pencil-leg sketch-leg-${type}` }));
        const shin = joint(`${side}-shin`, kneeX, 82, leg);
        if (type === 'r') shin.append(svg('path', { d: `M${kneeX - 4} 81q-2 7 ${sign * 11} 12q${-sign * 8} 3 ${-sign * 14}-1l-4-2q7-2 8-9z`, class: 'sketch-root-foot' }));
        else shin.append(svg('path', { d: `M${kneeX} 82q${sign * 2} 4 ${sign * 4} 8`, class: `sketch-pencil-leg sketch-leg-${type}` }));
        const foot = joint(`${side}-foot`, footX, 91, shin);
        if (type !== 'r') foot.append(svg('ellipse', { cx: footX, cy: 91, rx: type === 'k' ? 9 : type === 'q' ? 6 : 5, ry: type === 'k' ? 3.6 : 2.2, class: `sketch-pencil-foot sketch-foot-${type}` }));
        if (type === 'k') foot.append(svg('path', { d: `M${footX - 4} 90v2m4-2v2m4-2v2`, class: 'sketch-paw-toes' }));
      }
    }
    if (type === 'n') {
      fragment('left-ear', 'polygon(28% 18%,57% 18%,64% 48%,34% 46%)', '56% 44%');
      fragment('right-ear', 'polygon(56% 17%,76% 17%,78% 45%,58% 48%)', '64% 43%');
      const tail = joint('tail', 30, 61);
      tail.append(svg('path', { d: 'M24 57q-5-3-7 3q-4 3 1 7q3 6 9 1q6-1 4-7q0-4-7-4z', class: 'sketch-hare-tail' }));
    }
    if (type === 'b') {
      fragment('left-wing', 'polygon(0% 46%,46% 43%,48% 96%,0% 96%)', '47% 62%');
      fragment('right-wing', 'polygon(63% 44%,100% 44%,100% 96%,62% 96%)', '63% 62%');
    }
    if (type === 'q') fragment('fox-tail', 'polygon(53% 66%,100% 66%,100% 100%,53% 100%)', '57% 72%');
  }
  function refreshArtwork(sprite: Sprite) {
    sprite.element.className = `sketch-piece sketch-${sprite.type}`; sprite.pendingArtwork = false;
    sprite.element.dataset.color = sprite.color; sprite.fallback.textContent = SYMBOLS[sprite.color][sprite.type];
    artwork(sprite.image, sprite.color, sprite.type, sprite.fallback); articulate(sprite);
  }
  function updatePiece(sprite: Sprite, piece: BoardPiece) {
    if (sprite.type === piece.type && sprite.color === piece.color) return;
    sprite.type = piece.type; sprite.color = piece.color;
    if (sprite.element.classList.contains('is-moving')) sprite.pendingArtwork = true;
    else refreshArtwork(sprite);
  }
  function move(sprite: Sprite, square: Square, animate: boolean) {
    const fromSquare = sprite.square, from = position(fromSquare), to = position(square);
    const plan = getPieceMotion(sprite.type, fromSquare, square); locate(sprite, square);
    if (!animate) return;
    sprite.element.classList.add('is-moving'); sprite.element.dataset.locomotion = plan.type;
    sprite.element.style.zIndex = '60';
    const keyframes = plan.frames.map(pose => ({
      offset: pose.offset,
      left: `${(from.x + (to.x - from.x) * pose.progress) / 10}%`,
      top: `${(from.y + (to.y - from.y) * pose.progress - pose.lift) / 10}%`,
    }));
    trackMotion(sprite.element.animate(keyframes, { duration: plan.durationMs, easing: 'linear' }), {
      id: ++motionId, phase: 'start', type: plan.type, from: fromSquare, to: square,
      durationMs: plan.durationMs, contactTimesMs: plan.contactTimesMs, capture: false,
    }, () => {
      sprite.element.classList.remove('is-moving'); delete sprite.element.dataset.locomotion;
      locate(sprite, sprite.square);
      if (sprite.pendingArtwork) refreshArtwork(sprite);
    });
    track(sprite.body.animate(plan.frames.map(pose => ({ offset: pose.offset, transform: `rotate(${pose.rotation}deg) scale(${pose.scaleX},${pose.scaleY})` })), { duration: plan.durationMs, easing: 'linear' }));
    track(sprite.shadow.animate(plan.frames.map(pose => ({
      offset: pose.offset,
      transform: `translateY(${pose.lift * height / 1000}px) scaleX(${1 - pose.lift / 150})`,
      opacity: 1 - pose.lift / 110,
    })), { duration: plan.durationMs, easing: 'linear' }));
    animateLimbs(sprite, plan);
    drawFootsteps(plan, from, to);
  }
  function animatePart(sprite: Sprite, name: string, frames: Keyframe[], duration: number) {
    const part = sprite.parts.get(name);
    if (part) track(part.animate(frames, { duration, easing: 'linear' }));
  }
  function animateLimbs(sprite: Sprite, plan: PieceMotionPlan) {
    if (plan.type === 'p' || plan.type === 'r' || plan.type === 'k') {
      const swing = plan.type === 'r' ? 14 : plan.type === 'k' ? 19 : 29;
      const firstPlant = plan.contacts[0].atMs / plan.durationMs;
      const period = (plan.contacts[1].atMs - plan.contacts[0].atMs) / plan.durationMs * 2;
      for (const [side, phase] of [['left', 0], ['right', Math.PI]] as const) {
        const thigh: Keyframe[] = [], shin: Keyframe[] = [], foot: Keyframe[] = [];
        for (let index = 0; index <= 20; index++) {
          const offset = index / 20, active = Math.sin(Math.PI / 2 * Math.min(1, offset / .09)) * (offset > .92 ? (1 - offset) / .08 : 1);
          const gait = Math.sin((offset - firstPlant) * Math.PI * 2 / period - Math.PI / 2 + phase);
          const bend = Math.max(0, gait) * swing * 1.15;
          thigh.push({ offset, transform: `rotate(${gait * swing * active}deg)` });
          shin.push({ offset, transform: `rotate(${-bend * active}deg)` });
          foot.push({ offset, transform: `rotate(${(bend - gait * swing) * active * .5}deg) translateY(${-Math.max(0, gait) * active * (plan.type === 'r' ? 2 : 4)}px)` });
        }
        animatePart(sprite, `${side}-leg`, thigh, plan.durationMs);
        animatePart(sprite, `${side}-shin`, shin, plan.durationMs);
        animatePart(sprite, `${side}-foot`, foot, plan.durationMs);
      }
    }
    if (plan.type === 'q') {
      for (const [side, sign] of [['left', -1], ['right', 1]] as const) {
        animatePart(sprite, `${side}-leg`, plan.frames.map(pose => ({ offset: pose.offset, transform: `rotate(${sign * pose.lift * .6}deg)` })), plan.durationMs);
        animatePart(sprite, `${side}-shin`, plan.frames.map(pose => ({ offset: pose.offset, transform: `rotate(${-sign * pose.lift * .8}deg)` })), plan.durationMs);
      }
    }
    if (plan.type === 'n') {
      const offsets = [0, .10, .17, .25, .43, .58, .73, .78, .88, 1];
      const earAngles = [0, -13, -28, 13, 25, 18, -12, -32, 12, 0];
      for (const [name, side] of [['left-ear', -1], ['right-ear', 1]] as const) animatePart(sprite, name, offsets.map((offset, index) => ({ offset, transform: `rotate(${earAngles[index] * (side < 0 ? .8 : 1.1)}deg)` })), plan.durationMs);
      animatePart(sprite, 'tail', offsets.map((offset, index) => ({ offset, transform: `rotate(${earAngles[index] * -.55}deg) scale(${index === 3 || index === 4 ? .85 : 1})` })), plan.durationMs);
    }
    if (plan.type === 'b') {
      for (const [name, sign] of [['left-wing', -1], ['right-wing', 1]] as const) {
        const frames: Keyframe[] = [];
        for (let index = 0; index <= 24; index++) {
          const offset = index / 24, flutter = Math.sin(offset * Math.PI * 10);
          frames.push({ offset, transform: `rotate(${sign * flutter * 14}deg) scaleX(${.70 + flutter * .40})` });
        }
        frames[0].transform = 'rotate(0deg) scaleX(1)'; frames.at(-1)!.transform = 'rotate(0deg) scaleX(1)';
        animatePart(sprite, name, frames, plan.durationMs);
      }
    }
    if (plan.type === 'q') animatePart(sprite, 'fox-tail', plan.frames.map(pose => ({ offset: pose.offset, transform: `rotate(${-pose.rotation * 1.7}deg) scaleX(${1 + pose.lift / 240})` })), plan.durationMs);
  }
  function drawFootsteps(plan: PieceMotionPlan, from: Point, to: Point) {
    for (let index = 0; index < plan.contacts.length; index++) {
      const contact = plan.contacts[index];
      const pose = plan.frames.find(frame => Math.abs(frame.offset * plan.durationMs - contact.atMs) <= 2) ?? plan.frames.at(-1)!;
      const x = from.x + (to.x - from.x) * pose.progress, y = from.y + (to.y - from.y) * pose.progress + 43;
      const group = svg('g', { class: 'sketch-footstep', transform: `translate(${x} ${y})`, opacity: 0 });
      if (plan.type === 'b') group.append(svg('path', { d: 'M-13-7q-7-4-10 1m34-2q8-5 12 0m-16 9q-6 4-13 0', class: 'sketch-flutter-trace', fill: 'none' }));
      else {
        for (const side of contact.foot === 'both' ? [-1, 1] : [contact.foot === 'left' ? -1 : 1]) {
          group.append(svg('ellipse', { cx: side * 7, cy: side * 2, rx: plan.type === 'k' ? 5 : 3.5, ry: 2, class: 'sketch-footprint' }));
          if (plan.type === 'k' || plan.type === 'q') group.append(svg('path', { d: `M${side * 7 - 3}-4v1m3-2v1m3-1v1`, class: 'sketch-paw-toes' }));
        }
      }
      traces.append(group);
      track(group.animate([{ opacity: 0 }, { opacity: .48, offset: .08 }, { opacity: .36, offset: .55 }, { opacity: 0 }], { duration: 850, delay: contact.atMs, fill: 'backwards', easing: 'ease-out' }), () => group.remove());
    }
    if (plan.type === 'n' || plan.type === 'q' || plan.type === 'r' || plan.type === 'k') {
      const dust = svg('g', { class: 'sketch-landing-dust', transform: `translate(${to.x} ${to.y + 40})`, opacity: 0 });
      dust.append(svg('path', { d: 'M-15 1q-8-6-14-2m46-1q9-7 16-2m-22 11 7-1m-32-2-7-1', fill: 'none', class: 'sketch-dust-line' })); traces.append(dust);
      track(dust.animate([{ opacity: 0, scale: '.5' }, { opacity: .75, scale: '1.1', offset: .18 }, { opacity: 0, scale: '1.5' }], { duration: 430, delay: plan.landingTimeMs, fill: 'backwards', easing: 'ease-out' }), () => dust.remove());
    }
  }
  function depart(sprite: Sprite, captureIndex: number, animate: boolean) {
    if (!animate) { sprite.element.remove(); return; }
    flights.append(sprite.element); sprite.element.style.zIndex = '70';
    const from = position(sprite.square), to = capturedPosition(captureIndex);
    const middleX = from.x + (from.x < 500 ? -110 : 110);
    trackMotion(sprite.element.animate([
      { left: `${from.x / 10}%`, top: `${from.y / 10}%`, transform: 'translate(-50%,-57%) rotate(0deg) scale(1)', opacity: 1 },
      { left: `${middleX / 10}%`, top: `${(from.y - 150) / 10}%`, transform: 'translate(-50%,-57%) rotate(-11deg) scale(.72)', opacity: 1, offset: .42 },
      { left: `${to.x / 10}%`, top: `${to.y / 10}%`, transform: 'translate(-50%,-57%) rotate(7deg) scale(.33)', opacity: 0 },
    ], { duration: 1000, easing: 'cubic-bezier(.2,.7,.3,1)' }), {
      id: ++motionId, phase: 'capture', type: sprite.type, from: sprite.square, to: sprite.square,
      durationMs: 1000, contactTimesMs: [760], capture: true,
    }, () => sprite.element.remove());
  }
  function emote(sprite: Sprite) {
    if (reducedMotion) return;
    track(sprite.emote.animate([
      { opacity: 0, transform: 'translateY(5px) rotate(-8deg) scale(.3)' },
      { opacity: 1, transform: 'translateY(-4px) rotate(6deg) scale(1)', offset: .2 },
      { opacity: 1, transform: 'translateY(-8px) rotate(-4deg) scale(1)', offset: .65 },
      { opacity: 0, transform: 'translateY(-13px) rotate(0deg) scale(.8)' },
    ], { duration: 1450, delay: 180, easing: 'ease-out' }));
  }
  function showCaptures(captures: readonly Capture[], animate: boolean) {
    const key = captures.map(c => `${c.color}${c.type}${c.by}${c.moveNumber}`).join('|');
    if (key === captureKey && captures.length === previousCaptures) return;
    const oldCount = previousCaptures;
    captureKey = key; collection.replaceChildren();
    captures.slice(0, 30).forEach((capture, index) => {
      const item = document.createElement('div'); item.className = 'sketch-sideline-piece'; item.dataset.color = capture.color;
      const point = capturedPosition(index); item.style.left = `${point.x / 10}%`; item.style.top = `${point.y / 10}%`;
      item.style.setProperty('--sit-angle', `${index % 2 ? 4 : -5}deg`);
      const image = document.createElement('img'); image.alt = ''; image.draggable = false;
      const fallback = document.createElement('span'); fallback.className = 'sketch-sideline-fallback'; fallback.textContent = SYMBOLS[capture.color][capture.type]; fallback.hidden = true;
      item.append(image, fallback); collection.append(item); artwork(image, capture.color, capture.type, fallback);
      if (animate && oldCount >= 0 && index >= oldCount) track(item.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(.1)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' }], { duration: 400, delay: 760, fill: 'backwards', easing: 'ease-out' }));
    });
    previousCaptures = captures.length;
  }
  function circle(square: string, kind: 'selected' | 'legal' | 'last' | 'check', occupied = false) {
    const p = position(square);
    if (kind === 'last') {
      marks.append(svg('path', { d: `M${p.x - 38} ${p.y + 35}l63-2-59 7 70-4-67 9 59-4 M${p.x - 29} ${p.y + 33}q29 3 59-1`, class: 'sketch-last-mark', fill: 'none' })); return;
    }
    if (kind === 'check') {
      const x = p.x + 35, y = p.y - 38;
      marks.append(svg('path', { d: `M${x - 14} ${y + 11}L${x + 1} ${y - 16}l7 29-25-17 35-2-32 17 M${x - 12} ${y + 10}l14-24m18-1 5-7m-2 21 9 2`, class: 'sketch-check-mark', fill: 'none' })); return;
    }
    const radius = kind === 'selected' ? 43 : occupied ? 44 : 13;
    marks.append(svg('path', { d: `M${p.x - radius} ${p.y + 3}q-3 ${-radius * .83} ${radius * .62} ${-radius * 1.01}q${radius * .8} ${-radius * .38} ${radius * 1.23} ${radius * .14}q${radius * .43} ${radius * .61} ${radius * .14} ${radius * 1.19}q${-radius * .27} ${radius * .86} ${-radius * 1.04} ${radius * .72}q${-radius * 1.03} ${-radius * .02} ${-radius * .96} ${-radius * 1.04}`, class: `sketch-${kind}-mark`, fill: 'none' }));
    if (kind === 'selected' || occupied) marks.append(svg('path', { d: `M${p.x - radius + 6} ${p.y + 19}q-13 ${-radius * 1.38} ${radius + 4} ${-radius - 17}q${radius * 1.31} 8 ${radius * .77} ${radius * 1.51}q-17 ${radius * .62} ${-radius * 1.39} ${radius * .21}`, class: `sketch-${kind}-mark second-pass`, fill: 'none' }));
    else marks.append(svg('path', { d: `M${p.x - 6} ${p.y - 3}l10-2-12 8 14-4-10 7`, class: 'sketch-legal-mark pencil-dot', fill: 'none' }));
  }
  function sync({ board = [], selected = null, legal = [], lastMove = null, captures = [], checkSquare = null, animate = true }: SyncOptions = {}) {
    const pieces = board.flat().filter(piece => piece !== null);
    const desired = new Map(pieces.map(piece => [piece.square, piece]));
    const nextSignature = pieces.map(piece => `${piece.square}${piece.color}${piece.type}`).sort().join('|');
    const shouldAnimate = animate && !reducedMotion && signature !== '';
    const newlyCaptured = shouldAnimate && previousCaptures >= 0 && captures.length > previousCaptures;
    if (signature !== nextSignature) {
      finishAnimations();
      const moving = lastMove ? sprites.get(lastMove.from as Square) : undefined;
      if (moving && lastMove) {
        const destination = desired.get(lastMove.to as Square);
        if (destination && destination.color === moving.color && (destination.type === moving.type || lastMove.promotion)) {
          const captured = sprites.get(lastMove.to as Square);
          if (captured && captured !== moving) { sprites.delete(lastMove.to as Square); depart(captured, captures.length - 1, newlyCaptured); }
          const oldType = moving.type;
          sprites.delete(lastMove.from as Square); sprites.set(lastMove.to as Square, moving);
          move(moving, lastMove.to as Square, shouldAnimate); updatePiece(moving, destination);
          if (newlyCaptured) emote(moving);
          if (oldType === 'k' && Math.abs(FILES.indexOf(lastMove.from[0]) - FILES.indexOf(lastMove.to[0])) === 2) castleRook(lastMove, shouldAnimate);
        }
      }
      for (const [square, sprite] of sprites) {
        const piece = desired.get(square);
        if (!piece || piece.color !== sprite.color || piece.type !== sprite.type) { sprites.delete(square); depart(sprite, captures.length - 1, newlyCaptured); }
      }
      for (const piece of pieces) if (!sprites.has(piece.square)) {
        const sprite = createSprite(piece); sprites.set(piece.square, sprite);
        if (shouldAnimate && !newlyCaptured) track(sprite.body.animate([{ opacity: .25, transform: 'scale(.8) translateY(8%)' }, { opacity: 1, transform: 'scale(1) translateY(0)' }], { duration: 320, easing: 'ease-out' }));
      }
      signature = nextSignature;
    }
    marks.replaceChildren();
    if (lastMove) { circle(lastMove.from, 'last'); circle(lastMove.to, 'last'); }
    if (selected) circle(selected, 'selected');
    if (checkSquare) circle(checkSquare, 'check');
    for (const item of legal) { const square = typeof item === 'string' ? item : item.to; circle(square, 'legal', desired.has(square as Square)); }
    for (const [square, sprite] of sprites) sprite.element.classList.toggle('is-selected', square === selected);
    showCaptures(captures, shouldAnimate);
    if (pieces.length) revealPencilGrid();
  }
  function castleRook(lastMove: LastMove, animate: boolean) {
    const kingSide = lastMove.to[0] === 'g', rank = lastMove.from[1];
    const from = `${kingSide ? 'h' : 'a'}${rank}` as Square, to = `${kingSide ? 'f' : 'd'}${rank}` as Square;
    const rook = sprites.get(from);
    if (rook) { sprites.delete(from); sprites.set(to, rook); move(rook, to, animate); }
  }
  function pickSquare(clientX: number, clientY: number): Square | null {
    const bounds = root.getBoundingClientRect();
    const x = (clientX - bounds.left) / bounds.width * 1000, y = (clientY - bounds.top) / bounds.height * 1000;
    if (x < LEFT || y < TOP || x >= LEFT + CELL * 8 || y >= TOP + CELL * 8) return null;
    return `${FILES[Math.floor((x - LEFT) / CELL)]}${8 - Math.floor((y - TOP) / CELL)}` as Square;
  }
  function projectSquare(square: Square): SquareProjection {
    const p = position(square), x = (p.x - CELL / 2) * width / 1000, y = (p.y - CELL / 2) * height / 1000;
    const cellWidth = CELL * width / 1000, cellHeight = CELL * height / 1000;
    return { x, y, width: cellWidth, height: cellHeight, centerX: x + cellWidth / 2, centerY: y + cellHeight / 2, points: [{ x, y }, { x: x + cellWidth, y }, { x: x + cellWidth, y: y + cellHeight }, { x, y: y + cellHeight }] };
  }
  function resize() {
    const bounds = container.getBoundingClientRect();
    const nextWidth = Math.max(1, bounds.width), nextHeight = Math.max(1, bounds.height);
    if (nextWidth !== width || nextHeight !== height) finishAnimations();
    width = nextWidth; height = nextHeight;
  }
  function visibility() {
    root.dataset.paused = document.hidden ? 'true' : 'false';
    for (const animation of running.keys()) if (document.hidden) animation.pause(); else if (!reducedMotion) animation.play();
  }
  function setReducedMotion(value: boolean) {
    reducedMotion = value; root.dataset.motion = value ? 'still' : 'gentle';
    if (value) finishAnimations();
  }
  function greetResident(): CreatureName {
    const names: CreatureName[] = ['robin', 'snail', 'butterfly', 'bee'];
    const name = names[resident++ % names.length];
    hello.textContent = name === 'robin' ? '♪' : name === 'snail' ? '…' : name === 'butterfly' ? '✧' : 'bzz';
    if (!reducedMotion) track(hello.animate([{ opacity: 0, transform: 'translateY(5px) rotate(-8deg)' }, { opacity: .9, transform: 'translateY(-5px) rotate(4deg)', offset: .25 }, { opacity: 0, transform: 'translateY(-18px) rotate(-3deg)' }], { duration: 1800, easing: 'ease-out' }));
    onCreature?.(name); return name;
  }
  function click(event: MouseEvent) { const square = pickSquare(event.clientX, event.clientY); if (square) onSquare?.(square); }
  root.addEventListener('click', click); document.addEventListener('visibilitychange', visibility);
  const observer = new ResizeObserver(resize); observer.observe(container); resize(); visibility();
  queueMicrotask(() => { if (!destroyed && !ready) { ready = true; onReady?.(); } });
  function destroy() {
    destroyed = true; finishAnimations(); observer.disconnect();
    root.removeEventListener('click', click); document.removeEventListener('visibilitychange', visibility);
    for (const image of root.querySelectorAll('img')) { image.onload = null; image.onerror = null; }
    root.remove(); sprites.clear();
  }
  return { sync, projectSquare, pickSquare, resize, destroy, setReducedMotion, greetResident, whenSettled, settle: finishAnimations,
    setAtmosphere: mode => { root.dataset.atmosphere = mode; },
    setWeather: weather => { root.dataset.weather = weather; },
    setView: () => { /* This sketchbook is always a flat, readable chessboard. */ },
  };
}
