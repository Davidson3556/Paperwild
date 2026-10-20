import type { CaptureStory, Color, PieceSymbol, Square } from './game.ts';

/** Every resident of the standard set has a name, given by its starting square.
 * Amber (White) and indigo (Black) residents never share a name. */
const NAMES: Readonly<Record<string, string>> = Object.freeze({
  a2: 'Pip', b2: 'Hazel', c2: 'Nutmeg', d2: 'Bramble', e2: 'Tuck', f2: 'Chestnut', g2: 'Maple', h2: 'Button',
  a1: 'Old Oakley', h1: 'Mossy Mabel', b1: 'Clover', g1: 'Thistledown', c1: 'Lumen', f1: 'Glimmer', d1: 'Foxglove', e1: 'King Bramblewick',
  a7: 'Sloe', b7: 'Bilberry', c7: 'Juniper', d7: 'Rowan', e7: 'Wren', f7: 'Cobnut', g7: 'Pinecone', h7: 'Fennel',
  a8: 'Stumpy Stan', h8: 'Burl', b8: 'Bluebell', g8: 'Dash', c8: 'Nightjar', f8: 'Dusk', d8: 'Vixen Velvet', e8: 'Old Grizzle',
});
export const SPECIES: Readonly<Record<PieceSymbol, string>> = Object.freeze({ p: 'acorn', n: 'hare', b: 'moth', r: 'stump', q: 'fox', k: 'badger' });
const TITLES: Readonly<Record<PieceSymbol, string>> = Object.freeze({ p: 'Little Acorn', n: 'Wandering Hare', b: 'Moth', r: 'Old Stump', q: 'Fox', k: 'Badger' });
const HOME_TYPE: Readonly<Record<string, PieceSymbol>> = Object.freeze(Object.fromEntries(
  ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].flatMap((file, index) => {
    const back = (['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'] as const)[index];
    return [[`${file}2`, 'p'], [`${file}7`, 'p'], [`${file}1`, back], [`${file}8`, back]] as [string, PieceSymbol][];
  }),
));

/** A resident's name. Pieces outside the standard start (in studies) use a
 * species title, and a promoted pawn keeps its name with its new species. */
export function residentName(color: Color, origin: Square, originType: PieceSymbol, currentType: PieceSymbol = originType): string {
  const home = HOME_TYPE[origin] === originType && (Number(origin[1]) <= 2) === (color === 'w') ? NAMES[origin] : undefined;
  const base = home ?? `${color === 'w' ? 'Amber' : 'Indigo'} ${TITLES[originType]}`;
  return currentType !== originType ? `${base} the ${SPECIES[currentType][0].toUpperCase()}${SPECIES[currentType].slice(1)}` : base;
}

