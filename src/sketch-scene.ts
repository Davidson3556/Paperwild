import './sketch-scene.css';
import './capture-skirmish.css';
import type { Conservatory, ConservatoryOptions, CreatureName, LastMove, SquareProjection, SyncOptions } from './scene.ts';
import type { Capture, Color, PieceSymbol, Square } from './game.ts';
import { getPieceMotion } from './piece-motion.ts';
import { CAPTURE_PICKUP, getCaptureMotion } from './capture-motion.ts';
import type { CaptureGesture, CaptureMotionFrame, CaptureMotionPhase } from './capture-motion.ts';
import type { PieceMotionPlan } from './piece-motion.ts';
import { createCharacterFace } from './character-face.ts';
import { createCharacterIdle } from './character-idle.ts';
import { createCharacterLife } from './character-life.ts';
import { createCharacterPortrait } from './character-portrait.ts';
import { characterArt } from './character-art.ts';
import { TEAM_COLORS, handRaise, mittenGlyph } from './character-mittens.ts';
import { AMBER_PARTS } from './character-rig-amber.ts';
import { INDIGO_PARTS } from './character-rig-indigo.ts';

export interface SketchMotionEvent {
  id: number;
  phase: 'start' | 'duel' | 'land' | 'capture' | 'cancel';
  type: PieceSymbol;
  from: Square;
  to: Square;
  durationMs: number;
  contactTimesMs: readonly number[];
  capture: boolean;
}
/** Story beats of a capture, from the first step to the stretcher leaving. */
export type CaptureBeat = CaptureMotionPhase | 'pickup' | 'carry';
export interface CaptureBeatEvent {
  beat: CaptureBeat;
  attacker: PieceSymbol;
  attackerColor: Color;
  defender: PieceSymbol;
  defenderColor: Color;
  /** For the scuffle beat: impacts in milliseconds from the start of the beat. */
  impactsMs: readonly number[];
}
export interface SketchSceneOptions extends ConservatoryOptions {
  onMotion?: (event: SketchMotionEvent) => void;
  onIdle?: (role: PieceSymbol) => void;
  onCaptureBeat?: (event: CaptureBeatEvent) => void;
}
export interface SketchScene extends Conservatory {
  whenSettled(): Promise<void>;
  settle(): void;
  /** Pointer hover: the resident brightens, leans toward the cursor and hops once. */
  hover(square: Square | null, clientX?: number): PieceSymbol | null;
  /** A selected resident jumps for joy. Returns its role when it reacted. */
  delight(square: Square): PieceSymbol | null;
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
  base: SVGSVGElement;
  parts: Map<string, HTMLElement | SVGElement>;
  face: SVGSVGElement;
  idle: HTMLDivElement | null;
  idleSeed: number;
  life: ReturnType<typeof createCharacterLife>;
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

/** A watercolour puddle in the team's colour, outlined twice in pencil. It sits
 * on the paper under the feet, so a side is readable even when pieces mingle. */
function teamBase(color: Color, seed: number): SVGSVGElement {
  const random = (() => { let state = (seed * 2654435761) >>> 0 || 1; return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; }; })();
  const team = TEAM_COLORS[color];
  const base = svg('svg', { viewBox: '0 0 100 100', preserveAspectRatio: 'none', class: 'sketch-team-base', 'aria-hidden': 'true' });
  base.dataset.team = color;
  const loop = (rx: number, ry: number, wobble: number) => {
    const points = Array.from({ length: 9 }, (_, index) => {
      const angle = index / 9 * Math.PI * 2 + random() * .2;
      const stretch = 1 + (random() - .5) * wobble;
      return [50 + Math.cos(angle) * rx * stretch, 93 + Math.sin(angle) * ry * stretch];
    });
    let d = `M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
    for (let index = 1; index <= points.length; index++) {
      const [x, y] = points[index % points.length], [px, py] = points[index - 1];
      d += ` Q${((px + x) / 2 + (random() - .5) * 2).toFixed(1)} ${((py + y) / 2 + (random() - .5)).toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    return d;
  };
  base.append(
    svg('path', { d: loop(37, 6.6, .12), class: 'team-base-wash', fill: team.wash }),
    svg('path', { d: loop(38, 6.9, .08), class: 'team-base-line', fill: 'none', stroke: team.ink }),
    svg('path', { d: loop(35.5, 6.1, .14), class: 'team-base-line second-pass', fill: 'none', stroke: team.ink }),
  );
  if (color === 'b') base.append(svg('path', { d: 'M22 93.5h4m10 2.6h4m14-.4h5m11-2.4h4', class: 'team-base-hatch', fill: 'none', stroke: '#f3ead6' }));
  return base;
}

/** A flat sheet of pencilled chess, with all input owned by the semantic board. */
export function createSketchScene(container: HTMLElement, { onSquare, onCreature, onReady, onMotion, onIdle, onCaptureBeat, reducedMotion = false }: SketchSceneOptions = {}): SketchScene {
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
  function trackMotion(animation: Animation, event: SketchMotionEvent, cleanup?: (cancelled: boolean) => void) {
    motions.add(animation);
    track(animation, cancelled => {
      // Cleanup may hand off to another motion (the stretcher after a duel).
      // Register that motion before releasing this one so whenSettled never
      // resolves between the fight and its departure.
      cleanup?.(cancelled); motions.delete(animation);
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
    const holder = image.parentElement!;
    holder.dataset.artwork = 'loading';
    image.hidden = false; fallback.hidden = true;
    image.onload = () => { if (!destroyed) { image.hidden = false; fallback.hidden = true; holder.dataset.artwork = 'ready'; } };
    image.onerror = () => { if (!destroyed) { image.hidden = true; fallback.hidden = false; holder.dataset.artwork = 'missing'; } };
    image.src = characterArt(color, type);
  }
  function createSprite(piece: BoardPiece) {
    const element = document.createElement('div'); element.className = `sketch-piece sketch-${piece.type}`; element.dataset.color = piece.color;
    const body = document.createElement('div'); body.className = 'sketch-piece-body';
    const image = document.createElement('img'); image.alt = ''; image.draggable = false; image.className = 'sketch-piece-art'; image.decoding = 'async';
    const fallback = document.createElement('span'); fallback.className = 'sketch-piece-fallback'; fallback.textContent = SYMBOLS[piece.color][piece.type]; fallback.hidden = true;
    const emote = document.createElement('span'); emote.className = 'sketch-piece-emote'; emote.textContent = '!';
    const shadow = svg('svg', { viewBox: '0 0 100 100', preserveAspectRatio: 'none', class: 'sketch-ground-shadow' });
    shadow.append(svg('ellipse', { cx: 50, cy: 95, rx: 24, ry: 3, fill: '#706b48', opacity: .18 }), svg('path', { d: 'M30 95q20 3 39-1m-34 4 28-1', fill: 'none', stroke: '#746e4c', 'stroke-width': .7, opacity: .3 }));
    const idleSeed = (FILES.indexOf(piece.square[0]) + Number(piece.square[1]) * 8) * 37 + (piece.color === 'b' ? 17 : 0);
    const base = teamBase(piece.color, idleSeed);
    const face = createCharacterFace(piece.color, piece.type, idleSeed);
    const life = createCharacterLife(piece.color, piece.type, idleSeed);
    body.append(image, fallback, face); life.content.append(body); element.append(base, shadow, life.element, emote); cast.append(element);
    const sprite: Sprite = { element, body, image, fallback, emote, shadow, base, face, idle: null, idleSeed, life, parts: new Map(), pendingArtwork: false, square: piece.square, color: piece.color, type: piece.type };
    element.style.setProperty('--idle-delay', `${-((piece.square.charCodeAt(0) + Number(piece.square[1]) * 3) % 17) / 3}s`);
    artwork(image, piece.color, piece.type, fallback); articulate(sprite); locate(sprite, piece.square); return sprite;
  }
  function articulate(sprite: Sprite) {
    sprite.parts.clear();
    sprite.idle?.remove();
    const idle = createCharacterIdle(sprite.color, sprite.type, sprite.idleSeed);
    sprite.idle = idle?.element ?? null;
    sprite.element.classList.toggle('has-idle-parts', !!idle);
    if (idle) {
      sprite.body.style.setProperty('--idle-cutout', idle.mask);
      sprite.body.append(idle.element);
      for (const part of idle.element.querySelectorAll<HTMLElement>('[data-part]')) sprite.parts.set(part.dataset.part!, part);
    } else sprite.body.style.removeProperty('--idle-cutout');
  }
  function refreshArtwork(sprite: Sprite) {
    sprite.element.className = `sketch-piece sketch-${sprite.type}`; sprite.pendingArtwork = false;
    sprite.element.dataset.color = sprite.color; sprite.fallback.textContent = SYMBOLS[sprite.color][sprite.type];
    const life = createCharacterLife(sprite.color, sprite.type, sprite.idleSeed);
    life.content.append(sprite.body); sprite.life.element.replaceWith(life.element); sprite.life = life;
    sprite.face.remove(); sprite.face = createCharacterFace(sprite.color, sprite.type, sprite.idleSeed); sprite.body.append(sprite.face);
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
    // The team puddle stays on the paper while its resident hops or flutters.
    track(sprite.base.animate(plan.frames.map(pose => ({
      offset: pose.offset, transform: `translateY(${pose.lift * height / 1000}px) scale(${1 - pose.lift / 260})`,
    })), { duration: plan.durationMs, easing: 'linear' }));
    animateLimbs(sprite, plan);
    drawFootsteps(plan, from, to);
  }
  function animatePart(sprite: Sprite, name: string, frames: Keyframe[], duration: number) {
    const part = sprite.parts.get(name);
    if (part) track(part.animate(frames, { duration, easing: 'linear' }));
  }
  /** Signed degrees that lift a painted hand toward the sky, per resident. */
  function raiseOf(sprite: Sprite, name: string): number {
    const part = (sprite.color === 'w' ? AMBER_PARTS : INDIGO_PARTS)[sprite.type].find(item => item.name === name);
    return part ? handRaise(part, sprite.type) : (name.startsWith('left') ? 40 : -40);
  }
  /** Named gestures for hands, ears and wings, starting `delay` ms from now. */
  function gesture(sprite: Sprite, kind: CaptureGesture | 'hello', delay: number, duration: number, impacts: readonly number[] = []) {
    if (duration <= 0) return;
    const options = (frames: Keyframe[]) => ({ frames, timing: { duration, delay, easing: 'ease-in-out' as const } });
    for (const side of ['left', 'right'] as const) {
      const raise = raiseOf(sprite, `${side}-hand`), sign = side === 'left' ? 1 : -1;
      let hand: Keyframe[];
      switch (kind) {
        case 'guard': hand = [0, .25, .5, .75, 1].map((offset, index) => ({ offset, transform: `rotate(${raise * .55 + (index % 2 ? 7 : -5) * sign}deg)` })); break;
        case 'jab': {
          // Alternate punches land exactly on the plan's impacts.
          const keys: Keyframe[] = [{ offset: 0, transform: `rotate(${raise * .45}deg)` }];
          impacts.forEach((impact, index) => {
            const at = (impact - delay) / duration, mine = (index % 2 === 0) === (side === 'left');
            if (at <= .03 || at >= .97) return;
            keys.push({ offset: at - .03, transform: `rotate(${raise * (mine ? .15 : .55)}deg)` });
            keys.push({ offset: at, transform: `rotate(${raise * (mine ? .95 : .4)}deg) translateY(-2%)` });
          });
          keys.push({ offset: 1, transform: `rotate(${raise * .4}deg)` });
          hand = keys; break;
        }
        case 'flail': hand = Array.from({ length: 13 }, (_, index) => ({ offset: index / 12, transform: `rotate(${(index % 2 ? 1 : -1) * 22 * sign + raise * .3}deg)` })); break;
        case 'cheer': hand = [{ offset: 0, transform: 'none' }, { offset: .18, transform: `rotate(${raise}deg)` }, ...[.32, .46, .6, .74].map((offset, index) => ({ offset, transform: `rotate(${raise + (index % 2 ? 9 : -9) * sign}deg)` })), { offset: .88, transform: `rotate(${raise * .9}deg)` }, { offset: 1, transform: 'none' }]; break;
        case 'dazed': hand = [{ offset: 0, transform: 'none' }, { offset: .2, transform: `rotate(${-raise * .3}deg)` }, { offset: .5, transform: `rotate(${-raise * .25 + 6 * sign}deg)` }, { offset: .8, transform: `rotate(${-raise * .3 - 4 * sign}deg)` }, { offset: 1, transform: 'none' }]; break;
        case 'wave': case 'hello': {
          // One hand waves; the other gives a small happy pat.
          const waving = side === (sprite.color === 'w' ? 'right' : 'left');
          hand = waving
            ? [{ offset: 0, transform: 'none' }, { offset: .2, transform: `rotate(${raise * .8}deg)` }, ...[.34, .48, .62, .76].map((offset, index) => ({ offset, transform: `rotate(${raise * .8 + (index % 2 ? 16 : -16)}deg)` })), { offset: 1, transform: 'none' }]
            : [{ offset: 0, transform: 'none' }, { offset: .4, transform: `rotate(${raise * .22}deg)` }, { offset: .7, transform: `rotate(${raise * .1}deg)` }, { offset: 1, transform: 'none' }];
          break;
        }
      }
      const { frames, timing } = options(hand);
      const part = sprite.parts.get(`${side}-hand`);
      if (part) track(part.animate(frames, timing));
      const flap = kind === 'cheer' || kind === 'flail' || kind === 'hello' ? 6 : kind === 'jab' ? 4 : 2;
      const wing = sprite.parts.get(`${side}-wing`);
      if (wing) track(wing.animate(Array.from({ length: flap * 2 + 1 }, (_, index) => ({ offset: index / (flap * 2), transform: index % 2 ? `rotate(${sign * -18}deg) scaleX(.72)` : 'none' })), timing));
      const ear = sprite.parts.get(`${side}-ear`);
      if (ear) track(ear.animate(kind === 'dazed'
        ? [{ transform: 'none' }, { transform: `rotate(${sign * -26}deg)`, offset: .3 }, { transform: `rotate(${sign * -20}deg)`, offset: .8 }, { transform: 'none' }]
        : [{ transform: 'none' }, { transform: `rotate(${sign * 12}deg)`, offset: .25 }, { transform: `rotate(${sign * -8}deg)`, offset: .55 }, { transform: 'none' }], timing));
    }
    const leaf = sprite.parts.get('leaf') ?? sprite.parts.get('tail-tip');
    if (leaf && kind !== 'guard') track(leaf.animate([{ transform: 'none' }, { transform: 'rotate(-10deg)', offset: .3 }, { transform: 'rotate(8deg)', offset: .6 }, { transform: 'none' }], { duration, delay, easing: 'ease-in-out' }));
  }
  /** Sparkle, confetti and a hand-lettered word for winners and happy clicks. */
  function celebrate(sprite: Sprite, delay: number, word: string, big: boolean) {
    const burst = document.createElement('div');
    burst.className = `sketch-celebration${big ? ' is-big' : ''}`; burst.dataset.team = sprite.color;
    const team = TEAM_COLORS[sprite.color];
    const rays = Array.from({ length: 8 }, (_, index) => `<path d="M50 ${index % 2 ? 22 : 15}V${index % 2 ? 9 : 3}" transform="rotate(${index * 45} 50 50)"/>`).join('');
    burst.innerHTML = `<svg class="celebration-rays" viewBox="0 0 100 100" aria-hidden="true"><g stroke="${team.ink}">${rays}</g><path class="celebration-star" d="m50 37 3.5 8 8.5.8-6.4 5.6 2 8.4-7.6-4.5-7.6 4.5 2-8.4-6.4-5.6 8.5-.8Z" fill="${team.palm}" stroke="${team.ink}"/></svg>${word ? `<span class="celebration-word">${word}</span>` : ''}`;
    for (let index = 0; index < (big ? 12 : 6); index++) {
      const bit = document.createElement('i');
      bit.style.setProperty('--bit', String(index));
      bit.style.background = index % 3 === 2 ? '#f6ecd2' : index % 2 ? team.palm : team.cuff;
      burst.append(bit);
      const angle = (index / (big ? 12 : 6)) * Math.PI * 2 + .3, reach = big ? 120 + (index % 3) * 35 : 70 + (index % 2) * 25;
      track(bit.animate([
        { opacity: 0, transform: 'translate(-50%,-50%) rotate(0deg) scale(.4)' },
        { opacity: 1, transform: `translate(calc(-50% + ${Math.cos(angle) * reach * .55}%), calc(-50% + ${Math.sin(angle) * reach * .55 - 40}%)) rotate(${index * 70}deg) scale(1)`, offset: .3 },
        { opacity: 0, transform: `translate(calc(-50% + ${Math.cos(angle) * reach}%), calc(-50% + ${Math.sin(angle) * reach * .6 + 70}%)) rotate(${index * 140}deg) scale(.8)` },
      ], { duration: big ? 1100 : 760, delay, easing: 'cubic-bezier(.2,.8,.4,1)' }));
    }
    sprite.element.append(burst);
    track(burst.animate([{ opacity: 0, transform: 'scale(.4) rotate(-12deg)' }, { opacity: 1, transform: 'scale(1.1) rotate(4deg)', offset: .22 }, { opacity: 1, transform: 'scale(1) rotate(0deg)', offset: .7 }, { opacity: 0, transform: 'scale(1.05) rotate(2deg)' }],
      { duration: big ? 1150 : 780, delay, easing: 'ease-out' }), () => burst.remove());
  }
  /** Squeeze the painted eyes into happy crescents for a moment. */
  function joy(sprite: Sprite, delay: number, duration: number) {
    const smile = sprite.face.querySelector<SVGGElement>('.character-joy');
    if (smile) track(smile.animate([{ opacity: 0 }, { opacity: 1, offset: .12 }, { opacity: 1, offset: .82 }, { opacity: 0 }], { duration, delay, easing: 'linear' }));
  }
  function emoteAt(sprite: Sprite, text: string, delay: number, duration = 900) {
    track(sprite.emote.animate([
      { opacity: 0, transform: 'translateY(5px) rotate(-8deg) scale(.3)' },
      { opacity: 1, transform: 'translateY(-4px) rotate(6deg) scale(1.1)', offset: .18 },
      { opacity: 1, transform: 'translateY(-7px) rotate(-3deg) scale(1)', offset: .7 },
      { opacity: 0, transform: 'translateY(-12px) rotate(0deg) scale(.85)' },
    ], { duration, delay, easing: 'ease-out' }), () => { sprite.emote.textContent = '!'; delete sprite.emote.dataset.glyph; });
    // The glyph changes when this emote's visible window begins.
    track(sprite.emote.animate([], { duration: Math.max(1, delay) }), cancelled => { if (!cancelled) { sprite.emote.textContent = text; sprite.emote.dataset.glyph = text; } });
  }
  function captureBeat(beat: CaptureBeat, attacker: Sprite, defender: Sprite, attackerType: PieceSymbol, defenderType: PieceSymbol, impactsMs: readonly number[] = []) {
    // Promotion changes the live sprite's role before its pawn artwork lands.
    // Keep this capture story attached to the role that began the challenge.
    onCaptureBeat?.({ beat, attacker: attackerType, attackerColor: attacker.color, defender: defenderType, defenderColor: defender.color, impactsMs });
  }
  function duel(attacker: Sprite, defender: Sprite, square: Square, captureIndex: number) {
    const fromSquare = attacker.square, from = position(fromSquare), target = position(defender.square);
    const attackerType = attacker.type, defenderType = defender.type;
    const plan = getCaptureMotion(attackerType, fromSquare, square, defender.square, defenderType);
    locate(attacker, square);
    for (const sprite of [attacker, defender]) {
      sprite.element.classList.add('is-moving', 'is-dueling');
      sprite.element.style.zIndex = sprite === attacker ? '72' : '71';
    }
    defender.element.classList.add('is-defending');
    const clash = { x: target.x + plan.clash.x * CELL, y: target.y + plan.clash.y * CELL };
    const effect = document.createElement('div');
    effect.className = 'sketch-skirmish'; effect.dataset.testid = 'capture-skirmish';
    effect.dataset.phase = 'approach'; effect.dataset.color = attacker.color;
    effect.dataset.from = fromSquare; effect.dataset.to = square; effect.dataset.victimSquare = defender.square;
    effect.style.left = `${clash.x / 10}%`; effect.style.top = `${(clash.y + 42) / 10}%`;
    effect.innerHTML = `<svg class="skirmish-spark" viewBox="0 0 60 60" aria-hidden="true"><path d="m30 4-7 17 11 2-9 15 12 1-10 17"/><path d="m11 20 7 5m30-7-6 6m-30 22 7-4m30 4-7-5"/></svg>
    <svg class="skirmish-ink" viewBox="0 0 220 130" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path class="skirmish-cloud" d="M28 98q-26-6-20-28-14-24 14-32 0-27 34-24 18-20 42-4 26-14 40 6 30-6 38 18 30 2 26 30 18 22-6 34 4 26-28 24-14 22-44 10-24 18-46 0-30 14-42-6-24 4-30-16Z"/>
      <path class="skirmish-cloud-shade" d="M38 88q30 16 60 4m22 6q34 10 58-8M60 40q24-14 52-4"/>
      <path class="skirmish-loop" d="M52 74q46-46 104-8 22 18-18 22-50 0-54-20-2-22 26-14 20 8-8 22"/><path class="skirmish-loop" d="M58 92q30 20 98-2M64 44q32-18 84 2"/>
      <path class="skirmish-streak" d="m4 70 14-4m184 6 16 5M74 8l4 11m70 102 4 9"/>
    </svg>`;
    const pops = document.createElement('div'); pops.className = 'skirmish-pops';
    // Mittens, a foot and a star poke out of the cloud on each impact, with a
    // hand-lettered word. Alternate sides so both teams visibly join in.
    const slots = [[-4, 18, 200], [102, 26, -20], [12, -26, 230], [94, -18, -40], [-8, 62, 160], [104, 66, 20]] as const;
    plan.impactTimesMs.forEach((impact, index) => {
      const [x, y, angle] = slots[index % slots.length];
      const team: Color = index % 2 ? defender.color : attacker.color;
      const mitten = mittenGlyph(team, 'pop-mitten');
      mitten.style.left = `${x}%`; mitten.style.top = `${y}%`; pops.append(mitten);
      const out = { x: Math.cos(angle * Math.PI / 180) * 26, y: Math.sin(angle * Math.PI / 180) * 26 };
      track(mitten.animate([
        { opacity: 0, transform: `translate(-50%,-50%) rotate(${angle}deg) scale(.3)` },
        { opacity: 1, transform: `translate(calc(-50% + ${out.x}%), calc(-50% + ${out.y}%)) rotate(${angle}deg) scale(1.15)`, offset: .35 },
        { opacity: 1, transform: `translate(calc(-50% + ${out.x * .8}%), calc(-50% + ${out.y * .8}%)) rotate(${angle + 12}deg) scale(1)`, offset: .7 },
        { opacity: 0, transform: `translate(-50%,-50%) rotate(${angle}deg) scale(.5)` },
      ], { duration: 280, delay: impact - 70, easing: 'ease-out' }));
      const word = document.createElement('span'); word.className = 'pop-word'; word.textContent = plan.words[index % plan.words.length];
      word.dataset.team = team; word.style.left = `${[16, 84, 50, 22, 78, 50][index]}%`; word.style.top = `${[-18, -14, -30, 104, 100, -22][index]}%`;
      pops.append(word);
      track(word.animate([
        { opacity: 0, transform: `translate(-50%,-50%) rotate(${index % 2 ? 9 : -9}deg) scale(.4)` },
        { opacity: 1, transform: `translate(-50%,-50%) rotate(${index % 2 ? -4 : 5}deg) scale(1.18)`, offset: .2 },
        { opacity: 1, transform: `translate(-50%,-62%) rotate(${index % 2 ? -2 : 3}deg) scale(1)`, offset: .72 },
        { opacity: 0, transform: 'translate(-50%,-80%) scale(.92)' },
      ], { duration: 440, delay: impact - 20, easing: 'ease-out' }));
      if (index % 2 === 0) {
        const star = svg('svg', { viewBox: '0 0 40 40', class: 'pop-star', 'aria-hidden': 'true' });
        star.append(svg('path', { d: 'm20 3 4.5 11 12 1-9 8 3 12-10.5-6.5L9.5 35l3-12-9-8 12-1Z' }));
        star.style.left = `${[30, 70, 50][index / 2]}%`; star.style.top = `${[-6, 4, 96][index / 2]}%`; pops.append(star);
        track(star.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(.2) rotate(0deg)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1.2) rotate(70deg)', offset: .4 }, { opacity: 0, transform: 'translate(-50%,-90%) scale(.7) rotate(150deg)' }], { duration: 380, delay: impact, easing: 'ease-out' }));
      }
    });
    const puffs = Array.from({ length: 8 }, (_, index) => {
      const puff = document.createElement('i'); puff.className = 'skirmish-puff-bit'; pops.append(puff);
      const angle = index / 8 * Math.PI * 2;
      track(puff.animate([
        { opacity: 0, transform: 'translate(-50%,-50%) scale(.5)' },
        { opacity: .9, transform: `translate(calc(-50% + ${Math.cos(angle) * 120}%), calc(-50% + ${Math.sin(angle) * 90}%)) scale(1.2)`, offset: .35 },
        { opacity: 0, transform: `translate(calc(-50% + ${Math.cos(angle) * 260}%), calc(-50% + ${Math.sin(angle) * 190 - 40}%)) scale(.6)` },
      ], { duration: 520, delay: 1690, easing: 'cubic-bezier(.2,.8,.4,1)' }));
      return puff;
    });
    void puffs;
    effect.append(pops);
    cast.append(effect);
    // The cloud: bloom in, rumble, then burst into puffs as the winner emerges.
    const cloud = effect.querySelector<SVGSVGElement>('.skirmish-ink')!;
    track(cloud.animate([
      { opacity: 0, transform: 'scale(.25)', offset: 0 },
      { opacity: 0, transform: 'scale(.25)', offset: 840 / plan.durationMs },
      { opacity: 1, transform: 'scale(1.12)', offset: 960 / plan.durationMs },
      { opacity: 1, transform: 'scale(.97) rotate(-2deg)', offset: 1150 / plan.durationMs },
      { opacity: 1, transform: 'scale(1.04) rotate(2deg)', offset: 1400 / plan.durationMs },
      { opacity: 1, transform: 'scale(1) rotate(-1deg)', offset: 1650 / plan.durationMs },
      { opacity: 0, transform: 'scale(1.35) rotate(3deg)', offset: 1820 / plan.durationMs },
      { opacity: 0, transform: 'scale(1.35)', offset: 1 },
    ], { duration: plan.durationMs, easing: 'linear' }));
    const spark = effect.querySelector<SVGSVGElement>('.skirmish-spark')!;
    track(spark.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(.4)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1.2) rotate(8deg)', offset: .25 }, { opacity: 0, transform: 'translate(-50%,-50%) scale(.9) rotate(-6deg)', offset: .5 }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1.1)', offset: .7 }, { opacity: 0, transform: 'translate(-50%,-50%) scale(1.3)' }], { duration: 300, delay: 640, easing: 'ease-out' }));
    // Phase markers use the same pausable lifecycle as the characters.
    for (const phase of plan.phases.slice(1)) track(effect.animate([], { duration: phase.startMs }), cancelled => {
      if (cancelled) return;
      effect.dataset.phase = phase.name;
      captureBeat(phase.name, attacker, defender, attackerType, defenderType, phase.name === 'scuffle' ? plan.impactTimesMs.map(time => time - phase.startMs) : []);
    });
    captureBeat('approach', attacker, defender, attackerType, defenderType);
    const locations = (frames: readonly CaptureMotionFrame[], origin: Point) => frames.map(pose => ({
      offset: pose.offset, left: `${(origin.x + pose.x * CELL) / 10}%`, top: `${(origin.y + pose.y * CELL) / 10}%`,
    }));
    const bodies = (frames: readonly CaptureMotionFrame[]) => frames.map(pose => ({
      offset: pose.offset, transform: `rotate(${pose.rotation}deg) scale(${pose.scaleX},${pose.scaleY})`,
    }));
    const timing = { duration: plan.durationMs, easing: 'linear' };
    track(defender.element.animate(locations(plan.defenderFrames, target), timing));
    track(defender.body.animate(bodies(plan.defenderFrames), timing));
    track(attacker.body.animate(bodies(plan.attackerFrames), timing));
    // Gait limbs for the approach, then the duel's own gestures.
    const approach = plan.phases[0].endMs;
    animateLimbs(attacker, { ...getPieceMotion(attackerType, fromSquare, square), durationMs: approach });
    for (const { gesture: kind, startMs, endMs } of plan.attackerGestures) gesture(attacker, kind, startMs, endMs - startMs, plan.impactTimesMs);
    for (const { gesture: kind, startMs, endMs } of plan.defenderGestures) gesture(defender, kind, startMs, endMs - startMs, plan.impactTimesMs);
    emoteAt(defender, '!', 170, 650);
    emoteAt(attacker, '♪', 600, 520);
    joy(attacker, 1760, 760);
    celebrate(attacker, 1820, plan.victoryWord, true);
    track(effect.animate([], { duration: 1760 }), cancelled => {
      if (cancelled) return;
      const dizzy = document.createElement('div'); dizzy.className = 'sketch-dizzy'; dizzy.setAttribute('aria-hidden', 'true');
      dizzy.innerHTML = '<span>✦</span><span>★</span><span>✧</span>';
      defender.element.append(dizzy);
      track(dizzy.animate([{ opacity: 0, scale: '.5' }, { opacity: 1, scale: '1' }], { duration: 160, easing: 'ease-out' }));
    });
    const rest = { x: target.x + plan.defenderRest.x * CELL, y: target.y + plan.defenderRest.y * CELL };
    claimSquare(square, attacker.color, 2380);
    trackMotion(attacker.element.animate(locations(plan.attackerFrames, from), timing), {
      id: ++motionId, phase: 'duel', type: plan.type, from: fromSquare, to: square,
      durationMs: plan.durationMs, contactTimesMs: plan.impactTimesMs, capture: true,
    }, cancelled => {
      effect.remove();
      for (const sprite of [attacker, defender]) {
        sprite.element.classList.remove('is-moving', 'is-dueling', 'is-defending');
        sprite.emote.textContent = '!';
      }
      locate(attacker, square);
      if (attacker.pendingArtwork) refreshArtwork(attacker);
      if (cancelled) { defender.element.remove(); return; }
      depart(defender, captureIndex, true, rest, () => captureBeat('pickup', attacker, defender, attackerType, defenderType), () => captureBeat('carry', attacker, defender, attackerType, defenderType));
    });
  }
  /** The winner plants a little pennant and its colour soaks into the square. */
  function claimSquare(square: Square, color: Color, delay: number) {
    const p = position(square), team = TEAM_COLORS[color];
    const file = FILES.indexOf(square[0]), row = 8 - Number(square[1]);
    const bloom = svg('path', {
      d: `M${p.x - 50} ${p.y - 30}q18-28 52-22 40-6 46 26 10 34-8 52-34 26-64 6-34-20-26-62Z`,
      fill: team.wash, class: 'sketch-claim-bloom', 'clip-path': `url(#${prefix}-${row}-${file})`, opacity: 0,
    });
    const flag = svg('g', { class: 'sketch-claim-flag', transform: `translate(${p.x + 34} ${p.y + 40})`, opacity: 0 });
    flag.append(
      svg('path', { d: 'M0 0V-62', stroke: '#6d5639', 'stroke-width': 2.4, fill: 'none', 'stroke-linecap': 'round' }),
      svg('path', { class: 'claim-pennant', d: 'M1-61q14-3 26 2-8 6-2 13-12-5-24-1Z', fill: team.palm, stroke: team.ink, 'stroke-width': 1.3 }),
      svg('ellipse', { cx: 0, cy: 1, rx: 7, ry: 2.2, fill: '#6d5639', opacity: .25 }),
    );
    traces.append(bloom, flag);
    track(bloom.animate([{ opacity: 0, transform: 'scale(.4)' }, { opacity: .42, transform: 'scale(1.05)', offset: .2 }, { opacity: .2, transform: 'scale(1.1)', offset: .6 }, { opacity: 0, transform: 'scale(1.12)' }],
      { duration: 1900, delay, easing: 'ease-out' }), () => bloom.remove());
    track(flag.animate([{ opacity: 0, transform: `translate(${p.x + 34}px, ${p.y + 40}px) scale(1, 0)` }, { opacity: 1, transform: `translate(${p.x + 34}px, ${p.y + 40}px) scale(1, 1.12)`, offset: .1 }, { opacity: 1, transform: `translate(${p.x + 34}px, ${p.y + 40}px) scale(1, 1)`, offset: .16 }, { opacity: 1, transform: `translate(${p.x + 34}px, ${p.y + 40}px) scale(1, 1)`, offset: .82 }, { opacity: 0, transform: `translate(${p.x + 34}px, ${p.y + 40}px) scale(1, 1)` }],
      { duration: 2600, delay, easing: 'ease-out' }), () => flag.remove());
  }
  function animateLimbs(sprite: Sprite, plan: PieceMotionPlan) {
    // These are the same painted cutouts used at rest. Locomotion takes over
    // their transforms instead of adding a second set of ears, paws or hands.
    for (const [side, sign] of [['left', -1], ['right', 1]] as const) {
      const frames: Keyframe[] = [];
      for (let index = 0; index <= 20; index++) {
        const offset = index / 20, envelope = Math.sin(Math.PI * offset);
        frames.push({ offset, transform: `rotate(${Math.sin(offset * Math.PI * 6) * sign * 10 * envelope}deg)` });
      }
      animatePart(sprite, `${side}-hand`, frames, plan.durationMs);
    }
    if (plan.type === 'p' || plan.type === 'r' || plan.type === 'k') {
      const swing = plan.type === 'r' ? 14 : plan.type === 'k' ? 19 : 29;
      const firstPlant = plan.contacts[0].atMs / plan.durationMs;
      const period = (plan.contacts[1].atMs - plan.contacts[0].atMs) / plan.durationMs * 2;
      for (const [side, phase] of [['left', 0], ['right', Math.PI]] as const) {
        const foot: Keyframe[] = [];
        for (let index = 0; index <= 20; index++) {
          const offset = index / 20, active = Math.sin(Math.PI / 2 * Math.min(1, offset / .09)) * (offset > .92 ? (1 - offset) / .08 : 1);
          const gait = Math.sin((offset - firstPlant) * Math.PI * 2 / period - Math.PI / 2 + phase);
          const bend = Math.max(0, gait) * swing * 1.15;
          foot.push({ offset, transform: `rotate(${(bend - gait * swing) * active * .5}deg) translateY(${-Math.max(0, gait) * active * (plan.type === 'r' ? 2 : 4)}px)` });
        }
        animatePart(sprite, `${side}-foot`, foot, plan.durationMs);
      }
    }
    if (plan.type === 'q') {
      for (const [side, sign] of [['left', -1], ['right', 1]] as const) {
        animatePart(sprite, `${side}-foot`, plan.frames.map(pose => ({ offset: pose.offset, transform: `rotate(${sign * pose.lift * .25}deg) translateY(${-pose.lift * .06}px)` })), plan.durationMs);
      }
    }
    if (plan.type === 'n') {
      const offsets = [0, .10, .17, .25, .43, .58, .73, .78, .88, 1];
      const earAngles = [0, -13, -28, 13, 25, 18, -12, -32, 12, 0];
      for (const [name, side] of [['left-ear', -1], ['right-ear', 1]] as const) animatePart(sprite, name, offsets.map((offset, index) => ({ offset, transform: `rotate(${earAngles[index] * (side < 0 ? .8 : 1.1)}deg)` })), plan.durationMs);
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
    if (plan.type === 'q') animatePart(sprite, 'tail-tip', plan.frames.map(pose => ({ offset: pose.offset, transform: `rotate(${-pose.rotation * 1.7}deg) scaleX(${1 + pose.lift / 240})` })), plan.durationMs);
  }
  function drawFootsteps(plan: PieceMotionPlan, from: Point, to: Point) {
    for (let index = 0; index < plan.contacts.length; index++) {
      const contact = plan.contacts[index];
      const pose = plan.frames.find(frame => Math.abs(frame.offset * plan.durationMs - contact.atMs) <= 2) ?? plan.frames.at(-1)!;
      const x = from.x + (to.x - from.x) * pose.progress, y = from.y + (to.y - from.y) * pose.progress + 50;
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
      const dust = svg('g', { class: 'sketch-landing-dust', transform: `translate(${to.x} ${to.y + 50})`, opacity: 0 });
      dust.append(svg('path', { d: 'M-15 1q-8-6-14-2m46-1q9-7 16-2m-22 11 7-1m-32-2-7-1', fill: 'none', class: 'sketch-dust-line' })); traces.append(dust);
      track(dust.animate([{ opacity: 0, scale: '.5' }, { opacity: .75, scale: '1.1', offset: .18 }, { opacity: 0, scale: '1.5' }], { duration: 430, delay: plan.landingTimeMs, fill: 'backwards', easing: 'ease-out' }), () => dust.remove());
    }
  }
  function depart(sprite: Sprite, captureIndex: number, animate: boolean, restPoint?: Point, onPickup?: () => void, onCarry?: () => void) {
    if (!animate) { sprite.element.remove(); return; }
    const rest = restPoint ?? position(sprite.square);
    const { durationMs, arriveMs, liftMs, departMs } = CAPTURE_PICKUP;
    const carrier = document.createElement('div');
    carrier.className = 'sketch-stretcher'; carrier.dataset.testid = 'capture-stretcher';
    carrier.dataset.captureIndex = String(captureIndex);
    const helpers = [48, 202].map((x, index) => `<g class="stretcher-beetle" style="--beetle-delay:${index ? '-.13s' : '0s'}" transform="translate(${x} 105)">
      <g class="stretcher-beetle-legs" fill="none"><path d="m-10 16-9 11 7 2m16-12 10 12-7 1M-4 16l-5 15 8-1"/></g>
      <ellipse cx="0" cy="7" rx="17" ry="20" fill="${index ? '#9bad98' : '#c6af7c'}" fill-opacity=".82"/><path d="M0-11q-4 17 0 37m-13-23 8 3m17-4-7 3" fill="none" opacity=".6"/>
      <ellipse cy="-10" rx="13" ry="10" fill="#e3d8b8"/><path d="m-7-18-5-9m17 9 6-9" fill="none"/><circle cx="-5" cy="-11" r="1.8" fill="#535346"/><circle cx="5" cy="-11" r="1.8" fill="#535346"/><path d="m-3-5q3 3 6-1M-10-13l-13-16m33 16 12-16" fill="none"/>
      <path d="m-11-24 22-1-8-10-11 3Z" fill="#c86f5d" fill-opacity=".85"/><path d="M-3-31h6m-3-3v6" stroke="#fff6e8" stroke-width="1.4"/>
    </g>`).join('');
    carrier.innerHTML = `<svg class="sketch-stretcher-drawing" viewBox="0 0 250 160" fill="none" stroke="#706752" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <ellipse cx="125" cy="146" rx="106" ry="5" fill="#8d8a68" fill-opacity=".12" stroke="none"/>
      <path d="M26 84q100 7 198-1M27 88l197-1" stroke-width="3.4" stroke="#9c805c"/>
      <path d="M56 75q64-7 139 0l-5 28q-68 10-133-1Z" fill="#e4d6b4" fill-opacity=".9"/><path d="m61 80 9 18m11-20 8 22m11-22 8 23m11-24 8 24m11-24 8 24m11-22 8 19m11-20 7 18" stroke="#b2a57c" stroke-opacity=".4"/>
      <path d="m34 82-7-7m189 10 9-8M64 104q64 13 127-1" stroke="#88765c"/>${helpers}
    </svg><span class="stretcher-call" aria-hidden="true">hup! hup!</span>`;
    flights.append(carrier);
    // The loser waits on the paper, still seeing stars, until the crew arrives.
    sprite.element.style.left = `${rest.x / 10}%`; sprite.element.style.top = `${rest.y / 10}%`;
    sprite.element.style.zIndex = '68';
    sprite.element.classList.add('is-awaiting-stretcher');
    const lieY = rest.y - 12;
    gesture(sprite, 'dazed', 0, arriveMs);
    track(sprite.element.animate([
      { left: `${rest.x / 10}%`, top: `${rest.y / 10}%`, transform: 'translate(-50%,-57%) rotate(0deg) scale(1)' },
      { left: `${rest.x / 10}%`, top: `${rest.y / 10}%`, transform: 'translate(-50%,-57%) rotate(-6deg) scale(1)', offset: .35 },
      { left: `${rest.x / 10}%`, top: `${rest.y / 10}%`, transform: 'translate(-50%,-57%) rotate(5deg) scale(1)', offset: arriveMs / liftMs - .05 },
      { left: `${rest.x / 10}%`, top: `${(lieY - 30) / 10}%`, transform: 'translate(-50%,-57%) rotate(40deg) scale(.95)', offset: (arriveMs / liftMs + 1) / 2 },
      { left: `${rest.x / 10}%`, top: `${lieY / 10}%`, transform: 'translate(-50%,-57%) rotate(76deg) scale(.9)' },
    ], { duration: liftMs, easing: 'ease-in-out' }), cancelled => {
      if (cancelled) return;
      // Hand the resident to the crew exactly where the stretcher waits.
      sprite.element.classList.remove('is-awaiting-stretcher'); sprite.element.classList.add('is-carried');
      sprite.element.style.left = '50%'; sprite.element.style.top = '38%'; sprite.element.style.zIndex = '2';
      carrier.prepend(sprite.element);
      gesture(sprite, 'wave', 0, durationMs - liftMs);
      emoteAt(sprite, 'bye!', 80, 700);
    });
    const edgeX = rest.x < 500 ? 20 : 980, exitX = rest.x < 500 ? 120 : 880;
    for (const [at, callback] of [[arriveMs, onPickup], [departMs, onCarry]] as const) {
      track(carrier.animate([], { duration: at }), cancelled => { if (!cancelled) callback?.(); });
    }
    trackMotion(carrier.animate([
      { left: `${edgeX / 10}%`, top: `${rest.y / 10}%`, transform: 'translate(-50%,-45%) rotate(-3deg) scale(.8)', opacity: 0 },
      { left: `${(edgeX + (rest.x - edgeX) * .2) / 10}%`, top: `${rest.y / 10}%`, transform: 'translate(-50%,-45%) rotate(3deg) scale(.88)', opacity: 1, offset: .08 },
      { left: `${rest.x / 10}%`, top: `${rest.y / 10}%`, transform: 'translate(-50%,-45%) rotate(-1deg) scale(.95)', opacity: 1, offset: arriveMs / durationMs },
      { left: `${rest.x / 10}%`, top: `${(rest.y + 4) / 10}%`, transform: 'translate(-50%,-45%) rotate(1deg) scale(.95)', opacity: 1, offset: liftMs / durationMs },
      { left: `${rest.x / 10}%`, top: `${rest.y / 10}%`, transform: 'translate(-50%,-45%) rotate(0deg) scale(.95)', opacity: 1, offset: departMs / durationMs },
      { left: `${(rest.x < 500 ? Math.max(40, rest.x - 160) : Math.min(960, rest.x + 160)) / 10}%`, top: `${Math.min(860, rest.y + 150) / 10}%`, transform: 'translate(-50%,-45%) rotate(-4deg) scale(.8)', opacity: 1, offset: .82 },
      { left: `${exitX / 10}%`, top: '103%', transform: 'translate(-50%,-45%) rotate(3deg) scale(.55)', opacity: 0 },
    ], { duration: durationMs, easing: 'linear' }), {
      id: ++motionId, phase: 'capture', type: sprite.type, from: sprite.square, to: sprite.square,
      durationMs, contactTimesMs: [arriveMs, liftMs, departMs], capture: true,
    }, () => { carrier.remove(); sprite.element.remove(); });
  }
  function showCaptures(captures: readonly Capture[], animate: boolean, arrivalDelay = 760) {
    const key = captures.map(c => `${c.color}${c.type}${c.by}${c.moveNumber}`).join('|');
    if (key === captureKey && captures.length === previousCaptures) return;
    const oldCount = previousCaptures;
    captureKey = key; collection.replaceChildren();
    captures.slice(0, 30).forEach((capture, index) => {
      const item = document.createElement('div'); item.className = 'sketch-sideline-piece'; item.dataset.color = capture.color;
      const point = capturedPosition(index); item.style.left = `${point.x / 10}%`; item.style.top = `${point.y / 10}%`;
      item.style.setProperty('--sit-angle', `${index % 2 ? 4 : -5}deg`);
      item.append(createCharacterPortrait(capture.color, capture.type, index * 127 + 41)); collection.append(item);
      if (animate && oldCount >= 0 && index >= oldCount) track(item.animate([{ opacity: 0, transform: 'translate(-50%,-50%) scale(.1)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' }], { duration: 400, delay: arrivalDelay, fill: 'backwards', easing: 'ease-out' }));
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
    let captureArrivalDelay = 760;
    if (signature !== nextSignature) {
      finishAnimations();
      const moving = lastMove ? sprites.get(lastMove.from as Square) : undefined;
      if (moving && lastMove) {
        const destination = desired.get(lastMove.to as Square);
        if (destination && destination.color === moving.color && (destination.type === moving.type || lastMove.promotion)) {
          // En passant has an empty destination: find the opposing sprite
          // removed from the new legal board instead of assuming to=victim.
          const captured = newlyCaptured ? [...sprites.values()].find(sprite => sprite.color !== moving.color && !desired.has(sprite.square))
            ?? sprites.get(lastMove.to as Square) : sprites.get(lastMove.to as Square);
          if (captured && captured !== moving) sprites.delete(captured.square);
          const oldType = moving.type;
          sprites.delete(lastMove.from as Square); sprites.set(lastMove.to as Square, moving);
          if (captured && captured !== moving && newlyCaptured) {
            duel(moving, captured, lastMove.to as Square, captures.length - 1);
            captureArrivalDelay = getCaptureMotion(oldType, lastMove.from as Square, lastMove.to as Square).durationMs + CAPTURE_PICKUP.durationMs - 300;
          } else {
            if (captured && captured !== moving) depart(captured, captures.length - 1, false);
            move(moving, lastMove.to as Square, shouldAnimate);
          }
          updatePiece(moving, destination);
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
    showCaptures(captures, shouldAnimate, captureArrivalDelay);
    if (pieces.length) revealPencilGrid();
  }
  // A resident noticed by the pointer brightens, leans toward it and hops; a
  // selected one jumps for joy. These never move a piece or delay chess input.
  const reactions = new WeakMap<Sprite, Animation[]>();
  let hovered: Sprite | undefined;
  const lastHop = new WeakMap<Sprite, number>();
  function react(sprite: Sprite, animations: () => void) {
    for (const animation of reactions.get(sprite) ?? []) retire(animation, true);
    const before = new Set(running.keys());
    animations();
    reactions.set(sprite, [...running.keys()].filter(animation => !before.has(animation)));
  }
  function canReact(sprite: Sprite | undefined): sprite is Sprite {
    return !!sprite && !destroyed && !reducedMotion && !document.hidden && !motions.size
      && !sprite.element.classList.contains('is-moving') && sprite.body.dataset.artwork === 'ready';
  }
  function hop(sprite: Sprite, big: boolean) {
    const height = big ? 30 : 15, spin = big ? 7 : 3;
    track(sprite.body.animate(big ? [
      { transform: 'none' },
      { transform: 'translateY(2%) scale(1.12,.84)', offset: .14 },
      { transform: `translateY(-${height}%) rotate(${-spin}deg) scale(.9,1.12)`, offset: .36 },
      { transform: `translateY(-${height * .8}%) rotate(${spin}deg) scale(.98,1.03)`, offset: .46 },
      { transform: 'translateY(1%) scale(1.14,.84)', offset: .62 },
      { transform: `translateY(-${height * .38}%) rotate(${-spin * .5}deg) scale(.96,1.05)`, offset: .76 },
      { transform: 'translateY(.5%) scale(1.05,.95)', offset: .9 },
      { transform: 'none' },
    ] : [
      { transform: 'none' },
      { transform: 'translateY(1%) scale(1.07,.9)', offset: .18 },
      { transform: `translateY(-${height}%) rotate(${-spin}deg) scale(.95,1.07)`, offset: .45 },
      { transform: 'translateY(.5%) scale(1.06,.93)', offset: .72 },
      { transform: `translateY(-${height * .2}%) rotate(${spin * .4}deg)`, offset: .86 },
      { transform: 'none' },
    ], { duration: big ? 980 : 600, easing: 'ease-in-out' }));
    // Its puddle squeezes while the resident is in the air.
    track(sprite.base.animate([{ transform: 'none' }, { transform: 'scale(.86)', offset: big ? .36 : .45 }, { transform: 'scale(1.06)', offset: big ? .62 : .72 }, { transform: 'none' }], { duration: big ? 980 : 600, easing: 'ease-in-out' }));
  }
  function hover(square: Square | null, clientX?: number): PieceSymbol | null {
    const sprite = square ? sprites.get(square) : undefined;
    if (hovered && hovered !== sprite) {
      hovered.element.classList.remove('is-hovered'); hovered.body.style.rotate = '';
      hovered = undefined;
    }
    if (!sprite) return null;
    if (clientX !== undefined) {
      // Lean a few degrees toward the pointer, like a curious little creature.
      const bounds = sprite.element.getBoundingClientRect();
      const lean = Math.max(-1, Math.min(1, (clientX - (bounds.left + bounds.width / 2)) / (bounds.width / 2)));
      if (!reducedMotion && !sprite.element.classList.contains('is-moving')) sprite.body.style.rotate = `${(lean * 6).toFixed(2)}deg`;
    }
    if (hovered === sprite) return null;
    hovered = sprite; sprite.element.classList.add('is-hovered');
    const now = performance.now();
    if (!canReact(sprite) || now - (lastHop.get(sprite) ?? -Infinity) < 900) return null;
    lastHop.set(sprite, now);
    react(sprite, () => { hop(sprite, false); joy(sprite, 120, 520); gesture(sprite, 'hello', 60, 640); emoteAt(sprite, '♡', 60, 760); });
    return sprite.type;
  }
  function delight(square: Square): PieceSymbol | null {
    const sprite = sprites.get(square);
    if (!canReact(sprite)) return null;
    lastHop.set(sprite, performance.now());
    react(sprite, () => { hop(sprite, true); joy(sprite, 100, 900); gesture(sprite, 'cheer', 40, 940); emoteAt(sprite, '✦', 120, 820); celebrate(sprite, 260, '', false); });
    return sprite.type;
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
  function idleGesture(event: AnimationEvent) {
    if (event.animationName !== 'resident-voice-clock' || destroyed || document.hidden || reducedMotion || motions.size) return;
    const cue = event.target;
    if (!(cue instanceof HTMLElement) || !cue.classList.contains('character-life-voice-cue')) return;
    if (cue.closest('.reduced-motion, [data-page-paused=true]')) return;
    const element = cue.closest<HTMLDivElement>('.sketch-piece');
    const sprite = element?.dataset.square ? sprites.get(element.dataset.square as Square) : undefined;
    // Only the current board resident can nominate a call. Old capture flights,
    // replaced promotion artwork and decorative portraits have no voice here.
    if (!sprite || sprite.element !== element || element.classList.contains('is-moving') || cue.parentElement !== sprite.life.element) return;
    onIdle?.(sprite.type);
  }
  cast.addEventListener('animationiteration', idleGesture);
  root.addEventListener('click', click); document.addEventListener('visibilitychange', visibility);
  const observer = new ResizeObserver(resize); observer.observe(container); resize(); visibility();
  queueMicrotask(() => { if (!destroyed && !ready) { ready = true; onReady?.(); } });
  function destroy() {
    destroyed = true; finishAnimations(); observer.disconnect();
    cast.removeEventListener('animationiteration', idleGesture);
    root.removeEventListener('click', click); document.removeEventListener('visibilitychange', visibility);
    for (const image of root.querySelectorAll('img')) { image.onload = null; image.onerror = null; }
    root.remove(); sprites.clear();
  }
  return { sync, projectSquare, pickSquare, resize, destroy, setReducedMotion, greetResident, whenSettled, settle: finishAnimations, hover, delight,
    setAtmosphere: mode => { root.dataset.atmosphere = mode; },
    setWeather: weather => { root.dataset.weather = weather; },
    setView: () => { /* This sketchbook is always a flat, readable chessboard. */ },
  };
}
