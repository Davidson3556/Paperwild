import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame } from '../src/game.ts';
import type { ConservatoryGame } from '../src/game.ts';
import { epitaphFor, grandeurOf, residentName, sermonFor, storyNames } from '../src/resident-stories.ts';

function play(game: ConservatoryGame, ...moves: [string, string, string?][]) {
  for (const [from, to, promotion] of moves) assert.ok(game.move({ from, to, promotion }), `${from}-${to} should be legal`);
}

test('every resident keeps a lasting identity from its starting square', () => {
  const game = createGame({ mode: 'local' });
  // The d7 pawn walks to d5 and is taken by the e2 pawn, which went via e4.
  play(game, ['e2', 'e4'], ['d7', 'd5'], ['e4', 'd5']);
  const [story] = game.captureStories();
  assert.equal(story.square, 'd5');
  assert.equal(story.origin, 'd7'); assert.equal(story.originType, 'p');
  assert.equal(story.capturerOrigin, 'e2'); assert.equal(story.capturer, 'p');
  assert.equal(story.moves, 1); assert.equal(story.steps, 2);
  assert.deepEqual(storyNames(story), { name: 'Rowan', capturerName: 'Tuck' });
  // Stories line up one-for-one with the plain capture list.
  assert.deepEqual(game.captureStories().map(({ color, type, by, moveNumber }) => ({ color, type, by, moveNumber })), game.captures());
});

test('identities follow castling rooks, en passant victims and promotions', () => {
  const castle = createGame({ fen: '4k3/8/8/5n2/8/8/8/4K2R w K - 0 1', mode: 'local' });
  play(castle, ['e1', 'g1'], ['e8', 'd8'], ['f1', 'f5']);
  const [rookStory] = castle.captureStories();
  assert.equal(rookStory.capturerOrigin, 'h1', 'the castled rook keeps its h1 identity');
  assert.equal(rookStory.capturerOriginType, 'r');

  const passant = createGame({ mode: 'local' });
  play(passant, ['e2', 'e4'], ['a7', 'a6'], ['e4', 'e5'], ['d7', 'd5'], ['e5', 'd6']);
  const [victim] = passant.captureStories();
  assert.equal(victim.square, 'd5', 'en passant names the square where the pawn actually fell');
  assert.equal(victim.origin, 'd7');

  const promote = createGame({ fen: '1r5k/P7/8/8/8/8/8/7K w - - 0 1', mode: 'local' });
  play(promote, ['a7', 'b8', 'q']);
  assert.equal(promote.captureStories()[0].capturer, 'p', 'the capturing piece is recorded as it moved');
});

test('names belong to home squares; studies and promotions get sensible titles', () => {
  assert.equal(residentName('w', 'd1', 'q'), 'Foxglove');
  assert.equal(residentName('b', 'e8', 'k'), 'Old Grizzle');
  assert.equal(residentName('w', 'a2', 'p', 'q'), 'Pip the Fox', 'a promoted pawn keeps its name');
  assert.equal(residentName('w', 'g6', 'q'), 'Amber Fox', 'a piece placed by a study has a title');
  assert.equal(residentName('b', 'a2', 'p'), 'Indigo Little Acorn', 'an indigo piece on an amber home square is not mistaken for Pip');
  const names = new Set<string>();
  for (const file of 'abcdefgh') for (const rank of ['1', '2', '7', '8']) {
    const square = `${file}${rank}` as Parameters<typeof residentName>[1];
    const back = (['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'] as const)['abcdefgh'.indexOf(file)];
    names.add(residentName(rank === '1' || rank === '2' ? 'w' : 'b', square, rank === '2' || rank === '7' ? 'p' : back));
  }
  assert.equal(names.size, 32, 'all thirty-two residents have different names');
});

test('sermons tell the real story, vary between captures and repeat exactly for the same one', () => {
  const game = createGame({ mode: 'local' });
  play(game, ['e2', 'e4'], ['d7', 'd5'], ['e4', 'd5'], ['d8', 'd5'], ['b1', 'c3'], ['d5', 'a2'], ['a1', 'a2']);
  const stories = game.captureStories();
  assert.equal(stories.length, 4);
  const sermons = stories.map((story, index) => sermonFor(story, index));
  sermons.forEach((sermon, index) => {
    assert.ok(sermon.includes(storyNames(stories[index]).name), `sermon ${index} names the fallen`);
    assert.equal(sermon, sermonFor(stories[index], index), 'deterministic');
    assert.ok(epitaphFor(stories[index], index).length > 4);
  });
  assert.ok(sermons[3].includes('Vixen Velvet'), 'the fox queen taken by the a1 stump is remembered by name');
  assert.equal(storyNames(stories[3]).capturerName, 'Old Oakley');
  assert.equal(new Set(sermons).size, 4);
  // Across many acorn captures, more than one sermon is heard.
  const acorns = new Set(Array.from({ length: 8 }, (_, index) => sermonFor({ ...stories[0], moveNumber: index + 2 }, index).split('.')[0]));
  assert.ok(acorns.size >= 2);
});

test('send-offs scale with importance', () => {
  assert.equal(grandeurOf('p'), 'humble');
  assert.equal(grandeurOf('n'), 'standard'); assert.equal(grandeurOf('b'), 'standard');
  assert.equal(grandeurOf('r'), 'tolled');
  assert.equal(grandeurOf('q'), 'state');
});

test('consecutive send-offs of the same species never repeat their words', () => {
  const game = createGame({ mode: 'local' });
  play(game, ['e2', 'e4'], ['d7', 'd5'], ['e4', 'd5'], ['d8', 'd5'], ['b1', 'c3'], ['d5', 'a2']);
  const all = game.captureStories();
  const acorns = all.filter(story => story.type === 'p');
  assert.equal(acorns.length, 3);
  const indexOf = (story: typeof all[number]) => all.indexOf(story);
  assert.equal(new Set(acorns.map(story => epitaphFor(story, indexOf(story)))).size, 3);
  assert.equal(new Set(acorns.map(story => sermonFor(story, indexOf(story)).split(' ').slice(0, 3).join(' '))).size >= 2, true);
});
