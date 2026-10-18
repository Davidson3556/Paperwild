import assert from 'node:assert/strict';
import test from 'node:test';
import { createPaperwildSound } from '../src/sound.ts';
import type { CaptureSoundBeat, CharacterCallEvent, PageantSoundCue, ScenerySoundCue } from '../src/sound.ts';
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
  connections: Node[] = [];
  connect(destination: Node) { this.connections.push(destination); return destination; }
  disconnect() { this.disconnected = true; this.connections = []; }
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
    sound.cancel();
    for (let index = 0; index < 40; index++) {
      sound.pageant(index % 2 ? 'choir' : 'bell'); sound.scenery('pond');
    }
    assert.ok(context.sources.filter(source => source.started && !source.stopped).length <= 24, 'pageant and scenery voices share the same bounded budget');
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

const PAGEANT_CUES: readonly PageantSoundCue[] = ['arrival', 'sermon', 'plant', 'bell', 'petals', 'choir', 'memorial'];

test('pageant cues stay silent without opt-in and a real audio unlock', async () => {
  await environment(async (_page, activation) => {
    const calls: CharacterCallEvent[] = [];
    const sound = createPaperwildSound({ onCharacterCall: call => calls.push(call) });
    activation.isActive = true;
    for (const cue of PAGEANT_CUES) sound.pageant(cue, 'q');
    assert.equal(Context.instances.length, 0, 'a gesture without sound opt-in does not create audio');
    activation.isActive = false;
    assert.equal(await sound.setEnabled(true), false);
    for (const cue of PAGEANT_CUES) sound.pageant(cue, 'q');
    await Promise.resolve();
    assert.equal(Context.instances.length, 0, 'an autonomous pageant cannot unlock a saved preference');
    assert.deepEqual(calls, []);
    sound.destroy();
  });
});

test('each pageant cue schedules a short connected sound and memorials keep the character voice', async () => {
  await environment(async (_page, activation) => {
    const calls: CharacterCallEvent[] = [];
    const sound = createPaperwildSound({ onCharacterCall: call => calls.push(call) });
    activation.isActive = true; await sound.setEnabled(true);
    activation.isActive = false;
    const context = Context.instances[0];
    function reachesSpeaker(node: Node, visited = new Set<Node>()): boolean {
      if (node === context.destination) return true;
      if (visited.has(node)) return false;
      visited.add(node);
      return node.connections.some(next => reachesSpeaker(next, visited));
    }
    for (const cue of PAGEANT_CUES) {
      sound.cancel();
      const before = context.sources.length, beforeCalls = calls.length;
      sound.pageant(cue, 'q');
      const scheduled = context.sources.slice(before);
      assert.ok(scheduled.length > 0, `${cue} produces sound after the user has enabled it`);
      for (const source of scheduled) {
        assert.ok(source.started && !source.stopped && reachesSpeaker(source), `${cue} reaches the output`);
        assert.ok(source.startTime >= context.currentTime && source.startTime < context.currentTime + 1);
        assert.ok(Number.isFinite(source.stopTime) && source.stopTime! > source.startTime && source.stopTime! < context.currentTime + 1.5, `${cue} ends promptly`);
        if (source.buffer) {
          const samples = source.buffer.getChannelData(0);
          assert.ok(samples.every(Number.isFinite), `${cue} contains finite PCM`);
          assert.ok(samples.some(sample => Math.abs(sample) > 0.0001), `${cue} is not an empty buffer`);
        }
      }
      if (cue === 'sermon') {
        assert.deepEqual(calls.slice(beforeCalls), [{ role: 'k', activity: 'idle' }, { role: 'b', activity: 'idle' }]);
      } else if (cue === 'choir') {
        const rates = scheduled.map(source => source.playbackRate.value);
        assert.equal(new Set(rates).size, 3, 'the choir has three simultaneous pitches');
        assert.ok(scheduled.every(source => source.buffer), 'the choir sings with creature PCM');
      } else if (cue === 'memorial') {
        assert.deepEqual(calls.slice(beforeCalls), [{ role: 'q', activity: 'greet' }]);
      }
    }
    assert.equal(context.resumeCount, 1, 'autonomous cues reuse the context the user unlocked');
    sound.destroy();
    assert.ok(context.sources.every(source => source.stopped && source.disconnected));
    assert.ok(context.nodes.every(node => node.disconnected));
  });
});

