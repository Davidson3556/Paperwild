import './sketch-scene.css';
import type { Conservatory, ConservatoryOptions, CreatureName, LastMove, SquareProjection, SyncOptions } from './scene.ts';
import type { Capture, Color, PieceSymbol, Square } from './game.ts';

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
export function createSketchScene(container: HTMLElement, { onSquare, onCreature, onReady, reducedMotion = false }: ConservatoryOptions = {}): Conservatory {
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
  sheet.append(tiles, grid, coordinates, marks);
  const cast = document.createElement('div'); cast.className = 'sketch-cast';
  const collection = document.createElement('div'); collection.className = 'sketch-sidelines';
  const flights = document.createElement('div'); flights.className = 'sketch-departures';
  const hello = document.createElement('span'); hello.className = 'sketch-hello'; hello.textContent = '♪';
  root.append(sheet, collection, cast, flights, hello); container.append(root);
  let width = 1, height = 1, destroyed = false, ready = false, signature = '', captureKey = '', previousCaptures = -1, resident = 0;
  const sprites = new Map<Square, Sprite>();
  const running = new Map<Animation, (() => void) | undefined>();

  // The grid is drawn twice, imperfectly: the second pencil pass is lighter.
  // Every coloured square has individual wash edges and clipped pencil hatch.
  for (let row = 0; row < 8; row++) for (let file = 0; file < 8; file++) {
    const x = LEFT + file * CELL, y = TOP + row * CELL;
    const jitter = (file * 7 + row * 11) % 5;
    const dark = (file + 8 - row) % 2 === 1;
    const clip = svg('clipPath', { id: `${prefix}-${row}-${file}` });
    const outline = `M${x + 2},${y + 2 + jitter * .3} L${x + CELL - 2},${y + 1} L${x + CELL - 1 - jitter * .3},${y + CELL - 2} L${x + 1},${y + CELL - 1} Z`;
    clip.append(svg('path', { d: outline })); defs.append(clip);
    tiles.append(svg('path', { d: outline, fill: dark ? '#aebc96' : '#f2e7ca', opacity: dark ? .55 : .20 }));
    if (dark) {
      const hatch = svg('g', { 'clip-path': `url(#${prefix}-${row}-${file})`, stroke: '#70825b', 'stroke-width': 1.2, opacity: .34 });
      for (let line = -8; line < 15; line++) hatch.append(svg('path', { d: `M${x + line * 12},${y + CELL} l${CELL + 3},${-CELL - 2}` }));
      tiles.append(hatch);
    }
  }
  for (let index = 0; index <= 8; index++) {
    const v = LEFT + index * CELL, h = TOP + index * CELL;
    const bend = index % 2 ? 3.2 : -3;
    grid.append(svg('path', { d: `M${v},${TOP - 1} Q${v + bend},${TOP + 310} ${v - 1.4},${TOP + 600} T${v + .7},${TOP + CELL * 8 + 2}`, stroke: '#5e5947', 'stroke-width': index === 0 || index === 8 ? 2.1 : 1.75, opacity: .81 }));
    grid.append(svg('path', { d: `M${LEFT - 2},${h} Q${LEFT + 330},${h + bend} ${LEFT + 610},${h - 1.6} T${LEFT + CELL * 8 + 1},${h + .7}`, stroke: '#5e5947', 'stroke-width': index === 0 || index === 8 ? 2 : 1.65, opacity: .81 }));
    grid.append(svg('path', { d: `M${v + 1.5},${TOP + 3} L${v + .8},${TOP + CELL * 8 - 3} M${LEFT + 4},${h + 1.4} L${LEFT + CELL * 8 - 2},${h + 1.1}`, stroke: '#786f55', 'stroke-width': .65, opacity: .26 }));
  }
  for (let index = 0; index < 8; index++) {
    const file = svg('text', { x: LEFT + (index + .5) * CELL, y: 940, transform: `rotate(${index % 2 ? -3 : 2} ${LEFT + (index + .5) * CELL} 940)` }); file.textContent = FILES[index];
    const rank = svg('text', { x: 42, y: TOP + (index + .5) * CELL + 7, transform: `rotate(${index % 2 ? 3 : -3} 42 ${TOP + (index + .5) * CELL})` }); rank.textContent = String(8 - index);
    coordinates.append(file, rank);
  }
  // Little pencil corner flourishes tie the board to the surrounding notebook.
  grid.append(svg('path', { d: 'M53 65q-18-10-10-25q20 1 19 19m-7-5-8-9M939 894q19-1 22 17q-17 8-24-6m6 0 10 3', stroke: '#7e8a60', 'stroke-width': 1.7, opacity: .7 }));

  function track(animation: Animation, cleanup?: () => void) {
    running.set(animation, cleanup);
    if (document.hidden) animation.pause();
    animation.finished.then(() => {
      if (!running.has(animation)) return;
      running.delete(animation); cleanup?.(); animation.cancel();
    }, () => { running.delete(animation); });
    return animation;
  }
  function finishAnimations() {
    for (const [animation, cleanup] of running) { animation.cancel(); cleanup?.(); }
    running.clear();
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
    body.append(image, fallback); element.append(body, emote); cast.append(element);
    const sprite: Sprite = { element, body, image, fallback, emote, square: piece.square, color: piece.color, type: piece.type };
    element.style.setProperty('--idle-delay', `${-((piece.square.charCodeAt(0) + Number(piece.square[1]) * 3) % 17) / 3}s`);
    artwork(image, piece.color, piece.type, fallback); locate(sprite, piece.square); return sprite;
  }
  function updatePiece(sprite: Sprite, piece: BoardPiece) {
    if (sprite.type === piece.type && sprite.color === piece.color) return;
    sprite.type = piece.type; sprite.color = piece.color; sprite.element.className = `sketch-piece sketch-${piece.type}`;
    sprite.element.dataset.color = piece.color; sprite.fallback.textContent = SYMBOLS[piece.color][piece.type];
    artwork(sprite.image, piece.color, piece.type, sprite.fallback);
  }
  function move(sprite: Sprite, square: Square, animate: boolean) {
    const from = position(sprite.square), to = position(square); locate(sprite, square);
    if (!animate) return;
    track(sprite.element.animate([
      { left: `${from.x / 10}%`, top: `${from.y / 10}%` },
      { left: `${(from.x + to.x) / 20}%`, top: `${(from.y + to.y) / 20 - (sprite.type === 'n' ? 3 : 1.2)}%`, offset: .5 },
      { left: `${to.x / 10}%`, top: `${to.y / 10}%` },
    ], { duration: sprite.type === 'n' ? 620 : 540, easing: 'cubic-bezier(.22,.7,.22,1)' }));
    track(sprite.body.animate([
      { transform: 'rotate(0deg) scale(1)' },
      { transform: `rotate(${to.x > from.x ? -4 : 4}deg) scale(1.025,.97)`, offset: .36 },
      { transform: 'rotate(0deg) scale(1)' },
    ], { duration: 560, easing: 'ease-in-out' }));
  }
  function depart(sprite: Sprite, captureIndex: number, animate: boolean) {
    if (!animate) { sprite.element.remove(); return; }
    flights.append(sprite.element); sprite.element.style.zIndex = '70';
    const from = position(sprite.square), to = capturedPosition(captureIndex);
    const middleX = from.x + (from.x < 500 ? -110 : 110);
    track(sprite.element.animate([
      { left: `${from.x / 10}%`, top: `${from.y / 10}%`, transform: 'translate(-50%,-57%) rotate(0deg) scale(1)', opacity: 1 },
      { left: `${middleX / 10}%`, top: `${(from.y - 150) / 10}%`, transform: 'translate(-50%,-57%) rotate(-11deg) scale(.72)', opacity: 1, offset: .42 },
      { left: `${to.x / 10}%`, top: `${to.y / 10}%`, transform: 'translate(-50%,-57%) rotate(7deg) scale(.33)', opacity: 0 },
    ], { duration: 1000, easing: 'cubic-bezier(.2,.7,.3,1)' }), () => sprite.element.remove());
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
      marks.append(svg('path', { d: `M${p.x - 42},${p.y + 34} q35 6 84 -2 M${p.x - 39},${p.y + 39} l74 -1`, class: 'sketch-last-mark', fill: 'none' })); return;
    }
    if (kind === 'check') {
      const x = p.x + 35, y = p.y - 38;
      marks.append(svg('path', { d: `M${x} ${y - 15}l4 11 12-3-8 9 8 8-12-1-4 12-4-11-12 2 8-9-8-8 12 2z M${x + 18} ${y - 14}l6-7 M${x + 23} ${y + 4}l8 1`, class: 'sketch-check-mark', fill: 'none' })); return;
    }
    const radius = kind === 'selected' ? 43 : occupied ? 44 : 13;
    marks.append(svg('path', { d: `M${p.x - radius} ${p.y + 1} C${p.x - radius - 3} ${p.y - radius * 1.34},${p.x + radius + 5} ${p.y - radius * 1.25},${p.x + radius} ${p.y + 2} C${p.x + radius - 2} ${p.y + radius * 1.33},${p.x - radius + 1} ${p.y + radius * 1.25},${p.x - radius} ${p.y + 1}`, class: `sketch-${kind}-mark`, fill: kind === 'legal' && !occupied ? '#9b9e6b' : 'none' }));
    if (kind === 'selected') marks.append(svg('path', { d: `M${p.x - 40} ${p.y + 18}q-11-60 45-58q58 6 31 65q-18 28-56 14`, class: 'sketch-selected-mark second-pass', fill: 'none' }));
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
  return { sync, projectSquare, pickSquare, resize, destroy, setReducedMotion, greetResident,
    setAtmosphere: mode => { root.dataset.atmosphere = mode; },
    setWeather: weather => { root.dataset.weather = weather; },
    setView: () => { /* This sketchbook is always a flat, readable chessboard. */ },
  };
}
