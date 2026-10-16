import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// All of the artwork in the conservatory is modeled here. No external assets are
// required: porcelain, turned walnut, leaves, flowers, glass, and brass are native geometry.
const BOARD_Y = 0.235;
const FILES = 'abcdefgh';
const COLORS = { cream: 0xf4efe2, ivory: 0xe6dcc4, spruce: 0x163c32, brass: 0xb39155 };
const ease = t => 1 - (1 - t) ** 3;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const squarePosition = square => new THREE.Vector3(FILES.indexOf(square[0]) - 3.5, BOARD_Y, 4.5 - Number(square[1]));
const seeded = seed => { let n = seed; return () => { n = (n * 1664525 + 1013904223) >>> 0; return n / 4294967296; }; };

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function woodTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#856548'; ctx.fillRect(0, 0, w, h);
    const rand = seeded(482);
    for (let i = 0; i < 430; i++) {
      const y = rand() * h;
      ctx.strokeStyle = `rgba(${rand() > .5 ? '45, 29, 18' : '217, 176, 122'},${.035 + rand() * .1})`;
      ctx.lineWidth = .4 + rand() * 1.9;
      ctx.beginPath(); ctx.moveTo(0, y);
      ctx.bezierCurveTo(w * .34, y + rand() * 17, w * .66, y - rand() * 16, w, y + rand() * 5);
      ctx.stroke();
    }
  });
}

function tileTexture(dark) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = dark ? '#6c8c77' : '#e8e1ce'; ctx.fillRect(0, 0, w, h);
    const rand = seeded(dark ? 80 : 69);
    for (let i = 0; i < 3200; i++) {
      ctx.fillStyle = `rgba(${rand() > .55 ? '255,255,240' : '37,66,49'},${rand() * .045})`;
      ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1 + rand() * 2);
    }
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, 'rgba(255,255,255,.05)'); gradient.addColorStop(1, 'rgba(0,0,0,.035)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
  });
}

function radialTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(34,44,31,.34)'); g.addColorStop(.42, 'rgba(34,44,31,.15)'); g.addColorStop(1, 'rgba(34,44,31,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  });
}