test('pageant playback obeys mute, visibility, cancellation and destruction', async () => {
  await environment(async (page, activation) => {
    const calls: CharacterCallEvent[] = [];
    const sound = createPaperwildSound({ onCharacterCall: call => calls.push(call) });
    activation.isActive = true; await sound.setEnabled(true);
    const context = Context.instances[0];
    sound.pageant('choir'); sound.pageant('bell');
    assert.ok(context.sources.some(source => source.startTime > context.currentTime + 0.05), 'the cue has upcoming notes to cancel');
    sound.cancel();
    assert.ok(context.sources.every(source => source.stopped && source.disconnected), 'cancel also removes upcoming notes');
    sound.pageant('arrival');
    await sound.setEnabled(false);
    assert.ok(context.sources.every(source => source.stopped && source.disconnected));
    const mutedCount = context.sources.length, mutedCalls = calls.length;
    for (const cue of PAGEANT_CUES) sound.pageant(cue, 'r');
    assert.equal(context.sources.length, mutedCount); assert.equal(calls.length, mutedCalls);

    await sound.setEnabled(true); sound.pageant('sermon');
    page.hidden = true; page.dispatchEvent(new Event('visibilitychange'));
    assert.ok(context.sources.every(source => source.stopped && source.disconnected));
    const hiddenCount = context.sources.length, hiddenCalls = calls.length;
    sound.pageant('memorial', 'n');
    activation.isActive = false;
    page.hidden = false; page.dispatchEvent(new Event('visibilitychange'));
    for (const cue of PAGEANT_CUES) sound.pageant(cue, 'n');
    await Promise.resolve();
    assert.equal(context.sources.length, hiddenCount); assert.equal(calls.length, hiddenCalls);
    assert.equal(context.state, 'suspended', 'returning to the page cannot resume the pageant sound');
    activation.isActive = true; await sound.unlock(); sound.pageant('memorial', 'n');
    assert.deepEqual(calls.at(-1), { role: 'n', activity: 'greet' });
    sound.destroy();
    const destroyedCount = context.sources.length;
    for (const cue of PAGEANT_CUES) sound.pageant(cue, 'n');
    assert.equal(context.sources.length, destroyedCount);
    assert.ok(context.sources.every(source => source.stopped && source.disconnected));
    assert.equal(context.closeCount, 1);
  });
});

test('a cancelled pageant cannot reappear after a pending audio unlock', async () => {
  await environment(async (_page, activation) => {
    const calls: CharacterCallEvent[] = [];
    const sound = createPaperwildSound({ onCharacterCall: call => calls.push(call) });
    activation.isActive = true; Context.deferResume = true;
    const enabling = sound.setEnabled(true);
    sound.pageant('arrival'); sound.pageant('choir'); sound.pageant('memorial', 'r');
    sound.cancel();
    sound.select('n');
    const context = Context.instances[0];
    context.finishResume?.();
    assert.equal(await enabling, true);
    await Promise.resolve();
    assert.deepEqual(calls, [{ role: 'n', activity: 'select' }]);
    assert.ok(context.sources.every(source => source.startTime < 0.025), 'no cancelled pageant notes survived the unlock');
    sound.destroy();
  });
});

const SCENERY_CUES: readonly ScenerySoundCue[] = ['pond', 'whale', 'stars'];

