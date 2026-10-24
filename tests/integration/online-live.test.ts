import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import { ConvexClient } from 'convex/browser';
import { api } from '../../convex/_generated/api.js';
import { ROOM_ALPHABET } from '../../src/online-types.ts';
import type { OnlineCredentials, OnlineRoomSnapshot } from '../../src/online-types.ts';

// Opt in explicitly: the normal unit suite must never create remote rooms.
const endpoint = process.env.CONVEX_TEST_URL;
if (!endpoint) throw new Error('Set CONVEX_TEST_URL to the running local Convex backend before running this integration suite.');
const address = new URL(endpoint);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(address.hostname)) {
  throw new Error('CONVEX_TEST_URL must point to a local Convex backend.');
}

function credentials(code = Array.from(randomBytes(12), (byte) => ROOM_ALPHABET[byte % ROOM_ALPHABET.length]).join('')): OnlineCredentials {
  return { code, playerToken: randomBytes(32).toString('hex') };
}

function observe(client: ConvexClient, seat: OnlineCredentials) {
  let latest: OnlineRoomSnapshot | undefined;
  let failure: Error | undefined;
  const listeners = new Set<() => void>();
  const unsubscribe = client.onUpdate(api.rooms.get, seat, (snapshot) => {
    latest = snapshot;
    for (const listener of listeners) listener();
  }, (error) => {
    failure = error;
    for (const listener of listeners) listener();
  });
  return {
    unsubscribe,
    wait(predicate: (snapshot: OnlineRoomSnapshot) => boolean): Promise<OnlineRoomSnapshot> {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          listeners.delete(check);
          reject(new Error(`Room subscription did not converge; latest revision: ${latest?.revision ?? 'none'}.`));
        }, 10_000);
        function check() {
          if (failure || (latest && predicate(latest))) {
            clearTimeout(timer);
            listeners.delete(check);
            if (failure) reject(failure);
            else resolve(latest!);
          }
        }
        listeners.add(check);
        check();
      });
    },
  };
}

async function sameBoard(
  white: ReturnType<typeof observe>,
  black: ReturnType<typeof observe>,
  revision: number,
) {
  const [first, second] = await Promise.all([
    white.wait((snapshot) => snapshot.revision === revision),
    black.wait((snapshot) => snapshot.revision === revision),
  ]);
  assert.equal(first.seat, 'w');
  assert.equal(second.seat, 'b');
  assert.deepEqual(second, { ...first, seat: 'b' });
  return first;
}

test('real WebSocket clients converge, consent to changes and recover the same seat after reconnect', { timeout: 45_000 }, async (context) => {
  const clients: ConvexClient[] = [];
  const subscriptions: Array<ReturnType<typeof observe>> = [];
  const connect = () => {
    const client = new ConvexClient(endpoint, { logger: false });
    clients.push(client);
    return client;
  };
  context.after(async () => {
    for (const subscription of subscriptions) subscription.unsubscribe();
    await Promise.all(clients.filter((client) => !client.closed).map((client) => client.close()));
  });
  const host = connect();
  let friend = connect();
  const white = credentials();
  const black = credentials(white.code);
  await host.mutation(api.rooms.create, white);
  const hostView = observe(host, white);
  subscriptions.push(hostView);
  assert.equal((await hostView.wait((snapshot) => snapshot.revision === 0)).phase, 'waiting');
  await assert.rejects(friend.query(api.rooms.get, black), /does not belong/);
  await friend.mutation(api.rooms.join, black);
  let friendView = observe(friend, black);
  subscriptions.push(friendView);
  await sameBoard(hostView, friendView, 1);

  await host.mutation(api.rooms.move, { ...white, expectedRevision: 1, from: 'e2', to: 'e4' });
  await sameBoard(hostView, friendView, 2);
  await friend.mutation(api.rooms.move, { ...black, expectedRevision: 2, from: 'e7', to: 'e5' });
  await sameBoard(hostView, friendView, 3);
  await assert.rejects(friend.mutation(api.rooms.move, { ...black, expectedRevision: 3, from: 'a7', to: 'a6' }), /friend’s turn/);

  await host.mutation(api.rooms.requestUndo, { ...white, expectedRevision: 3 });
  assert.deepEqual((await sameBoard(hostView, friendView, 4)).undoRequest, { by: 'w', atPly: 2 });
  await assert.rejects(host.mutation(api.rooms.answerUndo, { ...white, expectedRevision: 4, accept: true }), /Only your friend/);
  await friend.mutation(api.rooms.answerUndo, { ...black, expectedRevision: 4, accept: true });
  assert.deepEqual((await sameBoard(hostView, friendView, 5)).game.history, [{ from: 'e2', to: 'e4' }]);

  await friend.mutation(api.rooms.requestRematch, { ...black, expectedRevision: 5 });
  assert.deepEqual((await sameBoard(hostView, friendView, 6)).rematchRequest, { by: 'b' });
  await assert.rejects(friend.mutation(api.rooms.answerRematch, { ...black, expectedRevision: 6, accept: true }), /Only your friend/);
  await host.mutation(api.rooms.answerRematch, { ...white, expectedRevision: 6, accept: true });
  const rematch = await sameBoard(hostView, friendView, 7);
  assert.equal(rematch.round, 1);
  assert.deepEqual(rematch.game.history, []);

  await host.mutation(api.rooms.move, { ...white, expectedRevision: 7, from: 'd2', to: 'd4' });
  await sameBoard(hostView, friendView, 8);
  await friend.mutation(api.rooms.move, { ...black, expectedRevision: 8, from: 'd7', to: 'd5' });
  await sameBoard(hostView, friendView, 9);
  friendView.unsubscribe();
  await friend.close();
  await host.mutation(api.rooms.move, { ...white, expectedRevision: 9, from: 'c2', to: 'c4' });
  await hostView.wait((snapshot) => snapshot.revision === 10);
  friend = connect();
  await friend.mutation(api.rooms.join, black);
  friendView = observe(friend, black);
  subscriptions.push(friendView);
  assert.equal((await sameBoard(hostView, friendView, 10)).game.history.length, 3);
  await assert.rejects(friend.mutation(api.rooms.move, { ...black, expectedRevision: 9, from: 'e7', to: 'e6' }), /room changed/);
  await friend.mutation(api.rooms.move, { ...black, expectedRevision: 10, from: 'e7', to: 'e6' });
  await sameBoard(hostView, friendView, 11);

  await friend.mutation(api.rooms.requestUndo, { ...black, expectedRevision: 11 });
  await sameBoard(hostView, friendView, 12);
  await host.mutation(api.rooms.answerUndo, { ...white, expectedRevision: 12, accept: false });
  assert.equal((await sameBoard(hostView, friendView, 13)).game.history.length, 4);
  await host.mutation(api.rooms.requestRematch, { ...white, expectedRevision: 13 });
  await sameBoard(hostView, friendView, 14);
  await host.mutation(api.rooms.cancelRequest, { ...white, expectedRevision: 14 });
  assert.equal((await sameBoard(hostView, friendView, 15)).rematchRequest, null);
});

