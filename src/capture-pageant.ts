import './capture-pageant.css';
import './field-pageant.css';
import type { Capture, PieceSymbol } from './game.ts';
import { createCharacterPortrait } from './character-portrait.ts';
import { createCapturePageantState } from './capture-pageant-state.ts';
import type { CapturePageantEntry, CapturePageantSnapshot } from './capture-pageant-state.ts';

export type PageantCue = 'arrival' | 'sermon' | 'plant' | 'bell' | 'petals' | 'choir' | 'memorial';

interface PageantOptions {
  reducedMotion?: boolean;
  onCue?: (cue: PageantCue, role?: PieceSymbol) => void;
}

const NAMES: Readonly<Record<PieceSymbol, string>> = { p: 'Acorn', r: 'Old Stump', n: 'Hare', b: 'Moth', q: 'Fox', k: 'Badger' };
const SERMONS: Readonly<Record<PieceSymbol, string>> = {
  p: 'Dear woodland. Acorn had big plans, very small feet, and no idea what a diagonal was. We shall miss the enthusiasm.',
  r: 'Old Stump stood for something. Mostly in straight lines. May the earth be soft, and the termites exceptionally polite.',
  n: 'Hare took the scenic route through life. Two steps this way, one step that way. Never once asked for directions.',
  b: 'Moth followed the light. And the diagonals. We leave a little lamp on, just in case this is another dramatic entrance.',
  q: 'Fox could go almost anywhere. Naturally, Fox chose trouble. We commend a magnificent career in being a little bit extra.',
  k: 'Badger moved one small step at a time. A sensible life. A lovely crown. An absolutely unreasonable collection of biscuits.',
};
const QUIRKS: Readonly<Record<PieceSymbol, readonly string[]>> = {
  p: ['A tiny oak is considering its options.', 'The snacks have been inherited by a worm.', 'Still dreaming of the other side of the board.'],
  r: ['A mushroom has applied for a room.', 'The roots are writing their memoirs.', 'Please knock. The termites are napping.'],
  n: ['Even the flowers grow in an L.', 'A carrot has been left in the will.', 'The ghost has already hopped the fence.'],
  b: ['A small lamp glows under the leaves.', 'The night shift sends its regards.', 'The flowers have learned to flutter.'],
  q: ['The flowers are being unnecessarily fabulous.', 'A secret biscuit stash has been discovered.', 'The ghost is wearing the crown sideways.'],
  k: ['A committee of worms has been appointed.', 'The crown is now a very small bird bath.', 'The biscuits remain a constitutional matter.'],
};

const SVG_OPEN = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" aria-hidden="true" focusable="false">';
const BELL = `${SVG_OPEN}<path class="wash" d="M21 51c8-6 5-16 9-25 3-7 15-9 21-2 7 7 2 21 11 27-10 5-29 6-41 0Z"/><path d="M21 51c8-6 5-16 9-25 3-7 15-9 21-2 7 7 2 21 11 27-10 5-29 6-41 0Zm15 5c1 9 12 10 15-1M38 18c-1-8 9-9 9-1M13 31l-7-4m10 16H7m58-12 7-5m-7 18 9 1"/></svg>`;
const FLOWER = `${SVG_OPEN}<path class="petal-wash" d="M40 33c-25-21-35 7-13 13-12 19 10 30 18 11 20 15 35-9 13-18 7-23-17-29-18-6Z"/><path d="M40 33c-25-21-35 7-13 13-12 19 10 30 18 11 20 15 35-9 13-18 7-23-17-29-18-6Z"/><circle cx="42" cy="43" r="7"/><path d="M43 59c-3 8-1 13 2 18m-3-9c-11-9-15-2-8 3 4 2 7 0 9 0"/></svg>`;
const CHOIR = `${SVG_OPEN}<path class="wash" d="m22 31 7-8 4 7 10-7 2 10c10 11 6 24-5 25-14 1-26-13-18-27Z"/><path d="m22 31 7-8 4 7 10-7 2 10c10 11 6 24-5 25-14 1-26-13-18-27Zm29 13 12-3V19l11-4v21M63 41c-8-3-14 4-9 7 4 3 9 0 9-7Zm11-5c-8-3-13 4-8 7 4 2 8-1 8-7Z"/><path d="m28 39 3 1m9-4 3 1m-7 6c-6 0-5 8 0 8 5-1 5-7 0-8Z"/></svg>`;