test('clicked scenery needs opt-in and produces short audible graphs after unlock', async () => {
  await environment(async (_page, activation) => {
    const sound = createPaperwildSound();
    activation.isActive = true;
    for (const cue of SCENERY_CUES) sound.scenery(cue);
    assert.equal(Context.instances.length, 0, 'clicking a scene cannot enable sound');
    activation.isActive = false; await sound.setEnabled(true);
    for (const cue of SCENERY_CUES) sound.scenery(cue);
    await Promise.resolve();
    assert.equal(Context.instances.length, 0, 'saved preferences do not grant autoplay');
    activation.isActive = true; await sound.unlock();
    const context = Context.instances[0];
    function reachesSpeaker(node: Node): boolean {
      return node === context.destination || node.connections.some(reachesSpeaker);
    }
    for (const cue of SCENERY_CUES) {
      sound.cancel();
      const before = context.sources.length;
      sound.scenery(cue);
      const sources = context.sources.slice(before);
      assert.ok(sources.length > 0, `${cue} creates a response`);
      assert.ok(sources.every(source => source.started && reachesSpeaker(source)), `${cue} reaches the output`);
      assert.ok(sources.every(source => Number.isFinite(source.startTime) && Number.isFinite(source.stopTime) && source.stopTime! > source.startTime && source.stopTime! < context.currentTime + 1.5), `${cue} ends rather than looping`);
      for (const source of sources) {
        if (source.buffer) {
          const samples = source.buffer.getChannelData(0);
          assert.ok(samples.every(Number.isFinite) && samples.some(sample => Math.abs(sample) > 0.0001));
        } else assert.ok(source.frequency.value > 0 && Number.isFinite(source.frequency.value));
      }
      if (cue === 'whale') assert.ok(sources.some(source => !source.buffer && source.frequency.value < 200), 'the whale has a low voice');
      if (cue === 'stars') assert.ok(new Set(sources.filter(source => source.buffer).map(source => source.startTime)).size >= 3, 'the star chime has three notes');
    }
    sound.destroy();
    assert.ok(context.sources.every(source => source.stopped && source.disconnected));
  });
});

test('scenery cues cannot survive cancellation, mute, page hiding or destruction', async () => {
  await environment(async (page, activation) => {
    const sound = createPaperwildSound();
    activation.isActive = true; Context.deferResume = true;
    const enabling = sound.setEnabled(true);
    for (const cue of SCENERY_CUES) sound.scenery(cue);
    sound.cancel();
    const context = Context.instances[0]; context.finishResume?.();
    await enabling; await Promise.resolve();
    assert.equal(context.sources.length, 0, 'cancelled scene requests never appear after unlock');
    Context.deferResume = false;
    for (const cue of SCENERY_CUES) sound.scenery(cue);
    assert.ok(context.sources.some(source => source.startTime > 0.2), 'there are upcoming ripples and notes to stop');
    await sound.setEnabled(false);
    assert.ok(context.sources.every(source => source.stopped && source.disconnected));
    let count = context.sources.length;
    for (const cue of SCENERY_CUES) sound.scenery(cue);
    assert.equal(context.sources.length, count);
    await sound.setEnabled(true); sound.scenery('whale');
    page.hidden = true; page.dispatchEvent(new Event('visibilitychange'));
    assert.ok(context.sources.every(source => source.stopped && source.disconnected));
    count = context.sources.length;
    for (const cue of SCENERY_CUES) sound.scenery(cue);
    activation.isActive = false; page.hidden = false; page.dispatchEvent(new Event('visibilitychange'));
    for (const cue of SCENERY_CUES) sound.scenery(cue);
    await Promise.resolve();
    assert.equal(context.sources.length, count, 'visibility changes cannot restart scenery audio');
    activation.isActive = true; await sound.unlock(); sound.scenery('stars');
    assert.ok(context.sources.length > count);
    sound.destroy(); count = context.sources.length;
    for (const cue of SCENERY_CUES) sound.scenery(cue);
    assert.equal(context.sources.length, count);
    assert.ok(context.sources.every(source => source.stopped && source.disconnected));
    assert.ok(context.nodes.every(node => node.disconnected));
  });
});

