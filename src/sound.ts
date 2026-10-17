import type { PieceSymbol } from './game.ts';
import { renderCharacterCall, type CharacterActivity } from './character-voice.ts';

export interface LandingSound {
  capture?: boolean;
  promotion?: boolean;
  check?: boolean;
  ending?: 'win' | 'draw';
}

export interface MovementSound {
  durationMs?: number;
  /** Actual ground contacts/wing beats from the scene's movement plan. */
  contactTimesMs?: readonly number[];
}

export interface PaperwildSound {
  /** Stores the preference; audio unlocks only inside a real user gesture. */
  setEnabled(enabled: boolean): Promise<boolean>;
  unlock(): Promise<boolean>;
  select(role: PieceSymbol): void;
  moveStart(role: PieceSymbol, motion?: MovementSound): void;
  land(role: PieceSymbol, result?: LandingSound): void;
  captured(role: PieceSymbol): void;
  invalid(role: PieceSymbol): void;
  /** Quiet, occasional reactions; never unlocks audio or queues a future call. */
  idle(role: PieceSymbol): void;
  undo(): void;
  greeting(role?: PieceSymbol): void;
  toggle(): void;
  cancel(): void;
  destroy(): void;
}

export interface CharacterCallEvent { role: PieceSymbol; activity: CharacterActivity }

export interface PaperwildSoundOptions {
  onUnavailable?: () => void;
  /** Fires only after the corresponding character voice has been scheduled. */
  onCharacterCall?: (event: CharacterCallEvent) => void;
}

interface Voice {
  source: AudioScheduledSourceNode;
  gain: GainNode;
  nodes: AudioNode[];
}

type Recipe = (context: AudioContext, start: number) => void;
// Two castling movement plans can each contain ten Foley sources plus a voice.
const MAX_VOICES = 24;
const MAX_CHARACTER_BUFFERS = 48;
const IDLE_INTERVAL = 7;
const ROLE_IDLE_INTERVAL = 25;
const MASTER_VOLUME = 0.52;
const ROLE_PITCH: Readonly<Record<PieceSymbol, number>> = { p: 520, r: 148, n: 330, b: 730, q: 370, k: 196 };
const GREETING_ROLES: readonly PieceSymbol[] = ['p', 'n', 'q', 'k', 'r', 'b'];

/**
 * A little Foley studio and cast of synthesized cartoon voices. Paper noise,
 * wooden plucks, soft pawfalls and calls are made locally, without audio files.
 */
