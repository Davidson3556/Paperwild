import test from 'node:test';
import assert from 'node:assert/strict';
import { getFunctionName } from 'convex/server';
import { createOnlineSession } from '../src/online-session.ts';
import type { OnlineSessionOptions } from '../src/online-session.ts';
import { createGame } from '../src/game.ts';
import { PLAYER_TOKEN_PATTERN, ROOM_CODE_PATTERN } from '../src/online-types.ts';
import type { OnlineRoomSnapshot } from '../src/online-types.ts';

const URL = 'https://paperwild-test.convex.cloud';
const CODE = 'ABCDEFGHJK23';
type Client = ReturnType<NonNullable<OnlineSessionOptions['clientFactory']>>;
type Reference = Parameters<typeof getFunctionName>[0];
type Call = { name: string; args: Record<string, unknown> };
const turn = () => new Promise<void>((resolve) => setImmediate(resolve));

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

function room(code = CODE, revision = 0, seat: 'w' | 'b' = 'w'): OnlineRoomSnapshot {
  return { code, revision, round: 0, phase: 'playing', seat, opponentJoined: true,
    game: createGame({ mode: 'local' }).serialize(), undoRequest: null, rematchRequest: null,
    expiresAt: Date.now() + 60_000 };
}

class FakeClient {
  calls: Call[] = [];
  connected = true;
  closed = 0;
  unsubscribed = 0;
  connectionUnsubscribed = 0;
  autoSnapshot = true;
  seat: 'w' | 'b' = 'w';
  queryArgs: Record<string, unknown> | null = null;
  updates: Array<(snapshot: OnlineRoomSnapshot) => void> = [];
  errors: Array<(error: Error) => void> = [];
  listeners = new Set<(state: { isWebSocketConnected: boolean }) => void>();
  handleMutation: ((call: Call) => Promise<unknown>) | null = null;

  connectionState() { return { isWebSocketConnected: this.connected }; }
  subscribeToConnectionState(callback: (state: { isWebSocketConnected: boolean }) => void) {
    this.listeners.add(callback);
    return () => { this.connectionUnsubscribed += 1; this.listeners.delete(callback); };
  }
  connection(value: boolean) {
    this.connected = value;
    for (const listener of this.listeners) listener(this.connectionState());
  }
  onUpdate(_reference: Reference, args: Record<string, unknown>, update: (snapshot: OnlineRoomSnapshot) => void, error: (error: Error) => void) {
    this.queryArgs = args;
    this.updates.push(update);
    this.errors.push(error);
    if (this.autoSnapshot) queueMicrotask(() => update(room(args.code as string, 0, this.seat)));
    return () => { this.unsubscribed += 1; };
  }
  mutation(reference: Reference, args: Record<string, unknown>): Promise<unknown> {
    const call = { name: getFunctionName(reference), args };
    this.calls.push(call);
    return this.handleMutation ? this.handleMutation(call)
      : Promise.resolve(call.name === 'rooms:create' || call.name === 'rooms:join' ? { code: args.code } : { revision: Number(args.expectedRevision) + 1 });
  }
  emit(snapshot: OnlineRoomSnapshot) { this.updates.at(-1)?.(snapshot); }
  close() { this.closed += 1; return Promise.resolve(); }
  asClient(): Client { return this as unknown as Client; }
}

function setup(client = new FakeClient(), activeStorage = new MemoryStorage(), savedStorage = new MemoryStorage()) {
  const changes: unknown[] = [];
  const session = createOnlineSession({ url: URL, onChange: (state) => changes.push(state),
    activeStorage, savedStorage, clientFactory: () => client.asClient() });
  return { session, client, activeStorage, savedStorage, changes };
}

test('host and guest in separate tabs use separate credentials despite shared saved-seat storage', async () => {
  const saved = new MemoryStorage();
  const host = setup(new FakeClient(), new MemoryStorage(), saved);
  await host.session.create();
  const hostCall = host.client.calls[0];
  assert.match(hostCall.args.code as string, ROOM_CODE_PATTERN);
  assert.match(hostCall.args.playerToken as string, PLAYER_TOKEN_PATTERN);

  const guestClient = new FakeClient();
  guestClient.seat = 'b';
  const guest = setup(guestClient, new MemoryStorage(), saved);
  assert.equal(guest.session.state.hasSavedSeat, true);
  assert.equal(guest.session.state.hasActiveSeat, false);
  await guest.session.resume();
  assert.equal(guest.client.calls.length, 0, 'a new tab must not silently claim the saved host seat');
  await guest.session.join(hostCall.args.code as string);
  assert.notEqual(guest.client.calls[0].args.playerToken, hostCall.args.playerToken);
  assert.equal(guest.session.state.room?.seat, 'b');
  assert.equal(host.session.state.room?.seat, 'w');
  assert.equal(JSON.stringify(host.session.state).includes(hostCall.args.playerToken as string), false);
  assert.equal(JSON.stringify(guest.session.state).includes(guest.client.calls[0].args.playerToken as string), false);
  host.session.dispose(); guest.session.dispose();
});

