import assert from 'node:assert/strict';
import test from 'node:test';
import { createPaperwildSound } from '../src/sound.ts';

class Parameter {
  value = 0;
  setValueAtTime(value: number) { this.value = value; return this; }
  linearRampToValueAtTime(value: number) { this.value = value; return this; }
  exponentialRampToValueAtTime(value: number) { this.value = value; return this; }
  cancelScheduledValues() { return this; }
}
class Node {
  disconnected = false;
  connect() { return this; }
  disconnect() { this.disconnected = true; }
}
class Source extends Node {
  buffer: AudioBuffer | null = null;
  playbackRate = new Parameter();
  frequency = new Parameter();
  type = 'sine';
  onended: (() => void) | null = null;
  started = false;
  stopped = false;
  startTime = 0;
  start(time = 0) { this.started = true; this.startTime = time; }
  stop() { this.stopped = true; }
}
class Page extends EventTarget { hidden = false; }
class Context {
  static instances: Context[] = [];
  static rejectResume = false;
  static deferResume = false;
  static unsupported = false;
  currentTime = 0;
  sampleRate = 24000;
  state = 'suspended';
  destination = new Node();
  sources: Source[] = [];
  nodes: Node[] = [];
  resumeCount = 0;
  suspendCount = 0;
  closeCount = 0;
  finishResume: (() => void) | undefined;
  constructor() { Context.instances.push(this); }
  createGain() { const node = Object.assign(new Node(), { gain: new Parameter() }); this.nodes.push(node); return node; }
  createDynamicsCompressor() {
    const node = Object.assign(new Node(), { threshold: new Parameter(), knee: new Parameter(), ratio: new Parameter(), attack: new Parameter(), release: new Parameter() });
    this.nodes.push(node); return node;
  }
  createBuffer(channels: number, length: number, sampleRate: number) {
    const samples = Array.from({ length: channels }, () => new Float32Array(length));
    return { duration: length / sampleRate, getChannelData(channel: number) { return samples[channel]; } };
  }
  createBufferSource() { const source = new Source(); this.sources.push(source); return source; }
  createOscillator() { const source = new Source(); this.sources.push(source); return source; }
  createBiquadFilter() {
    const node = Object.assign(new Node(), { Q: new Parameter(), frequency: new Parameter(), type: 'bandpass' });
    this.nodes.push(node); return node;
  }
  createStereoPanner() { const node = Object.assign(new Node(), { pan: new Parameter() }); this.nodes.push(node); return node; }
  resume(): Promise<void> {
    this.resumeCount++;
    if (Context.rejectResume) return Promise.reject(new Error('Browser refused playback'));
    if (Context.deferResume) return new Promise(resolve => { this.finishResume = () => { this.state = 'running'; resolve(); }; });
    this.state = 'running'; return Promise.resolve();
  }
  suspend() { this.suspendCount++; this.state = 'suspended'; return Promise.resolve(); }
  close() { this.closeCount++; this.state = 'closed'; return Promise.resolve(); }
}

async function environment(run: (page: Page, activation: { isActive: boolean }) => Promise<void>) {
  const originals = new Map(['window', 'document', 'navigator'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const page = new Page();
  const activation = { isActive: false };
  Context.instances = []; Context.rejectResume = false; Context.deferResume = false;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { AudioContext: Context } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: page });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userActivation: activation } });
  try { await run(page, activation); }
  finally {
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
}

test('a saved enabled preference never creates audio before a gesture', async () => {
  await environment(async (_page, activation) => {
    const sound = createPaperwildSound();
    assert.equal(await sound.setEnabled(true), false);
    sound.select('p'); sound.moveStart('n'); sound.land('n');
    await Promise.resolve();
    assert.equal(Context.instances.length, 0);
    activation.isActive = true;
    assert.equal(await sound.unlock(), true);
    sound.select('p');
    assert.ok(Context.instances[0].sources.some(source => source.started));
    sound.destroy();
  });
});

