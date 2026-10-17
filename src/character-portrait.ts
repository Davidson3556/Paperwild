import './character-portrait.css';
import type { Color, PieceSymbol } from './game.ts';
import { characterArt } from './character-art.ts';
import { createCharacterFace } from './character-face.ts';
import { createCharacterIdle } from './character-idle.ts';
import { createCharacterLife } from './character-life.ts';

/** The same residents keep breathing and blinking off the board, too. */
export function createCharacterPortrait(color: Color, type: PieceSymbol, seed: number, label = ''): HTMLSpanElement {
  const portrait = document.createElement('span');
  portrait.className = `character-portrait character-portrait-${type}`;
  portrait.dataset.color = color;
  if (label) { portrait.setAttribute('role', 'img'); portrait.setAttribute('aria-label', label); }
  else portrait.setAttribute('aria-hidden', 'true');
  const body = document.createElement('div');
  body.className = 'sketch-piece-body';
  body.dataset.artwork = 'loading';
  const image = document.createElement('img');
  image.className = 'sketch-piece-art';
  image.alt = label;
  image.draggable = false;
  image.decoding = 'async';
  const fallback = document.createElement('span');
  fallback.className = 'sketch-piece-fallback';
  fallback.textContent = (color === 'w' ? {p:'♙',r:'♖',n:'♘',b:'♗',q:'♕',k:'♔'} : {p:'♟',r:'♜',n:'♞',b:'♝',q:'♛',k:'♚'})[type];
  fallback.hidden = true;
  image.onload = () => { body.dataset.artwork = 'ready'; image.hidden = false; fallback.hidden = true; };
  image.onerror = () => { body.dataset.artwork = 'missing'; image.hidden = true; fallback.hidden = false; };
  body.append(image, fallback, createCharacterFace(color, type, seed));
  const idle = createCharacterIdle(color, type, seed);
  if (idle) {
    portrait.classList.add('has-idle-parts');
    body.style.setProperty('--idle-cutout', idle.mask);
    body.append(idle.element);
  }
  const life = createCharacterLife(color, type, seed);
  life.content.append(body);
  portrait.append(life.element);
  image.src = characterArt(color, type);
  return portrait;
}
