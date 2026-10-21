/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { api } from './_generated/api';
import schema from './schema';
import { createGame, restoreGame } from '../src/game';
import { ROOM_TTL_MS } from '../src/online-types';

const modules = import.meta.glob(['./**/*.ts', '!./**/*.test.ts']);
const CODE = 'ABCDEFGHJKLM';
const white = { code: CODE, playerToken: 'a'.repeat(64) };
const black = { code: CODE, playerToken: 'b'.repeat(64) };
const stranger = { code: CODE, playerToken: 'c'.repeat(64) };
const backend = () => convexTest(schema, modules);
type Backend = ReturnType<typeof backend>;

async function ready() {
  const t = backend();
  await t.mutation(api.rooms.create, white);
  await t.mutation(api.rooms.join, black);
  return t;
}

async function play(t: Backend, from: string, to: string, promotion?: string) {
  const snapshot = await t.query(api.rooms.get, white);
  const game = restoreGame(snapshot.game)!;
  return await t.mutation(api.rooms.move, {
    ...(game.status().turn === 'w' ? white : black),
    expectedRevision: snapshot.revision,
    from, to,
    ...(promotion ? { promotion } : {}),
  });
}

afterEach(() => vi.useRealTimers());

describe('room capabilities and seating', () => {
  test('persists token hashes only and redacts all credentials from seat-specific snapshots', async () => {
    const t = backend();
    expect(await t.mutation(api.rooms.create, white)).toEqual({ code: CODE });
    const waiting = await t.query(api.rooms.get, white);
    expect(waiting).toMatchObject({ revision: 0, round: 0, seat: 'w', phase: 'waiting', opponentJoined: false });
    expect(waiting.game).toMatchObject({ mode: 'local', history: [] });
    expect(waiting.expiresAt - Date.now()).toBeGreaterThan(ROOM_TTL_MS - 2_000);
    expect(waiting.expiresAt - Date.now()).toBeLessThanOrEqual(ROOM_TTL_MS);
    await t.mutation(api.rooms.join, black);
    const first = await t.query(api.rooms.get, white);
    const second = await t.query(api.rooms.get, black);
    expect(first).toMatchObject({ revision: 1, phase: 'playing', seat: 'w', opponentJoined: true });
    expect(second).toEqual({ ...first, seat: 'b' });
    const stored = await t.run(async (ctx) => await ctx.db.query('rooms').unique());
    expect(stored).not.toBeNull();
    expect(stored!.whiteTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored!.blackTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(stored!.whiteTokenHash).not.toBe(white.playerToken);
    expect(stored!.blackTokenHash).not.toBe(black.playerToken);
    const raw = JSON.stringify(stored);
    expect(raw).not.toContain(white.playerToken);
    expect(raw).not.toContain(black.playerToken);
    for (const snapshot of [first, second]) {
      const publicValue = JSON.stringify(snapshot);
      expect(publicValue).not.toContain('Token');
      expect(publicValue).not.toContain(stored!.whiteTokenHash);
      expect(publicValue).not.toContain(stored!.blackTokenHash!);
      expect(Object.keys(snapshot).sort()).toEqual([
        'code', 'expiresAt', 'game', 'opponentJoined', 'phase', 'rematchRequest', 'revision', 'round', 'seat', 'undoRequest',
      ]);
    }
  });

  test('create and join retries are idempotent and the same credential cannot occupy both seats', async () => {
    const t = backend();
    await t.mutation(api.rooms.create, white);
    await t.mutation(api.rooms.create, white);
    await t.mutation(api.rooms.join, white);
    expect(await t.query(api.rooms.get, white)).toMatchObject({ revision: 0, phase: 'waiting' });
    await expect(t.mutation(api.rooms.create, black)).rejects.toThrow('already in use');
    await t.mutation(api.rooms.join, black);
    await t.mutation(api.rooms.join, black);
    await t.mutation(api.rooms.create, white);
    expect(await t.query(api.rooms.get, white)).toMatchObject({ revision: 1, opponentJoined: true });
    expect(await t.run(async (ctx) => await ctx.db.query('rooms').collect())).toHaveLength(1);
    await expect(t.mutation(api.rooms.join, stranger)).rejects.toThrow('two players');
  });

  test('serializes two competing joins to one black seat', async () => {
    const t = backend();
    await t.mutation(api.rooms.create, white);
    const attempts = await Promise.allSettled([
      t.mutation(api.rooms.join, black),
      t.mutation(api.rooms.join, stranger),
    ]);
    expect(attempts.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const winner = attempts[0].status === 'fulfilled' ? black : stranger;
    const loser = winner === black ? stranger : black;
    expect(await t.query(api.rooms.get, winner)).toMatchObject({ revision: 1, seat: 'b' });
    await expect(t.query(api.rooms.get, loser)).rejects.toThrow('does not belong');
  });

  test('concurrent create and join retries reserve one room and one independent second seat', async () => {
    const t = backend();
    expect(await Promise.all([
      t.mutation(api.rooms.create, white), t.mutation(api.rooms.create, white),
    ])).toEqual([{ code: CODE }, { code: CODE }]);
    expect(await t.run(async (ctx) => await ctx.db.query('rooms').collect())).toHaveLength(1);
    expect(await Promise.all([
      t.mutation(api.rooms.join, black), t.mutation(api.rooms.join, black),
    ])).toEqual([{ code: CODE }, { code: CODE }]);
    expect(await t.query(api.rooms.get, black)).toMatchObject({ revision: 1, seat: 'b' });
    expect(await t.query(api.rooms.get, white)).toMatchObject({ revision: 1, seat: 'w' });
  });

  test('every read and room change requires an existing seat capability', async () => {
    const t = await ready();
    await expect(t.query(api.rooms.get, stranger)).rejects.toThrow('does not belong');
    await expect(t.mutation(api.rooms.move, { ...stranger, expectedRevision: 1, from: 'e2', to: 'e4' })).rejects.toThrow('does not belong');
    await expect(t.mutation(api.rooms.requestUndo, { ...stranger, expectedRevision: 1 })).rejects.toThrow('does not belong');
    await expect(t.mutation(api.rooms.answerUndo, { ...stranger, expectedRevision: 1, accept: true })).rejects.toThrow('does not belong');
    await expect(t.mutation(api.rooms.requestRematch, { ...stranger, expectedRevision: 1 })).rejects.toThrow('does not belong');
    await expect(t.mutation(api.rooms.answerRematch, { ...stranger, expectedRevision: 1, accept: true })).rejects.toThrow('does not belong');
    await expect(t.mutation(api.rooms.cancelRequest, { ...stranger, expectedRevision: 1 })).rejects.toThrow('does not belong');
    const elsewhere = { ...stranger, code: 'NPQRSTUVWXYZ' };
    await t.mutation(api.rooms.create, elsewhere);
    await expect(t.query(api.rooms.get, { ...white, code: elsewhere.code })).rejects.toThrow('does not belong');
    expect(await t.query(api.rooms.get, elsewhere)).toMatchObject({ seat: 'w', phase: 'waiting' });
  });

  test('rejects malformed, oversized, missing and unrecognized inputs', async () => {
    const t = backend();
    for (const code of ['ABC', 'abcdefghijkl', 'ABCDEFGHJKLO', 'A'.repeat(10_000)]) {
      await expect(t.mutation(api.rooms.create, { ...white, code })).rejects.toThrow('room code');
    }
    for (const playerToken of ['', 'A'.repeat(64), 'g'.repeat(64), 'a'.repeat(65), 'a'.repeat(10_000)]) {
      await expect(t.mutation(api.rooms.create, { ...white, playerToken })).rejects.toThrow('credential');
    }
    await expect(t.query(api.rooms.get, white)).rejects.toThrow('not found');
    await expect(t.mutation(api.rooms.join, black)).rejects.toThrow('not found');
    await t.mutation(api.rooms.create, white);
    await expect(t.mutation(api.rooms.join, { ...black, role: 'w' } as typeof black)).rejects.toThrow();
  });
});

describe('authoritative moves', () => {
  test('cannot start before the opponent joins', async () => {
    const t = backend();
    await t.mutation(api.rooms.create, white);
    await expect(t.mutation(api.rooms.move, { ...white, expectedRevision: 0, from: 'e2', to: 'e4' })).rejects.toThrow('join first');
    await expect(t.mutation(api.rooms.requestRematch, { ...white, expectedRevision: 0 })).rejects.toThrow('join first');
    expect(await t.query(api.rooms.get, white)).toMatchObject({ revision: 0, game: { history: [] } });
  });

  test('checks seat, legality, strict revisions, duplicate submissions, squares and promotions', async () => {
    const t = await ready();
    const firstMove = { ...white, expectedRevision: 1, from: 'e2', to: 'e4' };
    await expect(t.mutation(api.rooms.move, { ...firstMove, ...black })).rejects.toThrow('friend’s turn');
    await expect(t.mutation(api.rooms.move, { ...firstMove, to: 'e5' })).rejects.toThrow('not legal');
    await expect(t.mutation(api.rooms.move, { ...firstMove, from: 'e0' })).rejects.toThrow('invalid');
    await expect(t.mutation(api.rooms.move, { ...firstMove, promotion: 'k' })).rejects.toThrow('invalid');
    await expect(t.mutation(api.rooms.move, { ...firstMove, expectedRevision: 1.5 })).rejects.toThrow('revision');
    await expect(t.mutation(api.rooms.move, { ...firstMove, expectedRevision: -1 })).rejects.toThrow('revision');
    await expect(t.mutation(api.rooms.move, { ...firstMove, expectedRevision: 0 })).rejects.toThrow('room changed');
    expect(await t.mutation(api.rooms.move, firstMove)).toEqual({ revision: 2 });
    await expect(t.mutation(api.rooms.move, firstMove)).rejects.toThrow('room changed');
    await expect(t.mutation(api.rooms.move, { ...firstMove, expectedRevision: 2 })).rejects.toThrow('friend’s turn');
    await play(t, 'e7', 'e5');
    expect((await t.query(api.rooms.get, black)).game.history).toEqual([
      { from: 'e2', to: 'e4' }, { from: 'e7', to: 'e5' },
    ]);
  });

  test('resolves competing same-revision moves once', async () => {
    const t = await ready();
    const results = await Promise.allSettled([
      t.mutation(api.rooms.move, { ...white, expectedRevision: 1, from: 'e2', to: 'e4' }),
      t.mutation(api.rooms.move, { ...white, expectedRevision: 1, from: 'd2', to: 'd4' }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await t.query(api.rooms.get, white)).toMatchObject({ revision: 2, game: { history: [expect.any(Object)] } });
  });

  test('replays full history to enforce threefold repetition and finished games', async () => {
    const t = await ready();
    for (let i = 0; i < 2; i++) {
      await play(t, 'g1', 'f3'); await play(t, 'g8', 'f6');
      await play(t, 'f3', 'g1'); await play(t, 'f6', 'g8');
    }
    const snapshot = await t.query(api.rooms.get, white);
    expect(snapshot).toMatchObject({ phase: 'finished', revision: 9 });
    expect(restoreGame(snapshot.game)!.chess.isThreefoldRepetition()).toBe(true);
    await expect(t.mutation(api.rooms.move, { ...white, expectedRevision: 9, from: 'e2', to: 'e4' })).rejects.toThrow('finished');
  });

  test('server rules handle en passant and underpromotion', async () => {
    const t = await ready();
    await play(t, 'e2', 'e4'); await play(t, 'a7', 'a6');
    await play(t, 'e4', 'e5'); await play(t, 'd7', 'd5');
    await play(t, 'e5', 'd6');
    let snapshot = await t.query(api.rooms.get, white);
    expect(restoreGame(snapshot.game)!.chess.get('d5')).toBeUndefined();
    expect(restoreGame(snapshot.game)!.chess.get('d6')).toMatchObject({ color: 'w', type: 'p' });
    // Test fixtures may seed positions directly; no public endpoint accepts a game or FEN.
    await t.run(async (ctx) => {
      const room = await ctx.db.query('rooms').unique();
      const game = createGame({ fen: '7k/P7/8/8/8/8/8/7K w - - 0 1', mode: 'local' }).serialize();
      await ctx.db.patch(room!._id, { game: { ...game, mode: 'local', difficulty: 'garden', history: [] } });
    });
    await play(t, 'a7', 'a8', 'n');
    snapshot = await t.query(api.rooms.get, white);
    expect(snapshot.game.history).toEqual([{ from: 'a7', to: 'a8', promotion: 'n' }]);
    expect(restoreGame(snapshot.game)!.chess.get('a8')).toMatchObject({ color: 'w', type: 'n' });
  });

  test('rejects overlong persisted histories before replay or further mutation', async () => {
    const t = await ready();
    await t.run(async (ctx) => {
      const room = await ctx.db.query('rooms').unique();
      await ctx.db.patch(room!._id, {
        game: { ...room!.game, history: Array.from({ length: 2_049 }, () => ({ from: 'g1', to: 'f3' })) },
      });
    });
    await expect(t.query(api.rooms.get, white)).rejects.toThrow('could not be restored');
    await expect(t.mutation(api.rooms.move, { ...white, expectedRevision: 1, from: 'e2', to: 'e4' })).rejects.toThrow('could not be restored');
    expect(await t.run(async (ctx) => (await ctx.db.query('rooms').unique())!.revision)).toBe(1);
  });
});

describe('undo and rematch consent', () => {
  test('undo requires the opponent and removes only one ply', async () => {
    const t = await ready();
    await expect(t.mutation(api.rooms.requestUndo, { ...white, expectedRevision: 1 })).rejects.toThrow('no move');
    await play(t, 'e2', 'e4'); await play(t, 'e7', 'e5');
    expect(await t.mutation(api.rooms.requestUndo, { ...black, expectedRevision: 3 })).toEqual({ revision: 4 });
    expect(await t.query(api.rooms.get, white)).toMatchObject({ undoRequest: { by: 'b', atPly: 2 } });
    await expect(t.mutation(api.rooms.answerUndo, { ...black, expectedRevision: 4, accept: true })).rejects.toThrow('Only your friend');
    await expect(t.mutation(api.rooms.cancelRequest, { ...white, expectedRevision: 4 })).rejects.toThrow('who sent');
    expect(await t.mutation(api.rooms.answerUndo, { ...white, expectedRevision: 4, accept: true })).toEqual({ revision: 5 });
    expect(await t.query(api.rooms.get, black)).toMatchObject({ round: 0, undoRequest: null, game: { history: [{ from: 'e2', to: 'e4' }] } });
    await expect(t.mutation(api.rooms.answerUndo, { ...white, expectedRevision: 5, accept: true })).rejects.toThrow('no request');
    await play(t, 'c7', 'c5');
  });

  test('decline and cancellation preserve the board; a new move clears consent', async () => {
    const t = await ready();
    await play(t, 'e2', 'e4');
    await t.mutation(api.rooms.requestUndo, { ...white, expectedRevision: 2 });
    await expect(t.mutation(api.rooms.requestRematch, { ...black, expectedRevision: 3 })).rejects.toThrow('current request');
    await expect(t.mutation(api.rooms.answerUndo, { ...black, expectedRevision: 2, accept: true })).rejects.toThrow('room changed');
    await t.mutation(api.rooms.answerUndo, { ...black, expectedRevision: 3, accept: false });
    expect(await t.query(api.rooms.get, white)).toMatchObject({ revision: 4, undoRequest: null, game: { history: [{ from: 'e2', to: 'e4' }] } });
    await t.mutation(api.rooms.requestRematch, { ...black, expectedRevision: 4 });
    await t.mutation(api.rooms.cancelRequest, { ...black, expectedRevision: 5 });
    await t.mutation(api.rooms.requestUndo, { ...white, expectedRevision: 6 });
    await play(t, 'e7', 'e5');
    expect(await t.query(api.rooms.get, black)).toMatchObject({ revision: 8, undoRequest: null, rematchRequest: null, game: { history: [expect.any(Object), expect.any(Object)] } });
    await expect(t.mutation(api.rooms.answerUndo, { ...black, expectedRevision: 8, accept: true })).rejects.toThrow('no request');
  });

  test('rematch needs consent midgame, keeps colours and expiry, and resets only after acceptance', async () => {
    const t = await ready();
    await play(t, 'e2', 'e4');
    const before = await t.query(api.rooms.get, white);
    await t.mutation(api.rooms.requestRematch, { ...white, expectedRevision: 2 });
    expect(await t.query(api.rooms.get, black)).toMatchObject({ rematchRequest: { by: 'w' }, game: { history: [{ from: 'e2', to: 'e4' }] } });
    await expect(t.mutation(api.rooms.answerRematch, { ...white, expectedRevision: 3, accept: true })).rejects.toThrow('Only your friend');
    await t.mutation(api.rooms.answerRematch, { ...black, expectedRevision: 3, accept: false });
    expect(await t.query(api.rooms.get, white)).toMatchObject({ round: 0, game: { history: [expect.any(Object)] } });
    await t.mutation(api.rooms.requestRematch, { ...black, expectedRevision: 4 });
    await t.mutation(api.rooms.answerRematch, { ...white, expectedRevision: 5, accept: true });
    expect(await t.query(api.rooms.get, white)).toMatchObject({ revision: 6, round: 1, seat: 'w', expiresAt: before.expiresAt, phase: 'playing', rematchRequest: null, game: { history: [] } });
    expect(await t.query(api.rooms.get, black)).toMatchObject({ seat: 'b' });
    await expect(t.mutation(api.rooms.answerRematch, { ...white, expectedRevision: 5, accept: true })).rejects.toThrow('room changed');
    await expect(t.mutation(api.rooms.move, { ...white, expectedRevision: 1, from: 'e2', to: 'e4' })).rejects.toThrow('room changed');
    await play(t, 'd2', 'd4');
  });

  test('finished games support accepted undo and rematch', async () => {
    const t = await ready();
    await play(t, 'f2', 'f3'); await play(t, 'e7', 'e5');
    await play(t, 'g2', 'g4'); await play(t, 'd8', 'h4');
    expect(await t.query(api.rooms.get, white)).toMatchObject({ phase: 'finished' });
    await t.mutation(api.rooms.requestUndo, { ...white, expectedRevision: 5 });
    await t.mutation(api.rooms.answerUndo, { ...black, expectedRevision: 6, accept: true });
    expect(await t.query(api.rooms.get, white)).toMatchObject({ phase: 'playing' });
    await play(t, 'd8', 'h4');
    await t.mutation(api.rooms.requestRematch, { ...black, expectedRevision: 8 });
    await t.mutation(api.rooms.answerRematch, { ...white, expectedRevision: 9, accept: true });
    expect(await t.query(api.rooms.get, white)).toMatchObject({ phase: 'playing', revision: 10, game: { history: [] } });
  });
});

test('expired rooms reject queries, reconnects and every mutation without extending their life', async () => {
  const t = await ready();
  const { expiresAt } = await t.query(api.rooms.get, white);
  vi.useFakeTimers();
  vi.setSystemTime(expiresAt);
  await expect(t.query(api.rooms.get, white)).rejects.toThrow('expired');
  await expect(t.mutation(api.rooms.create, white)).rejects.toThrow('expired');
  await expect(t.mutation(api.rooms.join, black)).rejects.toThrow('expired');
  await expect(t.mutation(api.rooms.move, { ...white, expectedRevision: 1, from: 'e2', to: 'e4' })).rejects.toThrow('expired');
  await expect(t.mutation(api.rooms.requestUndo, { ...white, expectedRevision: 1 })).rejects.toThrow('expired');
  await expect(t.mutation(api.rooms.answerUndo, { ...black, expectedRevision: 1, accept: true })).rejects.toThrow('expired');
  await expect(t.mutation(api.rooms.requestRematch, { ...white, expectedRevision: 1 })).rejects.toThrow('expired');
  await expect(t.mutation(api.rooms.answerRematch, { ...black, expectedRevision: 1, accept: true })).rejects.toThrow('expired');
  await expect(t.mutation(api.rooms.cancelRequest, { ...white, expectedRevision: 1 })).rejects.toThrow('expired');
  const stored = await t.run(async (ctx) => await ctx.db.query('rooms').unique());
  expect(stored).toMatchObject({ expiresAt, revision: 1 });
});
