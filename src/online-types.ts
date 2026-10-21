import type { Color, SavedGame } from './game.ts';

/** Public room state. Seat credentials and their hashes never belong here. */
export interface OnlineRoomSnapshot {
  code: string;
  revision: number;
  round: number;
  phase: 'waiting' | 'playing' | 'finished';
  seat: Color;
  opponentJoined: boolean;
  game: SavedGame;
  undoRequest: { by: Color; atPly: number } | null;
  rematchRequest: { by: Color } | null;
  expiresAt: number;
}

export interface OnlineClientState {
  configured: boolean;
  status: 'idle' | 'joining' | 'connected' | 'reconnecting' | 'error';
  pending: boolean;
  error: string | null;
  room: OnlineRoomSnapshot | null;
  hasActiveSeat: boolean;
  hasSavedSeat: boolean;
}

export interface OnlineCredentials { code: string; playerToken: string }

export const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{12}$/;
export const PLAYER_TOKEN_PATTERN = /^[a-f0-9]{64}$/;
export const ROOM_TTL_MS = 24 * 60 * 60 * 1000;

export function normalizeRoomCode(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]/g, '');
}

export function formatRoomCode(code: string): string {
  return code.match(/.{1,4}/g)?.join(' · ') ?? code;
}
