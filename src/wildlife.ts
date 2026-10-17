import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type Creature = 'robin' | 'snail' | 'butterfly' | 'bee';
export type Weather = 'clear' | 'rain';
type Point = readonly [number, number, number];

interface Visitor {
  root: THREE.Group;
  wings: THREE.Group[];
  stops: Point[];
  from: THREE.Vector3;
  to: THREE.Vector3;
  control: THREE.Vector3;
  start: number;
  duration: number;
  waitUntil: number;
  index: number;
  flying: boolean;
  resting: boolean;
  phase: number;
  pending: Point[];
}

const TAU = Math.PI * 2;
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Small, purposeful visitors. Their routes stay outside the playable squares. */
export function createWildlife(scene: THREE.Scene) {
  const sphereGeometry = new THREE.SphereGeometry(1, 16, 12);
  const detailGeometry = new THREE.SphereGeometry(1, 9, 7);
  const palette = {
    blue: new THREE.MeshStandardMaterial({ color: 0x557b83, roughness: .64 }),
    feather: new THREE.MeshStandardMaterial({ color: 0x3c5d68, roughness: .73 }),
    orange: new THREE.MeshStandardMaterial({ color: 0xd19660, roughness: .75 }),
    cream: new THREE.MeshStandardMaterial({ color: 0xece2c6, roughness: .76 }),
    black: new THREE.MeshStandardMaterial({ color: 0x202d29, roughness: .3 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xbba16c, roughness: .55, metalness: .15 }),
    shell: new THREE.MeshStandardMaterial({ color: 0xc48f66, roughness: .65 }),
    shellLine: new THREE.MeshStandardMaterial({ color: 0x805b3f, roughness: .75 }),
    snail: new THREE.MeshStandardMaterial({ color: 0xa5b18a, roughness: .64 }),
    wing: new THREE.MeshStandardMaterial({ color: 0xffdc95, roughness: .48, side: THREE.DoubleSide }),
    wingTip: new THREE.MeshStandardMaterial({ color: 0xc4844f, roughness: .5, side: THREE.DoubleSide }),
    translucent: new THREE.MeshPhysicalMaterial({ color: 0xdcebe5, transparent: true, opacity: .72, roughness: .18, metalness: .08, side: THREE.DoubleSide }),
    yellow: new THREE.MeshStandardMaterial({ color: 0xe2b44e, roughness: .7 }),
  };
  const roots: THREE.Group[] = [];
  function ellipsoid(parent: THREE.Object3D, position: Point, scale: Point, material: THREE.Material, detail = false) {
    const mesh = new THREE.Mesh(detail ? detailGeometry : sphereGeometry, material);
    mesh.position.set(...position); mesh.scale.set(...scale);
    mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  function rod(parent: THREE.Object3D, from: Point, to: Point, thickness: number, material: THREE.Material) {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(thickness, thickness, a.distanceTo(b), 6), material);
    mesh.position.addVectors(a, b).multiplyScalar(.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
    parent.add(mesh); return mesh;
  }
  function creature(kind: Creature) {
    const root = new THREE.Group(); root.userData.creature = kind; scene.add(root); roots.push(root); return root;
  }

  // The robin's head and wings have their own joints. It watches the garden,
  // blinks, hops along the brass, then flies to a different perch.
  const bird = creature('robin');
  const birdBody = new THREE.Group(); bird.add(birdBody);
  ellipsoid(birdBody, [0, .30, 0], [.24, .31, .23], palette.blue);
  ellipsoid(birdBody, [0, .27, .155], [.197, .23, .095], palette.orange);
  ellipsoid(birdBody, [0, .13, .10], [.16, .12, .11], palette.cream);
  const tail = ellipsoid(birdBody, [0, .26, -.32], [.115, .06, .28], palette.feather); tail.rotation.x = -.32;
  const birdHead = new THREE.Group(); birdHead.position.set(0, .58, .10); birdBody.add(birdHead);
  ellipsoid(birdHead, [0, .03, 0], [.18, .18, .17], palette.blue);
  ellipsoid(birdHead, [0, -.035, .139], [.13, .115, .045], palette.orange);
  const eyes: THREE.Mesh[] = [];
  for (const sign of [-1, 1]) {
    ellipsoid(birdHead, [sign * .129, .067, .10], [.044, .047, .031], palette.cream, true);
    eyes.push(ellipsoid(birdHead, [sign * .135, .069, .124], [.025, .03, .022], palette.black, true));
    ellipsoid(birdHead, [sign * .132, .080, .143], [.007, .009, .006], palette.cream, true);
  }
  const beak = new THREE.Mesh(new THREE.ConeGeometry(.045, .15, 8), palette.brass);
  beak.rotation.x = Math.PI / 2; beak.position.set(0, -.008, .213); birdHead.add(beak);
  const birdWings: THREE.Group[] = [];
  for (const sign of [-1, 1]) {
    const joint = new THREE.Group(); joint.position.set(sign * .18, .39, -.015); birdBody.add(joint); birdWings.push(joint);
    const wing = ellipsoid(joint, [sign * .035, -.09, -.025], [.075, .20, .125], palette.feather); wing.rotation.z = sign * -.15;
    for (let i = 0; i < 3; i++) ellipsoid(joint, [sign * .072, -.15 + i * .045, -.072], [.016, .09, .035], palette.blue, true);
    rod(bird, [sign * .09, 0, 0], [sign * .09, .13, .015], .012, palette.brass);
    for (const toe of [-1, 0, 1]) rod(bird, [sign * .09, .012, .015], [sign * .09 + toe * .045, .01, .075], .007, palette.brass);
  }
  const birdPerches: Point[] = [[-2.65, 1.86, -4.96], [2.45, 1.94, -4.96], [-.75, 2.30, -4.96]];
  let birdPerch = 0, birdStart = 0, birdDuration = 0, birdNext = 7.5, birdFlying = false, birdAlert = -10;
  const birdFrom = new THREE.Vector3(), birdTo = new THREE.Vector3();
  bird.position.set(...birdPerches[0]); bird.rotation.y = .36;

  // A real little resident of the front rim: a raised spiral shell, a soft
  // stretching foot, independently curious eyes, and occasional pauses.
  const snail = creature('snail'); snail.position.set(-2.8, .212, 4.38);
  const snailFoot = ellipsoid(snail, [0, .05, 0], [.44, .066, .12], palette.snail);
  const snailHead = new THREE.Group(); snailHead.position.set(.30, .10, 0); snail.add(snailHead);
  ellipsoid(snailHead, [.025, .01, 0], [.14, .10, .10], palette.snail);
  const stalks: THREE.Group[] = [];
  for (const sign of [-1, 1]) {
    const stalk = new THREE.Group(); stalk.position.set(.06, .04, sign * .052); snailHead.add(stalk); stalks.push(stalk);
    rod(stalk, [0, 0, 0], [.08, .22, sign * .035], .012, palette.snail);
    ellipsoid(stalk, [.08, .22, sign * .035], [.026, .03, .026], palette.black, true);
    ellipsoid(stalk, [.092, .23, sign * .044], [.008, .009, .008], palette.cream, true);
  }
  ellipsoid(snail, [-.07, .245, 0], [.235, .25, .14], palette.shell);
  const spiralPoints: THREE.Vector3[] = [];
  for (let i = 0; i <= 80; i++) {
    const t = i / 80, angle = t * TAU * 2.4, radius = .012 + .19 * t;
    spiralPoints.push(new THREE.Vector3(-.07 + Math.cos(angle) * radius, .245 + Math.sin(angle) * radius, .131 + .01 * (1 - t)));
  }
  const shellSpiral = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spiralPoints), 80, .012, 5, false), palette.shellLine); snail.add(shellSpiral);
  let snailRetreat = -10;

  function visitor(kind: 'bee' | 'butterfly', stops: Point[], phase: number): Visitor {
    const root = creature(kind), wings: THREE.Group[] = [];
    if (kind === 'butterfly') {
      for (const sign of [-1, 1]) {
        const joint = new THREE.Group(); root.add(joint); wings.push(joint);
        const upper = ellipsoid(joint, [sign * .16, .02, -.06], [.18, .018, .235], palette.wing); upper.rotation.y = sign * -.25;
        const lower = ellipsoid(joint, [sign * .12, .015, .15], [.13, .014, .15], palette.wingTip); lower.rotation.y = sign * .22;
        ellipsoid(joint, [sign * .24, .041, -.13], [.05, .008, .061], palette.wingTip, true);
        ellipsoid(joint, [sign * .15, .035, .145], [.045, .006, .053], palette.wing, true);
        rod(joint, [0, .027, .04], [sign * .25, .027, -.14], .006, palette.brass);
      }
      ellipsoid(root, [0, .02, .03], [.027, .035, .20], palette.feather);
      ellipsoid(root, [0, .025, -.19], [.043, .04, .043], palette.black, true);
      for (const sign of [-1, 1]) rod(root, [sign * .017, .035, -.21], [sign * .065, .11, -.28], .006, palette.black);
    } else {
      ellipsoid(root, [0, 0, .025], [.10, .095, .19], palette.yellow);
      for (const z of [-.025, .075, .15]) ellipsoid(root, [0, 0, z], [.102 - Math.max(0, z) * .18, .097 - Math.max(0, z) * .18, .028], palette.black, true);
      ellipsoid(root, [0, .015, -.17], [.085, .08, .075], palette.black, true);
      for (const sign of [-1, 1]) {
        const joint = new THREE.Group(); joint.position.y = .067; root.add(joint); wings.push(joint);
        const wing = ellipsoid(joint, [sign * .12, .01, -.025], [.15, .009, .085], palette.translucent); wing.rotation.y = sign * -.3;
        ellipsoid(root, [sign * .047, .036, -.222], [.025, .027, .012], palette.cream, true);
        for (const z of [-.06, .045, .12]) rod(root, [sign * .07, -.035, z], [sign * .14, -.14, z + .04], .008, palette.black);
      }
    }
    root.position.set(...stops[0]);
    return { root, wings, stops, from: root.position.clone(), to: root.position.clone(), control: new THREE.Vector3(), start: 0, duration: 2.5, waitUntil: phase, index: 0, flying: false, resting: false, phase, pending: [] };
  }
  // All routes follow the perimeter. Successive points change only one side of
  // the garden at a time, so their flight never cuts across a chess square.
  const butterfly = visitor('butterfly', [
    [-5.10, 1.20, 3.1], [-5.25, .95, -2.1], [-4.85, 1.65, -4.8],
    [-1.8, 2.30, -5.10], [3.65, 1.75, -5.10], [5.10, 1.05, -3.90],
    [5.20, 1.10, 3.10], [5.05, .75, -.40], [5.05, 1.4, -4.85],
    [-2.5, 2.2, -5.15], [-5.15, .95, -3.5],
  ], 2.8);
  const bee = visitor('bee', [[5.15, 1.10, 3.10], [5.25, .83, -2.40], [5.02, 1.10, -3.90], [5.12, .62, -.35]], 1.3);
  // Bake fixed details by material while keeping every animated joint and eye.
  // A striped bee should not need a draw call for each stripe and leg.
  const animatedMeshes = new Set<THREE.Mesh>([...eyes, snailFoot]);
  const sharedGeometries = new Set<THREE.BufferGeometry>([sphereGeometry, detailGeometry]);
  const joints: THREE.Object3D[] = [];
  for (const root of roots) root.traverse(object => { if (!(object instanceof THREE.Mesh)) joints.push(object); });
  for (const joint of joints) {
    const batches = new Map<THREE.Material, THREE.Mesh[]>();
    for (const child of joint.children) {
      if (!(child instanceof THREE.Mesh) || animatedMeshes.has(child) || Array.isArray(child.material)) continue;
      const batch = batches.get(child.material);
      if (batch) batch.push(child); else batches.set(child.material, [child]);
    }
    for (const [material, batch] of batches) {
      if (batch.length < 2) continue;
      const parts = batch.map(child => {
        child.updateMatrix();
        const geometry = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone();
        return geometry.applyMatrix4(child.matrix);
      });
      const geometry = mergeGeometries(parts, false); parts.forEach(part => part.dispose());
      if (!geometry) continue;
      for (const child of batch) { child.removeFromParent(); if (!sharedGeometries.has(child.geometry)) child.geometry.dispose(); }
      const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = true; mesh.receiveShadow = true; joint.add(mesh);
    }
  }
  let dusk = false, raining = false, sleeping = false;
  let captureVisitUntil = 0;
  const bloomTarget = new THREE.Vector3();
  const fireflies: { root: THREE.Group; glow: THREE.MeshBasicMaterial; base: Point; phase: number }[] = [];
  for (let i = 0; i < 11; i++) {
    const side = i % 2 ? 1 : -1;
    const base: Point = [side * (4.8 + (i % 3) * .12), .25 + (i % 4) * .32, -3.6 + (i / 11) * 7];
    const root = new THREE.Group(); root.position.set(...base); scene.add(root);
    const glow = new THREE.MeshBasicMaterial({ color: 0xffd785, transparent: true, opacity: 0, depthWrite: false });
    ellipsoid(root, [0, 0, 0], [.065, .065, .065], glow, true);
    fireflies.push({ root, glow, base, phase: i * 1.91 });
  }

  function startLeg(visitor: Visitor, x: number, y: number, z: number, time: number, duration: number) {
    visitor.from.copy(visitor.root.position); visitor.to.set(x, y, z);
    visitor.control.addVectors(visitor.from, visitor.to).multiplyScalar(.5);
    visitor.control.y += .55;
    visitor.start = time; visitor.duration = duration; visitor.flying = true;
  }
  function takeFlight(visitor: Visitor, x: number, y: number, z: number, time: number, duration: number) {
    const from = visitor.root.position;
    const fromSide = from.x < -4.3 ? -1 : from.x > 4.3 ? 1 : 0;
    const toSide = x < -4.3 ? -1 : x > 4.3 ? 1 : 0;
    visitor.pending.length = 0;
    if (fromSide !== toSide) {
      // A fresh flower can be on either side. Take the long way around the
      // back of the greenhouse instead of flying through the chess pieces.
      if (from.z > -4.6) visitor.pending.push([from.x, Math.max(from.y, 1.2), -5.12]);
      if (z > -4.6) visitor.pending.push([x, Math.max(y, 1.2), -5.12]);
    }
    visitor.pending.push([x, y, z]);
    const first = visitor.pending.shift()!;
    startLeg(visitor, first[0], first[1], first[2], time, duration);
  }
  function birdFlight(time: number, startled = false) {
    birdFrom.copy(bird.position); birdPerch = (birdPerch + 1) % birdPerches.length;
    birdTo.set(...birdPerches[birdPerch]); birdStart = time; birdDuration = startled ? 1.15 : 1.85; birdFlying = true;
    birdNext = time + 12 + birdPerch * 3;
    if (startled) birdAlert = time;
  }
  function settleVisitor(visitor: Visitor, target: Point) {
    visitor.root.position.set(...target); visitor.to.copy(visitor.root.position);
    visitor.pending.length = 0; visitor.flying = false; visitor.resting = true;
  }
  function setMood(isDusk: boolean, weather: Weather, time: number, reduced: boolean) {
    dusk = isDusk; raining = weather === 'rain';
    const nextSleeping = dusk || raining || reduced;
    if (nextSleeping !== sleeping || reduced) {
      sleeping = nextSleeping;
      if (sleeping || reduced) {
        settleVisitor(bee, [5.13, .54, -3.94]);
        settleVisitor(butterfly, [-5.20, .72, -3.50]);
        birdFlying = false; birdPerch = raining ? 0 : 2; bird.position.set(...birdPerches[birdPerch]);
      } else {
        bee.resting = false; butterfly.resting = false;
        bee.waitUntil = time + .8; butterfly.waitUntil = time + 1.8; birdNext = time + 5;
      }
    }
  }
  function onCapture(x: number, y: number, z: number, time: number) {
    if (sleeping) return;
    bloomTarget.set(x, y + .15, z); captureVisitUntil = time + 9;
    const visitor = x > 0 ? bee : butterfly;
    takeFlight(visitor, x, y + .20, z, time + .35, 2.2);
    birdFlight(time, true);
  }
  function updateVisitor(visitor: Visitor, time: number, reduced: boolean) {
    const isBee = visitor === bee;
    let flutter = 0;
    if (!reduced && !visitor.resting) {
      if (visitor.flying) {
        const t = THREE.MathUtils.clamp((time - visitor.start) / visitor.duration, 0, 1), s = smooth(t), inverse = 1 - s;
        visitor.root.position.set(
          inverse * inverse * visitor.from.x + 2 * inverse * s * visitor.control.x + s * s * visitor.to.x,
          inverse * inverse * visitor.from.y + 2 * inverse * s * visitor.control.y + s * s * visitor.to.y,
          inverse * inverse * visitor.from.z + 2 * inverse * s * visitor.control.z + s * s * visitor.to.z,
        );
        visitor.root.rotation.y = Math.atan2(visitor.from.x - visitor.to.x, visitor.from.z - visitor.to.z);
        visitor.root.rotation.z = Math.sin(t * TAU) * (isBee ? .12 : .28);
        flutter = isBee ? 32 : 15;
        if (t === 1) {
          const next = visitor.pending.shift();
          if (next) startLeg(visitor, next[0], next[1], next[2], time, isBee ? 2.2 : 2.8);
          else { visitor.flying = false; visitor.waitUntil = time + (isBee ? 2.3 : 3.8); }
        }
      } else if (time >= visitor.waitUntil) {
        if (captureVisitUntil > time && (bloomTarget.x > 0) === isBee) {
          takeFlight(visitor, bloomTarget.x + .10, bloomTarget.y + .04, bloomTarget.z + .12, time, 1.1);
        } else {
          visitor.index = (visitor.index + 1) % visitor.stops.length;
          const point = visitor.stops[visitor.index];
          takeFlight(visitor, point[0], point[1], point[2], time, isBee ? 2.5 : 3.1);
        }
      } else {
        // Hover, land, taste a flower, open the wings, then choose another stop.
        visitor.root.position.y = visitor.to.y + (isBee ? .035 * Math.sin(time * 9) : .012 * Math.sin(time * 2));
        visitor.root.rotation.z = Math.sin(time * 2.3 + visitor.phase) * .12;
        flutter = isBee ? 29 : time % 3 > 2.2 ? 10 : 1.2;
      }
    }
    for (let i = 0; i < visitor.wings.length; i++) {
      const sign = i ? 1 : -1;
      visitor.wings[i].rotation.z = reduced ? sign * .48 : visitor.resting ? sign * 1.08 : sign * (.26 + Math.sin(time * flutter + visitor.phase) * (isBee ? .5 : .9));
    }
  }
  function update(time: number, reduced: boolean) {
    if (!reduced) {
      if (birdFlying) {
        const t = THREE.MathUtils.clamp((time - birdStart) / birdDuration, 0, 1), s = smooth(t);
        bird.position.lerpVectors(birdFrom, birdTo, s);
        bird.position.y += Math.sin(t * Math.PI) * .9;
        bird.position.z -= Math.sin(t * Math.PI) * .48;
        bird.rotation.y = Math.atan2(birdTo.x - birdFrom.x, birdTo.z - birdFrom.z) + Math.PI;
        birdBody.rotation.x = Math.sin(t * Math.PI) * .28;
        if (t === 1) { birdFlying = false; birdBody.rotation.x = 0; bird.rotation.y = birdPerch === 1 ? -.48 : .38; }
      } else if (!sleeping && time > birdNext) birdFlight(time);
      else {
        const cycle = (time + birdPerch * 1.7) % 7.4;
        const hop = !sleeping && cycle > 5.9 && cycle < 6.35 ? Math.sin((cycle - 5.9) / .45 * Math.PI) : 0;
        bird.position.y = birdPerches[birdPerch][1] + hop * .16;
        birdBody.scale.y = 1 + Math.sin(time * (sleeping ? 1.3 : 2.4)) * .018;
        birdHead.rotation.y = sleeping ? -.46 : Math.sin(time * .65) * .48 + Math.sin(time * .21) * .18;
        birdHead.rotation.z = sleeping ? -.18 : Math.sin(time * .9) * .08;
        birdHead.rotation.x = sleeping ? .26 : Math.max(0, Math.sin(time * .46)) * .17;
      }
      const blink = sleeping ? .13 : (time % 4.7 > 4.52 ? .12 : 1);
      for (const eye of eyes) eye.scale.y = .03 * blink;
      for (let i = 0; i < birdWings.length; i++) birdWings[i].rotation.z = birdFlying ? (i ? 1 : -1) * Math.sin(time * 23) * 1.1 : (i ? 1 : -1) * Math.max(0, 1 - (time - birdAlert) / .9) * .7;
      const snailTime = time % 112, forward = snailTime < 56, travel = forward ? snailTime / 56 : (112 - snailTime) / 56;
      snail.position.x = -3.0 + travel * 1.65;
      snail.rotation.y = forward ? 0 : Math.PI;
      snailFoot.scale.x = .44 * (1 + Math.sin(time * 2.2) * .06);
      const retreat = Math.max(0, 1 - (time - snailRetreat) / 2.5);
      snailHead.scale.setScalar(1 - retreat * .40);
      for (let i = 0; i < stalks.length; i++) {
        stalks[i].scale.y = 1 - retreat * .8;
        stalks[i].rotation.z = Math.sin(time * .8 + i * 1.9) * .13;
      }
    } else {
      birdHead.rotation.set(0, -.15, -.06); birdBody.rotation.set(0, 0, 0); birdBody.scale.setScalar(1);
      for (const eye of eyes) eye.scale.y = .03;
      for (const wing of birdWings) wing.rotation.z = 0;
      snailHead.scale.setScalar(1);
      for (const stalk of stalks) { stalk.scale.y = 1; stalk.rotation.z = .06; }
    }
    for (const firefly of fireflies) {
      firefly.root.visible = dusk && !raining;
      if (!firefly.root.visible) continue;
      const pulse = reduced ? .55 : Math.max(0, Math.sin(time * 1.6 + firefly.phase)) ** 4;
      firefly.glow.opacity = .12 + pulse * .80;
      if (!reduced) firefly.root.position.set(
        firefly.base[0] + Math.sin(time * .4 + firefly.phase) * .15,
        firefly.base[1] + Math.sin(time * .7 + firefly.phase) * .16,
        firefly.base[2] + Math.cos(time * .3 + firefly.phase) * .18,
      );
    }
    updateVisitor(butterfly, time, reduced); updateVisitor(bee, time, reduced);
  }
  function greet(kind: Creature, time: number, reduced: boolean) {
    if (reduced) return;
    if (kind === 'robin' && !sleeping) birdFlight(time, true);
    else if (kind === 'snail') snailRetreat = time;
    else if (!sleeping) {
      const insect = kind === 'bee' ? bee : butterfly;
      insect.waitUntil = time; insect.flying = false; captureVisitUntil = 0;
    }
  }
  function atRay(raycaster: THREE.Raycaster): Creature | null {
    const hit = raycaster.intersectObjects(roots, true)[0];
    if (!hit) return null;
    let object: THREE.Object3D | null = hit.object;
    while (object && !object.userData.creature) object = object.parent;
    const kind = object?.userData.creature as Creature | undefined;
    return kind ?? null;
  }
  function interact(raycaster: THREE.Raycaster, time: number, reduced: boolean): Creature | null {
    const kind = atRay(raycaster);
    if (!kind) return null;
    greet(kind, time, reduced);
    return kind;
  }
  return { update, onCapture, setMood, interact, atRay, greet };
}