test('invite codes normalize and invalid codes never reach the server', async () => {
  const { session, client } = setup();
  for (const value of ['short', 'ABCDEFGHJK2O', 'ABCDEFGHJK21', 'ABCDEFGHJK2I']) await session.join(value);
  assert.equal(client.calls.length, 0);
  assert.match(session.state.error ?? '', /12-character/);
  await session.join(' abcd efgh-jk23 ');
  assert.equal(client.calls[0].args.code, CODE);
  assert.equal(session.state.status, 'connected');
  session.dispose();
});

test('a reload resumes the active tab credential through the query without claiming a new seat', async () => {
  const first = setup();
  await first.session.join(CODE);
  const token = first.client.calls[0].args.playerToken;
  first.session.dispose();
  const reloaded = setup(new FakeClient(), first.activeStorage, first.savedStorage);
  assert.equal(reloaded.session.state.hasActiveSeat, true);
  await reloaded.session.resume();
  assert.equal(reloaded.client.calls.length, 0);
  assert.equal(reloaded.client.queryArgs?.playerToken, token);
  assert.equal(reloaded.session.state.status, 'connected');
  reloaded.session.dispose();
});

test('credentials are persisted before acquisition and a retry reuses an interrupted creation', async () => {
  const fixture = setup();
  fixture.client.handleMutation = async (call) => {
    assert.ok([...fixture.activeStorage.values.values()].some((value) => value.includes(call.args.playerToken as string)));
    throw new Error('network failure with secret internal detail');
  };
  await fixture.session.create();
  const first = fixture.client.calls[0];
  assert.equal(fixture.session.state.status, 'error');
  assert.equal(fixture.session.state.error?.includes('secret internal detail'), false);
  fixture.client.handleMutation = null;
  await fixture.session.create();
  assert.deepEqual(fixture.client.calls[1].args, first.args);
  fixture.session.dispose();
});

test('a new session resumes a pending acquisition with the same persisted credential', async () => {
  const first = setup();
  first.client.handleMutation = async () => { throw new Error('interrupted'); };
  await first.session.join(CODE);
  const credentials = first.client.calls[0].args;
  first.session.dispose();
  const reloaded = setup(new FakeClient(), first.activeStorage, first.savedStorage);
  await reloaded.session.resume();
  assert.deepEqual(reloaded.client.calls[0].args, credentials);
  reloaded.session.dispose();
});

test('disconnected players cannot queue moves or requests and reconnect with the same seat', async () => {
  const { session, client } = setup();
  await session.join(CODE);
  client.connected = false; // The socket can change before its notification is delivered.
  await session.move({ from: 'e2', to: 'e4' });
  assert.equal(client.calls.length, 1);
  client.connection(false);
  assert.equal(session.state.status, 'reconnecting');
  const count = client.calls.length;
  await session.move({ from: 'e2', to: 'e4' });
  await session.requestUndo();
  assert.equal(client.calls.length, count);
  client.connection(true);
  assert.equal(session.state.status, 'connected');
  await session.move({ from: 'e2', to: 'e4' });
  assert.equal(client.calls.at(-1)?.args.playerToken, client.calls[0].args.playerToken);
  assert.equal(client.calls.at(-1)?.args.expectedRevision, 0);
  session.dispose();
});

test('initial disconnection does not enqueue a room mutation', async () => {
  const client = new FakeClient();
  client.connected = false;
  const session = createOnlineSession({ url: URL, onChange: () => undefined,
    activeStorage: new MemoryStorage(), savedStorage: new MemoryStorage(),
    clientFactory: () => client.asClient(), connectionTimeoutMs: 5 });
  await session.create();
  assert.equal(client.calls.length, 0);
  assert.equal(session.state.status, 'error');
  assert.match(session.state.error ?? '', /connection/);
  session.dispose();
});

test('startup waits for a real connection before submitting the persisted seat once', async () => {
  const { session, client, activeStorage } = setup();
  client.connected = false;
  const joining = session.join(CODE);
  await turn();
  assert.equal(client.calls.length, 0);
  assert.equal(session.state.status, 'joining');
  assert.equal(activeStorage.values.size, 1);
  client.connection(true);
  await joining;
  assert.equal(client.calls.length, 1);
  assert.equal(session.state.status, 'connected');
  session.dispose();
});

