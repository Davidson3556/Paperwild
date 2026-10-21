import { ConvexError, v } from 'convex/values';
import type { Infer } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import type { Doc } from './_generated/dataModel';
import { color, savedGame, undoRequest } from './schema';
import { createGame, restoreGame } from '../src/game';
import type { Color, ConservatoryGame, PromotionPiece, SavedGame } from '../src/game';
import {
  PLAYER_TOKEN_PATTERN, ROOM_CODE_PATTERN, ROOM_TTL_MS,
} from '../src/online-types';
import type { OnlineRoomSnapshot } from '../src/online-types';

const credentials = { code: v.string(), playerToken: v.string() };
const revisionArgs = { ...credentials, expectedRevision: v.number() };
const changed = v.object({ revision: v.number() });
const codeResult = v.object({ code: v.string() });
const MAX_PLIES = 2_048;
const SQUARE = /^[a-h][1-8]$/;
const PROMOTIONS: ReadonlySet<string> = new Set(['q', 'r', 'b', 'n']);
type Credentials = { code: string; playerToken: string };
type RevisionArgs = Credentials & { expectedRevision: number };
type Room = Doc<'rooms'>;
type RoomGame = Infer<typeof savedGame>;

function fail(message: string): never { throw new ConvexError(message); }

function validateCredentials(args: Credentials): void {
  if (!ROOM_CODE_PATTERN.test(args.code)) fail('Enter a valid 12-character room code.');
  if (!PLAYER_TOKEN_PATTERN.test(args.playerToken)) fail('Your player credential is invalid.');
}

