import { v } from 'convex/values';
import { internalMutation } from './_generated/server';
import { internal } from './_generated/api';

const BATCH_SIZE = 100;

/** Internal maintenance only: clients cannot delete rooms or invoke cleanup. */
export const expiredRooms = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    const expired = await ctx.db.query('rooms')
      .withIndex('by_expiresAt', (q) => q.lte('expiresAt', Date.now()))
      .take(BATCH_SIZE + 1);
    for (const room of expired.slice(0, BATCH_SIZE)) await ctx.db.delete(room._id);
    // Read one extra row so exact batches don't enqueue an empty continuation.
    if (expired.length > BATCH_SIZE) await ctx.scheduler.runAfter(0, internal.cleanup.expiredRooms, {});
    return null;
  },
});