test('losing the initial socket before an acquisition submits cannot enqueue that mutation', async () => {
  const { session, client } = setup();
  const joining = session.join(CODE);
  client.connection(false);
  await joining;
  assert.equal(client.calls.length, 0);
  assert.equal(session.state.status, 'error');
  session.dispose();
});

test('busy survives an early snapshot, then clears when its mutation acknowledgement arrives', async () => {
  const { session, client } = setup();
  await session.join(CODE);
  let acknowledge!: (value: unknown) => void;
  client.handleMutation = () => new Promise((resolve) => { acknowledge = resolve; });
  const moving = session.move({ from: 'e2', to: 'e4' });
  client.emit(room(CODE, 1));
  assert.equal(session.state.pending, true);
  await session.move({ from: 'e2', to: 'e4' });
  await session.requestUndo();
  assert.equal(client.calls.length, 2, 'a busy move must not submit a concurrent request');
  acknowledge({ revision: 1 });
  await moving;
  assert.equal(session.state.pending, false);
  session.dispose();
});

test('a mutation acknowledgement waits for the authoritative board before enabling another action', async () => {
  const { session, client } = setup();
  await session.join(CODE);
  await session.requestUndo();
  assert.equal(client.calls.at(-1)?.name, 'rooms:requestUndo');
  assert.equal(client.calls.at(-1)?.args.expectedRevision, 0);
  assert.equal(session.state.pending, true);
  client.emit({ ...room(CODE, 1), undoRequest: { by: 'w', atPly: 1 } });
  assert.equal(session.state.pending, false);
  await session.answerUndo(false);
  assert.equal(client.calls.at(-1)?.name, 'rooms:answerUndo');
  assert.equal(client.calls.at(-1)?.args.accept, false);
  assert.equal(client.calls.at(-1)?.args.expectedRevision, 1);
  client.emit(room(CODE, 2));
  await session.requestRematch();
  client.emit({ ...room(CODE, 3), rematchRequest: { by: 'b' } });
  await session.answerRematch(true);
  assert.equal(client.calls.at(-1)?.name, 'rooms:answerRematch');
  assert.equal(client.calls.at(-1)?.args.accept, true);
  client.emit(room(CODE, 4));
  await session.cancelRequest();
  assert.equal(client.calls.at(-1)?.name, 'rooms:cancelRequest');
  session.dispose();
});

test('leaving suppresses late snapshots, errors, connection events and mutation completions', async () => {
  const { session, client, changes } = setup();
  await session.join(CODE);
  let acknowledge!: (value: unknown) => void;
  client.handleMutation = () => new Promise((resolve) => { acknowledge = resolve; });
  const moving = session.move({ from: 'e2', to: 'e4' });
  const staleUpdate = client.updates[0];
  const staleError = client.errors[0];
  const staleConnection = [...client.listeners][0];
  session.leave();
  const count = changes.length;
  staleUpdate(room(CODE, 9));
  staleError(new Error('stale error'));
  staleConnection({ isWebSocketConnected: true });
  acknowledge({ revision: 1 });
  await moving;
  assert.equal(changes.length, count);
  assert.equal(session.state.room, null);
  assert.equal(session.state.status, 'idle');
  assert.equal(session.state.hasActiveSeat, false);
  assert.equal(session.state.hasSavedSeat, true, 'leaving preserves an explicit later resume');
  assert.equal(client.unsubscribed, 1);
  assert.equal(client.connectionUnsubscribed, 1);
  session.dispose();
});

test('switching rooms suppresses a previous room acquisition that resolves later', async () => {
  const first = new FakeClient();
  const second = new FakeClient();
  let finishFirst!: (value: unknown) => void;
  first.handleMutation = () => new Promise((resolve) => { finishFirst = resolve; });
  const clients = [first, second];
  const session = createOnlineSession({ url: URL, onChange: () => undefined,
    activeStorage: new MemoryStorage(), savedStorage: new MemoryStorage(),
    clientFactory: () => clients.shift()!.asClient() });
  const original = session.create();
  await turn();
  await session.join(CODE);
  finishFirst({ code: first.calls[0].args.code });
  await original;
  assert.equal(first.queryArgs, null);
  assert.equal(session.state.room?.code, CODE);
  assert.equal(session.state.status, 'connected');
  session.dispose();
});