export interface StoryNames { name: string; capturerName: string }
export function storyNames(story: CaptureStory): StoryNames {
  return {
    name: residentName(story.color, story.origin, story.originType, story.type),
    capturerName: residentName(story.by, story.capturerOrigin, story.capturerOriginType, story.capturer),
  };
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
type Sermon = (story: CaptureStory, names: StoryNames) => string;
/** Three sermons for each species, told with the fallen piece's real game. */
const SERMONS: Readonly<Record<PieceSymbol, readonly Sermon[]>> = {
  p: [
    (s, n) => `Here lies ${n.name} of ${s.origin}, who ${s.steps ? `marched ${plural(s.steps, 'brave step')}` : 'never took a single step'} with very small feet and very big plans. Taken by ${n.capturerName} on ${s.square}, move ${s.moveNumber}.`,
    (_s, n) => `${n.name} never once moved backwards. Mostly because acorns can't. ${n.capturerName} caught up with them in the end.`,
    (s, n) => `Dear woodland. ${n.name} dreamed of reaching the far side of the board. ${n.capturerName} had other plans on ${s.square}. We shall miss the enthusiasm.`,
  ],
  n: [
    (s, n) => `${n.name} took the scenic route: ${plural(s.moves, 'hop')}, never once in a straight line. ${n.capturerName} finally caught them on ${s.square}.`,
    (s, n) => `Two steps this way, one step that way. ${n.name} never asked for directions, and won't need to now. Move ${s.moveNumber}.`,
    (_s, n) => `A carrot has been left in ${n.name}'s will. ${n.capturerName} is not getting it.`,
  ],
  b: [
    (s, n) => `${n.name} followed the light, and the diagonals, all the way to ${s.square}. ${n.capturerName} was waiting there.`,
    (_s, n) => `We leave a little lamp on for ${n.name}, just in case this is another dramatic entrance.`,
    (s, n) => `${n.name} fluttered ${plural(s.steps, 'square')} in ${plural(s.moves, 'flight')}. A small moth. A large legacy.`,
  ],
  r: [
    (s, n) => `${n.name} stood for something. Mostly in straight lines. Toppled by ${n.capturerName} on ${s.square}.`,
    (s, n) => `${n.name} held ${s.origin} with great dignity and a mild smell of moss. May the termites be exceptionally polite.`,
    (s, n) => `Here rests ${n.name}: solid as a stump and twice as stubborn. Move ${s.moveNumber}. Timber.`,
  ],
  q: [
    (s, n) => `${n.name} could go almost anywhere. Naturally, ${n.name} chose trouble, and found ${n.capturerName} on ${s.square}.`,
    (s, n) => `We commend ${n.name} to the earth: ${plural(s.moves, 'magnificent move')}, every one of them a little bit extra.`,
    (_s, n) => `The crown is now a very small bird bath. ${n.name} would have wanted it that way. Probably.`,
  ],
  k: [
    (_s, n) => `${n.name} moved one sensible step at a time, and kept an unreasonable collection of biscuits.`,
    (s, n) => `${n.name} ruled from ${s.origin} with a lovely crown and very firm opinions.`,
    (_s, n) => `A committee of worms has been appointed to look after ${n.name}'s crown.`,
  ],
};
const EPITAPHS: Readonly<Record<PieceSymbol, readonly string[]>> = {
  p: ['Small feet. Big plans.', 'Always forward.', 'A tiny oak, someday.', 'Never once looked back.', 'Brave in every square.'],
  n: ['Hopped its own way.', 'Never in a straight line.', 'Left a carrot. And a legend.', 'Two this way, one that way.', 'Ears up to the end.'],
  b: ['Followed the light.', 'Diagonal to the end.', 'A lamp is left on.', 'Fluttered, never faltered.', 'Moonlight suited it.'],
  r: ['Stood firm. Mostly.', 'Straight lines, kind heart.', 'Rooted forever.', 'Mossy and magnificent.', 'Held the corner proudly.'],
  q: ['A little bit extra, always.', 'Fabulous to the last.', 'Chose trouble, found it.', 'Went everywhere, twice.', 'Tail high, always.'],
  k: ['A sensible life.', 'Biscuits for all.', 'A lovely crown.', 'One careful step at a time.', 'Firm opinions, warm heart.'],
};

/** Deterministic variety: the same capture always gets the same words, and
 * consecutive captures in a game never repeat them. */
function pick<T>(options: readonly T[], _story: CaptureStory, index: number): T {
  return options[index % options.length];
}
export function sermonFor(story: CaptureStory, index: number): string {
  return pick(SERMONS[story.type], story, index)(story, storyNames(story));
}
export function epitaphFor(story: CaptureStory, index: number): string {
  return pick(EPITAPHS[story.type], story, index + 1);
}

/** How grand the send-off is: humble for acorns, a tolling bell for stumps and
 * a full state funeral for a fox queen. */
export type Grandeur = 'humble' | 'standard' | 'tolled' | 'state';
export function grandeurOf(type: PieceSymbol): Grandeur {
  return type === 'p' ? 'humble' : type === 'r' ? 'tolled' : type === 'q' || type === 'k' ? 'state' : 'standard';
}
