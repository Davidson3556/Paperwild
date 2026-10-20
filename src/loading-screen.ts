import { characterArt } from './character-art.ts';
import type { Color, PieceSymbol } from './game.ts';

const MESSAGES = [
  'Sharpening the pencils…',
  'Waking the little inklings…',
  'Ironing the mittens…',
  'Teaching the hare its L-shapes…',
  'Polishing the badger’s crown…',
  'Asking the moth to find the light…',
  'Putting the camp kettle on…',
] as const;

/** The artwork the game shows first; loading it here warms the browser cache. */
function firstArtwork(): string[] {
  const cast: string[] = [];
  for (const color of ['w', 'b'] as Color[]) for (const type of ['p', 'n', 'b', 'r', 'q', 'k'] as PieceSymbol[]) cast.push(characterArt(color, type));
  return [...cast, '/art/sketchbook-paper.jpg'];
}
export interface LoadingScreen {
  /** True while the notebook is on screen; the board should wait folded flat. */
  readonly active: boolean;
  /** Call once the game page is built. Resolves when the game is revealed. */
  finish(): Promise<void>;
}

export interface LoadingScreenOptions {
  /** Use the same effective preference as the board, including a saved pause. */
  reducedMotion?: boolean;
}

/** Drives the inline notebook in index.html: real progress for the cast's
 * artwork and the fonts (the ribbon bookmark), then the band snaps, the cover
 * opens and the game comes out of the page. The button can request an early
 * opening, then skip the opening itself without leaving a delayed story alive. */
export function createLoadingScreen({ reducedMotion }: LoadingScreenOptions = {}): LoadingScreen {
  const root = document.getElementById('paperwild-loading');
  const app = document.getElementById('app');
  if (!root) return { active: false, finish: () => Promise.resolve() };
  const status = root.querySelector('.pw-loading-status');
  const control = root.querySelector<HTMLButtonElement>('#pw-loading-skip');
  const reduced = reducedMotion ?? matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Apply this before the game mounts, so its saved pause also shows a complete
  // static cover rather than invisible, never-animated letters or artwork.
  document.documentElement.classList.toggle('reduced-motion', reduced);
  if (app) { app.inert = true; app.setAttribute('aria-busy', 'true'); }
  root.setAttribute('aria-busy', 'true');
  let disposed = false;
  const timers = new Map<number, () => void>();
  const wait = (ms: number) => new Promise<boolean>(resolve => {
    const timer = window.setTimeout(() => { timers.delete(timer); resolve(true); }, ms);
    timers.set(timer, () => { window.clearTimeout(timer); resolve(false); });
  });
  let message = 0;
  const showMessage = (text: string) => {
    if (!status || disposed) return;
    const line = document.createElement('span'); line.textContent = text;
    status.replaceChildren(line);
  };
  const rotation = window.setInterval(() => showMessage(MESSAGES[++message % MESSAGES.length]), 1600);
  const urls = firstArtwork();
  const total = urls.length + 1;
  let loaded = 0;
  const step = () => {
    if (disposed) return;
    loaded++; root.style.setProperty('--progress', String(Math.min(1, loaded / total)));
  };
  const images: HTMLImageElement[] = [];
  const assets = Promise.all([
    ...urls.map(url => new Promise<void>(resolve => {
      const image = new Image();
      images.push(image);
      image.onload = image.onerror = () => { step(); resolve(); };
      image.src = url;
    })),
    (document.fonts?.ready ?? Promise.resolve()).then(step, step),
  ]);
  // Keep the full notebook sequence on every visit. An explicit action, rather
  // than a previous tab visit, decides whether to shorten the introduction.
  let openEarly: () => void = () => {};
  const requested = new Promise<void>(resolve => { openEarly = resolve; });
  const minimum = Promise.race([wait(reduced ? 900 : 2600), requested]);
  const ceiling = wait(9000);
  let opening = false;
  const complete = () => {
    if (disposed) return;
    disposed = true;
    window.clearInterval(rotation);
    for (const cancel of timers.values()) cancel();
    timers.clear();
    for (const image of images) image.onload = image.onerror = null;
    control?.removeEventListener('click', skip);
    if (app) { app.inert = false; app.removeAttribute('aria-busy'); }
    root.removeAttribute('aria-busy');
    root.remove();
    document.documentElement.classList.remove('is-loading');
  };
  const skip = () => {
    if (opening) complete();
    else {
      openEarly();
      if (control) { control.textContent = 'Opening when ready…'; control.disabled = true; }
    }
  };
  control?.addEventListener('click', skip);
  let finishing: Promise<void> | undefined;
  return {
    get active() { return !disposed; },
    finish(): Promise<void> {
      finishing ??= Promise.race([Promise.all([assets, minimum]), ceiling]).then(async () => {
        if (disposed) return;
        window.clearInterval(rotation);
        root.style.setProperty('--progress', '1');
        showMessage('The club is ready. Off we go!');
        opening = true;
        if (control) { control.disabled = false; control.textContent = 'Skip opening'; }
        if (!reduced) {
          root.classList.add('is-ready');
          if (!await wait(600)) return;
          const book = root.querySelector<HTMLElement>('.pw-book');
          if (book) root.style.setProperty('--open-scale', String(Math.min(1, innerWidth * .94 / (2 * book.offsetWidth))));
          root.classList.add('is-opening');
          if (!await wait(1250)) return;
          root.classList.add('is-entering');
          if (!await wait(640)) return;
        }
        complete();
      });
      return finishing;
    },
  };
}