test('a repeated acquisition reuses the same credential and only the latest attempt subscribes', async () => {
  const first = new FakeClient();
  const second = new FakeClient();
  let acknowledge!: (value: unknown) => void;
  first.handleMutation = () => new Promise((resolve) => { acknowledge = resolve; });
  const clients = [first, second];
  const session = createOnlineSession({ url: URL, onChange: () => undefined,
    activeStorage: new MemoryStorage(), savedStorage: new MemoryStorage(),
    clientFactory: () => clients.shift()!.asClient() });
  const original = session.create();
  await turn();
  await session.create();
  assert.deepEqual(second.calls[0].args, first.calls[0].args);
  acknowledge({ code: first.calls[0].args.code });
  await original;
  assert.equal(first.queryArgs, null);
  assert.equal(second.updates.length, 1);
  assert.equal(session.state.room?.code, first.calls[0].args.code);
  session.dispose();
});

test('query errors end the connection and cannot be overwritten by later connection events', async () => {
  const { session, client } = setup();
  await session.join(CODE);
  const error = Object.assign(new Error('server error'), { data: 'This room has expired. Create a new room.' });
  const staleConnection = [...client.listeners][0];
  client.errors[0](error);
  staleConnection({ isWebSocketConnected: true });
  assert.equal(session.state.status, 'error');
  assert.equal(session.state.room, null);
  assert.match(session.state.error ?? '', /expired/);
  session.dispose();
});

test('idle rooms expire locally without waiting for another server document update', async () => {
  const { session, client } = setup();
  await session.join(CODE);
  client.emit({ ...room(), expiresAt: Date.now() + 15 });
  await new Promise((resolve) => setTimeout(resolve, 35));
  assert.equal(session.state.status, 'error');
  assert.equal(session.state.room, null);
  assert.match(session.state.error ?? '', /expired/);
  assert.equal(client.closed, 1);
  session.dispose();
});

test('disposing closes subscriptions and ignores all future callbacks', async () => {
  const { session, client, changes } = setup();
  await session.join(CODE);
  session.dispose();
  const count = changes.length;
  client.updates[0](room(CODE, 10));
  client.errors[0](new Error('late'));
  await session.move({ from: 'e2', to: 'e4' });
  await session.create();
  session.leave();
  assert.equal(changes.length, count);
  assert.equal(client.calls.length, 1);
  assert.equal(client.unsubscribed, 1);
  assert.equal(client.connectionUnsubscribed, 1);
  assert.equal(client.closed, 1);
});

test('storage denial is visible and prevents an unrecoverable seat from reaching the server', async () => {
  const client = new FakeClient();
  const denied = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => undefined };
  const session = createOnlineSession({ url: URL, onChange: () => undefined,
    activeStorage: denied, savedStorage: new MemoryStorage(), clientFactory: () => client.asClient() });
  await session.create();
  assert.equal(client.calls.length, 0);
  assert.equal(session.state.status, 'error');
  assert.match(session.state.error ?? '', /storage/);
  session.dispose();
});

test('saved-storage denial preserves a usable per-tab seat and displays the limitation', async () => {
  const client = new FakeClient();
  const denied = { getItem: () => null, setItem: () => { throw new Error('denied'); }, removeItem: () => undefined };
  const active = new MemoryStorage();
  active.setItem('paperwild:local-game', 'untouched local game');
  const session = createOnlineSession({ url: URL, onChange: () => undefined,
    activeStorage: active, savedStorage: denied, clientFactory: () => client.asClient() });
  await session.join(CODE);
  assert.equal(session.state.status, 'connected');
  assert.equal(session.state.hasActiveSeat, true);
  assert.equal(session.state.hasSavedSeat, false);
  assert.match(session.state.error ?? '', /Keep this tab open/);
  assert.equal(active.getItem('paperwild:local-game'), 'untouched local game');
  session.dispose();
});

test('saved resume is explicit, while malformed saved data never establishes a seat', async () => {
  const first = setup();
  await first.session.join(CODE);
  const token = first.client.calls[0].args.playerToken;
  first.session.dispose();
  const fresh = setup(new FakeClient(), new MemoryStorage(), first.savedStorage);
  await fresh.session.resume(true);
  assert.equal(fresh.client.queryArgs?.playerToken, token);
  assert.equal(fresh.client.calls.length, 0);
  fresh.session.dispose();
  for (const key of first.savedStorage.values.keys()) first.savedStorage.setItem(key, '{"code":"short","playerToken":"invalid"}');
  const corrupted = setup(new FakeClient(), new MemoryStorage(), first.savedStorage);
  assert.equal(corrupted.session.state.hasSavedSeat, false);
  await corrupted.session.resume(true);
  assert.equal(corrupted.client.queryArgs, null);
  corrupted.session.dispose();
});