test('muting stops playing and future scheduled cues immediately', async () => {
  await environment(async (_page, activation) => {
    const sound = createPaperwildSound();
    activation.isActive = true;
    await sound.setEnabled(true);
    sound.moveStart('k', { durationMs: 900, contactTimesMs: [40, 230, 470, 700] });
    sound.land('p', { capture: true, promotion: true, ending: 'win' });
    const context = Context.instances[0];
    assert.ok(context.sources.some(source => source.startTime > 0.3));
    await sound.setEnabled(false);
    assert.ok(context.sources.every(source => source.stopped && source.disconnected));
    const previous = context.sources.length;
    sound.land('q', { check: true }); sound.greeting();
    assert.equal(context.sources.length, previous);
    assert.equal(context.state, 'suspended');
    sound.destroy();
  });
});

test('a pending unlock cannot play stale cues after mute', async () => {
  await environment(async (_page, activation) => {
    const sound = createPaperwildSound();
    activation.isActive = true; Context.deferResume = true;
    const enabling = sound.setEnabled(true);
    sound.select('q');
    const context = Context.instances[0];
    await sound.setEnabled(false);
    context.finishResume?.();
    assert.equal(await enabling, false);
    await Promise.resolve();
    assert.equal(context.sources.length, 0);
    assert.equal(context.state, 'suspended');
    sound.destroy();
  });
});

test('cancel drops stale queued cues without breaking a newer gesture during unlock', async () => {
  await environment(async (_page, activation) => {
    const sound = createPaperwildSound();
    activation.isActive = true; Context.deferResume = true;
    const enabling = sound.setEnabled(true);
    sound.moveStart('b');
    sound.cancel();
    sound.select('p');
    const context = Context.instances[0];
    context.finishResume?.();
    assert.equal(await enabling, true);
    await Promise.resolve();
    // The fresh selection plays; none of the old four-flap movement is queued.
    assert.equal(context.sources.length, 2);
    assert.equal(context.resumeCount, 1);
    sound.destroy();
  });
});

test('a hidden page cancels voices and waits for a fresh gesture to resume', async () => {
  await environment(async (page, activation) => {
    const sound = createPaperwildSound();
    activation.isActive = true; await sound.setEnabled(true);
    sound.moveStart('b');
    const context = Context.instances[0];
    page.hidden = true; page.dispatchEvent(new Event('visibilitychange'));
    assert.ok(context.sources.every(source => source.stopped));
    const resumes = context.resumeCount;
    activation.isActive = false;
    page.hidden = false; page.dispatchEvent(new Event('visibilitychange'));
    sound.greeting(); await Promise.resolve();
    assert.equal(context.resumeCount, resumes);
    assert.equal(context.state, 'suspended');
    activation.isActive = true;
    await sound.unlock();
    assert.equal(context.state, 'running');
    sound.destroy();
  });
});

test('resume refusal is handled once without rejected public promises', async () => {
  await environment(async (_page, activation) => {
    let unavailable = 0;
    const sound = createPaperwildSound({ onUnavailable: () => { unavailable++; } });
    activation.isActive = true; Context.rejectResume = true;
    assert.equal(await sound.setEnabled(true), false);
    sound.select('p'); sound.greeting();
    await sound.unlock(); await Promise.resolve();
    assert.equal(unavailable, 1);
    assert.equal(Context.instances[0].sources.length, 0);
    sound.destroy();
  });
});

test('unsupported audio reports gracefully only when playback is requested', async () => {
  await environment(async (_page, activation) => {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
    let unavailable = 0;
    const sound = createPaperwildSound({ onUnavailable: () => { unavailable++; } });
    await sound.setEnabled(true);
    assert.equal(unavailable, 0);
    activation.isActive = true;
    assert.equal(await sound.unlock(), false);
    assert.equal(unavailable, 1);
    sound.destroy();
  });
});

test('repeated input has bounded polyphony and destroy releases the graph', async () => {
  await environment(async (_page, activation) => {
    const sound = createPaperwildSound();
    activation.isActive = true; await sound.setEnabled(true);
    for (let index = 0; index < 40; index++) sound.moveStart('b');
    const context = Context.instances[0];
    assert.ok(context.sources.filter(source => source.started && !source.stopped).length <= 14);
    assert.ok(context.sources.some(source => source.stopped));
    sound.destroy(); sound.destroy();
    assert.equal(context.closeCount, 1);
    assert.ok(context.sources.every(source => source.stopped && source.disconnected));
    assert.ok(context.nodes.every(node => node.disconnected));
    const count = context.sources.length;
    sound.toggle(); sound.land('k', { ending: 'draw' });
    assert.equal(await sound.setEnabled(true), false);
    assert.equal(context.sources.length, count);
  });
});
