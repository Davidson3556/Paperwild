import { ConvexClient } from 'convex/browser';
import { api } from '../convex/_generated/api.js';
import type { MoveInput } from './game.ts';
import {
  PLAYER_TOKEN_PATTERN, ROOM_ALPHABET, ROOM_CODE_PATTERN, normalizeRoomCode,
} from './online-types.ts';
import type { OnlineClientState, OnlineCredentials, OnlineRoomSnapshot } from './online-types.ts';

type Client = Pick<ConvexClient, 'onUpdate' | 'mutation' | 'connectionState' | 'subscribeToConnectionState' | 'close'>;
type SeatStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type SeatRecord = OnlineCredentials & { action: 'create' | 'join' | 'resume' };

export interface OnlineSessionOptions {
  url?: string;
  onChange: (state: OnlineClientState) => void;
  /** Dependency seams keep the browser transport testable without a live deployment. */
  clientFactory?: (url: string) => Client;
  activeStorage?: SeatStorage | null;
  savedStorage?: SeatStorage | null;
  connectionTimeoutMs?: number;
}

const ACTIVE_KEY = 'paperwild:online:active:v1:';
const SAVED_KEY = 'paperwild:online:saved:v1:';
const STORAGE_WARNING = 'Your browser could not save this online seat. Enable browser storage before joining a room.';
const SAVED_WARNING = 'Your seat is saved in this tab, but could not be saved for a later visit. Keep this tab open.';
const CONNECTION_ERROR = 'The room server could not be reached. Check your connection and try again.';

// Only known public server messages reach the UI; unexpected errors can contain request details.
const PUBLIC_ERRORS = new Set([
  'This room was not found. Check the invite code.',
  'This room has expired. Create a new room.',
  'This player credential does not belong to this room.',
  'The room changed. Wait for the latest board and try again.',
  'That room code is already in use. Create another room.',
  'This room already has two players.',
  'Wait for your friend to join first.',
  'That move is invalid.',
  'That move is not legal.',
  'It is your friend’s turn.',
  'This game has finished. Request a rematch to play again.',
  'This game reached its move limit. Request a rematch.',
  'Answer or cancel the current request first.',
  'There is no move to undo yet.',
  'There is no request to answer.',
  'Only your friend can answer your request.',
  'The board changed after this request.',
  'There is no move to undo.',
  'There is no request to cancel.',
  'Only the player who sent this request can cancel it.',
]);

function friendlyError(error: unknown): string {
  const data = typeof error === 'object' && error !== null && 'data' in error ? error.data : null;
  if (typeof data === 'string' && PUBLIC_ERRORS.has(data)) return data;
  return 'The room could not complete that action. Wait for the latest board and try again.';
}

function readSeat(storage: SeatStorage | null, key: string): SeatRecord | null {
  const raw = storage?.getItem(key);
  if (!raw) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const value = parsed as Partial<SeatRecord>;
  if (typeof value.code !== 'string' || !ROOM_CODE_PATTERN.test(value.code)
    || typeof value.playerToken !== 'string' || !PLAYER_TOKEN_PATTERN.test(value.playerToken)) return null;
  return {
    code: value.code, playerToken: value.playerToken,
    action: value.action === 'create' || value.action === 'join' ? value.action : 'resume',
  };
}

function newToken(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (value) => value.toString(16).padStart(2, '0')).join('');
}

function newRoomCode(): string {
  // The alphabet has 32 entries, so masking random bytes introduces no modulo bias.
  return Array.from(crypto.getRandomValues(new Uint8Array(12)), (value) => ROOM_ALPHABET[value & 31]).join('');
}

