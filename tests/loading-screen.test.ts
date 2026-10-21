import assert from 'node:assert/strict';
import test from 'node:test';
import { createLoadingScreen } from '../src/loading-screen.ts';

class Classes {
  values = new Set<string>(['is-loading']);
  add(...names: string[]) { names.forEach(name => this.values.add(name)); }
  remove(...names: string[]) { names.forEach(name => this.values.delete(name)); }
  contains(name: string) { return this.values.has(name); }
  toggle(name: string, enabled: boolean) { if (enabled) this.add(name); else this.remove(name); }
}

class Element extends EventTarget {
  classList = new Classes();
  attributes = new Map<string, string>();
  properties = new Map<string, string>();
  style = { setProperty: (key: string, value: string) => this.properties.set(key, value) };
  inert = false;
  disabled = false;
  removed = false;
  textContent = '';
  offsetWidth = 370;
  children: Element[] = [];
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  removeAttribute(name: string) { this.attributes.delete(name); }
  replaceChildren(...children: Element[]) { this.children = children; }
  remove() { this.removed = true; }
}

async function flush() { for (let index = 0; index < 12; index++) await Promise.resolve(); }

async function environment(run: (state: ReturnType<typeof makeState>) => Promise<void>) {
  const names = ['window', 'document', 'Image', 'matchMedia', 'innerWidth', 'sessionStorage'];
  const originals = new Map(names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const state = makeState();
  const globals = {
    window: state.clock,
    document: state.page,
    Image: state.Image,
    matchMedia: () => ({ matches: false }),
    innerWidth: 1280,
    // Returning visitors must keep the same opening, without a storage shortcut.
    sessionStorage: { getItem: () => '1', setItem: () => {} },
  };
  for (const [name, value] of Object.entries(globals)) Object.defineProperty(globalThis, name, { configurable: true, value });
  try { await run(state); }
  finally {
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
}

function makeState() {
  let now = 0, nextTimer = 0;
  const timers = new Map<number, { at: number; callback: () => void; interval?: number }>();
  const clock = {
    setTimeout(callback: () => void, ms: number) { const id = ++nextTimer; timers.set(id, { at: now + ms, callback }); return id; },
    clearTimeout(id: number) { timers.delete(id); },
    setInterval(callback: () => void, ms: number) { const id = ++nextTimer; timers.set(id, { at: now + ms, callback, interval: ms }); return id; },
    clearInterval(id: number) { timers.delete(id); },
    async advance(ms: number) {
      const end = now + ms;
      await flush();
      for (;;) {
        const entry = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!entry) break;
        const [id, timer] = entry; now = timer.at;
        if (timer.interval) timer.at += timer.interval;
        else timers.delete(id);
        timer.callback(); await flush();
      }
      now = end; await flush();
    },
  };
  const root = new Element(), app = new Element(), status = new Element(), button = new Element(), book = new Element(), html = new Element();
  const children = new Map([['.pw-loading-status', status], ['#pw-loading-skip', button], ['.pw-book', book]]);
  Object.assign(root, { querySelector: (selector: string) => children.get(selector) ?? null });
  let fontsReady: () => void = () => {};
  const page = {
    documentElement: html,
    getElementById: (id: string) => id === 'paperwild-loading' ? root : id === 'app' ? app : null,
    createElement: () => new Element(),
    fonts: { ready: new Promise<void>(resolve => { fontsReady = resolve; }) },
  };
  class Image {
    static instances: Image[] = [];
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    src = '';
    constructor() { Image.instances.push(this); }
  }
  const loadAssets = async () => { Image.instances.forEach(image => image.onload?.()); fontsReady(); await flush(); };
  const click = () => button.dispatchEvent(new Event('click'));
  return { root, app, status, button, html, page, clock, timers, Image, fontsReady: () => fontsReady(), loadAssets, click };
}

test('a saved pause takes the static entry path and releases the app without an opening', async () => {
  await environment(async state => {
    const loading = createLoadingScreen({ reducedMotion: true });
    const finished = loading.finish();
    assert.equal(state.app.inert, true);
    assert.equal(state.html.classList.contains('reduced-motion'), true);
    await state.loadAssets();
    await state.clock.advance(899);
    assert.equal(state.root.removed, false);
    await state.clock.advance(1); await finished;
    assert.equal(state.root.classList.contains('is-opening'), false);
    assert.equal(state.root.removed, true);
    assert.equal(state.app.inert, false);
    assert.equal(state.app.attributes.has('aria-busy'), false);
    assert.equal(loading.active, false);
    assert.equal(state.timers.size, 0);
  });
});

test('returning visitors keep the full notebook sequence until they explicitly skip', async () => {
  await environment(async state => {
    const loading = createLoadingScreen({ reducedMotion: false });
    const finished = loading.finish();
    assert.equal(loading.finish(), finished);
    await state.loadAssets();
    await state.clock.advance(2599);
    assert.equal(state.root.classList.contains('is-ready'), false);
    await state.clock.advance(1);
    assert.equal(state.root.classList.contains('is-ready'), true);
    assert.equal(state.button.textContent, 'Skip opening');
    await state.clock.advance(600);
    assert.equal(state.root.classList.contains('is-opening'), true);
    assert.equal(state.root.removed, false);
    await state.clock.advance(1250);
    assert.equal(state.root.classList.contains('is-entering'), true);
    assert.equal(state.app.inert, true);
    await state.clock.advance(640); await finished;
    assert.equal(state.root.removed, true);
    assert.equal(state.timers.size, 0);
  });
});

test('the opening button waits for assets and skipping cancels delayed scene mutations', async () => {
  await environment(async state => {
    const loading = createLoadingScreen({ reducedMotion: false });
    const finished = loading.finish();
    state.click(); await flush();
    assert.equal(state.button.disabled, true);
    assert.equal(state.root.classList.contains('is-ready'), false);
    await state.loadAssets();
    assert.equal(state.button.disabled, false);
    assert.equal(state.root.classList.contains('is-ready'), true);
    state.click(); await finished;
    const classes = [...state.root.classList.values];
    const progress = state.root.properties.get('--progress');
    assert.equal(state.root.removed, true);
    assert.equal(state.app.inert, false);
    assert.equal(state.timers.size, 0);
    assert.ok(state.Image.instances.every(image => image.onload === null && image.onerror === null));
    await state.clock.advance(20000);
    assert.deepEqual([...state.root.classList.values], classes);
    assert.equal(state.root.properties.get('--progress'), progress);
  });
});

test('stalled artwork and fonts cannot trap the app beyond the loading ceiling', async () => {
  await environment(async state => {
    const loading = createLoadingScreen({ reducedMotion: true });
    const finished = loading.finish();
    await state.clock.advance(8999);
    assert.equal(state.root.removed, false);
    await state.clock.advance(1); await finished;
    assert.equal(state.root.removed, true);
    assert.equal(state.app.inert, false);
    assert.equal(state.timers.size, 0);
    const progress = state.root.properties.get('--progress');
    state.fontsReady(); await flush();
    assert.equal(state.root.properties.get('--progress'), progress);
  });
});
