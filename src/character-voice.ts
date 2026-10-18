import type { PieceSymbol } from './game.ts';

export type CharacterActivity = 'select' | 'move' | 'land' | 'capture' | 'captured' | 'promotion' | 'check' | 'win' | 'draw' | 'idle' | 'greet' | 'blocked'
  | 'happy' | 'cheer' | 'dizzy' | 'challenge' | 'startled' | 'farewell';

interface Expression {
  seconds: number;
  notes: readonly number[];
  glide: number;
  strength: number;
}

const EXPRESSIONS: Readonly<Record<CharacterActivity, Expression>> = {
  select: { seconds: 0.29, notes: [0, 4], glide: 3, strength: 0.75 },
  move: { seconds: 0.32, notes: [0, -2], glide: -3, strength: 0.79 },
  land: { seconds: 0.23, notes: [0], glide: -4, strength: 0.68 },
  capture: { seconds: 0.43, notes: [0, 5, 7], glide: 2, strength: 0.91 },
  captured: { seconds: 0.28, notes: [8, 2], glide: -5, strength: 0.79 },
  promotion: { seconds: 0.66, notes: [0, 4, 7, 12], glide: 2, strength: 0.95 },
  check: { seconds: 0.34, notes: [3, 3], glide: 4, strength: 0.84 },
  win: { seconds: 0.79, notes: [0, 4, 7, 12], glide: 4, strength: 0.96 },
  draw: { seconds: 0.46, notes: [3, 0], glide: -4, strength: 0.65 },
  idle: { seconds: 0.30, notes: [0], glide: 1, strength: 0.43 },
  greet: { seconds: 0.53, notes: [0, 5, 3], glide: 3, strength: 0.83 },
  blocked: { seconds: 0.30, notes: [2, -3], glide: -5, strength: 0.67 },
  // A little giggle when noticed: three quick rising "he-he-he" syllables.
  happy: { seconds: 0.40, notes: [5, 7, 10], glide: 2, strength: 0.78 },
  // The winner's "yaaay!", sliding up a fifth and an octave.
  cheer: { seconds: 0.72, notes: [0, 7, 12], glide: 5, strength: 0.95 },
  // A woozy, wobbling descent while the stars go round.
  dizzy: { seconds: 0.62, notes: [6, 3, 0, -3], glide: -6, strength: 0.72 },
  // "Hup-hup!": a determined call to the duel.
  challenge: { seconds: 0.31, notes: [0, 2], glide: 3, strength: 0.88 },
  // A single startled yelp, scooping upward.
  startled: { seconds: 0.25, notes: [9], glide: 9, strength: 0.86 },
  // A brave, quiet "bye-bye" from the stretcher.
  farewell: { seconds: 0.50, notes: [4, 0], glide: -2, strength: 0.72 },
};

interface Character {
  pitch: number;
  stretch: number;
  articulation: number;
  air: number;
  formant: number;
  formant2: number;
}

// These are imaginary creature voices, rather than recordings or biological
// claims: a moth has a fluttery breath/hum, and a stump has a hollow chuckle.
const CHARACTERS: Readonly<Record<PieceSymbol, Character>> = {
  p: { pitch: 625, stretch: 0.86, articulation: 0.67, air: 0.12, formant: 1700, formant2: 3200 },
  r: { pitch: 157, stretch: 1.07, articulation: 0.91, air: 0.16, formant: 460, formant2: 850 },
  n: { pitch: 332, stretch: 0.96, articulation: 0.60, air: 0.76, formant: 1000, formant2: 2500 },
  b: { pitch: 486, stretch: 1.10, articulation: 1.02, air: 0.58, formant: 1500, formant2: 3300 },
  q: { pitch: 406, stretch: 1.00, articulation: 0.78, air: 0.14, formant: 1050, formant2: 2050 },
  k: { pitch: 123, stretch: 1.10, articulation: 0.96, air: 0.17, formant: 340, formant2: 720 },
};

const TAU = Math.PI * 2;

function smooth(value: number): number {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
}

