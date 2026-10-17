import assert from 'node:assert/strict';
import test from 'node:test';
import { createPaperwildSound } from '../src/sound.ts';
import type { CharacterCallEvent } from '../src/sound.ts';
import type { PieceSymbol } from '../src/game.ts';

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
  stopTime: number | undefined;
  startTime = 0;
  start(time = 0) { this.started = true; this.startTime = time; }
  stop(time?: number) { this.stopTime = time; if (time === undefined) this.stopped = true; }
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
  bufferCount = 0;
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
    this.bufferCount++;
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
    const calls: CharacterCallEvent[] = [];
    const sound = createPaperwildSound({ onCharacterCall: call => calls.push(call) });
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
    assert.deepEqual(calls, [{ role: 'p', activity: 'select' }]);
    assert.ok(context.sources.every(source => source.startTime < 0.025));
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
    assert.ok(context.sources.filter(source => source.started && !source.stopped).length <= 24);
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

test('each creature speaks for selection, movement, landing, capture, surprise and puzzlement', async () => {
  await environment(async (_page, activation) => {
    const calls: CharacterCallEvent[] = [];
    const sound = createPaperwildSound({ onCharacterCall: call => calls.push(call) });
    activation.isActive = true; await sound.setEnabled(true);
    const roles: readonly PieceSymbol[] = ['p', 'r', 'n', 'b', 'q', 'k'];
    for (const role of roles) {
      const before = calls.length;
      sound.select(role); sound.moveStart(role); sound.land(role);
      sound.land(role, { capture: true }); sound.captured(role);
      sound.invalid(role); sound.greeting(role);
      assert.deepEqual(calls.slice(before), ['select', 'move', 'land', 'capture', 'captured', 'blocked', 'greet'].map(activity => ({ role, activity })));
    }
    await sound.setEnabled(false);
    const count = calls.length;
    sound.captured('q'); sound.invalid('n'); sound.greeting('b'); sound.idle('k');
    assert.equal(calls.length, count, 'muted requests never report a scheduled voice');
    sound.destroy();
  });
});

test('landing chooses one expression while capture victims keep their own voice', async () => {
  await environment(async (_page, activation) => {
    const calls: CharacterCallEvent[] = [];
    const sound = createPaperwildSound({ onCharacterCall: call => calls.push(call) });
    activation.isActive = true; await sound.setEnabled(true);
    sound.captured('n'); sound.land('q', { capture: true });
    sound.land('p', { capture: true, check: true });
    sound.land('b', { capture: true, check: true, promotion: true });
    sound.land('q', { capture: true, check: true, promotion: true, ending: 'win' });
    sound.land('r', { promotion: true, ending: 'draw' });
    assert.deepEqual(calls, [
      { role: 'n', activity: 'captured' }, { role: 'q', activity: 'capture' },
      { role: 'p', activity: 'check' }, { role: 'b', activity: 'promotion' },
      { role: 'q', activity: 'win' }, { role: 'r', activity: 'draw' },
    ]);
    sound.destroy();
  });
});

test('idle calls cannot unlock audio and stay sparse around foreground activity', async () => {
  await environment(async (page, activation) => {
    const calls: CharacterCallEvent[] = [];
    const sound = createPaperwildSound({ onCharacterCall: call => calls.push(call) });
    await sound.setEnabled(true);
    activation.isActive = true;
    sound.idle('p'); sound.idle('n');
    assert.equal(Context.instances.length, 0, 'even a gesture does not let idle create audio');
    await sound.unlock();
    const context = Context.instances[0];
    sound.idle('p');
    assert.equal(calls.length, 0, 'no chorus at opt-in');
    context.currentTime = 3.1; sound.idle('p'); sound.idle('n');
    assert.deepEqual(calls, [{ role: 'p', activity: 'idle' }]);
    context.currentTime = 10.2; sound.idle('p'); sound.idle('n');
    assert.deepEqual(calls.at(-1), { role: 'n', activity: 'idle' });
    assert.equal(calls.length, 2, 'global and role cooldowns are independent');
    context.currentTime = 17.3; sound.select('q'); sound.idle('b');
    assert.equal(calls.length, 3, 'foreground action gets a quiet interval');
    context.currentTime = 19.4; sound.idle('b');
    assert.deepEqual(calls.at(-1), { role: 'b', activity: 'idle' });
    context.currentTime = 29; sound.idle('p');
    assert.deepEqual(calls.at(-1), { role: 'p', activity: 'idle' });
    page.hidden = true; page.dispatchEvent(new Event('visibilitychange'));
    const count = calls.length, resumes = context.resumeCount;
    context.currentTime = 60; sound.idle('k');
    page.hidden = false; page.dispatchEvent(new Event('visibilitychange')); sound.idle('k');
    assert.equal(calls.length, count); assert.equal(context.resumeCount, resumes);
    sound.destroy();
  });
});

test('castling keeps both movement plans and their contact sounds scheduled', async () => {
  await environment(async (_page, activation) => {
    const calls: CharacterCallEvent[] = [];
    const sound = createPaperwildSound({ onCharacterCall: call => calls.push(call) });
    activation.isActive = true; await sound.setEnabled(true);
    const contacts = [70, 210, 350, 490, 630, 770];
    sound.moveStart('k', { durationMs: 900, contactTimesMs: contacts });
    sound.moveStart('r', { durationMs: 900, contactTimesMs: contacts });
    const context = Context.instances[0];
    assert.deepEqual(calls, [{ role: 'k', activity: 'move' }, { role: 'r', activity: 'move' }]);
    assert.ok(context.sources.length > 14, 'the old source cap would steal part of this plan');
    assert.ok(context.sources.every(source => !source.stopped), 'no planned contact was stolen');
    for (const contact of contacts) {
      assert.equal(context.sources.filter(source => Math.abs(source.startTime - (0.008 + contact / 1000)) < 0.00001).length, 2);
    }
    sound.cancel();
    assert.ok(context.sources.every(source => source.stopped && source.disconnected));
    sound.destroy();
  });
});

test('four vocal takes are reused without losing natural variation', async () => {
  await environment(async (_page, activation) => {
    const sound = createPaperwildSound();
    activation.isActive = true; await sound.setEnabled(true);
    const context = Context.instances[0];
    for (let take = 0; take < 4; take++) sound.greeting('q');
    const buffers = context.sources.filter(source => source.buffer && source.buffer.duration < 1).map(source => source.buffer);
    assert.equal(new Set(buffers).size, 4);
    const previousAllocations = context.bufferCount;
    for (let take = 0; take < 4; take++) sound.greeting('q');
    assert.equal(context.bufferCount, previousAllocations, 'repeat takes reuse PCM buffers');
    sound.destroy();
  });
});