export function createPaperwildSound({ onUnavailable, onCharacterCall }: PaperwildSoundOptions = {}): PaperwildSound {
  let enabled = false;
  let destroyed = false;
  let unavailableReported = false;
  let context: AudioContext | undefined;
  let master: GainNode | undefined;
  let masterMuted = true;
  let limiter: DynamicsCompressorNode | undefined;
  let noiseBuffer: AudioBuffer | undefined;
  let pendingUnlock: Promise<boolean> | undefined;
  let gestureTurn = false;
  let epoch = 0;
  let randomState = 792451;
  let greetingIndex = 0;
  let nextIdleAt = 0;
  let idleQuietUntil = 0;
  const voices = new Set<Voice>();
  const plucks = new Map<string, AudioBuffer>();
  const characterBuffers = new Map<string, AudioBuffer>();
  const characterVariants = new Map<string, number>();
  const lastRoleIdle = new Map<PieceSymbol, number>();
  const page = typeof document === 'undefined' ? undefined : document;

  function random(): number {
    randomState = Math.imul(randomState ^ randomState >>> 15, 1 | randomState);
    randomState ^= randomState + Math.imul(randomState ^ randomState >>> 7, 61 | randomState);
    return ((randomState ^ randomState >>> 14) >>> 0) / 4294967296;
  }

  function hidden(): boolean { return !!page?.hidden; }
  function inGesture(): boolean {
    return gestureTurn || (typeof navigator !== 'undefined' && !!navigator.userActivation?.isActive);
  }
  function noteGesture(event: Event): void {
    if (!event.isTrusted) return;
    gestureTurn = true;
    queueMicrotask(() => { gestureTurn = false; });
  }
  function unavailable(): void {
    if (destroyed || unavailableReported) return;
    unavailableReported = true;
    try { onUnavailable?.(); } catch { /* A UI callback must not break audio cleanup. */ }
  }
  function silenceMaster(): void {
    masterMuted = true;
    if (!context || !master) return;
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setValueAtTime(0, context.currentTime);
  }
  function restoreMaster(): void {
    if (!context || !master) return;
    const now = context.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(0, now);
    master.gain.linearRampToValueAtTime(MASTER_VOLUME, now + 0.012);
    masterMuted = false;
    // Enabling sound should not immediately summon an idle chorus.
    idleQuietUntil = Math.max(idleQuietUntil, now + 3);
  }
  function suspend(): void {
    if (!context || context.state === 'closed') return;
    try { void context.suspend().catch(() => {}); } catch { /* Muting still silences the graph. */ }
  }
  function release(voice: Voice): void {
    if (!voices.delete(voice)) return;
    voice.source.onended = null;
    for (const node of voice.nodes) {
      try { node.disconnect(); } catch { /* Already disconnected by the browser. */ }
    }
  }
  function stopVoice(voice: Voice): void {
    if (context) {
      voice.gain.gain.cancelScheduledValues(context.currentTime);
      voice.gain.gain.setValueAtTime(0, context.currentTime);
    }
    try { voice.source.stop(); } catch { /* A source may already have ended. */ }
    release(voice);
  }
  function cancel(): void {
    epoch++;
    if (context) idleQuietUntil = Math.max(idleQuietUntil, context.currentTime + 2);
    for (const voice of voices) stopVoice(voice);
  }

  function createContext(): boolean {
    if (context) return context.state !== 'closed';
    if (typeof window === 'undefined') return false;
    const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) { unavailable(); return false; }
    try {
      context = new AudioContextClass({ latencyHint: 'interactive' });
      master = context.createGain();
      master.gain.value = 0;
      limiter = context.createDynamicsCompressor();
      limiter.threshold.value = -19;
      limiter.knee.value = 16;
      limiter.ratio.value = 4;
      limiter.attack.value = 0.005;
      limiter.release.value = 0.12;
      master.connect(limiter);
      limiter.connect(context.destination);
      // Smoothed noise retains the fine grain of graphite without white-noise hiss.
      noiseBuffer = context.createBuffer(1, Math.ceil(context.sampleRate * 1.2), context.sampleRate);
      const samples = noiseBuffer.getChannelData(0);
      let low = 0;
      for (let index = 0; index < samples.length; index++) {
        const white = random() * 2 - 1;
        low = low * 0.79 + white * 0.21;
        samples[index] = white * 0.58 + low * 0.42;
      }
      return true;
    } catch {
      const failed = context;
      context = undefined;
      master = undefined;
      limiter = undefined;
      noiseBuffer = undefined;
      try { if (failed) void failed.close().catch(() => {}); } catch { /* Constructor may only partially initialize. */ }
      unavailable();
      return false;
    }
  }

  function unlock(): Promise<boolean> {
    if (destroyed || !enabled || hidden()) return Promise.resolve(false);
    if (context?.state === 'running') {
      if (masterMuted) restoreMaster();
      return Promise.resolve(true);
    }
    // Saved preferences do not grant permission to start audio on page load.
    if (!inGesture()) return Promise.resolve(false);
    if (!createContext() || !context) return Promise.resolve(false);
    if (pendingUnlock) return pendingUnlock;
    const requestedContext = context;
    try {
      const operation = requestedContext.resume().then(() => {
        if (destroyed || !enabled || hidden() || context !== requestedContext) {
          silenceMaster();
          suspend();
          return false;
        }
        const running = requestedContext.state === 'running';
        if (running) restoreMaster();
        return running;
      }).catch(() => {
        silenceMaster();
        unavailable();
        return false;
      });
      pendingUnlock = operation;
      void operation.then(() => { if (pendingUnlock === operation) pendingUnlock = undefined; });
      return operation;
    } catch {
      silenceMaster();
      unavailable();
      return Promise.resolve(false);
    }
  }

  function play(recipe: Recipe): void {
    if (destroyed || !enabled || hidden()) return;
    const requestedEpoch = epoch;
    const schedule = () => {
      if (destroyed || !enabled || hidden() || requestedEpoch !== epoch || context?.state !== 'running') return;
      idleQuietUntil = Math.max(idleQuietUntil, context.currentTime + 2);
      try { recipe(context, context.currentTime + 0.008); } catch { cancel(); unavailable(); }
    };
    if (context?.state === 'running') schedule();
    else void unlock().then(unlocked => { if (unlocked) schedule(); });
  }

  function connectVoice(ctx: AudioContext, source: AudioScheduledSourceNode, volume: number, start: number, duration: number, attack: number, pan = 0, filters: AudioNode[] = []): Voice | undefined {
    if (!master) return;
    while (voices.size >= MAX_VOICES) {
      const oldest = voices.values().next().value;
      if (oldest) stopVoice(oldest); else break;
    }
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + Math.max(attack + 0.004, duration));
    const nodes: AudioNode[] = [source, ...filters, gain];
    let previous: AudioNode = source;
    for (const filter of filters) { previous.connect(filter); previous = filter; }
    previous.connect(gain);
    if (typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.value = pan;
      gain.connect(panner); panner.connect(master); nodes.push(panner);
    } else gain.connect(master);
    const voice = { source, gain, nodes };
    voices.add(voice);
    source.onended = () => release(voice);
    return voice;
  }

  function brush(ctx: AudioContext, at: number, duration: number, frequency: number, volume: number, pan = 0, rate = 1, reverse = false): void {
    if (!noiseBuffer) return;
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    source.playbackRate.value = rate;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 0.65;
    filter.frequency.setValueAtTime(reverse ? frequency * 1.8 : frequency, at);
    filter.frequency.exponentialRampToValueAtTime(reverse ? frequency * 0.65 : frequency * 0.82, at + duration);
    const voice = connectVoice(ctx, source, volume, at, duration, Math.min(duration * 0.18, 0.012), pan, [filter]);
    if (!voice) return;
    source.start(at, random() * 0.12, Math.min(noiseBuffer.duration - 0.15, (duration + 0.025) * rate));
    source.stop(at + duration + 0.03);
  }

  function pluckBuffer(ctx: AudioContext, frequency: number, duration: number, softness: number): AudioBuffer {
    const key = `${frequency}:${duration}:${softness}`;
    const cached = plucks.get(key);
    if (cached) return cached;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const output = buffer.getChannelData(0);
    const period = Math.max(3, Math.round(ctx.sampleRate / frequency));
    const string = new Float32Array(period);
    for (let index = 0; index < period; index++) string[index] = (random() * 2 - 1) * 0.8;
    let previous = 0;
    const decay = 0.992 - softness * 0.008;
    for (let index = 0; index < output.length; index++) {
      const slot = index % period;
      const sample = string[slot];
      const next = string[(slot + 1) % period];
      string[slot] = (sample + next) * 0.5 * decay;
      previous = previous * softness + sample * (1 - softness);
      output[index] = previous * Math.min(1, index / (ctx.sampleRate * 0.002));
    }
    if (plucks.size >= 30) {
      const oldest = plucks.keys().next().value;
      if (oldest) plucks.delete(oldest);
    }
    plucks.set(key, buffer);
    return buffer;
  }

  function pluck(ctx: AudioContext, at: number, frequency: number, duration: number, volume: number, softness = 0.5, pan = 0): void {
    const source = ctx.createBufferSource();
    source.buffer = pluckBuffer(ctx, frequency, duration, softness);
    if (!connectVoice(ctx, source, volume, at, duration, 0.003, pan)) return;
    source.start(at);
    source.stop(at + duration + 0.015);
  }

  function pop(ctx: AudioContext, at: number): void {
    const source = ctx.createOscillator();
    source.type = 'sine';
    source.frequency.setValueAtTime(610, at);
    source.frequency.exponentialRampToValueAtTime(180, at + 0.075);
    if (!connectVoice(ctx, source, 0.038, at, 0.11, 0.004)) return;
    source.start(at); source.stop(at + 0.13);
  }

  function characterBuffer(ctx: AudioContext, role: PieceSymbol, activity: CharacterActivity, variant: number): AudioBuffer {
    const key = `${role}:${activity}:${variant}`;
    const cached = characterBuffers.get(key);
    if (cached) {
      // Touch the entry so frequently heard voices stay in the bounded cache.
      characterBuffers.delete(key);
      characterBuffers.set(key, cached);
      return cached;
    }
    const samples = renderCharacterCall(role, activity, ctx.sampleRate, variant);
    const buffer = ctx.createBuffer(1, samples.length, ctx.sampleRate);
    buffer.getChannelData(0).set(samples);
    if (characterBuffers.size >= MAX_CHARACTER_BUFFERS) {
      const oldest = characterBuffers.keys().next().value;
      if (oldest !== undefined) characterBuffers.delete(oldest);
    }
    characterBuffers.set(key, buffer);
    return buffer;
  }

  function characterCall(ctx: AudioContext, at: number, role: PieceSymbol, activity: CharacterActivity): void {
    const key = `${role}:${activity}`;
    const variant = characterVariants.get(key) ?? 0;
    const buffer = characterBuffer(ctx, role, activity, variant);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const volume = activity === 'idle' ? 0.075 : activity === 'greet' ? 0.36 : activity === 'captured' ? 0.24 : 0.3;
    const duration = buffer.duration;
    const voice = connectVoice(ctx, source, volume, at, duration, 0.006);
    if (!voice) return;
    // The renderer shapes individual syllables. Preserve their relative levels,
    // with only a short outer fade to avoid clicks when composing the graph.
    const fade = Math.min(0.012, duration / 4);
    voice.gain.gain.cancelScheduledValues(at);
    voice.gain.gain.setValueAtTime(0, at);
    voice.gain.gain.linearRampToValueAtTime(volume, at + fade);
    voice.gain.gain.setValueAtTime(volume, at + duration - fade);
    voice.gain.gain.linearRampToValueAtTime(0, at + duration);
    source.start(at);
    source.stop(at + duration + 0.01);
    characterVariants.set(key, (variant + 1) % 4);
    try { onCharacterCall?.({ role, activity }); } catch { /* UI evidence must not interrupt a call. */ }
  }

  function landingActivity(result: LandingSound): CharacterActivity {
    if (result.ending) return result.ending;
    if (result.promotion) return 'promotion';
    if (result.check) return 'check';
    return result.capture ? 'capture' : 'land';
  }

  function idle(role: PieceSymbol): void {
    // Passive animations cannot create/resume an AudioContext, even with a saved
    // preference. They also do not enter play()'s pending-unlock queue.
    if (destroyed || !enabled || hidden() || masterMuted || context?.state !== 'running') return;
    const now = context.currentTime;
    if (now < idleQuietUntil || now < nextIdleAt || now - (lastRoleIdle.get(role) ?? -Infinity) < ROLE_IDLE_INTERVAL) return;
    try {
      characterCall(context, now + 0.008, role, 'idle');
      nextIdleAt = now + IDLE_INTERVAL;
      lastRoleIdle.set(role, now);
    } catch { cancel(); unavailable(); }
  }

  function startStep(ctx: AudioContext, at: number, role: PieceSymbol): void {
    switch (role) {
      case 'p':
        brush(ctx, at, 0.07, 1900, 0.06, -0.12);
        pluck(ctx, at + 0.012, 520, 0.13, 0.022, 0.7);
        break;
      case 'r':
        brush(ctx, at, 0.21, 620, 0.13, -0.12, 0.8);
        pluck(ctx, at + 0.024, 148, 0.24, 0.05, 0.65);
        brush(ctx, at + 0.09, 0.09, 1080, 0.06, 0.12, 0.85);
        break;
      case 'n':
        brush(ctx, at, 0.065, 820, 0.12, -0.2);
        brush(ctx, at + 0.075, 0.06, 1120, 0.09, 0.2);
        pluck(ctx, at + 0.018, 330, 0.17, 0.04, 0.65);
        brush(ctx, at + 0.1, 0.15, 2600, 0.038, 0, 1.1);
        break;
      case 'b':
        for (let flap = 0; flap < 4; flap++) brush(ctx, at + flap * 0.049, 0.062, 2700 - flap * 210, 0.064 - flap * 0.006, flap % 2 ? 0.2 : -0.2);
        pluck(ctx, at + 0.025, 730, 0.19, 0.022, 0.72);
        break;
      case 'q':
        brush(ctx, at, 0.075, 1050, 0.075, -0.16);
        brush(ctx, at + 0.085, 0.065, 1300, 0.06, 0.16);
        brush(ctx, at + 0.025, 0.2, 3300, 0.042, 0, 0.85);
        pluck(ctx, at + 0.012, 370, 0.19, 0.028, 0.75);
        break;
      case 'k':
        brush(ctx, at, 0.12, 940, 0.11, -0.13, 0.82);
        brush(ctx, at + 0.1, 0.11, 680, 0.085, 0.13, 0.8);
        pluck(ctx, at + 0.03, 196, 0.26, 0.047, 0.72);
        break;
    }
  }

  function plannedSteps(ctx: AudioContext, at: number, role: PieceSymbol, motion?: MovementSound): void {
    const duration = Math.min(2400, Math.max(100, motion?.durationMs ?? 1200));
    const contacts = motion?.contactTimesMs?.filter(value => Number.isFinite(value) && value >= 0 && value <= duration).slice(0, 6);
    if (!contacts?.length) { startStep(ctx, at, role); return; }
    const frequency: Readonly<Record<PieceSymbol, number>> = { p: 1500, r: 500, n: 850, b: 2800, q: 1200, k: 650 };
    const volume: Readonly<Record<PieceSymbol, number>> = { p: 0.055, r: 0.09, n: 0.085, b: 0.052, q: 0.05, k: 0.073 };
    brush(ctx, at, Math.min(duration / 1000, 0.24), role === 'r' || role === 'k' ? 980 : 2600, 0.04, -0.08, 0.9);
    for (let index = 0; index < contacts.length; index++) {
      const time = at + contacts[index] / 1000;
      brush(ctx, time, role === 'b' ? 0.08 : 0.055, frequency[role] * (index % 2 ? 1.12 : 0.96), volume[role], index % 2 ? 0.12 : -0.12);
      if (index % 2 === 0) pluck(ctx, time + 0.004, ROLE_PITCH[role] * (role === 'b' ? 1 : 0.8), 0.12, 0.018, 0.72);
    }
  }

  function landing(ctx: AudioContext, at: number, role: PieceSymbol, result: LandingSound): void {
    const wing = role === 'b';
    brush(ctx, at, wing ? 0.12 : 0.075, wing ? 2300 : role === 'r' || role === 'k' ? 420 : 870, wing ? 0.055 : 0.1, 0, 0.9);
    pluck(ctx, at + 0.008, ROLE_PITCH[role] * (wing ? 1 : 0.75), 0.19, wing ? 0.018 : 0.036, 0.72);
    if (role === 'n') brush(ctx, at + 0.055, 0.05, 1350, 0.06, 0.12);
    let after = at + 0.035;
    if (result.capture) {
      brush(ctx, after, 0.12, 3900, 0.12, -0.12, 1.15);
      pop(ctx, after + 0.055);
      after += 0.14;
    }
    if (result.promotion) {
      const notes = [523.25, 783.99, 1046.5, 1318.51];
      for (let index = 0; index < notes.length; index++) pluck(ctx, after + index * 0.095, notes[index], 0.62, 0.052 - index * 0.004, 0.32, (index - 1.5) * 0.12);
      after += 0.4;
    }
    if (result.ending) {
      const notes = result.ending === 'win' ? [392, 523.25, 659.25, 783.99] : [440, 392, 523.25];
      for (let index = 0; index < notes.length; index++) pluck(ctx, after + index * 0.15, notes[index], 0.9, 0.066, 0.48, (index - 1) * 0.1);
      brush(ctx, after + 0.04, 0.3, 2200, 0.036, 0, 0.8);
    } else if (result.check) {
      pluck(ctx, after + 0.045, 880, 0.42, 0.052, 0.4, -0.08);
      pluck(ctx, after + 0.17, 659.25, 0.36, 0.042, 0.5, 0.08);
    }
  }

  function visibilityChanged(): void {
    if (!hidden()) return;
    cancel(); silenceMaster(); suspend();
  }
  page?.addEventListener('visibilitychange', visibilityChanged);
  for (const event of ['click', 'keydown', 'touchend']) page?.addEventListener(event, noteGesture, true);

  return {
    async setEnabled(value) {
      if (destroyed) return false;
      enabled = value;
      if (!enabled) { cancel(); silenceMaster(); suspend(); return false; }
      return unlock();
    },
    unlock,
    select(role) {
      play((ctx, at) => {
        brush(ctx, at, 0.045, 2500, 0.065, -0.08, 1.05);
        pluck(ctx, at + 0.008, ROLE_PITCH[role] * 1.35, 0.11, 0.016, 0.72);
        characterCall(ctx, at + 0.012, role, 'select');
      });
    },
    moveStart(role, motion) {
      play((ctx, at) => {
        plannedSteps(ctx, at, role, motion);
        characterCall(ctx, at, role, 'move');
      });
    },
    land(role, result = {}) {
      play((ctx, at) => {
        landing(ctx, at, role, result);
        characterCall(ctx, at + 0.025, role, landingActivity(result));
      });
    },
    captured(role) { play((ctx, at) => characterCall(ctx, at, role, 'captured')); },
    invalid(role) { play((ctx, at) => characterCall(ctx, at, role, 'blocked')); },
    idle,
    undo() {
      cancel();
      play((ctx, at) => {
        brush(ctx, at, 0.22, 1800, 0.1, 0.15, 0.8, true);
        brush(ctx, at + 0.09, 0.12, 3200, 0.055, -0.15, 0.8, true);
        pluck(ctx, at + 0.045, 392, 0.23, 0.036, 0.65);
        pluck(ctx, at + 0.145, 294, 0.2, 0.03, 0.7);
      });
    },
    greeting(role) {
      play((ctx, at) => {
        brush(ctx, at, 0.09, 2400, 0.045, -0.12);
        const speaker = role ?? GREETING_ROLES[greetingIndex++ % GREETING_ROLES.length];
        characterCall(ctx, at + 0.012, speaker, 'greet');
      });
    },
    toggle() {
      play((ctx, at) => {
        brush(ctx, at, 0.055, 1900, 0.045);
        pluck(ctx, at + 0.008, 660, 0.14, 0.026, 0.64);
      });
    },
    cancel,
    destroy() {
      if (destroyed) return;
      cancel(); silenceMaster();
      destroyed = true; enabled = false;
      page?.removeEventListener('visibilitychange', visibilityChanged);
      for (const event of ['click', 'keydown', 'touchend']) page?.removeEventListener(event, noteGesture, true);
      try { master?.disconnect(); limiter?.disconnect(); } catch { /* Closed contexts may already be disconnected. */ }
      const closing = context;
      context = undefined; master = undefined; limiter = undefined; noiseBuffer = undefined;
      plucks.clear(); characterBuffers.clear(); characterVariants.clear(); lastRoleIdle.clear();
      try { if (closing && closing.state !== 'closed') void closing.close().catch(() => {}); } catch { /* Disposal stays idempotent. */ }
    },
  };
}