export function createConservatory(container, { onSquare, onReady, reducedMotion = false } = {}) {
  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.className = 'conservatory-canvas';
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:manipulation;';
  container.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(36, 1, .1, 100);
  const target = new THREE.Vector3(0, .10, .05);
  let view = 'perspective';
  let width = 1, height = 1, stopped = false, frame = 0, mode = 'day';
  let lastTime = performance.now(), elapsed = 0;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, .04);
  scene.environment = environment.texture;
  scene.environmentIntensity = .43;
  room.dispose(); pmrem.dispose();

  const materials = {
    ivory: new THREE.MeshStandardMaterial({ color: COLORS.ivory, roughness: .33, metalness: .025 }),
    spruce: new THREE.MeshStandardMaterial({ color: COLORS.spruce, roughness: .26, metalness: .08 }),
    ivoryDetail: new THREE.MeshStandardMaterial({ color: 0xc9bea1, roughness: .38 }),
    spruceDetail: new THREE.MeshStandardMaterial({ color: 0x386a50, roughness: .34 }),
    brass: new THREE.MeshStandardMaterial({ color: COLORS.brass, roughness: .3, metalness: .8 }),
    darkBrass: new THREE.MeshStandardMaterial({ color: 0x705332, roughness: .5, metalness: .65 }),
    wood: new THREE.MeshStandardMaterial({ color: 0xc8ad8b, map: woodTexture(), roughness: .5 }),
    woodSide: new THREE.MeshStandardMaterial({ color: 0x6e4e36, map: woodTexture(), roughness: .5 }),
    darkTile: new THREE.MeshStandardMaterial({ color: 0xffffff, map: tileTexture(true), roughness: .52 }),
    lightTile: new THREE.MeshStandardMaterial({ color: 0xffffff, map: tileTexture(false), roughness: .55 }),
    terracotta: new THREE.MeshStandardMaterial({ color: 0xc58868, roughness: .85 }),
    glazedPot: new THREE.MeshStandardMaterial({ color: 0xe6decb, roughness: .3, metalness: .03 }),
    greenPot: new THREE.MeshStandardMaterial({ color: 0x597e6d, roughness: .38 }),
    soil: new THREE.MeshStandardMaterial({ color: 0x3c3027, roughness: 1 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x4d7650, roughness: .66, side: THREE.DoubleSide }),
    leafLight: new THREE.MeshStandardMaterial({ color: 0x849958, roughness: .72, side: THREE.DoubleSide }),
    leafDark: new THREE.MeshStandardMaterial({ color: 0x254d3c, roughness: .62, side: THREE.DoubleSide }),
    pink: new THREE.MeshStandardMaterial({ color: 0xdc948d, roughness: .55, side: THREE.DoubleSide }),
    peach: new THREE.MeshStandardMaterial({ color: 0xf2c793, roughness: .55, side: THREE.DoubleSide }),
    lavender: new THREE.MeshStandardMaterial({ color: 0xa7a0c0, roughness: .65, side: THREE.DoubleSide }),
    petalIvory: new THREE.MeshStandardMaterial({ color: 0xfff6db, roughness: .46, side: THREE.DoubleSide }),
    pollen: new THREE.MeshStandardMaterial({ color: 0xc7973c, roughness: .63 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xd2e4d6, roughness: .08, metalness: 0, transmission: .55, opacity: .2, transparent: true, side: THREE.DoubleSide, depthWrite: false }),
    lanternGlass: new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffba58, emissiveIntensity: .12, roughness: .36, transparent: true, opacity: .78 }),
  };
  const geometries = {
    leaf: new THREE.SphereGeometry(1, 9, 6),
    sphere: new THREE.SphereGeometry(1, 20, 14),
    bead: new THREE.SphereGeometry(1, 12, 8),
    tile: new RoundedBoxGeometry(.981, .145, .981, 2, .025),
  };
  const contact = radialTexture();
  const pieceGroups = new Map();
  const raycastTiles = [];
  const animations = [];
  const swaying = [];
  const transient = [];

  function mesh(geometry, material, parent, x = 0, y = 0, z = 0, shadow = true) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = shadow;
    parent.add(m); return m;
  }
  function box(parent, sx, sy, sz, x, y, z, material, radius = 0) {
    return mesh(radius ? new RoundedBoxGeometry(sx, sy, sz, 2, radius) : new THREE.BoxGeometry(sx, sy, sz), material, parent, x, y, z);
  }
  function sphere(parent, r, x, y, z, material, scale) {
    const m = mesh(geometries.sphere, material, parent, x, y, z);
    m.scale.set(r, r, r); if (scale) m.scale.multiply(new THREE.Vector3(...scale)); return m;
  }
  function lathe(parent, points, material, segments = 40) {
    return mesh(new THREE.LatheGeometry(points.map(p => new THREE.Vector2(...p)), segments), material, parent);
  }
  function ring(parent, radius, tube, y, material = materials.brass) {
    const m = mesh(new THREE.TorusGeometry(radius, tube, 8, 48), material, parent, 0, y, 0);
    m.rotation.x = Math.PI / 2; return m;
  }
  function tube(parent, points, radius, material, segments = 24) {
    return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), segments, radius, 6, false), material, parent);
  }
  function leaf(parent, x, y, z, length, angle, material = materials.leaf, tilt = 0) {
    const m = mesh(geometries.leaf, material, parent, x, y, z);
    m.scale.set(length * .35, length, length * .085);
    m.rotation.set(tilt, angle * .3, angle); return m;
  }
  function shadow(parent, size, y, opacity = .5) {
    const material = new THREE.MeshBasicMaterial({ map: contact, transparent: true, opacity, depthWrite: false });
    const m = mesh(new THREE.PlaneGeometry(size, size), material, parent, 0, y, 0, false);
    m.rotation.x = -Math.PI / 2; return m;
  }
  // Bake the small sculptural details into one draw call per glaze. This keeps
  // the diorama light enough for mobile without simplifying its silhouettes.
  function batchSculpture(group) {
    group.updateMatrixWorld(true);
    const inverse = group.matrixWorld.clone().invert();
    const batches = new Map();
    const originals = [];
    group.traverse(object => {
      if (!object.isMesh || !object.geometry || Array.isArray(object.material)) return;
      const key = object.material;
      if (!batches.has(key)) batches.set(key, []);
      const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
      geometry.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld));
      batches.get(key).push(geometry); originals.push(object);
    });
    const shared = new Set(Object.values(geometries));
    for (const original of originals) {
      original.removeFromParent();
      if (!shared.has(original.geometry)) original.geometry.dispose();
    }
    for (const [material, parts] of batches) {
      const geometry = mergeGeometries(parts, false);
      parts.forEach(part => part.dispose());
      if (!geometry) continue;
      const combined = mesh(geometry, material, group);
      if (material.map === contact) { combined.castShadow = false; combined.receiveShadow = false; }
    }
  }
  function label(text, size, color = '#2b4234') {
    const texture = canvasTexture(96, 96, (ctx, w, h) => {
      ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '500 56px Georgia, serif'; ctx.fillText(text, w / 2, h / 2 + 1);
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; return m;
  }

  const lighting = new THREE.Group(); scene.add(lighting);
  const ambient = new THREE.HemisphereLight(0xfffaeb, 0x879f88, 1.45); lighting.add(ambient);
  const sun = new THREE.DirectionalLight(0xffe7bc, 2.55);
  sun.position.set(-5.5, 11.5, 2.5); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -7.5, right: 7.5, top: 7.5, bottom: -7.5, near: .5, far: 28 });
  sun.shadow.bias = -.00032; sun.shadow.normalBias = .025; sun.shadow.radius = 3;
  lighting.add(sun);
  const fill = new THREE.DirectionalLight(0xe0ede4, .78); fill.position.set(5, 6, -7); lighting.add(fill);
  const lanternLights = [];

  // The cabinet is built like a small heirloom chess table: inset ceramic tiles,
  // a brass fillet, rounded walnut sides, and small turned feet.
  const cabinet = new THREE.Group(); scene.add(cabinet);
  box(cabinet, 9.16, .48, 9.16, 0, -.17, 0, materials.woodSide, .15);
  box(cabinet, 9.22, .065, 9.22, 0, .076, 0, materials.brass, .09);
  box(cabinet, 9.12, .1, 9.12, 0, .12, 0, materials.wood, .09);
  box(cabinet, 8.17, .055, 8.17, 0, .143, 0, materials.darkBrass, .025);
  box(cabinet, 8.06, .07, 8.06, 0, .147, 0, materials.spruce, .018);
  for (const x of [-3.88, 3.88]) for (const z of [-3.88, 3.88]) {
    const foot = new THREE.Group(); foot.position.set(x, -.64, z); cabinet.add(foot);
    lathe(foot, [[0, 0], [.18, 0], [.22, .05], [.19, .12], [.13, .17], [.19, .25], [0, .25]], materials.woodSide, 24);
    ring(foot, .18, .011, .06);
  }
  // Fine parallel inlay on the front and sides catches the sunlight.
  for (const z of [-4.584, 4.584]) {
    box(cabinet, 8.82, .014, .012, 0, -.17, z, materials.brass);
    box(cabinet, 8.82, .008, .012, 0, -.24, z, materials.darkBrass);
  }
  for (const x of [-4.584, 4.584]) box(cabinet, .012, .014, 8.82, x, -.17, 0, materials.brass);
  // A cabinetmaker's small oval emblem on the front apron.
  const plaque = sphere(cabinet, 1, 0, -.11, 4.594, materials.brass, [.32, .11, .014]);
  const plaqueInset = sphere(cabinet, 1, 0, -.11, 4.612, materials.spruce, [.265, .071, .008]);
  for (const x of [-.31, .31]) sphere(cabinet, .014, x, -.11, 4.615, materials.darkBrass);
  leaf(cabinet, -.035, -.11, 4.625, .039, -.6, materials.brass);
  leaf(cabinet, .035, -.11, 4.625, .039, .6, materials.brass);

  for (let rank = 1; rank <= 8; rank++) for (let f = 0; f < 8; f++) {
    const square = FILES[f] + rank;
    const p = squarePosition(square);
    const tile = mesh(geometries.tile, (f + rank) % 2 ? materials.darkTile : materials.lightTile, cabinet, p.x, BOARD_Y - .0725, p.z);
    tile.userData.square = square; raycastTiles.push(tile);
  }
  for (let i = 0; i < 8; i++) {
    const file = label(FILES[i], .29); file.position.set(i - 3.5, .182, 4.30); cabinet.add(file);
    const rank = label(String(i + 1), .29); rank.position.set(-4.3, .182, 3.5 - i); cabinet.add(rank);
    const farFile = label(FILES[i], .23, '#3e513a'); farFile.position.set(i - 3.5, .182, -4.3); farFile.rotation.z = Math.PI; cabinet.add(farFile);
  }
  // Tiny brass corner ornaments give the wide wooden border a finished edge.
  for (const x of [-4.28, 4.28]) for (const z of [-4.28, 4.28]) {
    const corner = new THREE.Group(); corner.position.set(x, .185, z); cabinet.add(corner);
    const ornament = new THREE.Mesh(new THREE.TorusGeometry(.115, .008, 5, 24), materials.brass);
    ornament.rotation.x = -Math.PI / 2; corner.add(ornament);
    const dot = sphere(corner, .026, 0, .003, 0, materials.brass, [1, .25, 1]);
  }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: .16 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -.66; floor.receiveShadow = true; scene.add(floor);
  const broadShadow = shadow(scene, 13.5, -.657, .4); broadShadow.scale.z = .87;

  function makePiece(type, color) {
    const group = new THREE.Group();
    const porcelain = color === 'w' ? materials.ivory : materials.spruce;
    const detail = color === 'w' ? materials.ivoryDetail : materials.spruceDetail;
    group.userData = { type, color, square: null };
    shadow(group, .93, .004, .48);
    lathe(group, [[0, .015], [.275, .015], [.323, .04], [.336, .075], [.327, .12], [.293, .145], [.29, .18], [.24, .215], [0, .215]], porcelain);
    ring(group, .313, .011, .119);
    ring(group, .268, .009, .192, color === 'w' ? materials.brass : materials.darkBrass);
    if (type === 'p') {
      lathe(group, [[0, .18], [.23, .18], [.21, .235], [.16, .29], [.12, .45], [.145, .5], [.18, .535], [.177, .58], [.13, .61], [0, .61]], porcelain);
      sphere(group, .176, 0, .742, 0, porcelain);
      ring(group, .144, .009, .575);
    } else if (type === 'r') {
      lathe(group, [[0, .18], [.245, .18], [.227, .24], [.17, .31], [.17, .72], [.225, .77], [.255, .8], [.255, .91], [0, .91]], porcelain);
      ring(group, .224, .011, .782);
      const top = mesh(new THREE.CylinderGeometry(.208, .208, .025, 32), detail, group, 0, .935, 0);
      for (let i = 0; i < 6; i++) {
        const angle = i * Math.PI / 3;
        const battlement = box(group, .15, .17, .13, Math.sin(angle) * .213, .987, Math.cos(angle) * .213, porcelain, .016);
        battlement.rotation.y = angle;
      }
    } else if (type === 'n') {
      lathe(group, [[0, .18], [.24, .18], [.22, .25], [.175, .3], [.175, .35], [0, .35]], porcelain);
      ring(group, .201, .009, .29);
      const shape = new THREE.Shape();
      shape.moveTo(-.25, 0); shape.lineTo(.225, 0);
      shape.quadraticCurveTo(.235, .17, .11, .32);
      shape.quadraticCurveTo(.02, .47, .095, .62);
      shape.lineTo(.26, .59); shape.quadraticCurveTo(.4, .60, .345, .76);
      shape.lineTo(.18, .94); shape.lineTo(.075, .99);
      shape.lineTo(.015, 1.13); shape.lineTo(-.085, 1.10); shape.lineTo(-.14, .96);
      shape.quadraticCurveTo(-.34, .78, -.29, .57);
      shape.quadraticCurveTo(-.21, .27, -.25, 0);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: .22, steps: 1, bevelEnabled: true, bevelThickness: .04, bevelSize: .035, bevelSegments: 3, curveSegments: 10 });
      const horse = mesh(geo, porcelain, group, 0, .32, -.11);
      for (const side of [-1, 1]) {
        sphere(group, .021, .095, 1.19, side * .153, materials.brass);
        sphere(group, .009, .25, 1.035, side * .148, detail);
        tube(group, [[-.09, 1.29, side * .13], [-.23, 1.10, side * .139], [-.27, .88, side * .14], [-.23, .65, side * .145], [-.25, .5, side * .14]], .018, detail, 16);
        for (let i = 0; i < 4; i++) {
          tube(group, [[-.12 - i * .032, 1.19 - i * .11, side * .151], [-.23 - i * .008, 1.15 - i * .11, side * .153]], .007, materials.brass, 3);
        }
      }
      if (color === 'b') group.rotation.y = Math.PI;
    } else if (type === 'b') {
      lathe(group, [[0, .18], [.24, .18], [.21, .26], [.14, .39], [.102, .74], [.155, .82], [.215, .85], [.215, .895], [.165, .93], [.12, .965], [0, .965]], porcelain);
      ring(group, .20, .01, .87);
      const mitre = lathe(group, [[0, .94], [.10, .94], [.18, 1.01], [.198, 1.12], [.16, 1.24], [.07, 1.37], [0, 1.43]], porcelain);
      // The mitre's diagonal incision is recessed into the glazed front and back.
      for (const side of [-1, 1]) {
        const notch = box(group, .038, .225, .024, .032, 1.231, side * .137, color === 'w' ? materials.spruce : materials.ivoryDetail, .008);
        notch.rotation.z = -.59;
      }
      sphere(group, .045, 0, 1.438, 0, materials.brass);
    } else if (type === 'q') {
      lathe(group, [[0, .18], [.24, .18], [.205, .29], [.14, .44], [.105, .82], [.145, .93], [.22, .97], [.226, 1.01], [.16, 1.075], [.15, 1.13], [.23, 1.27], [.24, 1.31], [0, 1.31]], porcelain);
      ring(group, .214, .012, .996);
      ring(group, .229, .013, 1.292);
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4;
        const crown = mesh(new THREE.ConeGeometry(.052, .205, 10), porcelain, group, Math.sin(a) * .227, 1.38, Math.cos(a) * .227);
        crown.rotation.z = -Math.sin(a) * .18; crown.rotation.x = Math.cos(a) * .18;
        sphere(group, .035, Math.sin(a) * .246, 1.49, Math.cos(a) * .246, materials.brass);
      }
      sphere(group, .09, 0, 1.39, 0, porcelain);
      sphere(group, .045, 0, 1.49, 0, materials.brass);
    } else {
      lathe(group, [[0, .18], [.25, .18], [.22, .27], [.15, .44], [.11, .87], [.16, .99], [.225, 1.025], [.225, 1.075], [.15, 1.13], [.145, 1.21], [.18, 1.24], [.18, 1.29], [.12, 1.32], [0, 1.32]], porcelain);
      ring(group, .216, .012, 1.055);
      sphere(group, .092, 0, 1.337, 0, porcelain, [1, .72, 1]);
      box(group, .105, .39, .11, 0, 1.57, 0, porcelain, .019);
      box(group, .295, .105, .11, 0, 1.60, 0, porcelain, .018);
      box(group, .026, .26, .012, 0, 1.575, .061, materials.brass, .005);
      box(group, .19, .026, .012, 0, 1.60, .061, materials.brass, .005);
    }
    // An understated gilded sprig is the maker's mark on every porcelain piece.
    if (type !== 'n') {
      const z = type === 'p' ? .14 : type === 'r' ? .178 : .118;
      const y = type === 'p' ? .36 : type === 'r' ? .49 : .62;
      tube(group, [[-.025, y - .07, z], [0, y, z + .013], [.015, y + .085, z]], .007, materials.brass, 6);
      leaf(group, -.035, y + .005, z + .013, .043, -.8, materials.brass);
      leaf(group, .038, y + .045, z + .005, .039, .8, materials.brass);
    }
    batchSculpture(group);
    group.traverse(child => { if (child.isMesh) child.userData.pieceRoot = group; });
    return group;
  }

  // The surrounding collection is intentionally botanical, with different leaf
  // silhouettes and ceramic planters rather than repeated identical shrubs.
  const garden = new THREE.Group(); scene.add(garden);
  function pot(parent, x, z, scale = 1, material = materials.terracotta) {
    const group = new THREE.Group(); group.position.set(x, -.61, z); group.scale.setScalar(scale); parent.add(group);
    lathe(group, [[0, 0], [.24, 0], [.265, .045], [.30, .45], [.325, .49], [.327, .55], [.272, .55], [.267, .49], [.23, .13], [0, .13]], material, 32);
    ring(group, .308, .018, .49, material);
    mesh(new THREE.CylinderGeometry(.267, .267, .025, 24), materials.soil, group, 0, .487, 0);
    shadow(group, .95, .012, .4);
    return group;
  }
  function stalk(parent, endpoint, bending = .12, color = materials.leafDark) {
    return tube(parent, [[0, .49, 0], [endpoint[0] * .5 + bending, endpoint[1] * .7, endpoint[2] * .5], endpoint], .012, color, 12);
  }
  function botanical(parent, type, seed) {
    const rand = seeded(seed);
    if (type === 'fern') {
      for (let j = 0; j < 7; j++) {
        const a = j / 7 * Math.PI * 2 + rand() * .3;
        const tip = [.6 * Math.sin(a), 1.22 + rand() * .28, .6 * Math.cos(a)];
        stalk(parent, tip, 0);
        for (let i = 1; i < 7; i++) {
          const t = i / 7;
          for (const side of [-1, 1]) {
            const l = (.16 + Math.sin(t * Math.PI) * .08) * (1 - t * .45);
            const x = tip[0] * t + Math.cos(a) * side * l * .65;
            const z = tip[2] * t - Math.sin(a) * side * l * .65;
            const m = leaf(parent, x, .5 + (tip[1] - .5) * t, z, l, side * .9, j % 2 ? materials.leaf : materials.leafLight, -.3);
            m.rotation.y = a + side * .6;
          }
        }
      }
    } else if (type === 'rubber') {
      for (let j = 0; j < 6; j++) {
        const a = j * 2.4, h = .9 + j * .105;
        const tip = [Math.sin(a) * .27, h, Math.cos(a) * .27];
        stalk(parent, tip, -.05);
        const m = leaf(parent, tip[0] * 1.4, h, tip[2] * 1.4, .31, Math.sin(a) * .6, j % 2 ? materials.leafDark : materials.leaf, .35);
        m.rotation.y = a; m.rotation.x = .5;
        tube(parent, [[tip[0] * 1.1, h - .17, tip[2] * 1.1 + .021], [tip[0] * 1.4, h + .17, tip[2] * 1.4 + .021]], .005, materials.leafLight, 3);
      }
    } else if (type === 'flowers') {
      for (let i = 0; i < 9; i++) {
        const a = i * 2.4;
        const h = .9 + rand() * .53;
        const x = Math.sin(a) * (.15 + rand() * .23), z = Math.cos(a) * (.15 + rand() * .23);
        stalk(parent, [x, h, z], .03);
        const lm = leaf(parent, x * .5 + .055, h * .66, z * .6, .16, .8, materials.leaf, .3);
        flower(parent, x, h, z, .13 + rand() * .025, i % 3 === 0 ? materials.petalIvory : materials.pink, i % 2 ? 6 : 5);
      }
    } else {
      for (let i = 0; i < 13; i++) {
        const a = i * 2.4;
        const h = .83 + rand() * .64;
        const x = Math.sin(a) * (.1 + rand() * .21), z = Math.cos(a) * (.1 + rand() * .21);
        stalk(parent, [x, h, z], .035);
        for (let t = .6; t <= 1; t += .13) {
          for (let k = 0; k < 3; k++) {
            const angle = k * Math.PI * 2 / 3 + t * 10;
            sphere(parent, .038, x + Math.cos(angle) * .041, h * t, z + Math.sin(angle) * .041, materials.lavender, [.8, 1.25, .8]);
          }
        }
        leaf(parent, x * .5, h * .58, z * .5, .14, i % 2 ? .6 : -.6, materials.leafLight);
      }
    }
  }
  function flower(parent, x, y, z, size, material, count = 6) {
    const group = new THREE.Group(); group.position.set(x, y, z); group.rotation.x = -.18; parent.add(group);
    for (let p = 0; p < count; p++) {
      const a = p * Math.PI * 2 / count;
      const petal = mesh(geometries.leaf, material, group, Math.cos(a) * size * .58, .015, Math.sin(a) * size * .58);
      petal.scale.set(size * .6, size * .15, size * .35); petal.rotation.y = -a; petal.rotation.z = Math.cos(a) * -.25;
    }
    sphere(group, size * .25, 0, .036, 0, materials.pollen, [1, .5, 1]);
    return group;
  }

  const fern = pot(garden, -5.12, 3.15, 1.3, materials.glazedPot); botanical(fern, 'fern', 91); swaying.push({ group: fern, phase: 2, amount: .018 });
  const flowers = pot(garden, 5.13, 3.10, 1.3, materials.terracotta); botanical(flowers, 'flowers', 55); swaying.push({ group: flowers, phase: 5, amount: .012 });
  const rubber = pot(garden, -5.12, -3.5, 1.55, materials.greenPot); botanical(rubber, 'rubber', 24); swaying.push({ group: rubber, phase: 1, amount: .012 });
  const lavender = pot(garden, 5.02, -3.9, 1.38, materials.glazedPot); botanical(lavender, 'lavender', 81); swaying.push({ group: lavender, phase: 4, amount: .014 });
  const smallPot = pot(garden, -5.3, -2.1, .63, materials.terracotta); botanical(smallPot, 'flowers', 431);
  const smallFern = pot(garden, 5.3, -2.4, .58, materials.greenPot); botanical(smallFern, 'fern', 41);
  for (const planting of [fern, flowers, rubber, lavender, smallPot, smallFern]) batchSculpture(planting);
  // A pair of fallen petals and polished stones make the display feel lived in.
  for (let i = 0; i < 5; i++) {
    const pebble = sphere(garden, .08 + i * .009, -5.15 + Math.sin(i * 2) * .4, -.6, 2.55 + i * .17, i % 2 ? materials.glazedPot : materials.darkBrass, [1.5, .45, 1]);
    pebble.rotation.y = i;
  }
  flower(garden, 4.7, -.62, 2.22, .105, materials.pink, 5);

  // Slender arched greenhouse windows rise behind the board without crossing
  // the playing surface. The pale panes cast only a whisper of color.
  const greenhouse = new THREE.Group(); scene.add(greenhouse);
  const archPoints = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40 * Math.PI;
    archPoints.push([-4.77 * Math.cos(t), -.53 + 2.85 * Math.sin(t), -4.96]);
  }
  tube(greenhouse, archPoints, .029, materials.brass, 60);
  tube(greenhouse, archPoints.map(([x, y, z]) => [x * .978, y - .075, z]), .012, materials.brass, 60);
  // A second arch and delicate glazed roof ribs give the glasshouse real depth.
  const backArch = archPoints.map(([x, y]) => [x * 1.025, y + .13, -5.62]);
  tube(greenhouse, backArch, .023, materials.brass, 60);
  const roofVertices = [];
  for (let i = 0; i < archPoints.length - 1; i++) {
    roofVertices.push(...archPoints[i], ...archPoints[i + 1], ...backArch[i + 1], ...archPoints[i], ...backArch[i + 1], ...backArch[i]);
  }
  const roofGeometry = new THREE.BufferGeometry();
  roofGeometry.setAttribute('position', new THREE.Float32BufferAttribute(roofVertices, 3));
  roofGeometry.computeVertexNormals();
  mesh(roofGeometry, materials.glass, greenhouse, 0, 0, 0, false);
  for (const t of [0, Math.PI / 6, Math.PI / 3, Math.PI / 2, Math.PI * 2 / 3, Math.PI * 5 / 6, Math.PI]) {
    const x = -4.77 * Math.cos(t), y = -.53 + 2.85 * Math.sin(t);
    tube(greenhouse, [[x, y, -4.96], [x * 1.025, y + .13, -5.62]], .016, materials.brass, 2);
  }
  tube(greenhouse, [[-4.77, -.55, -4.96], [4.77, -.55, -4.96]], .035, materials.darkBrass, 2);
  for (const x of [-3.1, -1.6, 0, 1.6, 3.1]) {
    const h = -.53 + 2.85 * Math.sqrt(1 - (x / 4.77) ** 2);
    tube(greenhouse, [[x, -.53, -4.96], [x, h, -4.96]], .018, materials.brass, 2);
  }
  tube(greenhouse, [[-4.0, 1.02, -4.96], [0, 1.02, -4.96], [4, 1.02, -4.96]], .016, materials.brass, 8);
  const archShape = new THREE.Shape(); archShape.moveTo(-4.74, -.53);
  for (let i = 0; i <= 40; i++) { const t = i / 40 * Math.PI; archShape.lineTo(-4.74 * Math.cos(t), -.53 + 2.81 * Math.sin(t)); }
  archShape.lineTo(-4.74, -.53);
  const windowPane = mesh(new THREE.ShapeGeometry(archShape), materials.glass, greenhouse, 0, 0, -4.974, false);
  for (const x of [-4.77, 4.77]) {
    sphere(greenhouse, .073, x, -.43, -4.96, materials.brass);
    box(greenhouse, .24, .08, .32, x, -.59, -4.96, materials.darkBrass, .02);
  }
  // Vines climb the outer uprights and stop short of the central view.
  for (const sign of [-1, 1]) {
    const vine = new THREE.Group(); greenhouse.add(vine);
    const pts = [];
    for (let i = 0; i < 15; i++) {
      const a = i / 14 * .7;
      const x = sign * (4.77 * Math.cos(a) + Math.sin(i * 1.7) * .055);
      const y = -.53 + 2.85 * Math.sin(a);
      pts.push([x, y, -4.91]);
      if (i % 2) {
        const l = leaf(vine, x + sign * .055, y, -4.89, .13 + i * .002, sign * (i % 3 ? -.7 : .7), i % 3 ? materials.leaf : materials.leafLight);
        l.rotation.y = sign * .3;
      }
      if (i === 8 || i === 12) flower(vine, x, y, -4.84, .09, materials.petalIvory, 5);
    }
    tube(vine, pts, .013, materials.leafDark, 24);
  }
  // Hanging lanterns become small pools of candlelight in the evening.
  function lantern(x, y, z) {
    const group = new THREE.Group(); group.position.set(x, y, z); greenhouse.add(group);
    tube(group, [[0, .4, 0], [0, .56, 0], [.09, .62, 0], [.16, .55, 0]], .012, materials.darkBrass, 8);
    box(group, .28, .035, .28, 0, 0, 0, materials.brass, .018);
    box(group, .28, .035, .28, 0, .36, 0, materials.brass, .018);
    box(group, .214, .32, .214, 0, .18, 0, materials.lanternGlass, .014);
    for (const a of [-1, 1]) for (const b of [-1, 1]) box(group, .017, .34, .017, a * .12, .18, b * .12, materials.darkBrass);
    const top = mesh(new THREE.ConeGeometry(.22, .16, 4), materials.darkBrass, group, 0, .45, 0); top.rotation.y = Math.PI / 4;
    const light = new THREE.PointLight(0xffbd67, 0, 4.3, 2); light.position.set(x, y + .18, z + .15); scene.add(light); lanternLights.push(light);
  }
  lantern(-4.0, .8, -4.7); lantern(4.0, .8, -4.7);
  for (const sign of [-1, 1]) {
    const hanging = new THREE.Group();
    hanging.position.set(sign * 3.56, .52, -5.45); greenhouse.add(hanging);
    lathe(hanging, [[0, 0], [.12, 0], [.16, .06], [.19, .25], [.195, .29], [.16, .29], [.13, .08], [0, .08]], sign < 0 ? materials.terracotta : materials.glazedPot, 24);
    mesh(new THREE.CylinderGeometry(.16, .16, .015, 20), materials.soil, hanging, 0, .264, 0);
    ring(hanging, .187, .012, .26, materials.brass);
    for (let j = 0; j < 3; j++) {
      const a = j * Math.PI * 2 / 3;
      tube(hanging, [[Math.sin(a) * .18, .26, Math.cos(a) * .18], [0, .98, 0]], .006, materials.brass, 2);
      const vine = [];
      for (let i = 0; i < 9; i++) {
        const x = Math.sin(a) * .17 + Math.sin(i * .8 + a) * .055;
        const z = Math.cos(a) * .17 + Math.cos(i * .9 + a) * .05;
        const y = .28 - i * .095;
        vine.push([x, y, z]);
        const l = leaf(hanging, x + (i % 2 ? -.035 : .035), y, z, .066, i % 2 ? -.8 : .8, i % 3 ? materials.leafDark : materials.leafLight);
        l.rotation.y = a;
      }
      tube(hanging, vine, .007, materials.leaf, 12);
    }
    batchSculpture(hanging);
  }

  const captureGarden = new THREE.Group(); scene.add(captureGarden);
  let captureCount = -1;
  let captureKey = '';
  function updateCaptureGarden(captures, lastMove, animate) {
    const count = Array.isArray(captures) ? captures.length : typeof captures === 'number' ? captures : Object.values(captures || {}).reduce((sum, value) => sum + (Array.isArray(value) ? value.length : 0), 0);
    const key = Array.isArray(captures) ? captures.map(c => `${c.color}${c.type}${c.by}${c.moveNumber}`).join('|') : String(count);
    if (count === captureCount && key === captureKey) return;
    const previousCount = captureCount;
    captureCount = count; captureKey = key;
    for (let i = animations.length - 1; i >= 0; i--) {
      if (animations[i].kind === 'bloom' || animations[i].kind === 'seed') {
        const animation = animations.splice(i, 1)[0];
        if (animation.kind === 'seed') { animation.group.removeFromParent(); disposePiece(animation.group); }
      }
    }
    while (captureGarden.children.length) {
      const child = captureGarden.children[0]; captureGarden.remove(child);
      child.traverse(obj => { if (obj.geometry && !Object.values(geometries).includes(obj.geometry)) obj.geometry.dispose(); });
    }
    const sides = { left: 0, right: 0 };
    for (let i = 0; i < Math.min(count, 30); i++) {
      const captured = Array.isArray(captures) ? captures[i] : {};
      const fingerprint = `${captured.color}${captured.type}${captured.by}${captured.moveNumber}${i}`;
      const random = seeded([...fingerprint].reduce((sum, char) => sum * 31 + char.charCodeAt(0), 17) >>> 0);
      const side = captured?.color ? captured.color === 'w' ? -1 : 1 : i % 2 ? 1 : -1;
      const n = side < 0 ? sides.left++ : sides.right++;
      const x = side * (4.8 + (n % 3) * .19 + random() * .08), z = -1.05 + Math.floor(n / 3) * .39 + random() * .12;
      const stem = new THREE.Group(); stem.position.set(x, -.62, z); captureGarden.add(stem);
      const significance = ({ p: 0, n: 1, b: 1.5, r: 2, q: 3 })[captured?.type] || 0;
      const h = .29 + significance * .055 + random() * .15;
      tube(stem, [[0, 0, 0], [.035, h * .5, 0], [0, h, 0]], .008, materials.leaf, 5);
      const palette = side < 0 ? [materials.peach, materials.petalIvory] : [materials.pink, materials.lavender];
      flower(stem, 0, h, 0, .073 + significance * .01, palette[Math.floor(random() * palette.length)], 5 + Math.floor(significance));
      leaf(stem, .034, h * .4, 0, .07, .8, materials.leafLight);
      batchSculpture(stem);
      if (animate && previousCount >= 0 && i >= previousCount) {
        stem.scale.setScalar(.001);
        animations.push({ group: stem, start: elapsed + .42, duration: .85, kind: 'bloom' });
        if (lastMove?.to) {
          const seed = new THREE.Group();
          sphere(seed, .053, 0, 0, 0, materials.brass, [.7, 1.4, .7]);
          leaf(seed, .035, .06, 0, .048, .8, materials.leafLight);
          seed.position.copy(squarePosition(lastMove.to)).add(new THREE.Vector3(0, .65, 0));
          scene.add(seed);
          animations.push({ group: seed, from: seed.position.clone(), to: stem.position.clone(), start: elapsed, duration: .62, kind: 'seed' });
        }
      }
    }
  }

  // Selection uses thin gold inlay, with soft pools of light for legal landings.
  const indicators = new THREE.Group(); scene.add(indicators);
  const selectedMaterial = new THREE.MeshBasicMaterial({ color: 0xe4b460, transparent: true, opacity: .8, depthWrite: false });
  const moveMaterial = new THREE.MeshBasicMaterial({ color: 0x6c9278, transparent: true, opacity: .21, depthWrite: false });
  const legalMaterial = new THREE.MeshBasicMaterial({ color: 0x375b44, transparent: true, opacity: .48, depthWrite: false });
  const captureMaterial = new THREE.MeshBasicMaterial({ color: 0xc59653, transparent: true, opacity: .82, depthWrite: false });
  const checkMaterial = new THREE.MeshBasicMaterial({ color: 0xbf6b57, transparent: true, opacity: .42, depthWrite: false });
  function marker(square, kind, occupied = false) {
    const p = squarePosition(square); let geometry, material;
    if (kind === 'selected') { geometry = new THREE.RingGeometry(.374, .403, 56); material = selectedMaterial; }
    else if (kind === 'check') { geometry = new THREE.PlaneGeometry(.94, .94); material = checkMaterial; }
    else if (kind === 'last') { geometry = new THREE.PlaneGeometry(.945, .945); material = moveMaterial; }
    else { geometry = occupied ? new THREE.RingGeometry(.34, .365, 48) : new THREE.CircleGeometry(.094, 24); material = occupied ? captureMaterial : legalMaterial; }
    const m = new THREE.Mesh(geometry, material); m.position.copy(p); m.position.y += kind === 'last' ? .004 : .009; m.rotation.x = -Math.PI / 2;
    indicators.add(m); return m;
  }
  function clearIndicators() {
    while (indicators.children.length) { const child = indicators.children[0]; indicators.remove(child); child.geometry.dispose(); }
  }

  // Floating pollen is barely perceptible in daylight, and catches the lantern
  // light at dusk. A single butterfly visits the far edge of the conservatory.
  const pollenGeometry = new THREE.BufferGeometry();
  const pollenPositions = new Float32Array(45 * 3); const pollenBase = [];
  const rand = seeded(153);
  for (let i = 0; i < 45; i++) {
    const p = [(rand() - .5) * 11, .3 + rand() * 3.6, (rand() - .5) * 10];
    pollenBase.push(p); pollenPositions.set(p, i * 3);
  }
  pollenGeometry.setAttribute('position', new THREE.BufferAttribute(pollenPositions, 3));
  const pollenMaterial = new THREE.PointsMaterial({ color: 0xcfb778, size: .026, transparent: true, opacity: .46, depthWrite: false, sizeAttenuation: true });
  const pollen = new THREE.Points(pollenGeometry, pollenMaterial); scene.add(pollen);
  const butterfly = new THREE.Group(); butterfly.position.set(-4.8, 1.7, -2.8); scene.add(butterfly);
  const wings = [];
  for (const sign of [-1, 1]) {
    const wing = new THREE.Group(); butterfly.add(wing); wings.push({ wing, sign });
    const upper = sphere(wing, 1, sign * .085, .025, 0, materials.peach, [.10, .018, .145]);
    upper.rotation.y = sign * -.35;
    sphere(wing, 1, sign * .063, .02, .11, materials.pollen, [.074, .012, .085]);
    sphere(wing, .025, sign * .1, .044, -.02, materials.darkBrass, [1, .2, 1]);
  }
  sphere(butterfly, 1, 0, .02, .03, materials.darkBrass, [.013, .018, .16]);

  let boardSignature = '';
  function sync({ board = [], selected = null, legal = [], lastMove = null, captures = [], checkSquare = null, animate = true } = {}) {
    const entries = board.flat().filter(Boolean);
    const desired = new Map(entries.map(piece => [piece.square, piece]));
    const signature = entries.map(p => `${p.square}${p.color}${p.type}`).sort().join('|');
    const shouldAnimate = animate && !reducedMotion && boardSignature !== '';
    if (signature !== boardSignature) {
      // Follow chess identities rather than recreating every mesh on every move.
      if (lastMove?.from && lastMove?.to && pieceGroups.has(lastMove.from)) {
        const moving = pieceGroups.get(lastMove.from);
        const destination = desired.get(lastMove.to);
        if (destination?.color === moving.userData.color && (destination.type === moving.userData.type || lastMove.promotion)) {
          const captured = pieceGroups.get(lastMove.to);
          if (captured && captured !== moving) { pieceGroups.delete(lastMove.to); removePiece(captured, shouldAnimate); }
          pieceGroups.delete(lastMove.from); pieceGroups.set(lastMove.to, moving);
          moving.userData.square = lastMove.to;
          movePiece(moving, lastMove.to, shouldAnimate);
          if (moving.userData.type === 'k' && Math.abs(FILES.indexOf(lastMove.from[0]) - FILES.indexOf(lastMove.to[0])) === 2) {
            const rank = lastMove.from[1], kingSide = lastMove.to[0] === 'g';
            const rookFrom = (kingSide ? 'h' : 'a') + rank, rookTo = (kingSide ? 'f' : 'd') + rank;
            const rook = pieceGroups.get(rookFrom);
            if (rook) { pieceGroups.delete(rookFrom); pieceGroups.set(rookTo, rook); rook.userData.square = rookTo; movePiece(rook, rookTo, shouldAnimate); }
          }
        }
      }
      for (const [square, group] of [...pieceGroups]) {
        const piece = desired.get(square);
        if (!piece || piece.color !== group.userData.color || piece.type !== group.userData.type) {
          pieceGroups.delete(square); removePiece(group, shouldAnimate);
        }
      }
      for (const piece of entries) {
        if (!pieceGroups.has(piece.square)) {
          const group = makePiece(piece.type, piece.color); group.userData.square = piece.square;
          group.position.copy(squarePosition(piece.square)); scene.add(group); pieceGroups.set(piece.square, group);
          if (shouldAnimate) {
            group.scale.setScalar(.01);
            animations.push({ group, start: elapsed, duration: .42, kind: 'appear' });
          }
        }
      }
      boardSignature = signature;
    }
    clearIndicators();
    if (lastMove?.from && lastMove?.to) { marker(lastMove.from, 'last'); marker(lastMove.to, 'last'); }
    if (checkSquare) marker(checkSquare, 'check');
    if (selected) marker(selected, 'selected');
    for (const item of legal) {
      const square = typeof item === 'string' ? item : item.to;
      if (square) marker(square, 'legal', desired.has(square));
    }
    updateCaptureGarden(captures, lastMove, shouldAnimate);
    render();
  }
  function movePiece(group, square, animate) {
    for (let i = animations.length - 1; i >= 0; i--) if (animations[i].group === group) animations.splice(i, 1);
    group.scale.setScalar(1);
    const destination = squarePosition(square);
    if (!animate) { group.position.copy(destination); return; }
    animations.push({ group, from: group.position.clone(), to: destination, start: elapsed, duration: .52, kind: 'move', knight: group.userData.type === 'n' });
  }
  function removePiece(group, animate) {
    for (let i = animations.length - 1; i >= 0; i--) if (animations[i].group === group) animations.splice(i, 1);
    if (!animate) { scene.remove(group); disposePiece(group); return; }
    animations.push({ group, start: elapsed, duration: .28, kind: 'remove' });
  }
  function disposePiece(group) {
    const shared = new Set(Object.values(geometries));
    group.traverse(object => {
      if (object.isMesh) {
        if (!shared.has(object.geometry)) object.geometry.dispose();
        if (object.material.map === contact) object.material.dispose();
      }
    });
  }

  function updateCamera() {
    const aspect = width / height;
    camera.aspect = aspect;
    const perspective = view === 'perspective';
    let distance = Math.max(perspective ? 16.45 : 16.0, (perspective ? 10.65 : 10.7) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect));
    const direction = new THREE.Vector3(0, perspective ? .816 : .994, perspective ? .578 : .11).normalize();
    const fitPoints = [...archPoints, ...backArch].map(point => new THREE.Vector3(...point));
    for (const x of [-4.7, 4.7]) for (const z of [-4.7, 4.7]) {
      fitPoints.push(new THREE.Vector3(x, -.65, z), new THREE.Vector3(x, .24, z));
    }
    camera.clearViewOffset();
    let minY = 0, maxY = 0;
    for (let attempt = 0; attempt < 4; attempt++) {
      camera.position.copy(target).addScaledVector(direction, distance);
      camera.lookAt(target); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
      minY = Infinity; maxY = -Infinity; let maxX = 0;
      for (const point of fitPoints) {
        const projected = point.clone().project(camera);
        minY = Math.min(minY, projected.y); maxY = Math.max(maxY, projected.y); maxX = Math.max(maxX, Math.abs(projected.x));
      }
      const expansion = Math.max((maxY - minY) / 1.84, maxX / .94);
      if (expansion <= 1.001 || attempt === 3) break;
      distance *= expansion * 1.008;
    }
    // Shift the optical center without changing the board angle. This reserves
    // equal headroom for the glass roof and the front apron at every aspect ratio.
    camera.setViewOffset(width, height, 0, -(minY + maxY) * height / 4, width, height);
    camera.updateMatrixWorld();
  }
  function resize() {
    const bounds = container.getBoundingClientRect();
    width = Math.max(1, bounds.width); height = Math.max(1, bounds.height);
    renderer.setSize(width, height, false); updateCamera(); render();
  }
  function projectSquare(square) {
    const p = squarePosition(square);
    const corners = [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, .5]];
    const points = corners.map(([x, z]) => {
      const projected = new THREE.Vector3(p.x + x, BOARD_Y + .012, p.z + z).project(camera);
      return { x: (projected.x * .5 + .5) * width, y: (-projected.y * .5 + .5) * height };
    });
    const x = Math.min(...points.map(p => p.x)), y = Math.min(...points.map(p => p.y));
    const right = Math.max(...points.map(p => p.x)), bottom = Math.max(...points.map(p => p.y));
    return { x, y, width: right - x, height: bottom - y, points, centerX: points.reduce((s, p) => s + p.x, 0) / 4, centerY: points.reduce((s, p) => s + p.y, 0) / 4 };
  }
  function setAtmosphere(nextMode) {
    mode = nextMode === 'dusk' ? 'dusk' : 'day';
    const dusk = mode === 'dusk';
    ambient.color.set(dusk ? 0xc5d4ed : 0xfffaeb); ambient.groundColor.set(dusk ? 0x667b86 : 0x879f88); ambient.intensity = dusk ? .95 : 1.45;
    sun.color.set(dusk ? 0xffb883 : 0xffe7bc); sun.intensity = dusk ? 1.45 : 2.55;
    fill.color.set(dusk ? 0x9eb7ed : 0xe0ede4); fill.intensity = dusk ? 1.25 : .78;
    scene.environmentIntensity = dusk ? .35 : .43;
    renderer.toneMappingExposure = dusk ? 1.0 : 1.02;
    materials.lanternGlass.emissiveIntensity = dusk ? 2.8 : .12;
    lanternLights.forEach(light => { light.intensity = dusk ? 3.2 : 0; });
    pollenMaterial.color.set(dusk ? 0xffd88f : 0xcfb778); pollenMaterial.opacity = dusk ? .72 : .46;
    render();
  }
  function setReducedMotion(value) {
    reducedMotion = !!value;
    if (reducedMotion) {
      cancelAnimationFrame(frame); frame = 0;
      for (const a of animations) {
        if (a.kind === 'move') a.group.position.copy(a.to);
        if (a.kind === 'remove' || a.kind === 'seed') { a.group.removeFromParent(); disposePiece(a.group); }
        else a.group.scale.setScalar(1);
      }
      animations.length = 0;
      swaying.forEach(({ group }) => { group.rotation.z = 0; });
      wings.forEach(({ wing }) => { wing.rotation.z = 0; });
    } else if (!frame && !stopped) {
      lastTime = performance.now(); frame = requestAnimationFrame(tick);
    }
    render();
  }
  function setView(nextView) { view = nextView === 'overhead' ? 'overhead' : 'perspective'; updateCamera(); render(); }
  function render() { if (!stopped) renderer.render(scene, camera); }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2(); let pointerDown = null;
  function squareAt(event) {
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects([...pieceGroups.values(), ...raycastTiles], true)[0];
    return hit?.object.userData.pieceRoot?.userData.square || hit?.object.userData.square || null;
  }
  function pointerdown(event) { pointerDown = { x: event.clientX, y: event.clientY }; }
  function pointerup(event) {
    if (!pointerDown || Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 8) return;
    pointerDown = null; const square = squareAt(event); if (square) onSquare?.(square);
  }
  function pointermove(event) { renderer.domElement.style.cursor = squareAt(event) ? 'pointer' : 'default'; }
  renderer.domElement.addEventListener('pointerdown', pointerdown);
  renderer.domElement.addEventListener('pointerup', pointerup);
  renderer.domElement.addEventListener('pointermove', pointermove);
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(container);
  resize();

  function tick(time) {
    if (stopped) return;
    const dt = Math.min((time - lastTime) / 1000, .06); lastTime = time; elapsed += dt;
    for (let i = animations.length - 1; i >= 0; i--) {
      const a = animations[i], t = clamp((elapsed - a.start) / a.duration, 0, 1), e = ease(t);
      if (a.kind === 'move') { a.group.position.lerpVectors(a.from, a.to, e); a.group.position.y += Math.sin(t * Math.PI) * (a.knight ? .85 : .3); }
      else if (a.kind === 'seed') { a.group.position.lerpVectors(a.from, a.to, t); a.group.position.y += Math.sin(t * Math.PI) * 1.5; a.group.rotation.z = t * Math.PI * 2; a.group.scale.setScalar(1 - Math.max(0, t - .75) * 3.5); }
      else if (a.kind === 'remove') a.group.scale.setScalar(1 - e);
      else a.group.scale.setScalar(e);
      if (t === 1) {
        animations.splice(i, 1);
        if (a.kind === 'remove' || a.kind === 'seed') { a.group.removeFromParent(); disposePiece(a.group); }
      }
    }
    if (!reducedMotion) {
      swaying.forEach(({ group, phase, amount }) => { group.rotation.z = Math.sin(elapsed * .7 + phase) * amount; });
      for (let i = 0; i < pollenBase.length; i++) {
        const p = pollenBase[i]; pollenPositions[i * 3] = p[0] + Math.sin(elapsed * .22 + i) * .18;
        pollenPositions[i * 3 + 1] = p[1] + Math.sin(elapsed * .3 + i * .8) * .16;
      }
      pollenGeometry.attributes.position.needsUpdate = true;
      butterfly.position.set(-4.65 + Math.sin(elapsed * .22) * .23, 1.65 + Math.sin(elapsed * .65) * .16, -2.8 + Math.cos(elapsed * .23) * .2);
      butterfly.rotation.y = -.3 + Math.sin(elapsed * .24) * .6;
      wings.forEach(({ wing, sign }) => { wing.rotation.z = sign * Math.sin(elapsed * 9) * .65; });
    }
    if (!reducedMotion || animations.length) render();
    frame = !reducedMotion || animations.length ? requestAnimationFrame(tick) : 0;
  }
  if (!reducedMotion) frame = requestAnimationFrame(tick);
  queueMicrotask(() => { if (!stopped) onReady?.(); });

  function destroy() {
    stopped = true; cancelAnimationFrame(frame); resizeObserver.disconnect();
    renderer.domElement.removeEventListener('pointerdown', pointerdown);
    renderer.domElement.removeEventListener('pointerup', pointerup);
    renderer.domElement.removeEventListener('pointermove', pointermove);
    const seenGeometry = new Set(), seenMaterial = new Set(), seenTexture = new Set();
    scene.traverse(object => {
      if (object.geometry && !seenGeometry.has(object.geometry)) { seenGeometry.add(object.geometry); object.geometry.dispose(); }
      const mats = Array.isArray(object.material) ? object.material : object.material ? [object.material] : [];
      for (const material of mats) {
        if (seenMaterial.has(material)) continue; seenMaterial.add(material);
        for (const value of Object.values(material)) if (value?.isTexture && !seenTexture.has(value)) { seenTexture.add(value); value.dispose(); }
        material.dispose();
      }
    });
    for (const material of Object.values(materials)) {
      if (material.map && !seenTexture.has(material.map)) material.map.dispose();
      if (!seenMaterial.has(material)) material.dispose();
    }
    environment.dispose(); renderer.dispose(); renderer.domElement.remove();
  }

  return {
    sync, setAtmosphere, setReducedMotion, setView, projectSquare,
    pickSquare: (clientX, clientY) => squareAt({ clientX, clientY }),
    resize, destroy,
  };
}