function bandpass(frequency: number, quality: number, sampleRate: number): (sample: number) => number {
  const omega = TAU * Math.min(frequency, sampleRate * 0.43) / sampleRate;
  const alpha = Math.sin(omega) / (2 * quality);
  const a0 = 1 + alpha;
  const b0 = alpha / a0;
  const a1 = -2 * Math.cos(omega) / a0;
  const a2 = (1 - alpha) / a0;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  return sample => {
    const y = b0 * (sample - x2) - a1 * y1 - a2 * y2;
    x2 = x1; x1 = sample; y2 = y1; y1 = y;
    return y;
  };
}

/**
 * One short, mono, deterministic PCM call. Each species has its own source
 * texture and articulation; activity supplies its expression and phrase.
 *
 * No AudioContext, timers, randomness outside the seed, or playback side
 * effects. The caller owns opt-in, scheduling, spatial position and cleanup.
 */
export function renderCharacterCall(role: PieceSymbol, activity: CharacterActivity, sampleRate: number, variant = 0): Float32Array {
  if (!Number.isFinite(sampleRate) || !Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000) {
    throw new RangeError('Character voices require an integer sample rate between 8000 and 192000 Hz.');
  }
  const character = CHARACTERS[role];
  const expression = EXPRESSIONS[activity];
  const take = Number.isFinite(variant) ? ((Math.trunc(variant) % 4) + 4) % 4 : 0;
  const seconds = expression.seconds * character.stretch * [1, 0.965, 1.035, 0.985][take];
  const samples = new Float32Array(Math.ceil(seconds * sampleRate));
  let seed = (role.charCodeAt(0) * 65537 + activity.charCodeAt(0) * 257 + activity.length * 17 + take * 1031) >>> 0;
  const random = () => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return ((seed >>> 0) / 2147483648) - 1;
  };
  const breath = bandpass(character.formant, role === 'n' || role === 'b' ? 0.75 : 2.1, sampleRate);
  // A "mouth": two resonances that open in the middle of each syllable and close
  // at its edges, so calls have vowel-like "wa"/"ya" shapes instead of a flat tone.
  const mouthLow = bandpass(character.formant * 0.92, 3.4, sampleRate);
  const mouthHigh = bandpass(character.formant2 * 0.82, 4.2, sampleRate);
  const vocal = role === 'p' || role === 'q' || role === 'k' || role === 'r';
  const whisper = bandpass(character.formant2, 0.9, sampleRate);
  let lowNoise = 0;
  const slot = seconds * 0.94 / expression.notes.length;
  const happy = activity === 'capture' || activity === 'win' || activity === 'promotion' || activity === 'greet' || activity === 'happy' || activity === 'cheer';
  const syllables = expression.notes.map((note, index) => ({
    start: index * slot + (index ? Math.sin(index * 3.1 + take) * slot * 0.035 : 0),
    duration: Math.min(seconds * 0.965 - index * slot, slot * character.articulation),
    pitch: character.pitch * 2 ** (note / 12) * [1, 0.986, 1.014, 1.006][take],
    phase: 0,
    strength: index === 0 ? 1 : 0.88 + index * 0.025,
  }));

  for (let index = 0; index < samples.length; index++) {
    const time = index / sampleRate;
    const white = random();
    const air = breath(white) * 1.5 + whisper(white) * 0.7;
    lowNoise += (white - lowNoise) * (1 - Math.exp(-TAU * 330 / sampleRate));
    let voice = 0;
    let opening = 0;
    for (const syllable of syllables) {
      const elapsed = time - syllable.start;
      const u = elapsed / syllable.duration;
      if (u <= 0 || u >= 1) continue;
      const attack = role === 'n' || role === 'b' ? 0.017 : 0.009;
      const release = role === 'b' || role === 'k' ? 0.045 : 0.027;
      const envelope = smooth(elapsed / attack) * smooth((syllable.duration - elapsed) / release);
      const decay = Math.exp(-u * (role === 'b' ? 0.45 : role === 'n' ? 1.25 : 0.84));
      const vibrato = activity === 'dizzy' ? Math.sin(TAU * 4.2 * elapsed) * 0.045
        : role === 'r' ? Math.sin(TAU * 13 * elapsed) * 0.025
        : role === 'k' ? Math.sin(TAU * 16 * elapsed) * 0.017
        : Math.sin(TAU * (happy ? 24 : 7) * elapsed) * (happy ? 0.009 : 0.004);
      const bend = expression.glide * (u - 0.27) + (role === 'q' ? Math.sin(Math.PI * u) * 3.8 : role === 'p' ? Math.sin(Math.PI * u) * 1.5 : 0);
      const frequency = syllable.pitch * 2 ** (bend / 12) * (1 + vibrato);
      syllable.phase += TAU * frequency / sampleRate;
      const phase = syllable.phase;
      let tone = 0;
      switch (role) {
        case 'p':
          // A bright pip, a tiny chirrup and a dry seed-shell rattle.
          tone = Math.sin(phase) * 0.64 + Math.sin(phase * 2) * 0.19 + Math.sin(phase * 3) * 0.055;
          tone += air * character.air * (0.35 + Math.exp(-u * 18) * 2.5);
          tone *= 0.91 + Math.sin(TAU * 35 * elapsed) * (happy ? 0.09 : 0.025);
          break;
        case 'r':
          // Uneven low pulses and a brief inharmonic wooden resonance.
          tone = Math.sin(phase) * 0.40 + Math.sin(phase * 2) * 0.25 + Math.sin(phase * 3) * 0.15 + Math.sin(phase * 5) * 0.08;
          tone += Math.sin(phase * 1.57) * 0.19 * Math.exp(-u * 9) + air * character.air;
          tone *= 0.75 + 0.25 * Math.sin(TAU * 11 * elapsed + 0.8);
          break;
        case 'n':
          // An airy little sniff/whuffle with a soft voiced chitter beneath it.
          tone = Math.sin(phase) * 0.23 + Math.sin(phase * 2) * 0.10 + Math.sin(phase * 3) * 0.06;
          tone += air * character.air * (0.72 + 0.28 * Math.sin(TAU * 31 * elapsed));
          break;
        case 'b':
          // Fluttered breath and a quiet rounded hum, never a piercing buzz.
          tone = Math.sin(phase) * 0.27 + Math.sin(phase * 2) * 0.09 + Math.sin(phase * 3) * 0.035;
          tone += Math.sin(phase * 1.006 + elapsed * 2.1) * 0.11;
          tone += air * character.air;
          tone *= 0.72 + 0.28 * Math.sin(TAU * (25 + take) * elapsed);
          break;
        case 'q':
          // A nasal, rounded yip with an upward scoop and a friendly trill.
          tone = Math.sin(phase) * 0.49 + Math.sin(phase * 2) * 0.26 + Math.sin(phase * 3) * 0.21 + Math.sin(phase * 5) * 0.075;
          tone += air * character.air;
          tone *= happy ? 0.83 + 0.17 * Math.sin(TAU * 27 * elapsed) : 0.95;
          break;
        case 'k':
          // A warm chesty hmm, with a slow irregular grumble in its body.
          tone = Math.sin(phase) * 0.55 + Math.sin(phase * 2) * 0.24 + Math.sin(phase * 3) * 0.19 + Math.sin(phase * 4) * 0.08;
          tone += lowNoise * character.air * 1.8;
          tone *= 0.81 + 0.16 * Math.sin(TAU * 17 * elapsed) + 0.03 * Math.sin(TAU * 23.7 * elapsed);
          break;
      }
      // Expression colour: giggles bounce, dizzy calls wobble, yelps snap open.
      if (activity === 'happy') tone *= 0.62 + 0.38 * Math.sin(TAU * 12 * elapsed + 1.2);
      else if (activity === 'dizzy') tone *= 0.8 + 0.2 * Math.sin(TAU * 5.5 * elapsed);
      voice += tone * envelope * decay * syllable.strength;
      opening = Math.max(opening, Math.sin(Math.PI * u) * envelope);
    }
    if (vocal) {
      const shaped = mouthLow(voice) * 1.5 + mouthHigh(voice) * (role === 'q' ? 0.35 : 0.7);
      voice = voice * (0.78 - opening * 0.18) + shaped * (0.18 + opening * 0.42);
    }
    // An additional whole-buffer fade protects the boundary even where a
    // flutter or overlapping syllable reaches the final release.
    const edge = smooth(time / 0.008) * smooth((samples.length - 1 - index) / (sampleRate * 0.018));
    samples[index] = Math.tanh(voice * 1.2) * 0.72 * expression.strength * edge + 0; // never -0 at the boundary
  }
  return samples;
}
