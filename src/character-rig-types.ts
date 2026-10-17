/** Traced against the final 1254px square watercolor originals. Delivery images
 * share their framing; the renderer normalizes this geometry to its viewbox. */
export type Point = readonly [number, number];
export interface IdlePart {
  readonly name: string;
  readonly origin: Point;
  readonly outline: readonly Point[];
  /** Keep a little painted joint under the rotating cutout to close its seam. */
  readonly joint?: number;
}