async function tokenHash(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function requireLive(room: Room): void {
  if (Date.now() >= room.expiresAt) fail('This room has expired. Create a new room.');
}

function seatFor(room: Room, hash: string): Color {
  if (hash === room.whiteTokenHash) return 'w';
  if (hash === room.blackTokenHash) return 'b';
  return fail('This player credential does not belong to this room.');
}

async function findRoom(ctx: QueryCtx, code: string): Promise<Room | null> {
  return await ctx.db.query('rooms').withIndex('by_code', (q) => q.eq('code', code)).unique();
}

async function authorize(ctx: QueryCtx, args: Credentials): Promise<{ room: Room; seat: Color }> {
  validateCredentials(args);
  const hash = await tokenHash(args.playerToken);
  const room = await findRoom(ctx, args.code);
  if (!room) fail('This room was not found. Check the invite code.');
  requireLive(room);
  return { room, seat: seatFor(room, hash) };
}

async function authorizeChange(ctx: MutationCtx, args: RevisionArgs): Promise<{ room: Room; seat: Color }> {
  if (!Number.isSafeInteger(args.expectedRevision) || args.expectedRevision < 0) fail('Invalid room revision.');
  const result = await authorize(ctx, args);
  if (result.room.revision !== args.expectedRevision) fail('The room changed. Wait for the latest board and try again.');
  if (result.room.blackTokenHash === null) fail('Wait for your friend to join first.');
  return result;
}

function loadGame(room: Room): ConservatoryGame {
  if (room.game.history.length > MAX_PLIES) fail('This room game could not be restored.');
  const game = restoreGame(room.game);
  if (!game) fail('This room game could not be restored.');
  return game;
}

function serialize(game: ConservatoryGame): RoomGame & SavedGame {
  const saved = game.serialize();
  return {
    initialFen: saved.initialFen,
    history: saved.history.map(({ from, to, promotion }) => promotion
      ? { from, to, promotion: promotion as PromotionPiece }
      : { from, to }),
    mode: 'local',
    difficulty: 'garden',
  };
}

function nextRevision(room: Room): number {
  if (!Number.isSafeInteger(room.revision + 1)) fail('This room has reached its update limit.');
  return room.revision + 1;
}

export const create = mutation({
  args: credentials,
  returns: codeResult,
  handler: async (ctx, args) => {
    validateCredentials(args);
    const hash = await tokenHash(args.playerToken);
    const existing = await findRoom(ctx, args.code);
    if (existing) {
      requireLive(existing);
      if (existing.whiteTokenHash === hash) return { code: existing.code };
      fail('That room code is already in use. Create another room.');
    }
    // The indexed read and insert share one serializable transaction, so two
    // creators cannot reserve the same code or overwrite an existing seat.
    await ctx.db.insert('rooms', {
      code: args.code,
      whiteTokenHash: hash,
      blackTokenHash: null,
      revision: 0,
      round: 0,
      game: serialize(createGame({ mode: 'local' })),
      undoRequest: null,
      rematchRequest: null,
      expiresAt: Date.now() + ROOM_TTL_MS,
    });
    return { code: args.code };
  },
});

export const join = mutation({
  args: credentials,
  returns: codeResult,
  handler: async (ctx, args) => {
    validateCredentials(args);
    const hash = await tokenHash(args.playerToken);
    const room = await findRoom(ctx, args.code);
    if (!room) fail('This room was not found. Check the invite code.');
    requireLive(room);
    if (hash === room.whiteTokenHash || hash === room.blackTokenHash) return { code: room.code };
    if (room.blackTokenHash !== null) fail('This room already has two players.');
    await ctx.db.patch(room._id, { blackTokenHash: hash, revision: nextRevision(room) });
    return { code: room.code };
  },
});

export const get = query({
  args: credentials,
  returns: v.object({
    code: v.string(), revision: v.number(), round: v.number(),
    phase: v.union(v.literal('waiting'), v.literal('playing'), v.literal('finished')),
    seat: color, opponentJoined: v.boolean(), game: savedGame,
    undoRequest,
    rematchRequest: v.union(v.null(), v.object({ by: color })),
    expiresAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const { room, seat } = await authorize(ctx, args);
    const game = loadGame(room);
    return {
      code: room.code,
      revision: room.revision,
      round: room.round,
      phase: room.blackTokenHash === null ? 'waiting' : game.status().over ? 'finished' : 'playing',
      seat,
      opponentJoined: room.blackTokenHash !== null,
      game: serialize(game),
      undoRequest: room.undoRequest,
      rematchRequest: room.rematchRequest ? { by: room.rematchRequest.by } : null,
      expiresAt: room.expiresAt,
    } satisfies OnlineRoomSnapshot;
  },
});

export const move = mutation({
  args: { ...revisionArgs, from: v.string(), to: v.string(), promotion: v.optional(v.string()) },
  returns: changed,
  handler: async (ctx, args) => {
    const { room, seat } = await authorizeChange(ctx, args);
    if (!SQUARE.test(args.from) || !SQUARE.test(args.to)
      || (args.promotion !== undefined && !PROMOTIONS.has(args.promotion))) fail('That move is invalid.');
    const game = loadGame(room);
    const status = game.status();
    if (status.over) fail('This game has finished. Request a rematch to play again.');
    if (status.turn !== seat) fail('It is your friend’s turn.');
    if (room.game.history.length >= MAX_PLIES) fail('This game reached its move limit. Request a rematch.');
    if (!game.move({ from: args.from, to: args.to, ...(args.promotion ? { promotion: args.promotion } : {}) })) {
      fail('That move is not legal.');
    }
    const revision = nextRevision(room);
    await ctx.db.patch(room._id, { game: serialize(game), revision, undoRequest: null, rematchRequest: null });
    return { revision };
  },
});

async function request(ctx: MutationCtx, args: RevisionArgs, kind: 'undo' | 'rematch'): Promise<{ revision: number }> {
  const { room, seat } = await authorizeChange(ctx, args);
  if (room.undoRequest || room.rematchRequest) fail('Answer or cancel the current request first.');
  const atPly = room.game.history.length;
  if (kind === 'undo' && atPly === 0) fail('There is no move to undo yet.');
  const revision = nextRevision(room);
  await ctx.db.patch(room._id, {
    revision,
    ...(kind === 'undo' ? { undoRequest: { by: seat, atPly } } : { rematchRequest: { by: seat, atPly } }),
  });
  return { revision };
}

export const requestUndo = mutation({
  args: revisionArgs, returns: changed,
  handler: (ctx, args) => request(ctx, args, 'undo'),
});

export const requestRematch = mutation({
  args: revisionArgs, returns: changed,
  handler: (ctx, args) => request(ctx, args, 'rematch'),
});

async function answer(
  ctx: MutationCtx,
  args: RevisionArgs & { accept: boolean },
  kind: 'undo' | 'rematch',
): Promise<{ revision: number }> {
  const { room, seat } = await authorizeChange(ctx, args);
  const pending = kind === 'undo' ? room.undoRequest : room.rematchRequest;
  if (!pending) fail('There is no request to answer.');
  if (pending.by === seat) fail('Only your friend can answer your request.');
  if (pending.atPly !== room.game.history.length) fail('The board changed after this request.');
  const revision = nextRevision(room);
  let game: RoomGame = room.game;
  if (args.accept) {
    if (kind === 'rematch') game = serialize(createGame({ mode: 'local' }));
    else {
      const restored = loadGame(room);
      if (restored.undoTurn().length !== 1) fail('There is no move to undo.');
      game = serialize(restored);
    }
  }
  await ctx.db.patch(room._id, {
    revision, game,
    round: kind === 'rematch' && args.accept ? room.round + 1 : room.round,
    undoRequest: null, rematchRequest: null,
  });
  return { revision };
}

export const answerUndo = mutation({
  args: { ...revisionArgs, accept: v.boolean() }, returns: changed,
  handler: (ctx, args) => answer(ctx, args, 'undo'),
});

export const answerRematch = mutation({
  args: { ...revisionArgs, accept: v.boolean() }, returns: changed,
  handler: (ctx, args) => answer(ctx, args, 'rematch'),
});

export const cancelRequest = mutation({
  args: revisionArgs, returns: changed,
  handler: async (ctx, args) => {
    const { room, seat } = await authorizeChange(ctx, args);
    const pending = room.undoRequest ?? room.rematchRequest;
    if (!pending) fail('There is no request to cancel.');
    if (pending.by !== seat) fail('Only the player who sent this request can cancel it.');
    const revision = nextRevision(room);
    await ctx.db.patch(room._id, { revision, undoRequest: null, rematchRequest: null });
    return { revision };
  },
});
