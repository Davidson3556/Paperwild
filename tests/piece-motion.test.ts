import test from 'node:test';
import assert from 'node:assert/strict';
import { getPieceMotion } from '../src/piece-motion.ts';
import type { PieceSymbol, Square } from '../src/game.ts';

const roles: readonly PieceSymbol[] = ['p', 'n', 'b', 'r', 'q', 'k'];
const journeys: readonly (readonly [Square, Square])[] = [
  ['a1', 'h8'], ['h8', 'a1'], ['c2', 'c3'], ['g7', 'a7'], ['e8', 'e1'], ['a8', 'h8'],
];

test('every character starts and finishes at its canonical board pose', () => {
  for (const role of roles) for (const [from, to] of journeys) {
    const plan = getPieceMotion(role, from, to);
    const first = plan.frames[0], last = plan.frames.at(-1)!;
    assert.equal(first.offset, 0);
    assert.equal(first.progress, 0);
    assert.equal(last.offset, 1);
    assert.equal(last.progress, 1);
    for (const endpoint of [first, last]) {
      assert.equal(endpoint.lift, 0, `${role} must return to the paper`);
      assert.ok(Math.abs(endpoint.rotation) < 1e-8, `${role} must return upright`);
      assert.equal(endpoint.scaleX, 1);
      assert.equal(endpoint.scaleY, 1);
    }
    assert.ok(plan.durationMs > 0 && plan.durationMs <= 850, `${role} must fit the move interaction budget`);
  }
});

test('choreography advances toward its destination with finite, bounded poses', () => {
  for (const role of roles) for (const [from, to] of journeys) {
    const plan = getPieceMotion(role, from, to);
    let previousOffset = -1, previousProgress = 0;
    for (const pose of plan.frames) {
      assert.ok(Object.values(pose).every(Number.isFinite), `${role} has a non-finite pose`);
      assert.ok(pose.offset > previousOffset && pose.offset <= 1, `${role} keyframes must be strictly ordered`);
      assert.ok(pose.progress >= previousProgress && pose.progress <= 1, `${role} must not travel backward along the board`);
      assert.ok(pose.lift >= 0 && pose.lift <= 100, `${role} must remain within one square of jump height`);
      assert.ok(pose.scaleX > 0 && pose.scaleY > 0, `${role} must never invert its artwork`);
      previousOffset = pose.offset; previousProgress = pose.progress;
    }
  }
});

test('sound contacts stay within the motion and reversed journeys mirror the same gait', () => {
  for (const role of roles) {
    const forward = getPieceMotion(role, 'b2', 'g6');
    const reverse = getPieceMotion(role, 'g6', 'b2');
    assert.equal(forward.direction, 1);
    assert.equal(reverse.direction, -1);
    assert.equal(forward.profile, reverse.profile);
    assert.equal(forward.durationMs, reverse.durationMs);
    assert.deepEqual(forward.contactTimesMs, reverse.contactTimesMs);
    assert.equal(forward.frames.length, reverse.frames.length);
    for (let index = 0; index < forward.frames.length; index++) {
      const a = forward.frames[index], b = reverse.frames[index];
      assert.equal(a.offset, b.offset); assert.equal(a.progress, b.progress);
      assert.equal(a.lift, b.lift); assert.equal(a.scaleX, b.scaleX); assert.equal(a.scaleY, b.scaleY);
      assert.equal(a.rotation, -b.rotation);
    }
    for (const [from, to] of journeys) {
      const plan = getPieceMotion(role, from, to);
      assert.ok(plan.contacts.length > 0);
      assert.deepEqual(plan.contactTimesMs, plan.contacts.map(contact => contact.atMs));
      let previousTime = -1;
      for (const contact of plan.contacts) {
        assert.ok(contact.atMs > previousTime && contact.atMs <= plan.durationMs);
        assert.ok(['left', 'right', 'both'].includes(contact.foot));
        previousTime = contact.atMs;
      }
      assert.ok(plan.landingTimeMs >= 0 && plan.landingTimeMs <= plan.durationMs);
    }
  }
});
