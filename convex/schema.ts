import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export const color = v.union(v.literal('w'), v.literal('b'));
const promotion = v.union(v.literal('q'), v.literal('r'), v.literal('b'), v.literal('n'));
export const savedGame = v.object({
  initialFen: v.string(),
  history: v.array(v.object({ from: v.string(), to: v.string(), promotion: v.optional(promotion) })),
  mode: v.literal('local'),
  difficulty: v.literal('garden'),
});
export const undoRequest = v.union(v.null(), v.object({ by: color, atPly: v.number() }));
export const rematchRequest = v.union(v.null(), v.object({ by: color, atPly: v.number() }));

export default defineSchema({
  rooms: defineTable({
    code: v.string(),
    whiteTokenHash: v.string(),
    blackTokenHash: v.union(v.string(), v.null()),
    revision: v.number(),
    round: v.number(),
    game: savedGame,
    undoRequest,
    rematchRequest,
    expiresAt: v.number(),
  }).index('by_code', ['code']).index('by_expiresAt', ['expiresAt']),
});
