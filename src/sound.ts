import type { PieceSymbol } from './game.ts';
import { renderCharacterCall, type CharacterActivity } from './character-voice.ts';
import { FINALE } from './finale-motion.ts';

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

export type PageantSoundCue = 'arrival' | 'sermon' | 'plant' | 'bell' | 'petals' | 'choir' | 'memorial' | 'revive' | 'fanfare' | 'salute';
export type ScenerySoundCue = 'pond' | 'whale' | 'stars';
/** One beat of a capture, scheduled when the scene reaches it so pausing,
 * skipping and the shared voice budget all follow the animation. */
export interface CaptureSoundBeat {
  beat: 'approach' | 'faceoff' | 'scuffle' | 'victory' | 'claim' | 'pickup' | 'carry';
  attacker: PieceSymbol;
  attackerColor: 'w' | 'b';
  defender: PieceSymbol;
  defenderColor: 'w' | 'b';
  /** Scuffle impacts, in milliseconds from the start of that beat. */
  impactsMs: readonly number[];
}

export interface PaperwildSound {
  /** Stores the preference; audio unlocks only inside a real user gesture. */
  setEnabled(enabled: boolean): Promise<boolean>;
  unlock(): Promise<boolean>;
  select(role: PieceSymbol): void;
  moveStart(role: PieceSymbol, motion?: MovementSound): void;
  /** Cartoon contacts, in milliseconds from the start of a brief skirmish. */
  skirmish(role: PieceSymbol, contactTimesMs: readonly number[]): void;
  /** The capture story's Foley and voices, one beat at a time. */
  captureBeat(beat: CaptureSoundBeat): void;
  /** A quiet giggle for a hovered resident. Like idle calls, never unlocks audio. */
  delight(role: PieceSymbol): void;
  /** A paper "fwip" as a row of pop-up residents stands up. Never unlocks audio. */
  pagePop(): void;
  /** The checkmate finisher's original edit cue, on its own clock and budget. */
  finale(event: FinaleSound): void;
  land(role: PieceSymbol, result?: LandingSound): void;
  captured(role: PieceSymbol): void;
  /** "Nope" at first; repeated tries bring a growl and stomps, or a sniffle. */
  invalid(role: PieceSymbol, mood?: 'nope' | 'angry' | 'sad', level?: number): void;
  /** Quiet, occasional reactions; never unlocks audio or queues a future call. */
  idle(role: PieceSymbol): void;
  undo(): void;
  greeting(role?: PieceSymbol): void;
  pageant(cue: PageantSoundCue, role?: PieceSymbol): void;
  /** Short responses to clicked story scenes; never used as an ambient loop. */
  scenery(cue: ScenerySoundCue): void;
  toggle(): void;
  /** Radio Small Hours: a preference for the generative lullaby. It plays only
   * while sound is enabled and audio is unlocked, and resumes after a fresh tap. */
  radio(on: boolean): void;
  radioMood(mood: RadioMood): void;
  /** A short phrase in the winner's key, woven into the next bar. */
  radioFlourish(color: 'w' | 'b'): void;
  isRadioPlaying(): boolean;
  /** Stops character and Foley sounds. The radio has its own lifecycle. */
  cancel(): void;
  destroy(): void;
}

export type RadioMood = 'day' | 'dusk';
/** The checkmate finisher's soundtrack is scored for the winning side and attacker. */
export interface FinaleSound { winner: 'w' | 'b'; attacker: PieceSymbol; capture?: boolean }

export interface CharacterCallEvent { role: PieceSymbol; activity: CharacterActivity }

