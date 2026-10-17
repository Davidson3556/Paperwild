import './character-life.css';
import type { Color, PieceSymbol } from './game.ts';

const NS = 'http://www.w3.org/2000/svg';

const RESIDENTS: Readonly<Record<PieceSymbol, { name: string; cycle: number; voicePhase: number; marks: string }>> = {
  p: {
    name: 'acorn', cycle: 10.8, voicePhase: .28,
    marks: '<path d="M76 28l2-5m4 9 4-2m-13-6-1-4"/>',
  },
  r: {
    name: 'stump', cycle: 15.6, voicePhase: .37,
    marks: '<path d="M75 29c7 1 11-2 11-7-6-1-11 1-11 7Zm0 0 7-5M79 34c4 1 7 0 9-3"/>',
  },
  n: {
    name: 'hare', cycle: 11.9, voicePhase: .24,
    marks: '<path d="M78 34c5-1 5-4 2-5m-2-2c6-1 6-5 3-7"/>',
  },
  b: {
    name: 'moth', cycle: 9.6, voicePhase: .31,
    marks: '<path d="M77 25v5m-2.5-2.5h5M85 34v3m-1.5-1.5h3"/><circle cx="82" cy="20" r=".65"/>',
  },
  q: {
    name: 'fox', cycle: 14.1, voicePhase: .36,
    marks: '<path d="m78 27 2-4m2 9 4-1M75 23l-1-3"/>',
  },
  k: {
    name: 'badger', cycle: 16.4, voicePhase: .35,
    marks: '<circle cx="77" cy="31" r="1"/><circle cx="81" cy="26" r="1.8"/><path d="M82 20c-1-3 1-5 4-4 2-3 7-1 6 2 3 2 1 6-2 5-3 2-7 0-8-3Z"/>',
  },
};

/** A CSS-only resident lifecycle. Place the existing artwork body in `content`.
 * The two wrappers keep breathing and long gestures independent from the body
 * transform used by chess movement. Removing `element` disposes everything. */
export function createCharacterLife(color: Color, type: PieceSymbol, seed: number): { element: HTMLDivElement; content: HTMLDivElement } {
  const resident = RESIDENTS[type];
  const hash = Math.imul((seed >>> 0) ^ (color === 'w' ? 0x2c1b3c6d : 0x297a2d39) ^ type.charCodeAt(0), 0x85ebca6b) >>> 0;
  const element = document.createElement('div');
  element.className = `character-life character-life-${resident.name}`;
  element.dataset.character = `${color}${type}`;
  element.setAttribute('aria-hidden', 'true');
  const cycle = resident.cycle + (hash % 3900) / 1000;
  const phase = -((hash >>> 4) % 19000) / 1000;
  element.style.setProperty('--life-cycle', `${cycle}s`);
  element.style.setProperty('--life-phase', `${phase}s`);
  // The separate iteration clock reaches its boundary at this resident's
  // gesture peak. Starting a CSS animation never asks the character to speak.
  element.style.setProperty('--voice-phase', `${phase + cycle * resident.voicePhase}s`);
  element.style.setProperty('--breath-cycle', `${3.7 + ((hash >>> 7) % 2100) / 1000}s`);
  element.style.setProperty('--breath-phase', `${-((hash >>> 11) % 5700) / 1000}s`);

  const content = document.createElement('div');
  content.className = 'character-life-breath';
  const marks = document.createElementNS(NS, 'svg');
  marks.classList.add('character-life-marks');
  marks.setAttribute('viewBox', '0 0 100 100');
  marks.setAttribute('focusable', 'false');
  marks.setAttribute('aria-hidden', 'true');
  marks.innerHTML = resident.marks;
  const voiceCue = document.createElement('span');
  voiceCue.className = 'character-life-voice-cue';
  element.append(content, marks, voiceCue);
  return { element, content };
}
