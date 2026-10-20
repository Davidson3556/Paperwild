import type { CaptureStory } from './game.ts';
import { characterArt } from './character-art.ts';
import { createCharacterPortrait } from './character-portrait.ts';
import { TEAM_COLORS } from './character-mittens.ts';
import { SPECIES, epitaphFor, storyNames } from './resident-stories.ts';

export interface RemembranceSummary {
  /** A short line such as "Checkmate · White wins · 38 moves". */
  line: string;
}

function detail(story: CaptureStory): string {
  return `move ${story.moveNumber} · taken by ${storyNames(story).capturerName} on ${story.square}`;
}

/** The garden of remembrance as a page: one card for every fallen friend. */
export function renderRemembrance(list: HTMLElement, stories: readonly CaptureStory[]): void {
  list.replaceChildren();
  if (!stories.length) {
    const empty = document.createElement('p'); empty.className = 'remembrance-empty';
    empty.textContent = 'No one has left the board yet. Everyone is still busy being alive.';
    list.append(empty);
    return;
  }
  stories.forEach((story, index) => {
    const card = document.createElement('article'); card.className = 'remembrance-card'; card.dataset.team = story.color;
    const portrait = document.createElement('span'); portrait.className = 'remembrance-portrait';
    portrait.append(createCharacterPortrait(story.color, story.type, 5200 + index * 61));
    const text = document.createElement('div');
    const name = document.createElement('h3'); name.textContent = storyNames(story).name;
    const epitaph = document.createElement('p'); epitaph.className = 'remembrance-epitaph'; epitaph.textContent = epitaphFor(story, index);
    const line = document.createElement('p'); line.className = 'remembrance-detail';
    line.textContent = `${story.color === 'w' ? 'Amber' : 'Indigo'} ${SPECIES[story.type]} · ${detail(story)}`;
    text.append(name, epitaph, line); card.append(portrait, text); list.append(card);
  });
}

function wrap(context: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width > width && line) { lines.push(line); line = word; }
    else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Draws the garden onto a notebook page and downloads it as a PNG keepsake. */
export async function saveRemembrancePicture(stories: readonly CaptureStory[], summary: RemembranceSummary): Promise<void> {
  const columns = 3, cardWidth = 320, cardHeight = 210, gap = 26, top = 230;
  const width = columns * cardWidth + (columns - 1) * gap + 120;
  const rows = Math.max(1, Math.ceil(stories.length / columns));
  const height = top + rows * (cardHeight + gap) + 90;
  const canvas = document.createElement('canvas');
  const scale = 2;
  canvas.width = width * scale; canvas.height = height * scale;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D is unavailable.');
  context.scale(scale, scale);
  try { await Promise.all([document.fonts.load('56px Schoolbell'), document.fonts.load('22px "Patrick Hand"')]); } catch { /* Fall back to cursive. */ }
  const images = await Promise.all(stories.map(story => new Promise<HTMLImageElement | null>(resolve => {
    const image = new Image(); image.onload = () => resolve(image); image.onerror = () => resolve(null); image.src = characterArt(story.color, story.type);
  })));
  // A notebook page: paper, faint rules and a red margin line.
  context.fillStyle = '#f4ead4'; context.fillRect(0, 0, width, height);
  context.strokeStyle = '#d8ccb1'; context.lineWidth = 1;
  for (let y = 60; y < height; y += 34) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }
  context.strokeStyle = '#d99a8f'; context.beginPath(); context.moveTo(52, 0); context.lineTo(52, height); context.stroke();
  context.textAlign = 'center'; context.fillStyle = '#5b4733';
  context.font = '56px Schoolbell, "Patrick Hand", cursive'; context.fillText('The Garden of Remembrance', width / 2, 108);
  context.font = '24px "Patrick Hand", cursive'; context.fillStyle = '#7d6a52';
  context.fillText(summary.line, width / 2, 152);
  context.fillText(stories.length ? `${stories.length} ${stories.length === 1 ? 'friend' : 'friends'} remembered` : 'Everyone is still on the board', width / 2, 186);
  stories.forEach((story, index) => {
    const x = 60 + (index % columns) * (cardWidth + gap), y = top + Math.floor(index / columns) * (cardHeight + gap);
    const team = TEAM_COLORS[story.color];
    context.save();
    context.translate(x + cardWidth / 2, y + cardHeight / 2); context.rotate(((index % 3) - 1) * .012); context.translate(-cardWidth / 2, -cardHeight / 2);
    context.fillStyle = '#efe2c6'; context.strokeStyle = '#b39d78'; context.lineWidth = 1.6;
    context.beginPath(); context.roundRect(0, 0, cardWidth, cardHeight, 18); context.fill(); context.stroke();
    context.fillStyle = team.wash; context.globalAlpha = .55; context.fillRect(0, 14, 7, cardHeight - 28); context.globalAlpha = 1;
    // A little grassy mound under each friend.
    context.fillStyle = '#b9c49c88'; context.beginPath(); context.ellipse(78, 168, 62, 14, 0, 0, Math.PI * 2); context.fill();
    const image = images[index];
    if (image) context.drawImage(image, 18, 26, 120, 120);
    context.textAlign = 'left'; context.fillStyle = '#5b4733';
    context.font = '28px Schoolbell, "Patrick Hand", cursive';
    wrap(context, storyNames(story).name, cardWidth - 160).slice(0, 2).forEach((line, row) => context.fillText(line, 148, 52 + row * 30));
    context.font = '20px "Patrick Hand", cursive'; context.fillStyle = '#7a6550';
    wrap(context, epitaphFor(story, index), cardWidth - 160).slice(0, 3).forEach((line, row) => context.fillText(line, 148, 110 + row * 24));
    context.font = '16px "Patrick Hand", cursive'; context.fillStyle = '#8d7a62';
    wrap(context, detail(story), cardWidth - 36).slice(0, 2).forEach((line, row) => context.fillText(line, 18, 184 + row * 18));
    context.restore();
  });
  context.textAlign = 'center'; context.font = '20px "Patrick Hand", cursive'; context.fillStyle = '#8d7a62';
  context.fillText('Paperwild · chess, drawn to life', width / 2, height - 36);
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('The picture could not be created.');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = 'paperwild-garden-of-remembrance.png'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
