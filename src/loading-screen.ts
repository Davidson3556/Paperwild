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
const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export interface LoadingScreen {
  /** True while the notebook is on screen; the board should wait folded flat. */
  readonly active: boolean;
  /** Call once the game page is built. Resolves when the game is revealed. */
  finish(): Promise<void>;
}

/** Drives the inline notebook in index.html: real progress for the cast's
 * artwork and the fonts (the ribbon bookmark), then the band snaps, the cover
 * opens and the game comes out of the page. A tap opens it as soon as it can. */
export function createLoadingScreen(): LoadingScreen {
  const root = document.getElementById('paperwild-loading');
  const app = document.getElementById('app');
  if (!root) return { active: false, finish: () => Promise.resolve() };
  const status = root.querySelector('.pw-loading-status');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const quick = document.documentElement.classList.contains('is-quick-load');
  const pace = quick ? .45 : 1;
  if (app) app.inert = true;
  let message = 0;
  const showMessage = (text: string) => {
    if (!status) return;
    const line = document.createElement('span'); line.textContent = text;
    status.replaceChildren(line);
  };
  const rotation = window.setInterval(() => showMessage(MESSAGES[++message % MESSAGES.length]), 1600);
  const urls = firstArtwork();
  const total = urls.length + 1;
  let loaded = 0;
  const step = () => { loaded++; root.style.setProperty('--progress', String(Math.min(1, loaded / total))); };
  const assets = Promise.all([
    ...urls.map(url => new Promise<void>(resolve => {
      const image = new Image();
      image.onload = image.onerror = () => { step(); resolve(); };
      image.src = url;
    })),
    (document.fonts?.ready ?? Promise.resolve()).then(step, step),
  ]);
  // Long enough to watch the acorn drawn on the cover, unless someone taps.
  let tapped: () => void = () => {};
  const tap = new Promise<void>(resolve => { tapped = resolve; });
  const minimum = Promise.race([wait(reduced ? 250 : quick ? 1100 : 2600), tap]);
  const ceiling = wait(9000);
  // A second tap during the opening skips straight into the game.
  let skip: () => void = () => {};
  const skipped = new Promise<void>(resolve => { skip = resolve; });
  let opening = false;
  root.addEventListener('click', () => { if (opening) skip(); else tapped(); });
  let finishing: Promise<void> | undefined;
  return {
    active: true,
    finish(): Promise<void> {
      finishing ??= Promise.race([Promise.all([assets, minimum]), ceiling]).then(async () => {
        window.clearInterval(rotation);
        root.style.setProperty('--progress', '1');
        showMessage('The club is ready. Off we go!');
        try { sessionStorage.setItem('paperwild.loaded', '1'); } catch { /* Private browsing. */ }
        opening = true;
        if (!reduced) {
          const story = async () => {
            root.classList.add('is-ready');
            await wait(600 * pace);
            const book = root.querySelector<HTMLElement>('.pw-book');
            if (book) root.style.setProperty('--open-scale', String(Math.min(1, innerWidth * .94 / (2 * book.offsetWidth))));
            root.classList.add('is-opening');
            await wait(1250 * pace);
            if (app) app.inert = false;
            root.classList.add('is-entering');
            await wait(640 * pace);
          };
          await Promise.race([story(), skipped]);
        }
        if (app) app.inert = false;
        root.remove();
        document.documentElement.classList.remove('is-loading', 'is-quick-load');
      });
      return finishing;
    },
  };
}