export function createOnlineSession(options: OnlineSessionOptions) {
  let url = options.url?.trim() ?? '';
  try {
    if (url) {
      const parsed = new URL(url);
      if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) url = '';
      else url = url.replace(/\/$/, '');
    }
  } catch { url = ''; }

  let storageWarning: string | null = null;
  function storage(kind: 'sessionStorage' | 'localStorage', explicit: SeatStorage | null | undefined) {
    if (explicit !== undefined) return explicit;
    try { return globalThis[kind]; } catch { storageWarning = STORAGE_WARNING; return null; }
  }
  const activeStorage = storage('sessionStorage', options.activeStorage);
  const savedStorage = storage('localStorage', options.savedStorage);
  const activeKey = `${ACTIVE_KEY}${url}`;
  const savedKey = `${SAVED_KEY}${url}`;
  let active: SeatRecord | null = null;
  let saved: SeatRecord | null = null;
  try { active = readSeat(activeStorage, activeKey); } catch { storageWarning = STORAGE_WARNING; }
  try { saved = readSeat(savedStorage, savedKey); } catch { storageWarning = STORAGE_WARNING; }

  let state: OnlineClientState = {
    configured: Boolean(url), status: 'idle', pending: false, error: storageWarning,
    room: null, hasActiveSeat: Boolean(active), hasSavedSeat: Boolean(saved),
  };
  let disposed = false;
  let generation = 0;
  let client: Client | null = null;
  let connected = false;
  let unsubscribeRoom: (() => void) | null = null;
  let unsubscribeConnection: (() => void) | null = null;
  let connectionWait: { finish: (connected: boolean) => void; timer: ReturnType<typeof setTimeout> } | null = null;
  let firstSnapshot: { finish: () => void; timer: ReturnType<typeof setTimeout> } | null = null;
  let expiryTimer: ReturnType<typeof setTimeout> | null = null;
  let expectedSnapshotRevision: number | null = null;

  function publish(change: Partial<OnlineClientState>) {
    if (disposed) return;
    state = { ...state, ...change, hasActiveSeat: Boolean(active), hasSavedSeat: Boolean(saved) };
    options.onChange(state);
  }

  function finishFirstSnapshot() {
    if (!firstSnapshot) return;
    clearTimeout(firstSnapshot.timer);
    const { finish } = firstSnapshot;
    firstSnapshot = null;
    finish();
  }

  function stop() {
    generation += 1;
    unsubscribeRoom?.();
    unsubscribeConnection?.();
    unsubscribeRoom = null;
    unsubscribeConnection = null;
    if (connectionWait) {
      clearTimeout(connectionWait.timer);
      connectionWait.finish(false);
      connectionWait = null;
    }
    finishFirstSnapshot();
    if (expiryTimer) clearTimeout(expiryTimer);
    expiryTimer = null;
    const previousClient = client;
    client = null;
    connected = false;
    expectedSnapshotRevision = null;
    // close rejects outstanding work; its old generation can no longer publish.
    if (previousClient) void previousClient.close().catch(() => undefined);
  }

  function fail(message: string) {
    stop();
    publish({ status: 'error', pending: false, room: null, error: message });
  }

  function persistActive(seat: SeatRecord): boolean {
    try {
      if (!activeStorage) throw new Error('No storage');
      activeStorage.setItem(activeKey, JSON.stringify(seat));
      active = seat;
      return true;
    } catch {
      storageWarning = STORAGE_WARNING;
      fail(STORAGE_WARNING);
      return false;
    }
  }

  function saveConfirmedSeat(seat: SeatRecord) {
    // Successful queries, rather than a locally assumed role, establish a saved seat.
    const confirmed: SeatRecord = { code: seat.code, playerToken: seat.playerToken, action: 'resume' };
    if (!persistActive(confirmed)) return false;
    try {
      if (!savedStorage) throw new Error('No storage');
      savedStorage.setItem(savedKey, JSON.stringify(confirmed));
      saved = confirmed;
      storageWarning = null;
    } catch { storageWarning = SAVED_WARNING; }
    return true;
  }

  function stillCurrent(current: number) { return !disposed && current === generation; }

  function open(current: number): Client {
    const opened = (options.clientFactory ?? ((address) => new ConvexClient(address, { logger: false })))(url);
    client = opened;
    let previouslyConnected = false;
    const connectionChanged = (connection: { isWebSocketConnected: boolean }) => {
      if (!stillCurrent(current)) return;
      connected = connection.isWebSocketConnected;
      if (connected) previouslyConnected = true;
      if (connected && connectionWait) {
        clearTimeout(connectionWait.timer);
        connectionWait.finish(true);
        connectionWait = null;
      }
      if (state.room) publish({ status: connected ? 'connected' : 'reconnecting' });
      else if (previouslyConnected) publish({ status: connected ? 'joining' : 'reconnecting' });
    };
    unsubscribeConnection = opened.subscribeToConnectionState(connectionChanged);
    connectionChanged(opened.connectionState());
    return opened;
  }

  function waitForConnection(): Promise<boolean> {
    if (connected) return Promise.resolve(true);
    return new Promise((finish) => {
      const timer = setTimeout(() => {
        connectionWait = null;
        finish(false);
      }, options.connectionTimeoutMs ?? 12_000);
      connectionWait = { finish, timer };
    });
  }

  function watchRoom(opened: Client, seat: SeatRecord, current: number): Promise<void> {
    const ready = new Promise<void>((finish) => {
      firstSnapshot = { finish, timer: setTimeout(() => {
        if (stillCurrent(current)) fail(CONNECTION_ERROR);
      }, options.connectionTimeoutMs ?? 12_000) };
    });
    const unsubscribe = opened.onUpdate(api.rooms.get, { code: seat.code, playerToken: seat.playerToken }, (snapshot) => {
      if (!stillCurrent(current)) return;
      if (!snapshot || snapshot.code !== seat.code || !['w', 'b'].includes(snapshot.seat)) {
        fail('This room could not confirm your player seat. Rejoin with your invite code.');
        return;
      }
      if (snapshot.expiresAt <= Date.now()) {
        fail('This room has expired. Create a new room.');
        return;
      }
      if (state.room && snapshot.revision < state.room.revision) return;
      if (!state.room && !saveConfirmedSeat(seat)) return;
      // Keep the public state explicitly bounded even if the backend later gains private fields.
      const room: OnlineRoomSnapshot = {
        code: snapshot.code, revision: snapshot.revision, round: snapshot.round, phase: snapshot.phase,
        seat: snapshot.seat, opponentJoined: snapshot.opponentJoined, game: snapshot.game,
        undoRequest: snapshot.undoRequest, rematchRequest: snapshot.rematchRequest, expiresAt: snapshot.expiresAt,
      };
      const acquiring = Boolean(firstSnapshot);
      const acknowledged = expectedSnapshotRevision !== null && room.revision >= expectedSnapshotRevision;
      if (acknowledged) expectedSnapshotRevision = null;
      if (expiryTimer) clearTimeout(expiryTimer);
      expiryTimer = setTimeout(() => {
        if (stillCurrent(current)) fail('This room has expired. Create a new room.');
      }, Math.min(room.expiresAt - Date.now(), 2_147_483_647));
      publish({ room, status: connected ? 'connected' : 'reconnecting',
        pending: acquiring || acknowledged ? false : state.pending, error: storageWarning });
      finishFirstSnapshot();
    }, (error) => {
      if (stillCurrent(current)) fail(friendlyError(error));
    });
    if (stillCurrent(current)) unsubscribeRoom = unsubscribe;
    else unsubscribe();
    return ready;
  }

  async function acquire(seat: SeatRecord) {
    if (disposed) return;
    stop();
    if (!url) {
      publish({ status: 'error', pending: false, room: null, error: 'Online play is not configured on this site yet.' });
      return;
    }
    if (!persistActive(seat)) return;
    const current = generation;
    publish({ status: 'joining', pending: true, room: null, error: storageWarning });
    try {
      const opened = open(current);
      const ready = await waitForConnection();
      if (!stillCurrent(current)) return;
      if (!ready || !connected || !opened.connectionState().isWebSocketConnected) { fail(CONNECTION_ERROR); return; }
      const credentials = { code: seat.code, playerToken: seat.playerToken };
      if (seat.action === 'create') await opened.mutation(api.rooms.create, credentials);
      else if (seat.action === 'join') await opened.mutation(api.rooms.join, credentials);
      if (!stillCurrent(current)) return;
      await watchRoom(opened, seat, current);
    } catch (error) {
      if (stillCurrent(current)) fail(friendlyError(error));
    }
  }

  async function submit(mutation: (opened: Client, credentials: OnlineCredentials, revision: number) => Promise<{ revision: number }>) {
    if (disposed) return;
    if (client && !client.connectionState().isWebSocketConnected) connected = false;
    if (!client || !active || !state.room || !connected || state.status !== 'connected') {
      publish({ ...(state.room && !connected ? { status: 'reconnecting' as const } : {}),
        error: 'Wait for the room to reconnect before sending an action.' });
      return;
    }
    if (state.pending) return;
    if (state.room.expiresAt <= Date.now()) { fail('This room has expired. Create a new room.'); return; }
    const current = generation;
    const opened = client;
    const seat = { code: active.code, playerToken: active.playerToken };
    const revision = state.room.revision;
    publish({ pending: true, error: storageWarning });
    try {
      const result = await mutation(opened, seat, revision);
      if (!stillCurrent(current)) return;
      if (state.room && state.room.revision >= result.revision) publish({ pending: false });
      else expectedSnapshotRevision = result.revision;
    } catch (error) {
      if (stillCurrent(current)) {
        const message = friendlyError(error);
        if (message === 'This room has expired. Create a new room.'
          || message === 'This room was not found. Check the invite code.'
          || message === 'This player credential does not belong to this room.') fail(message);
        else publish({ pending: false, error: message });
      }
    }
  }

  return {
    get state(): OnlineClientState { return state; },
    async create(): Promise<void> {
      try {
        const seat = active?.action === 'create' && !state.room
          && state.error !== 'That room code is already in use. Create another room.' ? active
          : { code: newRoomCode(), playerToken: newToken(), action: 'create' as const };
        await acquire(seat);
      } catch { fail('Secure room credentials could not be created in this browser.'); }
    },
    async join(value: string): Promise<void> {
      const code = normalizeRoomCode(value);
      if (!ROOM_CODE_PATTERN.test(code)) {
        publish({ error: 'Enter the 12-character room code from your friend’s invite.' });
        return;
      }
      try {
        const seat: SeatRecord = active?.code === code ? { ...active, action: 'join' }
          : { code, playerToken: newToken(), action: 'join' };
        await acquire(seat);
      } catch { fail('Secure room credentials could not be created in this browser.'); }
    },
    async resume(useSaved = false): Promise<void> {
      if (disposed) return;
      let seat = active;
      if (useSaved) {
        // Another tab may have saved its own seat since this controller was created.
        try { seat = readSeat(savedStorage, savedKey); saved = seat; }
        catch { publish({ error: STORAGE_WARNING }); return; }
      }
      if (!seat) { publish({ error: 'There is no saved online seat to resume.' }); return; }
      await acquire(seat);
    },
    leave(): void {
      if (disposed) return;
      stop();
      active = null;
      try { activeStorage?.removeItem(activeKey); }
      catch { storageWarning = STORAGE_WARNING; }
      publish({ status: 'idle', pending: false, error: storageWarning, room: null });
    },
    move: (input: MoveInput) => submit((opened, seat, expectedRevision) => opened.mutation(api.rooms.move,
      { ...seat, expectedRevision, from: input.from, to: input.to, ...(input.promotion !== undefined ? { promotion: input.promotion } : {}) })),
    requestUndo: () => submit((opened, seat, expectedRevision) => opened.mutation(api.rooms.requestUndo, { ...seat, expectedRevision })),
    answerUndo: (accept: boolean) => submit((opened, seat, expectedRevision) => opened.mutation(api.rooms.answerUndo, { ...seat, expectedRevision, accept })),
    requestRematch: () => submit((opened, seat, expectedRevision) => opened.mutation(api.rooms.requestRematch, { ...seat, expectedRevision })),
    answerRematch: (accept: boolean) => submit((opened, seat, expectedRevision) => opened.mutation(api.rooms.answerRematch, { ...seat, expectedRevision, accept })),
    cancelRequest: () => submit((opened, seat, expectedRevision) => opened.mutation(api.rooms.cancelRequest, { ...seat, expectedRevision })),
    dispose(): void { stop(); disposed = true; },
  };
}

export type OnlineSession = ReturnType<typeof createOnlineSession>;