test('skirmish sounds follow the supplied contacts and preserve the shared movement budget', async () => {
  await environment(async (_page, activation) => {
    const calls: CharacterCallEvent[] = [];
    const sound = createPaperwildSound({ onCharacterCall: call => calls.push(call) });
    activation.isActive = true; await sound.setEnabled(true);
    const context = Context.instances[0]; context.currentTime = 10;
    const contacts = [700, 950, 1200];
    sound.skirmish('n', contacts);
    const sources = [...context.sources];
    assert.ok(sources.every(source => source.started && !source.stopped && source.startTime >= 10.6), 'nothing hits before the scene approaches its first contact');
    for (const contact of contacts) {
      const at = 10.008 + contact / 1000;
      assert.ok(sources.some(source => Math.abs(source.startTime - at) < 0.00001), `the ${contact}ms hit has a synchronized response`);
      assert.ok(sources.some(source => source.startTime < at && source.startTime >= at - 0.07), 'each hit has a preceding paper swish');
    }
    assert.ok(sources.every(source => Number.isFinite(source.stopTime) && source.stopTime! > source.startTime && source.stopTime! < 12), 'the skirmish is short and finite');
    assert.deepEqual(calls, [{ role: 'n', activity: 'move' }], 'the attacker exerts itself without prematurely announcing capture or landing');
    for (const source of sources) {
      assert.ok(source.connections.length > 0);
      assert.ok(source.buffer?.getChannelData(0).every(Number.isFinite));
      assert.ok(source.buffer?.getChannelData(0).some(sample => Math.abs(sample) > 0.0001));
    }
    sound.cancel();
    const before = context.sources.length;
    const fullPlan = [70, 210, 350, 490, 630, 770];
    sound.moveStart('k', { durationMs: 900, contactTimesMs: fullPlan });
    sound.skirmish('k', [100, 300, 500, 700, 900, 1100]);
    const together = context.sources.slice(before);
    assert.ok(together.every(source => !source.stopped), 'a full skirmish cannot steal the movement contacts');
    assert.ok(together.length <= 24);
    sound.cancel();
    assert.ok(context.sources.every(source => source.stopped && source.disconnected));
    sound.destroy();
  });
});

test('skirmish contacts reject invalid offsets, collapse duplicate hits and keep each creature voice', async () => {
  await environment(async (_page, activation) => {
    const calls: CharacterCallEvent[] = [];
    const sound = createPaperwildSound({ onCharacterCall: call => calls.push(call) });
    await sound.setEnabled(true); activation.isActive = true;
    sound.skirmish('p', []); sound.skirmish('p', [-1, NaN, Infinity, 2401]);
    assert.equal(Context.instances.length, 0, 'empty plans cannot create an audio context');
    await sound.unlock();
    const context = Context.instances[0];
    sound.skirmish('p', [950, NaN, -1, 700, 950, Infinity, 1200, 2401]);
    assert.equal(context.sources.filter(source => Math.abs(source.startTime - 0.958) < 0.00001).length, 1, 'a duplicated contact does not double its impact');
    assert.ok(context.sources.every(source => source.startTime >= 0 && source.startTime <= 1.208));
    const roles: readonly PieceSymbol[] = ['r', 'n', 'b', 'q', 'k'];
    for (const role of roles) { sound.cancel(); sound.skirmish(role, [700]); }
    assert.deepEqual(calls, ['p', ...roles].map(role => ({ role, activity: 'move' })));
    sound.destroy();
  });
});

test('skirmishes respect opt-in and cannot return after cancel, mute, hiding or destroy', async () => {
  await environment(async (page, activation) => {
    const calls: CharacterCallEvent[] = [];
    const sound = createPaperwildSound({ onCharacterCall: call => calls.push(call) });
    const contacts = [700, 950, 1200];
    activation.isActive = true; sound.skirmish('q', contacts);
    assert.equal(Context.instances.length, 0, 'a skirmish does not opt the user into audio');
    activation.isActive = false; await sound.setEnabled(true); sound.skirmish('q', contacts);
    await Promise.resolve();
    assert.equal(Context.instances.length, 0, 'a saved preference cannot autoplay a fight');
    activation.isActive = true; Context.deferResume = true;
    const enabling = sound.unlock(); sound.skirmish('q', contacts); sound.cancel();
    const context = Context.instances[0]; context.finishResume?.();
    await enabling; await Promise.resolve();
    assert.equal(context.sources.length, 0); assert.deepEqual(calls, []);
    Context.deferResume = false;
    sound.skirmish('q', contacts);
    assert.ok(context.sources.length > 0);
    await sound.setEnabled(false);
    assert.ok(context.sources.every(source => source.stopped && source.disconnected), 'muting stops upcoming hits too');
    let count = context.sources.length; sound.skirmish('n', contacts);
    assert.equal(context.sources.length, count);
    await sound.setEnabled(true); sound.skirmish('n', contacts);
    page.hidden = true; page.dispatchEvent(new Event('visibilitychange'));
    assert.ok(context.sources.every(source => source.stopped && source.disconnected));
    count = context.sources.length; sound.skirmish('b', contacts);
    activation.isActive = false; page.hidden = false; page.dispatchEvent(new Event('visibilitychange'));
    sound.skirmish('b', contacts); await Promise.resolve();
    assert.equal(context.sources.length, count);
    activation.isActive = true; await sound.unlock(); sound.skirmish('b', contacts);
    assert.ok(context.sources.length > count);
    sound.destroy(); count = context.sources.length; sound.skirmish('k', contacts);
    assert.equal(context.sources.length, count);
    assert.ok(context.sources.every(source => source.stopped && source.disconnected));
    assert.ok(context.nodes.every(node => node.disconnected));
  });
});

