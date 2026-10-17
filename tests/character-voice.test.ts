import assert from 'node:assert/strict';
import test from 'node:test';
import { renderCharacterCall } from '../src/character-voice.ts';
import type { CharacterActivity } from '../src/character-voice.ts';
import type { PieceSymbol } from '../src/game.ts';

const ROLES: readonly PieceSymbol[] = ['p', 'r', 'n', 'b', 'q', 'k'];
const ACTIVITIES: readonly CharacterActivity[] = ['select', 'move', 'land', 'capture', 'captured', 'promotion', 'check', 'win', 'draw', 'idle', 'greet', 'blocked'];

function rms(samples: Float32Array, start = 0, end = samples.length): number {
  let energy = 0;
  for (let index = start; index < end; index++) energy += samples[index] ** 2;
  return Math.sqrt(energy / (end - start));
}

test('all creature expressions are finite, short, audible PCM with quiet boundaries at browser sample rates', () => {
  for (const sampleRate of [24000, 44100, 48000]) {
    for (const role of ROLES) for (const activity of ACTIVITIES) {
      const samples = renderCharacterCall(role, activity, sampleRate);
      const label = `${role}/${activity}/${sampleRate}`;
      assert.ok(samples.length >= sampleRate * 0.15 && samples.length <= sampleRate * 1.2, `${label}: duration`);
      let peak = 0;
      let sum = 0;
      for (const sample of samples) {
        assert.ok(Number.isFinite(sample), `${label}: finite`);
        peak = Math.max(peak, Math.abs(sample)); sum += sample;
      }
      const level = rms(samples);
      assert.ok(peak > 0.03 && peak < 0.75, `${label}: bounded, non-silent peak ${peak}`);
      assert.ok(level > 0.006 && level < 0.35, `${label}: useful RMS ${level}`);
      assert.ok(Math.abs(sum / samples.length) < 0.015, `${label}: no substantial DC`);
      assert.equal(samples[0], 0, `${label}: starts at rest`);
      assert.equal(samples.at(-1), 0, `${label}: ends at rest`);
      const edge = Math.floor(sampleRate * 0.002);
      assert.ok(rms(samples, 0, edge) < level * 0.15, `${label}: no hard attack`);
      assert.ok(rms(samples, samples.length - edge) < level * 0.15, `${label}: no hard cutoff`);
    }
  }
});

test('creatures have distinct voice textures, including breath and woody/low voiced families', () => {
  const samples = Object.fromEntries(ROLES.map(role => [role, renderCharacterCall(role, 'greet', 24000)])) as Record<PieceSymbol, Float32Array>;
  // A breathy whuffle has many more high-frequency changes relative to its
  // total energy than a rounded yip. This compares texture, not loudness.
  const roughness = (audio: Float32Array) => {
    let difference = 0;
    let energy = 0;
    for (let index = 1; index < audio.length; index++) {
      difference += (audio[index] - audio[index - 1]) ** 2;
      energy += audio[index] ** 2;
    }
    return difference / energy;
  };
  assert.ok(roughness(samples.n) > roughness(samples.q) * 2, 'hare carries breath texture beyond a pitch change');
  assert.ok(roughness(samples.b) > roughness(samples.k) * 3, 'moth flutter differs from badger chest voice');
  for (let first = 0; first < ROLES.length; first++) for (let second = first + 1; second < ROLES.length; second++) {
    assert.notDeepEqual(samples[ROLES[first]], samples[ROLES[second]], `${ROLES[first]} and ${ROLES[second]} are distinct`);
  }
});

test('activity changes expression and idle calls stay quieter than celebrations', () => {
  for (const role of ROLES) {
    const idle = renderCharacterCall(role, 'idle', 24000);
    const win = renderCharacterCall(role, 'win', 24000);
    const capture = renderCharacterCall(role, 'capture', 24000);
    const surprised = renderCharacterCall(role, 'captured', 24000);
    assert.ok(rms(idle) < rms(win) * 0.8, `${role}: idle is restrained`);
    assert.ok(win.length > idle.length * 2, `${role}: celebration has a longer phrase`);
    assert.notDeepEqual(capture, surprised, `${role}: delight differs from surprise`);
    assert.notDeepEqual(renderCharacterCall(role, 'select', 24000), renderCharacterCall(role, 'blocked', 24000), `${role}: curious and puzzled differ`);
  }
});

test('natural takes vary reproducibly without changing species or escaping audio bounds', () => {
  for (const role of ROLES) {
    const original = renderCharacterCall(role, 'greet', 44100, 0);
    assert.deepEqual(renderCharacterCall(role, 'greet', 44100, 0), original);
    for (const variant of [1, 2, 3]) {
      const take = renderCharacterCall(role, 'greet', 44100, variant);
      assert.notDeepEqual(take, original);
      assert.deepEqual(renderCharacterCall(role, 'greet', 44100, variant), take);
      assert.ok(Math.abs(take.length - original.length) / original.length < 0.05, 'variation stays subtle');
      assert.ok(rms(take) > rms(original) * 0.7 && rms(take) < rms(original) * 1.3);
    }
  }
});

test('invalid sample rates fail before allocating PCM', () => {
  for (const sampleRate of [0, -44100, Number.NaN, Infinity, 7999, 192001, 24000.5]) {
    assert.throws(() => renderCharacterCall('p', 'greet', sampleRate), RangeError);
  }
});
