import test from 'node:test';
import assert from 'node:assert/strict';
import { createCaptureRevivals } from '../src/capture-revival.ts';

function animation() {
  let resolve!: (value: unknown) => void;
  let reject!: (reason: unknown) => void;
  let cancellations = 0;
  const finished = new Promise<unknown>((done, failed) => { resolve = done; reject = failed; });
  return {
    finished,
    complete() { resolve(undefined); },
    cancel() { cancellations++; reject(new Error('Animation cancelled')); },
    get cancellations() { return cancellations; },
  };
}

function node(hidden = false) {
  let removals = 0;
  return { hidden, remove() { removals++; }, get removals() { return removals; } };
}

test('undoing the last settled capture keeps its garden visible until the revival finishes', async () => {
  let memorials = 1, gardenHidden = false;
  const updateGarden = () => { gardenHidden = memorials === 0 && !revivals.hasGardenRevival; };
  const revivals = createCaptureRevivals(updateGarden);
  const grave = node(), rising = animation();
  revivals.track(rising, grave, true);
  memorials = 0;
  updateGarden();
  assert.equal(gardenHidden, false, 'removing the last memorial must leave its revival visible');
  assert.equal(grave.removals, 0);
  rising.complete();
  await Promise.resolve();
  assert.equal(grave.removals, 1);
  assert.equal(gardenHidden, true, 'an empty garden hides once its final revival has departed');
});

test('an undone grave on another memorial page becomes visible for its revival', async () => {
  const revivals = createCaptureRevivals(() => {});
  const hiddenGrave = node(true), rising = animation();
  revivals.track(rising, hiddenGrave, true);
  assert.equal(hiddenGrave.hidden, false);
  assert.equal(revivals.hasGardenRevival, true);
  rising.complete();
  await Promise.resolve();
  assert.equal(hiddenGrave.removals, 1);
  assert.equal(revivals.hasGardenRevival, false);
});

test('stage revivals do not keep an empty memorial garden open', async () => {
  const revivals = createCaptureRevivals(() => {});
  const ghost = node(), rising = animation();
  revivals.track(rising, ghost, false);
  assert.equal(revivals.hasGardenRevival, false);
  rising.cancel();
  await Promise.resolve();
  assert.equal(ghost.removals, 1);
});

test('shared reset, reduced-motion, hidden-page and destroy cleanup cancels every revival once', async () => {
  let changes = 0;
  const revivals = createCaptureRevivals(() => { changes++; });
  const grave = node(), ghost = node(), rising = animation(), sittingUp = animation();
  revivals.track(rising, grave, true);
  revivals.track(sittingUp, ghost, false);
  revivals.clear();
  assert.equal(revivals.hasGardenRevival, false);
  assert.equal(rising.cancellations, 1);
  assert.equal(sittingUp.cancellations, 1);
  assert.equal(grave.removals, 1);
  assert.equal(ghost.removals, 1);
  assert.equal(changes, 3);
  // Completion/rejection callbacks queued before teardown cannot remove twice.
  rising.complete(); sittingUp.complete();
  await Promise.resolve();
  revivals.clear();
  assert.equal(grave.removals, 1);
  assert.equal(ghost.removals, 1);
  assert.equal(changes, 3);
  const next = node(), nextAnimation = animation();
  revivals.track(nextAnimation, next, true);
  assert.equal(revivals.hasGardenRevival, true);
  nextAnimation.complete();
  await Promise.resolve();
  assert.equal(next.removals, 1);
  assert.equal(revivals.hasGardenRevival, false);
});