const CAPTURE_ACTORS = { attacker: 'p', attackerColor: 'w', defender: 'n', defenderColor: 'b' } as const;
const SCUFFLE_IMPACTS = [90, 230, 370, 510, 640, 770] as const;

test('the full capture score follows its seven animation beats without stealing future voices', async t => {
  await environment(async (_page, activation) => {
    const calls: CharacterCallEvent[] = [];
    const sound = createPaperwildSound({ onCharacterCall: call => calls.push(call) });
    activation.isActive = true; await sound.setEnabled(true);
    const context = Context.instances[0];
    const timeline: readonly (readonly [number, CaptureSoundBeat['beat']])[] = [
      [0, 'approach'], [0.56, 'faceoff'], [0.84, 'scuffle'], [1.7, 'victory'],
      [2.2, 'claim'], [3.12, 'pickup'], [3.56, 'carry'],
    ];
    let maximum = 0;
    for (const [time, beat] of timeline) {
      context.currentTime = time;
      // Model the browser retiring sources between real animation beats.
      for (const source of context.sources) {
        if (!source.disconnected && source.stopTime !== undefined && source.stopTime <= time) source.onended?.();
      }
      const before = context.sources.length;
      sound.captureBeat({ ...CAPTURE_ACTORS, beat, impactsMs: beat === 'scuffle' ? SCUFFLE_IMPACTS : [] });
      const scheduled = context.sources.slice(before);
      assert.ok(scheduled.length > 0, `${beat} has a response`);
      assert.ok(scheduled.every(source => source.started && source.connections.length > 0 && source.startTime >= time));
      assert.ok(scheduled.every(source => Number.isFinite(source.stopTime) && source.stopTime! > source.startTime && source.stopTime! < time + 3), `${beat} has finite, short cues`);
      if (beat === 'scuffle') {
        for (const impact of SCUFFLE_IMPACTS) {
          assert.ok(scheduled.some(source => Math.abs(source.startTime - (time + 0.008 + impact / 1000)) < 0.00001), `${impact}ms impact stays synchronized`);
        }
      }
      maximum = Math.max(maximum, context.sources.filter(source => !source.disconnected).length);
      assert.ok(context.sources.every(source => !source.stopped), `${beat} cannot steal a scheduled sound from another beat`);
    }
    assert.ok(maximum <= 24, 'the actual story fits the shared polyphony budget');
    t.diagnostic(`Peak capture-score polyphony: ${maximum} of 24 voices`);
    assert.deepEqual(calls, [
      { role: 'p', activity: 'challenge' }, { role: 'n', activity: 'startled' },
      { role: 'p', activity: 'move' }, { role: 'n', activity: 'captured' },
      { role: 'p', activity: 'cheer' }, { role: 'n', activity: 'dizzy' },
      { role: 'p', activity: 'happy' }, { role: 'n', activity: 'farewell' },
    ], 'the winner and the captured creature retain their own expressions');
    sound.destroy();
    assert.ok(context.sources.every(source => source.disconnected));
    assert.ok(context.nodes.every(node => node.disconnected));
  });
});