const CLEARING = `<svg class="pageant-landscape" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 320" preserveAspectRatio="none" aria-hidden="true" focusable="false">
<defs><filter id="pageant-paper"><feTurbulence type="fractalNoise" baseFrequency=".085" numOctaves="2" seed="11" result="grain"/><feComposite in="grain" in2="SourceGraphic" operator="in"/><feBlend in="SourceGraphic" mode="multiply"/></filter></defs>
<path class="pageant-grass-wash" d="M4 227c112-35 162-19 246-6s139-40 221-21 151-16 245 12l-2 96-709 3Z"/>
<path class="pageant-horizon" d="M8 243c67-14 95-20 150-11s87 7 134-2 94-19 147-12 115 17 151 8 79-2 121 2M13 251c62-12 91-19 143-12M420 226c70 1 117 13 151 7"/>
<g class="pageant-tree"><path class="pageant-tree-wash" d="M29 103C0 91 7 56 34 57 16 21 61 5 76 34c25-29 61-7 48 19 38 4 31 46 1 49-8 26-39 33-55 15-12 20-36 9-41-14Z"/><path d="m69 231 4-129-22-25m22 46 30-35m-36 143 6-129M30 104C0 91 8 57 34 58 17 22 60 7 76 35c23-27 60-8 47 19 37 5 30 44 1 48-8 25-37 31-54 15-12 19-36 10-40-13Z"/></g>
<g class="pageant-mushrooms"><path class="pageant-cap" d="M605 227c2-27 40-27 44 1-13 7-30 6-44-1Z"/><path d="M605 227c2-27 40-27 44 1-13 7-30 6-44-1Zm14 5-3 27 15 2-3-29m-5-13 1 1m14 5 1-1"/><path class="pageant-cap" d="M661 247c3-20 30-19 32 0-11 5-22 5-32 0Z"/><path d="M661 247c3-20 30-19 32 0-11 5-22 5-32 0Zm12 3-1 17 9 1-1-18"/></g>
<g class="pageant-beetle pageant-beetle-one"><path class="pageant-beetle-shell" d="M117 259c-19-12-35 2-26 17 9 12 32 3 26-17Z"/><path d="M117 259c-19-12-35 2-26 17 9 12 32 3 26-17Zm-17-3 5 25m-15-20-9-5m8 14-10 2m37-12 10-4m-8 13 10 2m-31-18-3-8m12 10 3-8"/></g>
<g class="pageant-beetle pageant-beetle-two"><path class="pageant-beetle-shell" d="M560 269c-13-8-24 2-19 12 7 8 22 3 19-12Z"/><path d="M560 269c-13-8-24 2-19 12 7 8 22 3 19-12Zm-11-3 3 18m-11-14-7-3m6 10-7 2m26-8 8-3m-7 10 8 1m-20-16-2-5"/></g>
<path class="pageant-grass" d="m43 274-5-13 9 8 2-15m282 29-4-13 7 8 5-19m266 24-4-14 8 7 2-17m-446 18-5-11 10 6 2-15"/>
</svg>`;