test('real transactions serialize create retries, seat races and competing moves across connections', { timeout: 30_000 }, async (context) => {
  const first = new ConvexClient(endpoint, { logger: false });
  const second = new ConvexClient(endpoint, { logger: false });
  context.after(async () => await Promise.all([first.close(), second.close()]));
  const white = credentials();
  assert.deepEqual(await Promise.all([
    first.mutation(api.rooms.create, white), second.mutation(api.rooms.create, white),
  ]), [{ code: white.code }, { code: white.code }]);
  assert.equal((await first.query(api.rooms.get, white)).revision, 0);

  const candidateOne = credentials(white.code);
  const candidateTwo = credentials(white.code);
  const joins = await Promise.allSettled([
    first.mutation(api.rooms.join, candidateOne), second.mutation(api.rooms.join, candidateTwo),
  ]);
  assert.equal(joins.filter((attempt) => attempt.status === 'fulfilled').length, 1);
  const winner = joins[0].status === 'fulfilled' ? candidateOne : candidateTwo;
  const loser = winner === candidateOne ? candidateTwo : candidateOne;
  assert.equal((await second.query(api.rooms.get, winner)).seat, 'b');
  await assert.rejects(first.query(api.rooms.get, loser), /does not belong/);
  await assert.rejects(second.mutation(api.rooms.join, loser), /two players/);
  await Promise.all([first.mutation(api.rooms.join, winner), second.mutation(api.rooms.join, winner)]);
  assert.equal((await first.query(api.rooms.get, white)).revision, 1);

  const moves = await Promise.allSettled([
    first.mutation(api.rooms.move, { ...white, expectedRevision: 1, from: 'e2', to: 'e4' }),
    second.mutation(api.rooms.move, { ...white, expectedRevision: 1, from: 'd2', to: 'd4' }),
  ]);
  assert.equal(moves.filter((attempt) => attempt.status === 'fulfilled').length, 1);
  const board = await first.query(api.rooms.get, white);
  assert.equal(board.revision, 2);
  assert.equal(board.game.history.length, 1);
  assert.deepEqual(await second.query(api.rooms.get, winner), { ...board, seat: 'b' });

  const collisionOne = credentials();
  const collisionTwo = credentials(collisionOne.code);
  const creates = await Promise.allSettled([
    first.mutation(api.rooms.create, collisionOne), second.mutation(api.rooms.create, collisionTwo),
  ]);
  assert.equal(creates.filter((attempt) => attempt.status === 'fulfilled').length, 1);
  const creator = creates[0].status === 'fulfilled' ? collisionOne : collisionTwo;
  const rejectedCreator = creator === collisionOne ? collisionTwo : collisionOne;
  assert.equal((await first.query(api.rooms.get, creator)).seat, 'w');
  await assert.rejects(second.query(api.rooms.get, rejectedCreator), /does not belong/);
});