test('capture beats and hover delight honor opt-in, pending cancellation and browser lifecycle', async () => {
  await environment(async (page, activation) => {
    const calls: CharacterCallEvent[] = [];
    const sound = createPaperwildSound({ onCharacterCall: call => calls.push(call) });
    const beat = (name: CaptureSoundBeat['beat']) => sound.captureBeat({ ...CAPTURE_ACTORS, beat: name, impactsMs: SCUFFLE_IMPACTS });
    activation.isActive = true; beat('approach'); sound.delight('q');
    assert.equal(Context.instances.length, 0, 'neither API enables the user preference');
    activation.isActive = false; await sound.setEnabled(true); beat('approach'); sound.delight('q');
    await Promise.resolve();
    assert.equal(Context.instances.length, 0, 'saved preferences do not authorize autonomous voices');
    activation.isActive = true; sound.delight('q');
    assert.equal(Context.instances.length, 0, 'a hover cannot unlock audio even during user activation');
    Context.deferResume = true;
    const unlocking = sound.unlock();
    beat('approach'); beat('victory'); sound.cancel(); beat('pickup');
    const context = Context.instances[0]; context.finishResume?.();
    await unlocking; await Promise.resolve();
    assert.deepEqual(calls, [{ role: 'n', activity: 'farewell' }], 'only the newer beat survives pending-unlock cancellation');
    Context.deferResume = false;
    await sound.setEnabled(false);
    assert.ok(context.sources.every(source => source.stopped && source.disconnected));
    let count = context.sources.length, callCount = calls.length;
    beat('victory'); sound.delight('q');
    assert.equal(context.sources.length, count); assert.equal(calls.length, callCount);
    await sound.setEnabled(true); beat('scuffle'); sound.delight('q');
    page.hidden = true; page.dispatchEvent(new Event('visibilitychange'));
    assert.ok(context.sources.every(source => source.stopped && source.disconnected), 'hiding also stops future impact notes');
    count = context.sources.length; callCount = calls.length;
    beat('carry'); sound.delight('q');
    activation.isActive = false; page.hidden = false; page.dispatchEvent(new Event('visibilitychange'));
    beat('claim'); sound.delight('q'); await Promise.resolve();
    assert.equal(context.sources.length, count); assert.equal(calls.length, callCount);
    assert.equal(context.state, 'suspended');
    activation.isActive = true; await sound.unlock(); beat('victory');
    assert.ok(context.sources.length > count);
    sound.destroy(); count = context.sources.length; callCount = calls.length;
    beat('pickup'); sound.delight('r');
    assert.equal(context.sources.length, count); assert.equal(calls.length, callCount);
    assert.ok(context.sources.every(source => source.disconnected));
    assert.ok(context.nodes.every(node => node.disconnected));
    assert.equal(context.closeCount, 1);
  });
});

test('hover delight is a quiet, throttled character response that cancellation stops immediately', async () => {
  await environment(async (_page, activation) => {
    const calls: CharacterCallEvent[] = [];
    const sound = createPaperwildSound({ onCharacterCall: call => calls.push(call) });
    activation.isActive = true; await sound.setEnabled(true);
    const context = Context.instances[0];
    sound.delight('p');
    for (let index = 0; index < 40; index++) sound.delight(index % 2 ? 'n' : 'q');
    context.currentTime = 0.34; sound.delight('q');
    assert.deepEqual(calls, [{ role: 'p', activity: 'happy' }], 'rapid pointer crossings cannot create a chorus');
    context.currentTime = 0.35; sound.delight('q');
    assert.deepEqual(calls.at(-1), { role: 'q', activity: 'happy' });
    assert.equal(calls.length, 2, 'the next resident can react after the shared cooldown');
    assert.ok(context.sources.every(source => source.started && Number.isFinite(source.stopTime) && source.stopTime! < source.startTime + 0.8));
    sound.cancel();
    assert.ok(context.sources.every(source => source.stopped && source.disconnected));
    const count = context.sources.length;
    await Promise.resolve();
    assert.equal(context.sources.length, count, 'a cancelled hover has no delayed continuation');
    context.currentTime = 0.71; sound.delight('b');
    assert.deepEqual(calls.at(-1), { role: 'b', activity: 'happy' });
    sound.destroy();
  });
});
