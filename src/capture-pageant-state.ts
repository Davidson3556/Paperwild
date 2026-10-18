import type { Capture } from './game.ts';

export type CapturePageantPhase = 'arrival' | 'sermon' | 'burial' | 'memorial';

export const CAPTURE_PAGEANT_PHASES: readonly Readonly<{ phase: CapturePageantPhase; durationMs: number }>[] = Object.freeze([
  Object.freeze({ phase: 'arrival', durationMs: 2400 }),
  Object.freeze({ phase: 'sermon', durationMs: 2200 }),
  Object.freeze({ phase: 'burial', durationMs: 2000 }),
  Object.freeze({ phase: 'memorial', durationMs: 1400 }),
]);
export const CAPTURE_PAGEANT_DURATION_MS = 8000;

export interface CapturePageantEntry {
  readonly key: string;
  readonly capture: Readonly<Capture>;
  readonly index: number;
}

export interface ActiveCapturePageant extends CapturePageantEntry {
  readonly phase: CapturePageantPhase;
  readonly elapsedMs: number;
  readonly phaseElapsedMs: number;
  readonly phaseDurationMs: number;
  readonly progress: number;
  readonly phaseProgress: number;
}

export interface CapturePageantSnapshot {
  readonly active: ActiveCapturePageant | null;
  readonly queued: readonly CapturePageantEntry[];
  readonly memorials: readonly CapturePageantEntry[];
  readonly phase: CapturePageantPhase | 'idle';
  /** Includes the active ceremony and every waiting ceremony. */
  readonly pendingCount: number;
  readonly totalCount: number;
}

export interface CapturePageantSyncOptions {
  /** Materialize a restored snapshot or honor reduced motion without replay. */
  readonly settle?: boolean;
}

/** The snapshot index disambiguates even identical capture records. Keys remain
 * stable across cloned renders, while a replacement at the same index differs. */
export function capturePageantKey(capture: Readonly<Capture>, index: number): string {
  return `capture-${index}-${capture.moveNumber}-${capture.color}${capture.type}-${capture.by}`;
}

function entry(capture: Readonly<Capture>, index: number): CapturePageantEntry {
  const copy = Object.freeze({ color: capture.color, type: capture.type, by: capture.by, moveNumber: capture.moveNumber });
  return Object.freeze({ key: capturePageantKey(copy, index), capture: copy, index });
}

/** A clock-free queue reconciled against the complete capture history.
 * Call advance only with visible, unpaused elapsed milliseconds. No browser
 * resources or game state are retained, and inspecting a snapshot is read-only.
 */
export class CapturePageantState {
  #entries: CapturePageantEntry[];
  #settled = new Set<string>();
  #queued: CapturePageantEntry[] = [];
  #active: CapturePageantEntry | null = null;
  #elapsedMs = 0;

  constructor(initialCaptures: readonly Readonly<Capture>[] = []) {
    this.#entries = initialCaptures.map(entry);
    for (const item of this.#entries) this.#settled.add(item.key);
  }

  /** Declare a different story explicitly, including one whose capture values
   * happen to match the previous story. Restored captures do not replay. */
  reset(initialCaptures: readonly Readonly<Capture>[] = []): CapturePageantSnapshot {
    this.#entries = initialCaptures.map(entry);
    return this.settle();
  }

  get snapshot(): CapturePageantSnapshot {
    let active: ActiveCapturePageant | null = null;
    if (this.#active) {
      let phaseStart = 0;
      for (const phase of CAPTURE_PAGEANT_PHASES) {
        if (this.#elapsedMs < phaseStart + phase.durationMs) {
          const phaseElapsedMs = this.#elapsedMs - phaseStart;
          active = Object.freeze({
            ...this.#active, phase: phase.phase, elapsedMs: this.#elapsedMs,
            phaseElapsedMs, phaseDurationMs: phase.durationMs,
            progress: this.#elapsedMs / CAPTURE_PAGEANT_DURATION_MS,
            phaseProgress: phaseElapsedMs / phase.durationMs,
          });
          break;
        }
        phaseStart += phase.durationMs;
      }
    }
    return Object.freeze({
      active,
      queued: Object.freeze([...this.#queued]),
      memorials: Object.freeze(this.#entries.filter(item => this.#settled.has(item.key))),
      phase: active?.phase ?? 'idle',
      pendingCount: this.#queued.length + (active ? 1 : 0),
      totalCount: this.#entries.length,
    });
  }

  /** Preserve only an identical history prefix. Undo and replacement discard
   * all removed active, queued, and settled entries before adding a new suffix.
   */
  sync(captures: readonly Readonly<Capture>[], { settle = false }: CapturePageantSyncOptions = {}): CapturePageantSnapshot {
    const next = captures.map(entry);
    let prefix = 0;
    while (prefix < next.length && prefix < this.#entries.length && next[prefix].key === this.#entries[prefix].key) prefix++;
    const surviving = new Set(next.slice(0, prefix).map(item => item.key));
    for (const key of this.#settled) if (!surviving.has(key)) this.#settled.delete(key);
    this.#queued = this.#queued.filter(item => surviving.has(item.key));
    if (this.#active && !surviving.has(this.#active.key)) { this.#active = null; this.#elapsedMs = 0; }
    this.#entries = next;
    this.#queued.push(...next.slice(prefix));
    if (settle) return this.settle();
    this.#startNext();
    return this.snapshot;
  }

  /** Advance by elapsed visible time, carrying overflow through the queue.
   * A boundary completes the old phase before exposing the next at progress 0.
   */
  advance(elapsedVisibleMs: number): CapturePageantSnapshot {
    if (!Number.isFinite(elapsedVisibleMs) || elapsedVisibleMs < 0) throw new RangeError('Elapsed visible time must be a finite, non-negative number.');
    let remaining = elapsedVisibleMs;
    this.#startNext();
    while (this.#active) {
      const untilComplete = CAPTURE_PAGEANT_DURATION_MS - this.#elapsedMs;
      if (remaining < untilComplete) { this.#elapsedMs += remaining; break; }
      remaining -= untilComplete;
      this.#settled.add(this.#active.key);
      this.#active = null; this.#elapsedMs = 0;
      this.#startNext();
      if (remaining === 0) break;
    }
    return this.snapshot;
  }

  /** Reduced motion and restored games show their memorials immediately. */
  settle(): CapturePageantSnapshot {
    this.#settled = new Set(this.#entries.map(item => item.key));
    this.#queued = []; this.#active = null; this.#elapsedMs = 0;
    return this.snapshot;
  }

  #startNext(): void {
    if (!this.#active && this.#queued.length) { this.#active = this.#queued.shift()!; this.#elapsedMs = 0; }
  }
}

export function createCapturePageantState(initialCaptures: readonly Readonly<Capture>[] = []): CapturePageantState {
  return new CapturePageantState(initialCaptures);
}
