/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { afterEach, expect, test, vi } from 'vitest';
import { internal } from './_generated/api';
import schema from './schema';
import { createGame } from '../src/game';
import { ROOM_ALPHABET } from '../src/online-types';

const modules = import.meta.glob(['./**/*.ts', '!./**/*.test.ts']);
const backend = () => convexTest(schema, modules);
type Backend = ReturnType<typeof backend>;

async function seed(t: Backend, expired: number, live: number) {
  const now = Date.now();
  await t.run(async (ctx) => {
    for (let i = 0; i < expired + live; i++) {
      const suffix = Array.from({ length: 4 }, (_, place) => ROOM_ALPHABET[(i >> (place * 5)) & 31]).join('');
      await ctx.db.insert('rooms', {
        code: `ABCDEFGH${suffix}`,
        whiteTokenHash: 'd'.repeat(64), blackTokenHash: null,
        revision: 0, round: 0,
        game: { ...createGame({ mode: 'local' }).serialize(), mode: 'local', difficulty: 'garden', history: [] },
        undoRequest: null, rematchRequest: null,
        expiresAt: i < expired ? now : now + 60_000,
      });
    }
  });
}

async function counts(t: Backend) {
  return await t.run(async (ctx) => ({
    rooms: (await ctx.db.query('rooms').collect()).length,
    jobs: (await ctx.db.system.query('_scheduled_functions').collect()).length,
  }));
}

afterEach(() => vi.useRealTimers());

test('internal cleanup removes expired rooms at the TTL boundary and preserves live rooms', async () => {
  vi.useFakeTimers();
  const t = backend();
  await seed(t, 2, 3);
  await t.mutation(internal.cleanup.expiredRooms, {});
  expect(await counts(t)).toEqual({ rooms: 3, jobs: 0 });
  const remaining = await t.run(async (ctx) => await ctx.db.query('rooms').collect());
  expect(remaining.every((room) => room.expiresAt > Date.now())).toBe(true);
});

test('cleanup bounds each deletion batch and schedules just the continuations needed', async () => {
  vi.useFakeTimers();
  const t = backend();
  await seed(t, 201, 3);
  await t.mutation(internal.cleanup.expiredRooms, {});
  expect(await counts(t)).toEqual({ rooms: 104, jobs: 1 });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  // The first invocation and two continuations delete 100, 100 and 1 rows.
  expect(await counts(t)).toEqual({ rooms: 3, jobs: 2 });
  const jobs = await t.run(async (ctx) => await ctx.db.system.query('_scheduled_functions').collect());
  expect(jobs.every((job) => job.state.kind === 'success')).toBe(true);
  await t.mutation(internal.cleanup.expiredRooms, {});
  await t.mutation(internal.cleanup.expiredRooms, {});
  expect(await counts(t)).toEqual({ rooms: 3, jobs: 2 });
});

test('an exact full batch and empty sweeps enqueue no redundant jobs', async () => {
  vi.useFakeTimers();
  const t = backend();
  await seed(t, 100, 1);
  await t.mutation(internal.cleanup.expiredRooms, {});
  expect(await counts(t)).toEqual({ rooms: 1, jobs: 0 });
  await t.mutation(internal.cleanup.expiredRooms, {});
  expect(await counts(t)).toEqual({ rooms: 1, jobs: 0 });
});