export interface PaperwildSoundOptions {
  onUnavailable?: () => void;
  /** Fires only after the corresponding character voice has been scheduled. */
  onCharacterCall?: (event: CharacterCallEvent) => void;
  /** Reports when the radio actually starts or stops making sound. */
  onRadioChange?: (playing: boolean) => void;
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
const MUSIC_VOLUME = 0.32;
/** The radio's own budget of overlapping oscillators. */
const MAX_MUSIC_NOTES = 48;
/** The finisher's own budget of sources; it is dense for five seconds, then gone. */
const MAX_STAGE_NOTES = 180;
const STAGE_VOLUME = 0.55;
const ROLE_PITCH: Readonly<Record<PieceSymbol, number>> = { p: 520, r: 148, n: 330, b: 730, q: 370, k: 196 };
const GREETING_ROLES: readonly PieceSymbol[] = ['p', 'n', 'q', 'k', 'r', 'b'];

/**
 * A little Foley studio and cast of synthesized cartoon voices. Paper noise,
 * wooden plucks, soft pawfalls and calls are made locally, without audio files.
 */
export function createPaperwildSound({ onUnavailable, onCharacterCall, onRadioChange }: PaperwildSoundOptions = {}): PaperwildSound {
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
  let nextDelightAt = 0;
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
    stopMusic(false);
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
    startMusic();
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
    stopStage();
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
      else startMusic();
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

  function characterCall(ctx: AudioContext, at: number, role: PieceSymbol, activity: CharacterActivity, expression: { volume?: number; rate?: number } = {}): void {
    const key = `${role}:${activity}`;
    const variant = characterVariants.get(key) ?? 0;
    const buffer = characterBuffer(ctx, role, activity, variant);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const rate = expression.rate ?? 1;
    source.playbackRate.value = rate;
    const volume = expression.volume ?? (activity === 'idle' ? 0.075 : activity === 'greet' ? 0.36 : activity === 'captured' ? 0.24 : 0.3);
    const duration = buffer.duration / rate;
    if (activity !== 'idle') duckMusic(Math.min(1.4, duration + 0.4));
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

  function pageantCue(ctx: AudioContext, at: number, cue: PageantSoundCue, role: PieceSymbol): void {
    switch (cue) {
      case 'arrival':
        // Two tiny bootfalls and the springy creak of a twig stretcher.
        brush(ctx, at, 0.085, 640, 0.055, -0.16, 0.8);
        pluck(ctx, at + 0.015, 148, 0.24, 0.035, 0.76, -0.1);
        brush(ctx, at + 0.14, 0.075, 790, 0.045, 0.16, 0.85);
        pluck(ctx, at + 0.15, 196, 0.2, 0.026, 0.72, 0.1);
        break;
      case 'sermon':
        characterCall(ctx, at, 'k', 'idle', { volume: 0.11 });
        characterCall(ctx, at + 0.16, 'b', 'idle', { volume: 0.07 });
        break;
      case 'plant':
        brush(ctx, at, 0.18, 420, 0.08, -0.05, 0.75);
        pop(ctx, at + 0.11);
        break;
      case 'bell':
        pluck(ctx, at, 587.33, 0.7, 0.065, 0.62);
        pluck(ctx, at + 0.003, 1174.66, 0.43, 0.015, 0.7);
        break;
      case 'petals':
        brush(ctx, at, 0.19, 2300, 0.04, -0.2, 0.8);
        brush(ctx, at + 0.07, 0.14, 3300, 0.025, 0.2, 0.9);
        break;
      case 'choir':
        // One creature timbre forms a little major chord, each voice separately
        // tracked so mute/undo also stops notes that have not started yet.
        for (const [index, rate] of [1, 1.25, 1.5].entries()) {
          characterCall(ctx, at + index * 0.045, 'p', 'idle', { volume: 0.085, rate });
        }
        break;
      case 'memorial':
        brush(ctx, at, 0.07, 2400, 0.028, -0.1);
        characterCall(ctx, at + 0.012, role, 'greet', { volume: 0.24 });
        break;
      case 'revive':
        // "Not dead yet!": a springy pop out of the ground and a delighted cheer.
        brush(ctx, at, 0.12, 900, 0.06, 0, 0.8);
        boing(ctx, at + 0.04, Math.min(520, 230 + ROLE_PITCH[role] * 0.35), 0.04);
        characterCall(ctx, at + 0.1, role, 'cheer', { volume: 0.26 });
        break;
      case 'fanfare':
        // A small, slightly wobbly woodland trumpet for a state funeral.
        [392, 523.25, 659.25, 523.25, 783.99].forEach((note, index) => {
          const start = at + index * 0.18, source = ctx.createOscillator(); source.type = 'sawtooth';
          source.frequency.setValueAtTime(note * 0.985, start); source.frequency.exponentialRampToValueAtTime(note, start + 0.05);
          const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 1800; tone.Q.value = 2;
          if (connectVoice(ctx, source, index === 4 ? 0.04 : 0.03, start, index === 4 ? 0.55 : 0.17, 0.02, 0, [tone])) { source.start(start); source.stop(start + (index === 4 ? 0.6 : 0.2)); }
        });
        break;
      case 'salute':
        // Twenty-one acorns pop in seven little volleys of three.
        for (let volley = 0; volley < 7; volley++) pop(ctx, at + volley * 0.16);
        break;
    }
  }

  function sceneryCue(ctx: AudioContext, at: number, cue: ScenerySoundCue): void {
    if (cue === 'stars') {
      for (const [index, frequency] of [783.99, 1046.5, 1318.51].entries()) {
        pluck(ctx, at + index * 0.085, frequency, 0.58, 0.045 - index * 0.007, 0.42, (index - 1) * 0.14);
      }
      brush(ctx, at, 0.055, 2700, 0.022);
    } else if (cue === 'pond') {
      for (const [index, frequency] of [392, 294].entries()) {
        const start = at + index * 0.14;
        pluck(ctx, start, frequency, 0.22, 0.05 - index * 0.01, 0.8, index ? 0.15 : -0.15);
        brush(ctx, start + 0.018, 0.14, 1800, 0.025, index ? 0.15 : -0.15, 0.8);
      }
      // A brief two-syllable croak, with a hollow throat instead of a loud buzz.
      for (let syllable = 0; syllable < 2; syllable++) {
        const start = at + 0.29 + syllable * 0.115;
        const source = ctx.createOscillator(); source.type = 'sawtooth';
        source.frequency.setValueAtTime(syllable ? 145 : 170, start);
        source.frequency.exponentialRampToValueAtTime(syllable ? 105 : 125, start + 0.09);
        const throat = ctx.createBiquadFilter(); throat.type = 'bandpass';
        throat.frequency.value = 620; throat.Q.value = 1.4;
        if (connectVoice(ctx, source, 0.034, start, 0.1, 0.012, 0.08, [throat])) {
          source.start(start); source.stop(start + 0.115);
        }
      }
    } else {
      // A low, rounded "whoo" with a quiet overtone and water on its tail.
      for (const [index, frequency] of [112, 225].entries()) {
        const source = ctx.createOscillator(); source.type = 'sine';
        source.frequency.setValueAtTime(frequency, at);
        source.frequency.exponentialRampToValueAtTime(frequency * 1.22, at + 0.22);
        source.frequency.exponentialRampToValueAtTime(frequency * 0.91, at + 0.43);
        source.frequency.exponentialRampToValueAtTime(frequency * 1.08, at + 0.61);
        source.frequency.exponentialRampToValueAtTime(frequency * 0.78, at + 0.84);
        if (connectVoice(ctx, source, index ? 0.024 : 0.13, at, 0.88, 0.1, index ? 0.08 : -0.08)) {
          source.start(at); source.stop(at + 0.91);
        }
      }
      brush(ctx, at + 0.3, 0.3, 1300, 0.027, 0.1, 0.75);
    }
  }

  function skirmish(ctx: AudioContext, at: number, role: PieceSymbol, contacts: readonly number[]): void {
    const pitch = ROLE_PITCH[role];
    for (const [index, offset] of contacts.entries()) {
      const contact = at + offset / 1000;
      const pan = index % 2 ? 0.12 : -0.12;
      brush(ctx, Math.max(at, contact - 0.065), 0.075, Math.min(2800, 850 + pitch * 2), 0.043, pan, 1.08);
      pluck(ctx, contact, pitch * (role === 'b' ? 1.05 : 0.82), 0.13, role === 'b' ? 0.024 : 0.038, 0.7, -pan);
    }
    // One effort call leaves space between the little paper taps. Six contacts
    // plus this call fit alongside a full movement plan in the shared budget.
    characterCall(ctx, at + contacts[0] / 1000, role, 'move', { volume: 0.15 });
  }

  /** A soft pillow-fight thump: a falling sine body under a short paper puff. */
  function thump(ctx: AudioContext, at: number, frequency: number, volume: number, pan = 0): void {
    const source = ctx.createOscillator();
    source.type = 'sine';
    source.frequency.setValueAtTime(frequency, at);
    source.frequency.exponentialRampToValueAtTime(frequency * 0.42, at + 0.12);
    if (connectVoice(ctx, source, volume, at, 0.16, 0.004, pan)) { source.start(at); source.stop(at + 0.18); }
  }
  /** A cartoon spring: a triangle wave that zigzags upward and settles. */
  function boing(ctx: AudioContext, at: number, base: number, volume: number, pan = 0): void {
    const source = ctx.createOscillator();
    source.type = 'triangle';
    source.frequency.setValueAtTime(base, at);
    source.frequency.exponentialRampToValueAtTime(base * 1.85, at + 0.05);
    source.frequency.exponentialRampToValueAtTime(base * 1.3, at + 0.1);
    source.frequency.exponentialRampToValueAtTime(base * 1.7, at + 0.15);
    source.frequency.exponentialRampToValueAtTime(base * 1.42, at + 0.24);
    if (connectVoice(ctx, source, volume, at, 0.28, 0.006, pan)) { source.start(at); source.stop(at + 0.3); }
  }
  /** Air rushing past: band-limited paper noise swept between two pitches. */
  function swoosh(ctx: AudioContext, at: number, duration: number, from: number, to: number, volume: number, pan = 0): void {
    if (!noiseBuffer) return;
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.1;
    filter.frequency.setValueAtTime(from, at);
    filter.frequency.exponentialRampToValueAtTime(to, at + duration);
    if (!connectVoice(ctx, source, volume, at, duration, duration * 0.45, pan, [filter])) return;
    source.start(at, random() * 0.2, duration + 0.03);
    source.stop(at + duration + 0.03);
  }
  /** Dizzy birdies: two quick high chirps. */
  function tweet(ctx: AudioContext, at: number, pan: number): void {
    for (let index = 0; index < 2; index++) {
      const start = at + index * 0.09, source = ctx.createOscillator();
      source.type = 'sine';
      source.frequency.setValueAtTime(2300, start);
      source.frequency.exponentialRampToValueAtTime(3200, start + 0.05);
      if (connectVoice(ctx, source, 0.022, start, 0.07, 0.004, pan)) { source.start(start); source.stop(start + 0.08); }
    }
  }
  /** Beetle feet on paper: tiny alternating ticks. */
  function patter(ctx: AudioContext, at: number, count: number, gap: number, volume: number): void {
    for (let index = 0; index < count; index++) brush(ctx, at + index * gap, 0.022, 3600 + (index % 2) * 500, volume, index % 2 ? 0.25 : -0.25, 1.2);
  }
  const FANFARE: Readonly<Record<'w' | 'b', readonly number[]>> = { w: [523.25, 659.25, 783.99, 1046.5], b: [440, 554.37, 659.25, 880] };

  function captureScore(ctx: AudioContext, at: number, event: CaptureSoundBeat): void {
    const { attacker, defender } = event;
    const attackerPitch = ROLE_PITCH[attacker], defenderPitch = ROLE_PITCH[defender];
    switch (event.beat) {
      case 'approach':
        // Footfalls in the attacker's gait, a determined call, and a startled yelp.
        plannedSteps(ctx, at, attacker, { durationMs: 560, contactTimesMs: [110, 250, 390, 520] });
        characterCall(ctx, at + 0.04, attacker, 'challenge', { volume: 0.22 });
        characterCall(ctx, at + 0.18, defender, 'startled', { volume: 0.2 });
        break;
      case 'faceoff':
        // A tiny ring bell ("ding ding!") and the two of them bumping mittens.
        for (const [index, time] of [0.04, 0.16].entries()) {
          pluck(ctx, at + time, 1567.98, 0.42, 0.04 - index * 0.006, 0.36, 0.08);
          pluck(ctx, at + time + 0.002, 3135.96, 0.22, 0.012, 0.5, 0.08);
        }
        swoosh(ctx, at + 0.02, 0.12, 900, 2400, 0.05, -0.1);
        thump(ctx, at + 0.14, 230, 0.07);
        break;
      case 'scuffle': {
        // A rolling dust rumble with a different cartoon hit on every impact.
        swoosh(ctx, at, 0.86, 520, 900, 0.06);
        event.impactsMs.slice(0, 6).forEach((offset, index) => {
          const time = at + Math.max(0, offset) / 1000, pan = index % 2 ? 0.22 : -0.22;
          const pitch = index % 2 ? defenderPitch : attackerPitch;
          if (index % 3 === 0) thump(ctx, time, 150 + pitch * 0.12, 0.11, pan);
          else if (index % 3 === 1) boing(ctx, time, Math.min(520, 220 + pitch * 0.35), 0.035, pan);
          else pluck(ctx, time, 680 + pitch * 0.4, 0.14, 0.045, 0.6, pan);
          if (index % 2 === 0) brush(ctx, Math.max(at, time - 0.05), 0.06, 2400, 0.045, -pan, 1.1);
        });
        const [first = 90, , second = 370, , fourth = 640] = event.impactsMs;
        characterCall(ctx, at + first / 1000, attacker, 'move', { volume: 0.13 });
        characterCall(ctx, at + (fourth || second) / 1000, defender, 'captured', { volume: 0.12 });
        break;
      }
      case 'victory': {
        // The cloud bursts, the winner cheers to a little fanfare, the loser sees stars.
        swoosh(ctx, at, 0.22, 2600, 700, 0.07);
        const notes = FANFARE[event.attackerColor];
        notes.forEach((note, index) => pluck(ctx, at + 0.1 + index * 0.075, note, 0.55 + index * 0.08, 0.05 - index * 0.004, 0.34, (index - 1.5) * 0.14));
        brush(ctx, at + 0.4, 0.2, 4200, 0.03, 0, 0.9);
        characterCall(ctx, at + 0.12, attacker, 'cheer', { volume: 0.3 });
        characterCall(ctx, at + 0.2, defender, 'dizzy', { volume: 0.13 });
        tweet(ctx, at + 0.36, 0.3);
        break;
      }
      case 'claim':
        // A proud hop, a pennant planted with a "plink", and beetle feet arriving.
        swoosh(ctx, at + 0.04, 0.14, 700, 1500, 0.04);
        thump(ctx, at + 0.3, 120 + attackerPitch * 0.2, 0.08);
        brush(ctx, at + 0.18, 0.08, 900, 0.05, 0.15, 0.9);
        pop(ctx, at + 0.21);
        characterCall(ctx, at + 0.32, attacker, 'happy', { volume: 0.16 });
        patter(ctx, at + 0.4, 5, 0.075, 0.03);
        break;
      case 'pickup':
        // "Hup!": two tiny beetle calls, a creaking twig stretcher, a brave goodbye.
        for (const [index, time] of [0, 0.11].entries()) {
          const source = ctx.createOscillator(); source.type = 'sine';
          source.frequency.setValueAtTime(880 + index * 120, at + time);
          source.frequency.exponentialRampToValueAtTime(1250 + index * 140, at + time + 0.06);
          if (connectVoice(ctx, source, 0.028, at + time, 0.08, 0.005, index ? 0.2 : -0.2)) { source.start(at + time); source.stop(at + time + 0.09); }
        }
        pluck(ctx, at + 0.08, 148, 0.3, 0.035, 0.76);
        characterCall(ctx, at + 0.3, defender, 'farewell', { volume: 0.18 });
        break;
      case 'carry':
        patter(ctx, at, 8, 0.07, 0.026);
        break;
    }
  }

  // ---- Radio Small Hours ---------------------------------------------------
  // A generative music-box lullaby on its own quiet bus. It has a separate node
  // budget, so it never steals Foley or voices, and it is never part of play():
  // music starts only while sound is enabled and the context is already running.
  interface MusicNote { sources: AudioScheduledSourceNode[]; nodes: AudioNode[] }
  const musicNotes = new Set<MusicNote>();
  let musicWanted = false;
  let musicMood: RadioMood = 'day';
  let musicBus: GainNode | undefined;
  let musicNodes: AudioNode[] = [];
  let musicTimer: ReturnType<typeof setTimeout> | undefined;
  let musicPlaying = false;
  let musicNextTime = 0;
  let musicStep = 0;
  let musicPhrase = 0;
  let musicDegree = 4;
  let musicSeed = 20261018;
  let musicFlourish: readonly number[] = [];
  let musicDuckUntil = 0;
  let musicDuckDepth = 1;

  function musicRandom(): number {
    musicSeed = (Math.imul(musicSeed, 1664525) + 1013904223) >>> 0;
    return musicSeed / 4294967296;
  }
  function midi(note: number): number { return 440 * 2 ** ((note - 69) / 12); }
  function reportRadio(): void {
    try { onRadioChange?.(musicPlaying); } catch { /* UI state must not break audio. */ }
  }
  function ensureMusicBus(ctx: AudioContext): GainNode | undefined {
    if (musicBus || !master) return musicBus;
    const bus = ctx.createGain();
    bus.gain.value = 0;
    // A gentle "wireless" roll-off; brighter music-box partials stay soft.
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass'; tone.frequency.value = 2900; tone.Q.value = 0.4;
    bus.connect(tone); tone.connect(master);
    musicNodes = [bus, tone];
    if (typeof ctx.createDelay === 'function') {
      // A small room around the radio: one soft, filtered echo.
      const delay = ctx.createDelay(1);
      delay.delayTime.value = 0.34;
      const feedback = ctx.createGain(); feedback.gain.value = 0.27;
      const wet = ctx.createGain(); wet.gain.value = 0.24;
      bus.connect(delay); delay.connect(feedback); feedback.connect(delay); delay.connect(wet); wet.connect(tone);
      musicNodes.push(delay, feedback, wet);
    }
    musicBus = bus;
    return bus;
  }
  function musicVoice(ctx: AudioContext, type: OscillatorType, frequency: number, at: number, volume: number, decay: number, attack = 0.006): void {
    if (!musicBus || musicNotes.size >= MAX_MUSIC_NOTES) return;
    const source = ctx.createOscillator();
    source.type = type;
    source.frequency.setValueAtTime(frequency, at);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
    source.connect(gain); gain.connect(musicBus);
    const note: MusicNote = { sources: [source], nodes: [source, gain] };
    musicNotes.add(note);
    source.onended = () => releaseMusicNote(note);
    source.start(at); source.stop(at + attack + decay + 0.02);
  }
  function releaseMusicNote(note: MusicNote): void {
    if (!musicNotes.delete(note)) return;
    for (const source of note.sources) source.onended = null;
    for (const node of note.nodes) { try { node.disconnect(); } catch { /* Already gone. */ } }
  }
  /** A music-box tine: a sine body with a short metallic overtone. */
  function musicBox(ctx: AudioContext, note: number, at: number, velocity: number): void {
    const frequency = midi(note);
    musicVoice(ctx, 'sine', frequency, at, 0.11 * velocity, 1.7);
    musicVoice(ctx, 'sine', frequency * 4.01, at, 0.016 * velocity, 0.22, 0.002);
    musicVoice(ctx, 'sine', frequency * 2, at, 0.02 * velocity, 0.55);
  }
  function kalimba(ctx: AudioContext, note: number, at: number, velocity: number): void {
    musicVoice(ctx, 'triangle', midi(note), at, 0.045 * velocity, 0.9);
    musicVoice(ctx, 'sine', midi(note) * 5.4, at, 0.006 * velocity, 0.05, 0.002);
  }
  function bass(ctx: AudioContext, note: number, at: number): void {
    musicVoice(ctx, 'sine', midi(note), at, 0.085, 1.5, 0.04);
  }
  const MOODS: Readonly<Record<RadioMood, { beat: number; chords: readonly (readonly number[])[]; scale: readonly number[] }>> = {
    // C major pentatonic over C–Am–F–G in daylight.
    day: { beat: 0.39, chords: [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]], scale: [72, 74, 76, 79, 81, 84, 86, 88] },
    // Slower A minor pentatonic over Am–F–C–G by moonlight.
    dusk: { beat: 0.46, chords: [[45, 48, 52], [41, 45, 48], [48, 52, 55], [43, 47, 50]], scale: [69, 72, 74, 76, 79, 81, 84, 86] },
  };
  /** Schedules one eighth note: bass on each bar, kalimba on the off-beats and
   * a wandering melody that leans on chord tones and rests often. */
  function musicEighth(ctx: AudioContext, at: number): void {
    const mood = MOODS[musicMood];
    const bar = Math.floor(musicStep / 8), slot = musicStep % 8;
    const chord = mood.chords[bar % mood.chords.length];
    const breath = musicPhrase % 4 === 3 && bar % 4 === 3;
    if (slot === 0) bass(ctx, chord[0] - 12, at);
    if (!breath && (slot === 2 || slot === 6)) kalimba(ctx, chord[(slot / 2 + bar) % chord.length] + 12, at, 0.8);
    if (musicFlourish.length && slot % 2 === 0) {
      musicBox(ctx, musicFlourish[0], at, 1.15);
      musicFlourish = musicFlourish.slice(1);
    } else if (!breath && musicRandom() < (slot % 2 ? 0.34 : 0.62)) {
      // Step through the scale, sometimes leaping, gently pulled to the middle.
      const leap = musicRandom() < 0.18 ? 2 : 1;
      const direction = musicDegree > 5 ? -1 : musicDegree < 2 ? 1 : musicRandom() < 0.5 ? -1 : 1;
      musicDegree = Math.max(0, Math.min(mood.scale.length - 1, musicDegree + direction * leap));
      musicBox(ctx, mood.scale[musicDegree], at, slot === 0 ? 1 : 0.72 + musicRandom() * 0.2);
    }
    musicStep++;
    if (musicStep % 32 === 0) { musicPhrase++; musicSeed ^= musicPhrase * 2654435761; }
  }
  function musicTick(): void {
    musicTimer = undefined;
    if (!musicPlaying) return;
    if (!context || context.state !== 'running') {
      // An audio-device interruption need not hide the page. Retire the old
      // schedule so a fresh unlock can tune back in rather than remaining "on"
      // with no timer and no notes.
      stopMusic(false);
      return;
    }
    const horizon = context.currentTime + 0.6;
    if (musicNextTime < context.currentTime) musicNextTime = context.currentTime + 0.05;
    while (musicNextTime < horizon) {
      musicEighth(context, musicNextTime);
      musicNextTime += MOODS[musicMood].beat;
    }
    musicTimer = setTimeout(musicTick, 150);
    // A forgotten studio must never keep a host process (or test run) alive.
    (musicTimer as { unref?: () => void }).unref?.();
  }
  function startMusic(): void {
    if (musicPlaying || !musicWanted || destroyed || !enabled || hidden() || masterMuted || context?.state !== 'running') return;
    const bus = ensureMusicBus(context);
    if (!bus) return;
    const now = context.currentTime;
    // Tuning in: a wisp of static and a falling whistle, then the lullaby fades up.
    if (noiseBuffer) {
      const hiss = context.createBufferSource(); hiss.buffer = noiseBuffer;
      const band = context.createBiquadFilter(); band.type = 'bandpass'; band.Q.value = 1.2;
      band.frequency.setValueAtTime(600, now); band.frequency.exponentialRampToValueAtTime(2600, now + 0.5);
      const hissGain = context.createGain();
      hissGain.gain.setValueAtTime(0, now); hissGain.gain.linearRampToValueAtTime(0.16, now + 0.2); hissGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
      hiss.connect(band); band.connect(hissGain); hissGain.connect(bus);
      const static_: MusicNote = { sources: [hiss], nodes: [hiss, band, hissGain] };
      musicNotes.add(static_); hiss.onended = () => releaseMusicNote(static_);
      hiss.start(now, 0, 0.6); hiss.stop(now + 0.6);
    }
    const whistle = context.createOscillator(); whistle.type = 'sine';
    whistle.frequency.setValueAtTime(1900, now + 0.1);
    whistle.frequency.exponentialRampToValueAtTime(820, now + 0.45);
    const whistleGain = context.createGain();
    whistleGain.gain.setValueAtTime(0, now + 0.1); whistleGain.gain.linearRampToValueAtTime(0.012, now + 0.16); whistleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    whistle.connect(whistleGain); whistleGain.connect(bus);
    const note: MusicNote = { sources: [whistle], nodes: [whistle, whistleGain] };
    musicNotes.add(note); whistle.onended = () => releaseMusicNote(note);
    whistle.start(now + 0.1); whistle.stop(now + 0.52);
    bus.gain.cancelScheduledValues(now);
    bus.gain.setValueAtTime(0.0001, now);
    bus.gain.exponentialRampToValueAtTime(MUSIC_VOLUME, now + 2.4);
    musicPlaying = true;
    musicNextTime = now + 0.7;
    musicTick();
    reportRadio();
  }
  function stopMusic(fade: boolean): void {
    clearTimeout(musicTimer); musicTimer = undefined;
    const wasPlaying = musicPlaying;
    musicPlaying = false;
    musicDuckUntil = 0; musicDuckDepth = 1;
    if (context && musicBus) {
      const now = context.currentTime;
      musicBus.gain.cancelScheduledValues(now);
      if (fade) { musicBus.gain.setValueAtTime(musicBus.gain.value, now); musicBus.gain.linearRampToValueAtTime(0, now + 0.35); }
      else musicBus.gain.setValueAtTime(0, now);
    }
    for (const note of [...musicNotes]) {
      for (const source of note.sources) { try { source.stop(fade && context ? context.currentTime + 0.4 : undefined); } catch { /* Ended. */ } }
      if (!fade) releaseMusicNote(note);
    }
    if (wasPlaying) reportRadio();
  }
  /** Voices and capture beats briefly lower the music so the cast stays clear. */
  function duckMusic(seconds = 1.1, depth = 0.32): void {
    if (!musicPlaying || !context || !musicBus) return;
    const now = context.currentTime;
    // Character calls can be scheduled inside a longer scored moment. Keep
    // the strongest active hold instead of letting a short call release it.
    musicDuckDepth = Math.min(now < musicDuckUntil ? musicDuckDepth : 1, depth);
    musicDuckUntil = Math.max(musicDuckUntil, now + seconds);
    musicBus.gain.cancelScheduledValues(now);
    musicBus.gain.setValueAtTime(Math.max(0.0001, musicBus.gain.value), now);
    musicBus.gain.linearRampToValueAtTime(MUSIC_VOLUME * musicDuckDepth, now + 0.06);
    musicBus.gain.setValueAtTime(MUSIC_VOLUME * musicDuckDepth, musicDuckUntil);
    musicBus.gain.linearRampToValueAtTime(MUSIC_VOLUME, musicDuckUntil + 1.2);
  }

  // ---- The checkmate finisher's soundtrack -----------------------------------
  // An original 128 BPM "edit" cue, composed here in code: a tape-stop freeze, a
  // riser with an accelerating snare roll, half a beat of silence, a drop on the
  // winning strike, four beats of groove and a final chord. It plays on its own
  // stage bus and budget, so it can be dense without stealing the cast's voices.
  interface StageNote { source: AudioScheduledSourceNode; nodes: AudioNode[] }
  const stageNotes = new Set<StageNote>();
  let stageBus: GainNode | undefined;
  let stageNodes: AudioNode[] = [];
  function ensureStageBus(ctx: AudioContext): GainNode | undefined {
    if (stageBus || !master) return stageBus;
    // Punchier than the cast, but not a jump-scare: about 10 dB above its peaks.
    const bus = ctx.createGain(); bus.gain.value = STAGE_VOLUME;
    bus.connect(master);
    stageBus = bus; stageNodes = [bus];
    return bus;
  }
  function releaseStage(note: StageNote): void {
    if (!stageNotes.delete(note)) return;
    note.source.onended = null;
    for (const node of note.nodes) { try { node.disconnect(); } catch { /* Gone. */ } }
  }
  function stopStage(): void {
    const wasPlaying = stageNotes.size > 0;
    for (const note of [...stageNotes]) {
      try { note.source.stop(); } catch { /* Ended. */ }
      releaseStage(note);
    }
    if (wasPlaying && musicPlaying && context && musicBus) {
      // Skipping or undoing the finisher also releases its radio hold.
      musicDuckUntil = 0; musicDuckDepth = 1;
      const now = context.currentTime;
      musicBus.gain.cancelScheduledValues(now);
      musicBus.gain.setValueAtTime(musicBus.gain.value, now);
      musicBus.gain.linearRampToValueAtTime(MUSIC_VOLUME, now + 0.35);
    }
  }
  function stageConnect(source: AudioScheduledSourceNode, chain: AudioNode[], start: number, stop: number): boolean {
    if (!stageBus || stageNotes.size >= MAX_STAGE_NOTES) return false;
    let previous: AudioNode = source;
    for (const node of chain) { previous.connect(node); previous = node; }
    previous.connect(stageBus);
    const note: StageNote = { source, nodes: [source, ...chain] };
    stageNotes.add(note);
    source.onended = () => releaseStage(note);
    source.start(start); source.stop(stop);
    return true;
  }
  function envelope(ctx: AudioContext, at: number, peak: number, attack: number, decay: number): GainNode {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(peak, at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
    return gain;
  }
  function stageTone(ctx: AudioContext, type: OscillatorType, from: number, to: number, at: number, peak: number, attack: number, decay: number, filter?: { type: BiquadFilterType; from: number; to: number; q?: number }): void {
    const source = ctx.createOscillator(); source.type = type;
    source.frequency.setValueAtTime(from, at);
    if (to !== from) source.frequency.exponentialRampToValueAtTime(to, at + attack + decay);
    const chain: AudioNode[] = [];
    if (filter) {
      const node = ctx.createBiquadFilter(); node.type = filter.type; node.Q.value = filter.q ?? 0.7;
      node.frequency.setValueAtTime(filter.from, at); node.frequency.exponentialRampToValueAtTime(filter.to, at + attack + decay);
      chain.push(node);
    }
    chain.push(envelope(ctx, at, peak, attack, decay));
    stageConnect(source, chain, at, at + attack + decay + 0.02);
  }
  function stageNoise(ctx: AudioContext, at: number, duration: number, from: number, to: number, peak: number, attack = 0.002, q = 0.8): void {
    if (!noiseBuffer) return;
    const source = ctx.createBufferSource(); source.buffer = noiseBuffer; source.loop = true;
    const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.Q.value = q;
    filter.frequency.setValueAtTime(from, at); filter.frequency.exponentialRampToValueAtTime(to, at + duration);
    const rise = Math.min(attack, duration * 0.95);
    stageConnect(source, [filter, envelope(ctx, at, peak, rise, duration - rise)], at, at + duration);
  }
  const kick = (ctx: AudioContext, at: number, peak = 0.42) => {
    stageTone(ctx, 'sine', 155, 42, at, peak, 0.003, 0.26);
    stageNoise(ctx, at, 0.018, 3200, 2400, peak * 0.18);
  };
  const snare = (ctx: AudioContext, at: number, peak: number) => {
    stageNoise(ctx, at, 0.1, 2300, 1500, peak, 0.002, 0.7);
    stageTone(ctx, 'triangle', 200, 160, at, peak * 0.5, 0.002, 0.06);
  };
  const hat = (ctx: AudioContext, at: number) => stageNoise(ctx, at, 0.035, 8500, 7600, 0.05, 0.001, 1.2);
  const clap = (ctx: AudioContext, at: number) => { for (let index = 0; index < 3; index++) stageNoise(ctx, at + index * 0.011, 0.06 + index * 0.03, 1500, 1200, 0.12 - index * 0.025, 0.001, 0.9); };
  /** A bright chord: two slightly detuned saws per note through a closing filter. */
  const supersaw = (ctx: AudioContext, notes: readonly number[], at: number, peak: number, decay: number) => {
    for (const note of notes) for (const detune of [-0.0035, 0.0035]) {
      const frequency = midi(note) * (1 + detune);
      stageTone(ctx, 'sawtooth', frequency, frequency, at, peak, 0.006, decay, { type: 'lowpass', from: 5200, to: 900, q: 0.9 });
    }
  };
  function finaleScore(ctx: AudioContext, at: number, event: FinaleSound): void {
    const beat = FINALE.beatMs / 1000;
    const t = (beats: number) => at + beats * beat;
    // The winner's key: amber in A minor, indigo in E minor. Chords i–VI–III–VII.
    const root = event.winner === 'w' ? 57 : 52;
    const chords = [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]].map(chord => chord.map(step => root + 12 + step));
    // Freeze: a tape-stop sigh and a low drone that waits under the build.
    stageTone(ctx, 'sine', 620, 70, at, 0.08, 0.01, 0.42);
    stageNoise(ctx, at, 0.4, 2600, 300, 0.07, 0.01);
    stageTone(ctx, 'sawtooth', midi(root - 24), midi(root - 24), at, 0.04, 0.6, beat * 4.4, { type: 'lowpass', from: 220, to: 900, q: 1.2 });
    // Build: four beats of riser, kicks and a snare roll that doubles each beat.
    stageNoise(ctx, t(1), beat * 4, 400, 7000, 0.075, beat * 3.6, 1.1);
    stageTone(ctx, 'sawtooth', midi(root), midi(root + 24), t(1), 0.035, beat * 3.8, beat * 0.2, { type: 'lowpass', from: 600, to: 4000 });
    for (let index = 0; index < 4; index++) kick(ctx, t(1 + index), 0.26 + index * 0.03);
    [1, 2, 4, 8].forEach((hits, bar) => {
      for (let hit = 0; hit < hits; hit++) snare(ctx, t(1 + bar + hit / hits), 0.05 + bar * 0.022 + hit / hits * 0.02);
    });
    // Silence from beat 5 to 5.5. Then the drop, exactly on the winning strike.
    const drop = t(5.5);
    kick(ctx, drop, 0.5);
    stageTone(ctx, 'sine', 70, 31, drop, 0.32, 0.004, 0.95);
    stageNoise(ctx, drop, 1.3, 7200, 5200, 0.09, 0.002, 0.5);
    supersaw(ctx, chords[0], drop, 0.024, 0.55);
    // Groove: four beats of kick, off-beat hats, claps, pumping bass and stabs.
    for (let index = 0; index < 4; index++) {
      const downbeat = drop + index * beat, chord = chords[index];
      if (index) kick(ctx, downbeat, 0.42);
      hat(ctx, downbeat + beat / 2);
      if (index % 2) clap(ctx, downbeat);
      for (let eighth = 0; eighth < 2; eighth++) {
        // Each bass note starts just after the kick, as if side-chained to it.
        const start = downbeat + eighth * beat / 2 + 0.05;
        stageTone(ctx, 'square', midi(chord[0] - 24), midi(chord[0] - 24), start, 0.05, 0.012, beat / 2 - 0.09, { type: 'lowpass', from: 900, to: 320 });
      }
      if (index) supersaw(ctx, chord, downbeat + beat / 2, 0.016, 0.16);
    }
    // Outro: a sustained tonic with the winner's cheer on top.
    const outro = drop + beat * 4;
    kick(ctx, outro, 0.36);
    supersaw(ctx, [...chords[0], chords[0][0] + 12], outro, 0.02, 1.5);
    stageNoise(ctx, outro, 1.4, 6000, 3000, 0.05, 0.002, 0.5);
    // Voices ride on top of the mix through the shared, bounded cast budget.
    characterCall(ctx, t(1.3), event.attacker, 'challenge', { volume: 0.3 });
    characterCall(ctx, drop + 0.08, 'k', 'startled', { volume: 0.24 });
    characterCall(ctx, drop + beat * 0.9, event.attacker, 'cheer', { volume: 0.32 });
    characterCall(ctx, drop + beat * 1.6, 'k', 'dizzy', { volume: 0.18 });
    characterCall(ctx, outro + 0.05, event.attacker, 'win', { volume: 0.3 });
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
        // The happy jump has a springy little take-off.
        boing(ctx, at + 0.012, Math.min(560, 260 + ROLE_PITCH[role] * 0.3), 0.03);
        characterCall(ctx, at + 0.012, role, 'select');
      });
    },
    moveStart(role, motion) {
      play((ctx, at) => {
        plannedSteps(ctx, at, role, motion);
        characterCall(ctx, at, role, 'move');
      });
    },
    skirmish(role, contactTimesMs) {
      const contacts = [...new Set(contactTimesMs.filter(value => Number.isFinite(value) && value >= 0 && value <= 2400))].sort((a, b) => a - b).slice(0, 6);
      if (contacts.length) play((ctx, at) => skirmish(ctx, at, role, contacts));
    },
    captureBeat(beat) {
      if (!beat || !(beat.attacker in ROLE_PITCH) || !(beat.defender in ROLE_PITCH)) return;
      const impactsMs = beat.impactsMs.filter(value => Number.isFinite(value) && value >= 0 && value <= 2400);
      play((ctx, at) => { duckMusic(0.9); captureScore(ctx, at, { ...beat, impactsMs }); });
    },
    finale(event) {
      if (!event || !(event.attacker in ROLE_PITCH) || (event.winner !== 'w' && event.winner !== 'b')) return;
      play((ctx, at) => {
        if (!ensureStageBus(ctx)) return;
        // The radio steps aside for the whole finisher, then returns.
        duckMusic(FINALE.durationMs / 1000 + 0.4, 0);
        finaleScore(ctx, at, event);
      });
    },
    pagePop() {
      if (destroyed || !enabled || hidden() || masterMuted || context?.state !== 'running') return;
      const now = context.currentTime;
      try {
        swoosh(context, now, 0.16, 1200, 3600, 0.05);
        pluck(context, now + 0.1, 660, 0.12, 0.02, 0.6);
      } catch { cancel(); unavailable(); }
    },
    delight(role) {
      if (destroyed || !enabled || hidden() || masterMuted || context?.state !== 'running') return;
      const now = context.currentTime;
      if (now < nextDelightAt) return;
      nextDelightAt = now + 0.35;
      try {
        characterCall(context, now + 0.01, role, 'happy', { volume: 0.12 });
        boing(context, now + 0.04, Math.min(520, 240 + ROLE_PITCH[role] * 0.3), 0.018);
      } catch { cancel(); unavailable(); }
    },
    land(role, result = {}) {
      play((ctx, at) => {
        landing(ctx, at, role, result);
        characterCall(ctx, at + 0.025, role, landingActivity(result));
      });
    },
    captured(role) { play((ctx, at) => characterCall(ctx, at, role, 'captured')); },
    invalid(role, mood = 'nope', level = 1) {
      play((ctx, at) => {
        if (mood === 'angry') {
          // Stomps in time with the body, a growl, and a kettle hiss of steam.
          const stomps = level > 2 ? 4 : 3, span = level > 2 ? 1.7 : 1.25;
          for (let index = 0; index < stomps; index++) thump(ctx, at + span * (.14 + index * (.72 / stomps) + .72 / stomps * .45), 110 + ROLE_PITCH[role] * 0.15, 0.1, index % 2 ? 0.15 : -0.15);
          brush(ctx, at + 0.15, level > 2 ? 0.55 : 0.32, 5200, level > 2 ? 0.05 : 0.03, 0, 1.2);
          characterCall(ctx, at + 0.05, role, 'angry', { volume: level > 2 ? 0.34 : 0.28 });
        } else if (mood === 'sad') {
          // A sniffle, then on the third try a little "wah-wah" of falling notes.
          characterCall(ctx, at + 0.05, role, 'sad', { volume: 0.26 });
          brush(ctx, at + 0.75, 0.12, 2600, 0.025, 0, 0.9);
          if (level > 2) [392, 370, 349.23, 311.13].forEach((note, index) => pluck(ctx, at + 0.85 + index * 0.24, note, index === 3 ? 0.7 : 0.3, 0.035, 0.55));
        } else {
          // Two quick head-shake swishes and a soft wooden "tok" under the "uh-uh".
          brush(ctx, at + 0.17, 0.07, 1500, 0.05, -0.25, 1.05);
          brush(ctx, at + 0.28, 0.07, 1300, 0.045, 0.25, 1.05);
          pluck(ctx, at + 0.02, ROLE_PITCH[role] * 0.6, 0.12, 0.03, 0.75);
          characterCall(ctx, at, role, 'blocked');
        }
      });
    },
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
    pageant(cue, role = 'p') { play((ctx, at) => pageantCue(ctx, at, cue, role)); },
    scenery(cue) { play((ctx, at) => sceneryCue(ctx, at, cue)); },
    toggle() {
      play((ctx, at) => {
        brush(ctx, at, 0.055, 1900, 0.045);
        pluck(ctx, at + 0.008, 660, 0.14, 0.026, 0.64);
      });
    },
    radio(on) {
      if (destroyed) return;
      musicWanted = on;
      if (on) startMusic(); else stopMusic(true);
    },
    radioMood(mood) {
      if (mood === 'day' || mood === 'dusk') musicMood = mood;
    },
    radioFlourish(color) {
      if (musicPlaying) musicFlourish = color === 'b' ? [69, 73, 76, 81] : [72, 76, 79, 84];
    },
    isRadioPlaying: () => musicPlaying,
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
      for (const node of [...musicNodes, ...stageNodes]) { try { node.disconnect(); } catch { /* Closed. */ } }
      stageNodes = []; stageBus = undefined;
      musicNodes = []; musicBus = undefined; musicWanted = false;
      try { if (closing && closing.state !== 'closed') void closing.close().catch(() => {}); } catch { /* Disposal stays idempotent. */ }
    },
  };
}