export function createCapturePageant(container: HTMLElement, options: PageantOptions = {}) {
  let reducedMotion = options.reducedMotion ?? false;
  let destroyed = false;
  let initialSync = true;
  let frame = 0;
  let previousTime = 0;
  let lastCue = '';
  let portraitKey = '';
  let memorialPage = 0;
  let memorialKeys: string[] = [];
  let effectTimer: ReturnType<typeof setTimeout> | undefined;
  const model = createCapturePageantState();
  const plotButtons = new Map<string, HTMLButtonElement>();
  const plotClicks = new Map<string, number>();
  const root = document.createElement('section');
  root.className = 'capture-pageant';
  root.setAttribute('aria-label', 'Woodland send-offs');
  root.dataset.phase = 'idle';
  root.dataset.queueCount = '0';
  root.innerHTML = `<div class="pageant-heading"><span class="pageant-heading-flower">${FLOWER}</span><div><p class="pageant-eyebrow">meanwhile, in the margins</p><h2>A very small send-off.</h2></div><span class="pageant-queue" hidden></span></div>
  <p class="pageant-intro">Captured pieces get a little ceremony. The woodland takes this very seriously. Mostly.</p>
  <div class="pageant-stage" aria-hidden="true">${CLEARING}
    <div class="pageant-sermon"><span class="pageant-sermon-title">the moth has a few words</span><p></p></div>
    <div class="pageant-procession"><span class="pageant-bearer pageant-bearer-left"></span><span class="pageant-bearer pageant-bearer-right"></span><div class="pageant-stretcher"><svg viewBox="0 0 220 75" aria-hidden="true"><path class="pageant-cloth" d="m17 29 185-2-13 30c-55 12-106 13-162-1Z"/><path d="m3 28 214-2M7 32l208-3m-192 2 11 26c45 11 104 11 153-1l11-25M42 37l3 14m121-14-3 14"/></svg><span class="pageant-cargo"></span></div></div>
    <div class="pageant-celebrant"><span class="pageant-preacher"></span><svg class="pageant-book" viewBox="0 0 100 70" aria-hidden="true"><path d="M49 61C36 51 20 48 4 48L8 9c18-2 33 4 43 13C61 10 78 7 96 11l-1 39c-18-3-33 1-46 11Z"/><path d="m51 22-2 39M14 20c12-1 20 4 28 8m-28 3c10 0 19 4 27 8m21-11c8-5 16-8 25-7m-25 18c8-5 16-7 25-6"/></svg></div>
    <div class="pageant-mound"><svg viewBox="0 0 200 75" aria-hidden="true"><path d="M5 63C20 27 42 45 56 26c19-24 41-1 55-5 20-8 30 12 40 13 21-1 35 10 45 30-57 8-136 7-191-1Z"/><path d="m27 58 8-4m20 3 5 3m21-20 6 3m30 10 7-4m30 10 8-1"/></svg><span class="pageant-little-sprout"><i></i><i></i></span><span class="pageant-plaque">a good little story</span></div>
    <div class="pageant-spirit"><svg viewBox="0 0 90 110" aria-hidden="true"><path d="M15 98V44C15 0 76 0 76 44l-1 54-14-9-14 11-15-10-17 8Z"/><path class="pageant-spirit-face" d="M32 44v8m24-8v8m-20 9c3 5 8 5 12 0"/></svg><span>back for the snacks</span></div>
    <span class="pageant-choir-notes" aria-hidden="true">hmm · hmm · hmmm</span>
    <div class="pageant-petals" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<i style="--petal-index:${i}"></i>`).join('')}</div>
    <p class="pageant-idle-note">No little send-offs yet.<br>Everyone is busy being alive.</p>
  </div>
  <p class="pageant-status" role="status" aria-live="polite" aria-atomic="true">The meadow is listening.</p>
  <div class="pageant-actions"><button type="button" data-pageant-cue="bell" aria-label="Ring the bell" title="Ring the bell">${BELL}<span>Ring the bell</span></button><button type="button" data-pageant-cue="petals" aria-label="Scatter petals" title="Scatter petals">${FLOWER}<span>Scatter petals</span></button><button type="button" data-pageant-cue="choir" aria-label="Wake the choir" title="Wake the choir">${CHOIR}<span>Wake the choir</span></button></div>
  <p class="pageant-notice" aria-live="polite"></p><div class="pageant-garden" hidden><div class="pageant-memorials" role="group" aria-label="Little memorial garden"></div><nav class="pageant-pagination" aria-label="Memorial pages" hidden><button type="button" data-pageant-page="previous" aria-label="Previous memorials"><span aria-hidden="true">←</span></button><span class="pageant-page-number" role="status" aria-live="polite"></span><button type="button" data-pageant-page="next" aria-label="Next memorials"><span aria-hidden="true">→</span></button></nav></div>`;
  container.append(root);
  const query = <T extends Element>(selector: string) => root.querySelector<T>(selector)!;
  const status = query<HTMLParagraphElement>('.pageant-status');
  const notice = query<HTMLParagraphElement>('.pageant-notice');
  const queue = query<HTMLSpanElement>('.pageant-queue');
  const sermon = query<HTMLParagraphElement>('.pageant-sermon p');
  const cargo = query<HTMLSpanElement>('.pageant-cargo');
  const memorials = query<HTMLDivElement>('.pageant-memorials');
  const garden = query<HTMLDivElement>('.pageant-garden');
  const pagination = query<HTMLElement>('.pageant-pagination');
  const previousPage = query<HTMLButtonElement>('[data-pageant-page=previous]');
  const nextPage = query<HTMLButtonElement>('[data-pageant-page=next]');
  const pageNumber = query<HTMLSpanElement>('.pageant-page-number');
  query('.pageant-bearer-left').append(createCharacterPortrait('w', 'n', 859));
  query('.pageant-bearer-right').append(createCharacterPortrait('b', 'n', 1371));
  query('.pageant-preacher').append(createCharacterPortrait('w', 'b', 1123));

  const cue = (value: PageantCue, role?: PieceSymbol) => {
    if (!destroyed && !document.hidden && document.documentElement.dataset.pagePaused !== 'true') options.onCue?.(value, role);
  };
  function announceEffect(message: string, effect: string) {
    if (effectTimer !== undefined) clearTimeout(effectTimer);
    root.dataset.effect = '';
    // Restart the small interaction animation without recreating its children.
    void root.offsetWidth;
    root.dataset.effect = effect;
    notice.textContent = message;
    effectTimer = setTimeout(() => { if (!destroyed) { root.dataset.effect = ''; notice.textContent = ''; } }, 4200);
  }

  function paginatePlots() {
    const pageCount = Math.max(1, Math.ceil(memorialKeys.length / 3));
    memorialPage = Math.min(Math.max(0, memorialPage), pageCount - 1);
    // The first page contains the newest three friends, in capture order.
    const end = memorialKeys.length - memorialPage * 3;
    const visible = new Set(memorialKeys.slice(Math.max(0, end - 3), end));
    for (const [key, button] of plotButtons) button.hidden = !visible.has(key);
    garden.hidden = memorialKeys.length === 0;
    pagination.hidden = pageCount === 1;
    previousPage.disabled = memorialPage === 0;
    nextPage.disabled = memorialPage === pageCount - 1;
    const label = `${memorialPage + 1} / ${pageCount}`;
    if (pageNumber.textContent !== label) pageNumber.textContent = label;
    pageNumber.setAttribute('aria-label', `Memorial page ${memorialPage + 1} of ${pageCount}`);
    root.dataset.memorialPage = String(memorialPage + 1);
    root.dataset.memorialPages = String(pageCount);
    root.dataset.paginated = String(pageCount > 1);
  }

  function updatePlots(entries: readonly CapturePageantEntry[]) {
    const keys = new Set(entries.map(entry => entry.key));
    for (const [key, button] of plotButtons) if (!keys.has(key)) { button.remove(); plotButtons.delete(key); plotClicks.delete(key); }
    for (const entry of entries) {
      if (plotButtons.has(entry.key)) continue;
      memorialPage = 0;
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'pageant-grave';
      button.dataset.captureKey = entry.key; button.dataset.role = entry.capture.type;
      button.dataset.pageantCue = 'memorial';
      button.setAttribute('aria-label', `Leave flowers for ${NAMES[entry.capture.type]}, ${entry.capture.color === 'w' ? 'amber' : 'indigo'} ${entry.capture.type === 'p' ? 'pawn' : NAMES[entry.capture.type].toLowerCase()}, captured on move ${entry.capture.moveNumber}`);
      const portrait = document.createElement('span'); portrait.className = 'pageant-grave-portrait';
      portrait.append(createCharacterPortrait(entry.capture.color, entry.capture.type, 4001 + entry.index * 97));
      const name = document.createElement('span'); name.className = 'pageant-grave-name'; name.textContent = NAMES[entry.capture.type];
      const flower = document.createElement('span'); flower.className = 'pageant-grave-flower'; flower.innerHTML = FLOWER;
      button.append(portrait, name, flower); memorials.append(button); plotButtons.set(entry.key, button);
    }
    memorialKeys = entries.map(entry => entry.key);
    root.dataset.memorialCount = String(entries.length);
    paginatePlots();
  }

  function render(snapshot: CapturePageantSnapshot, playCues = true) {
    root.dataset.phase = snapshot.phase;
    root.dataset.queueCount = String(snapshot.queued.length);
    root.dataset.totalCount = String(snapshot.totalCount);
    queue.hidden = snapshot.queued.length === 0;
    queue.textContent = `${snapshot.queued.length} waiting politely`;
    const active = snapshot.active;
    if (active) {
      root.dataset.captureKey = active.key;
      if (portraitKey !== active.key) {
        portraitKey = active.key;
        cargo.replaceChildren(createCharacterPortrait(active.capture.color, active.capture.type, 7301 + active.index * 37, `${NAMES[active.capture.type]} on the woodland stretcher`));
        sermon.textContent = SERMONS[active.capture.type];
      }
      const arrival = Math.min(active.elapsedMs / 2400, 1);
      const burial = Math.min(Math.max((active.elapsedMs - 4600) / 2000, 0), 1);
      const spirit = Math.min(Math.max((active.elapsedMs - 5200) / 2400, 0), 1);
      root.style.setProperty('--pageant-arrival', String(arrival));
      root.style.setProperty('--pageant-burial', String(burial));
      root.style.setProperty('--pageant-spirit', String(spirit));
      const marker = `${active.key}-${active.phase}`;
      if (marker !== lastCue) {
        lastCue = marker;
        const name = NAMES[active.capture.type];
        status.textContent = active.phase === 'arrival' ? `Make way for ${name}. The woodland stretcher is coming through.`
          : active.phase === 'sermon' ? `${name}'s tiny sermon: ${SERMONS[active.capture.type]}`
            : active.phase === 'burial' ? `A little earth for ${name}. A very big legend.` : `A new sprout for ${name}. Leave a flower in the little garden.`;
        if (playCues) cue(active.phase === 'arrival' ? 'arrival' : active.phase === 'sermon' ? 'sermon' : active.phase === 'burial' ? 'plant' : 'memorial', active.capture.type);
      }
    } else {
      delete root.dataset.captureKey;
      portraitKey = ''; lastCue = '';
      status.textContent = snapshot.totalCount ? `${snapshot.totalCount} little ${snapshot.totalCount === 1 ? 'story planted' : 'stories planted'}. Tap a memorial to leave a flower.` : 'The meadow is listening. Everyone is still on the board.';
    }
    updatePlots(active?.phase === 'memorial' ? [...snapshot.memorials, active] : snapshot.memorials);
  }

  function paused() { return document.hidden || document.documentElement.dataset.pagePaused === 'true'; }
  function stopFrame() { if (frame) cancelAnimationFrame(frame); frame = 0; previousTime = 0; }
  function schedule() {
    if (!destroyed && !reducedMotion && !paused() && model.snapshot.active && !frame) frame = requestAnimationFrame(tick);
  }
  function tick(time: number) {
    frame = 0;
    if (destroyed || reducedMotion || paused()) { previousTime = 0; return; }
    const elapsed = previousTime ? Math.max(0, time - previousTime) : 0;
    previousTime = time;
    render(model.advance(elapsed));
    schedule();
  }
  function visibilityChanged() { if (paused()) stopFrame(); else schedule(); }
  const pauseObserver = new MutationObserver(visibilityChanged);
  pauseObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-page-paused'] });
  document.addEventListener('visibilitychange', visibilityChanged);

  function clicked(event: MouseEvent) {
    const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-pageant-cue], button[data-pageant-page]') : null;
    if (!target || !root.contains(target) || target.disabled) return;
    if (target.dataset.pageantPage) {
      memorialPage += target.dataset.pageantPage === 'previous' ? -1 : 1;
      paginatePlots(); return;
    }
    const value = target.dataset.pageantCue as PageantCue;
    if (value === 'memorial') {
      const key = target.dataset.captureKey!;
      const role = target.dataset.role as PieceSymbol;
      const count = (plotClicks.get(key) ?? 0) + 1;
      plotClicks.set(key, count); target.dataset.flowered = 'true';
      target.setAttribute('aria-pressed', 'true');
      announceEffect(`${NAMES[role]}: ${QUIRKS[role][(count - 1) % QUIRKS[role].length]}`, 'petals'); cue('memorial', role);
    } else {
      const messages = { bell: 'Ding. Even the worms took their hats off.', petals: 'A little colour for a rather good little life.', choir: 'The choir knows one song. It is mostly humming.' };
      announceEffect(messages[value as 'bell' | 'petals' | 'choir'], value); cue(value, model.snapshot.active?.capture.type);
    }
  }
  root.addEventListener('click', clicked);

  function setReducedMotion(value: boolean) {
    if (destroyed) return;
    reducedMotion = value; root.dataset.reducedMotion = String(value);
    if (value) { stopFrame(); render(model.settle(), false); }
    else schedule();
  }
  root.dataset.reducedMotion = String(reducedMotion);
  render(model.snapshot, false);
  return {
    sync(captures: readonly Capture[], animate = true) {
      if (destroyed) return;
      const snapshot = model.sync(captures, { settle: initialSync || reducedMotion || !animate });
      const silent = initialSync || reducedMotion || !animate;
      initialSync = false;
      render(snapshot, !silent);
      if (!snapshot.active) stopFrame(); else schedule();
    },
    /** A new study may happen to contain the same capture values as the last. */
    reset(captures: readonly Capture[] = []) {
      if (destroyed) return;
      stopFrame(); portraitKey = ''; lastCue = ''; initialSync = false; memorialPage = 0;
      render(model.reset(captures), false);
    },
    setReducedMotion,
    destroy() {
      if (destroyed) return;
      destroyed = true; stopFrame(); pauseObserver.disconnect();
      if (effectTimer !== undefined) clearTimeout(effectTimer);
      document.removeEventListener('visibilitychange', visibilityChanged);
      root.removeEventListener('click', clicked); root.remove();
      plotButtons.clear(); plotClicks.clear(); memorialKeys = [];
    },
  };
}
