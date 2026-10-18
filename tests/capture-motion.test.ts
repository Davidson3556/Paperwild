import test from 'node:test';
import assert from 'node:assert/strict';
import { CAPTURE_MOTION_DURATION_MS, CAPTURE_PICKUP, getCaptureMotion } from '../src/capture-motion.ts';
import type { CaptureMotionFrame } from '../src/capture-motion.ts';
import type { PieceSymbol, Square } from '../src/game.ts';

const roles: readonly PieceSymbol[] = ['p', 'n', 'b', 'r', 'q', 'k'];
const journeys: readonly (readonly [Square, Square])[] = [['a1', 'h8'], ['h8', 'a1'], ['d2', 'd5'], ['e7', 'e3'], ['b2', 'e5'], ['g2', 'd5']];
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} should equal ${expected}`);
const at = (frames: readonly CaptureMotionFrame[], ms: number) => frames.find(frame => Math.abs(frame.offset * CAPTURE_MOTION_DURATION_MS - ms) < 1e-8);
function canonical(frame: CaptureMotionFrame, x: number, y: number) {
  close(frame.x, x); close(frame.y, y); assert.equal(frame.rotation, 0);
  assert.equal(frame.scaleX, 1); assert.equal(frame.scaleY, 1);
}

test('every role approaches, squares up, scuffles, celebrates and claims its exact destination', () => {
  for (const role of roles) for (const [from, to] of journeys) {
    const plan = getCaptureMotion(role, from, to);
    assert.equal(plan.durationMs, CAPTURE_MOTION_DURATION_MS);
    assert.deepEqual(plan.phases.map(phase => phase.name), ['approach', 'faceoff', 'scuffle', 'victory', 'claim']);
    assert.equal(plan.phases[0].startMs, 0);
    assert.equal(plan.phases.at(-1)!.endMs, plan.durationMs);
    for (let index = 1; index < plan.phases.length; index++) assert.equal(plan.phases[index].startMs, plan.phases[index - 1].endMs);
    canonical(plan.attackerFrames[0], 0, 0);
    canonical(plan.attackerFrames.at(-1)!, to.charCodeAt(0) - from.charCodeAt(0), Number(from[1]) - Number(to[1]));
    canonical(plan.defenderFrames[0], 0, 0);
    // The loser finishes sitting beside the square, ready for the stretcher.
    canonical(plan.defenderFrames.at(-1)!, plan.defenderRest.x, plan.defenderRest.y);
    for (const frames of [plan.attackerFrames, plan.defenderFrames]) {
      assert.equal(frames[0].offset, 0); assert.equal(frames.at(-1)!.offset, 1);
    }
  }
});

test('choreography has strictly ordered finite frames and bounded cartoon deformations', () => {
  for (const role of roles) for (const [from, to] of journeys) {
    const plan = getCaptureMotion(role, from, to);
    for (const frames of [plan.attackerFrames, plan.defenderFrames]) {
      let offset = -1;
      for (const frame of frames) {
        assert.ok(Object.values(frame).every(Number.isFinite));
        assert.ok(frame.offset > offset && frame.offset <= 1);
        assert.ok(Math.abs(frame.x) <= 8 && Math.abs(frame.y) <= 8);
        assert.ok(Math.abs(frame.rotation) <= 30);
        assert.ok(frame.scaleX >= .65 && frame.scaleX <= 1.35);
        assert.ok(frame.scaleY >= .65 && frame.scaleY <= 1.35);
        offset = frame.offset;
      }
    }
    for (const gestures of [plan.attackerGestures, plan.defenderGestures]) {
      let end = 0;
      for (const gesture of gestures) {
        assert.ok(gesture.startMs >= end && gesture.endMs > gesture.startMs && gesture.endMs <= plan.durationMs);
        end = gesture.endMs;
      }
    }
  }
});

test('left and right captures mirror positions and leans without changing the score', () => {
  for (const role of roles) {
    const right = getCaptureMotion(role, 'b2', 'e5'), left = getCaptureMotion(role, 'g2', 'd5');
    assert.equal(right.direction, 1); assert.equal(left.direction, -1);
    assert.deepEqual(right.impactTimesMs, left.impactTimesMs);
    close(right.defenderRest.x, -left.defenderRest.x); close(right.defenderRest.y, left.defenderRest.y);
    for (const [a, b] of [[right.attackerFrames, left.attackerFrames], [right.defenderFrames, left.defenderFrames]] as const) {
      assert.equal(a.length, b.length);
      for (let index = 0; index < a.length; index++) {
        close(a[index].offset, b[index].offset); close(a[index].x, -b[index].x);
        close(a[index].y, b[index].y); close(a[index].rotation, -b[index].rotation);
        close(a[index].scaleX, b[index].scaleX); close(a[index].scaleY, b[index].scaleY);
      }
    }
  }
});

test('en passant fights at the adjacent victim then claims the empty destination', () => {
  const plan = getCaptureMotion('p', 'e5', 'd6', 'd5');
  assert.equal(plan.victimSquare, 'd5');
  assert.deepEqual(plan.victimDelta, { x: -1, y: 0 });
  assert.deepEqual(plan.delta, { x: -1, y: -1 });
  const approachEnd = at(plan.attackerFrames, 560)!;
  assert.ok(approachEnd.x < 0 && approachEnd.x > -1);
  close(approachEnd.y, 0);
  const claimStart = at(plan.attackerFrames, 2200)!;
  close(claimStart.y, 0);
  canonical(plan.attackerFrames.at(-1)!, -1, -1);
  const mirror = getCaptureMotion('p', 'd5', 'e6', 'e5');
  close(mirror.attackerFrames.at(-1)!.x, 1); close(mirror.attackerFrames.at(-1)!.y, -1);
});

test('impacts land inside the scuffle on both fighters, each with its own lettered word', () => {
  for (const role of roles) {
    const plan = getCaptureMotion(role, 'c4', 'd5');
    const scuffle = plan.phases.find(phase => phase.name === 'scuffle')!;
    let previous = scuffle.startMs;
    for (const impact of plan.impactTimesMs) {
      assert.ok(impact > previous && impact < scuffle.endMs);
      assert.ok(at(plan.attackerFrames, impact));
      assert.ok(at(plan.defenderFrames, impact));
      previous = impact;
    }
    assert.ok(plan.impactTimesMs.every(impact => impact <= 2400), 'impacts fit the sound score');
    assert.equal(plan.words.length, plan.impactTimesMs.length);
    assert.ok(plan.words.every(word => word.length > 1) && plan.victoryWord.length > 1);
    const victory = plan.phases.find(item => item.name === 'victory')!;
    assert.ok(victory.startMs > previous, 'the winner is clear before claiming the square');
  }
});

test('the loser is knocked clear of the claimed square and the stretcher trip is ordered', () => {
  for (const role of roles) for (const [from, to] of journeys) {
    const plan = getCaptureMotion(role, from, to);
    const rest = plan.defenderRest;
    assert.ok(Math.hypot(rest.x, rest.y) >= .35 && Math.hypot(rest.x, rest.y) <= .6, 'beside, not on, the square');
  }
  assert.ok(CAPTURE_PICKUP.arriveMs < CAPTURE_PICKUP.liftMs && CAPTURE_PICKUP.liftMs < CAPTURE_PICKUP.departMs && CAPTURE_PICKUP.departMs < CAPTURE_PICKUP.durationMs);
});

test('plans are deterministic and each species keeps a distinct physical gesture', () => {
  const gestures = new Set<string>();
  for (const role of roles) {
    const plan = getCaptureMotion(role, 'e4', 'd5');
    assert.deepEqual(plan, getCaptureMotion(role, 'e4', 'd5'));
    gestures.add(JSON.stringify(plan.attackerFrames));
    assert.ok(Object.isFrozen(plan)); assert.ok(Object.isFrozen(plan.attackerFrames));
  }
  assert.equal(gestures.size, roles.length);
});
