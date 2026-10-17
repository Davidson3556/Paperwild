type Light = 'day' | 'dusk';
type Weather = 'clear' | 'rain';

export interface AtmosphereOptions {
  reducedMotion: boolean;
  atmosphere: Light;
  weather: Weather;
}

export interface LivingAtmosphere {
  setAtmosphere(value: Light): void;
  setWeather(value: Weather): void;
  setReducedMotion(value: boolean): void;
  celebrateCapture(): void;
  destroy(): void;
}

interface ProtectedRect { x: number; y: number; width: number; height: number }
interface Mote { x: number; y: number; phase: number; speed: number; size: number }
interface Frond { image: HTMLCanvasElement; x: number; y: number; scale: number; angle: number; phase: number; mirrored: boolean }

const TAU = Math.PI * 2;
const PROTECTED = '.invitation, .game-journal, .masthead, .board-access, .fallback-board, .scene-controls, .scene-caption, .footer, .study-banner';

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = state + 0x6d2b79f5 | 0;
    let next = Math.imul(state ^ state >>> 15, 1 | state);
    next = next + Math.imul(next ^ next >>> 7, 61 | next) ^ next;
    return ((next ^ next >>> 14) >>> 0) / 4294967296;
  };
}

function leafPath(context: CanvasRenderingContext2D, length: number, breadth: number): void {
  context.beginPath();
  context.moveTo(0, 0);
  context.bezierCurveTo(length * 0.11, -breadth * 0.88, length * 0.71, -breadth * 0.8, length, 0);
  context.bezierCurveTo(length * 0.65, breadth * 0.46, length * 0.2, breadth * 0.68, 0, 0);
  context.fill();
}

/** A cached, deliberately uneven branch: its softness is an optical shadow, not a particle effect. */
function makeFrond(seed: number): HTMLCanvasElement {
  const random = seededRandom(seed);
  const image = document.createElement('canvas');
  image.width = 440;
  image.height = 520;
  const context = image.getContext('2d');
  if (!context) return image;
  context.fillStyle = '#273b29';
  context.strokeStyle = '#273b29';
  context.lineCap = 'round';
  context.lineWidth = 2.2;
  context.beginPath();
  context.moveTo(31, 507);
  context.bezierCurveTo(83, 340, 202, 140, 330, 16);
  context.stroke();
  for (let index = 0; index < 13; index++) {
    const progress = (index + 1) / 14;
    const stemX = 31 + 299 * progress ** 0.92;
    const stemY = 507 - 491 * progress;
    const leafLength = (61 + random() * 34) * (1.08 - progress * 0.49);
    for (const side of [-1, 1]) {
      context.save();
      context.translate(stemX + random() * 7, stemY);
      context.rotate(-0.94 + side * (0.58 + random() * 0.16));
      context.scale(1, side);
      leafPath(context, leafLength, leafLength * (0.28 + random() * 0.11));
      context.restore();
    }
  }
  return image;
}

/**
 * The room around the chessboard. Everything is decorative, lives behind the UI,
 * and goes completely still when the visitor requests reduced motion.
 */
export function createAtmosphere(container: HTMLElement, options: AtmosphereOptions): LivingAtmosphere {
  const canvas = document.createElement('canvas');
  canvas.className = 'living-atmosphere';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;contain:strict;';
  container.prepend(canvas);
  const context = canvas.getContext('2d', { alpha: true });
  const rainCanvas = document.createElement('canvas');
  const rainContext = rainCanvas.getContext('2d', { alpha: true });
  const random = seededRandom(28101987);
  const makeMotes = (count: number): Mote[] => Array.from({ length: count }, () => ({
    x: random(), y: random(), phase: random() * TAU, speed: 0.65 + random() * 0.7, size: 0.6 + random() * 0.8,
  }));
  // 84 moving details, regardless of viewport size. No particle allocation per frame.
  const rain = makeMotes(53);
  const fireflies = makeMotes(16);
  const leaves = makeMotes(3);
  const beads = makeMotes(12);
  const frondImage = makeFrond(813);
  const secondFrondImage = makeFrond(290);
  const fronds: Frond[] = [
    { image: frondImage, x: -0.04, y: 0.02, scale: 0.9, angle: -1.8, phase: 0.7, mirrored: false },
    { image: secondFrondImage, x: 1.05, y: -0.17, scale: 1.02, angle: 0.29, phase: 1.8, mirrored: true },
    { image: secondFrondImage, x: -0.14, y: 0.82, scale: 0.65, angle: -0.12, phase: 3.1, mirrored: false },
    { image: frondImage, x: 1.08, y: 1.08, scale: 0.68, angle: 0.65, phase: 4.4, mirrored: true },
  ];
  let light = options.atmosphere;
  let weather = options.weather;
  let reduced = options.reducedMotion;
  let width = 1;
  let height = 1;
  let pixelRatio = 1;
  let protectedRects: ProtectedRect[] = [];
  let frame = 0;
  let measureFrame = 0;
  let previousFrame = -Infinity;
  let previousTime = 0;
  let time = 0;
  let captureTime = -100;
  let destroyed = false;

  function measureProtection(): void {
    protectedRects = Array.from(container.querySelectorAll<HTMLElement>(PROTECTED), element => {
      const rect = element.getBoundingClientRect();
      return { x: rect.left - 13, y: rect.top - 13, width: rect.width + 26, height: rect.height + 26 };
    }).filter(rect => rect.width > 26 && rect.height > 26 && rect.y < height && rect.y + rect.height > 0);
  }

  function scheduleMeasurement(): void {
    if (destroyed || measureFrame) return;
    measureFrame = requestAnimationFrame(() => {
      measureFrame = 0;
      measureProtection();
      if (reduced) draw();
    });
  }

  function resize(): void {
    if (destroyed) return;
    width = window.innerWidth;
    height = window.innerHeight;
    pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = rainCanvas.width = Math.ceil(width * pixelRatio);
    canvas.height = rainCanvas.height = Math.ceil(height * pixelRatio);
    context?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    rainContext?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    measureProtection();
    draw();
  }

  function drawRoomLight(ctx: CanvasRenderingContext2D): void {
    const dusk = light === 'dusk';
    const cloudy = weather === 'rain';
    const breath = Math.sin(time * 0.095) * 0.5 + Math.sin(time * 0.17 + 2.1) * 0.28;
    const centerX = width * (0.64 + Math.sin(time * 0.031) * 0.05);
    const centerY = height * (-0.12 + Math.cos(time * 0.037) * 0.035);
    const glow = ctx.createRadialGradient(centerX, centerY, 12, centerX, centerY, width * 0.85);
    if (dusk) {
      glow.addColorStop(0, `rgba(240,190,104,${cloudy ? 0.08 : 0.12 + breath * 0.02})`);
      glow.addColorStop(0.43, 'rgba(198,167,99,.035)');
      glow.addColorStop(1, 'rgba(132,162,152,0)');
    } else {
      glow.addColorStop(0, `rgba(255,241,185,${cloudy ? 0.09 : 0.27 + breath * 0.045})`);
      glow.addColorStop(0.45, `rgba(255,248,220,${cloudy ? 0.015 : 0.095})`);
      glow.addColorStop(1, 'rgba(255,250,228,0)');
    }
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    // A long, blurred shaft of window light slowly traverses the paper.
    if (!dusk && !cloudy) {
      const drift = Math.sin(time * 0.028) * width * 0.035;
      ctx.save();
      ctx.translate(width * 0.73 + drift, -height * 0.28);
      ctx.rotate(0.4);
      const beam = ctx.createLinearGradient(-width * 0.15, 0, width * 0.15, 0);
      beam.addColorStop(0, 'rgba(255,253,228,0)');
      beam.addColorStop(0.39, `rgba(255,253,228,${0.08 + breath * 0.015})`);
      beam.addColorStop(0.56, 'rgba(255,254,233,.17)');
      beam.addColorStop(1, 'rgba(255,253,228,0)');
      ctx.fillStyle = beam;
      ctx.fillRect(-width * 0.15, 0, width * 0.3, height * 1.8);
      ctx.restore();
    }

    // Foliage is the projection of plants beyond the room, attached to the
    // corners rather than pasted onto the board. Each branch shares the breeze.
    const unit = Math.min(1.25, Math.max(0.7, width / 1250));
    const breeze = Math.sin(time * 0.34) * 0.013 + Math.sin(time * 0.71 + 0.8) * 0.004;
    for (const frond of fronds) {
      ctx.save();
      ctx.globalAlpha = (dusk ? 0.19 : 0.09) * (cloudy ? 0.72 : 1);
      ctx.filter = `blur(${dusk ? 2 : 4.2}px)`;
      ctx.translate(width * frond.x, height * frond.y);
      ctx.rotate(frond.angle + breeze + Math.sin(time * 0.41 + frond.phase) * 0.013);
      const scale = frond.scale * unit;
      ctx.scale(frond.mirrored ? -scale : scale, scale);
      ctx.drawImage(frond.image, -50, -160);
      ctx.restore();
    }
  }

  function drawLeaves(ctx: CanvasRenderingContext2D): void {
    // Brief, staggered journeys, separated by quiet stretches; never confetti.
    for (const leaf of leaves) {
      const cycle = (time + leaf.phase * 6) % 38;
      if (cycle > 12) continue;
      const progress = cycle / 12;
      const fromLeft = leaf.x < 0.5;
      const gutter = Math.min(width * 0.1, 105);
      const x = (fromLeft ? -16 : width + 16) + (fromLeft ? 1 : -1) * (Math.sin(progress * Math.PI) * gutter + progress * 22);
      const y = -28 + progress * (height + 70) + Math.sin(progress * TAU * 1.4 + leaf.phase) * 24;
      ctx.save();
      ctx.globalAlpha = Math.min(1, progress * 5, (1 - progress) * 5) * (light === 'dusk' ? 0.24 : 0.31);
      ctx.translate(x, y);
      ctx.rotate(leaf.phase + progress * 3.6 + Math.sin(progress * 13) * 0.3);
      ctx.scale(1, Math.cos(progress * 10 + leaf.phase) * 0.75);
      ctx.fillStyle = light === 'dusk' ? '#a5b58a' : '#71835a';
      leafPath(ctx, 14 + leaf.size * 7, 5 + leaf.size * 2);
      ctx.restore();
    }
  }

  function drawFireflies(ctx: CanvasRenderingContext2D): void {
    if (light !== 'dusk' || weather === 'rain') return;
    const celebration = Math.max(0, 1 - (time - captureTime) / 4);
    for (const fly of fireflies) {
      const leftSide = fly.x < 0.5;
      const margin = Math.min(width * 0.13, 160);
      const x = (leftSide ? margin * fly.x * 2 : width - margin * (fly.x - 0.5) * 2)
        + Math.sin(time * 0.23 * fly.speed + fly.phase) * 18;
      const y = height * (0.22 + fly.y * 0.73) + Math.cos(time * 0.17 + fly.phase) * 25 - celebration * 10;
      const flicker = Math.max(0, Math.sin(time * (0.6 + fly.speed * 0.2) + fly.phase));
      const alpha = (0.08 + flicker ** 3 * 0.55) * (0.7 + celebration * 0.3);
      const halo = ctx.createRadialGradient(x, y, 0, x, y, 11 + fly.size * 4);
      halo.addColorStop(0, `rgba(235,241,161,${alpha * 0.52})`);
      halo.addColorStop(0.16, `rgba(221,235,136,${alpha * 0.2})`);
      halo.addColorStop(1, 'rgba(215,235,139,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(x - 18, y - 18, 36, 36);
      ctx.fillStyle = `rgba(244,246,182,${alpha})`;
      ctx.beginPath();
      ctx.ellipse(x, y, fly.size * 0.7, fly.size, 0, 0, TAU);
      ctx.fill();
    }
  }

  function drawRain(ctx: CanvasRenderingContext2D): void {
    if (weather !== 'rain' || !rainContext) return;
    const rainCtx = rainContext;
    rainCtx.clearRect(0, 0, width, height);
    const dusk = light === 'dusk';
    const color = dusk ? '177,204,195' : '112,142,143';
    rainCtx.lineCap = 'round';
    for (const drop of rain) {
      const depth = drop.size;
      const fall = (drop.y + time * (0.28 + drop.speed * 0.18)) % 1;
      const y = fall * (height + 70) - 40;
      const x = (drop.x * (width + 90) - time * (8 + drop.speed * 5)) % (width + 90);
      const safeX = x < -40 ? x + width + 90 : x;
      rainCtx.strokeStyle = `rgba(${color},${(dusk ? 0.24 : 0.2) * depth})`;
      rainCtx.lineWidth = 0.55 + depth * 0.3;
      rainCtx.beginPath();
      rainCtx.moveTo(safeX, y);
      rainCtx.lineTo(safeX - 3 * depth, y + 13 + depth * 13);
      rainCtx.stroke();
    }

    // A few water trails on the window live at its extreme edges. Their slow
    // descent, highlights and refracted underside keep the rain tactile.
    for (const bead of beads) {
      const leftSide = bead.x < 0.5;
      const inset = 6 + bead.x * 22;
      const x = leftSide ? inset : width - inset;
      const y = ((bead.y + time * 0.014 * bead.speed) % 1) * (height + 60) - 30;
      const length = 10 + bead.size * 18;
      rainCtx.strokeStyle = `rgba(${color},${dusk ? 0.16 : 0.15})`;
      rainCtx.lineWidth = 0.75;
      rainCtx.beginPath();
      rainCtx.moveTo(x, y - length);
      rainCtx.bezierCurveTo(x - 1.8, y - length * 0.5, x + 0.8, y - 5, x, y);
      rainCtx.stroke();
      rainCtx.fillStyle = dusk ? 'rgba(207,225,214,.3)' : 'rgba(255,255,246,.52)';
      rainCtx.beginPath();
      rainCtx.ellipse(x - 0.7, y, 1.1 + bead.size * 0.5, 2.2 + bead.size, -0.12, 0, TAU);
      rainCtx.fill();
      rainCtx.fillStyle = `rgba(${color},.22)`;
      rainCtx.beginPath();
      rainCtx.ellipse(x + 0.6, y + 1.4, 0.8, 1.8, 0, 0, TAU);
      rainCtx.fill();
    }

    // Actual controls and board are protected, even when a study opens or the
    // layout changes. This mask is measured on events, never inside animation.
    rainCtx.save();
    rainCtx.globalCompositeOperation = 'destination-out';
    rainCtx.fillStyle = '#000';
    for (const rect of protectedRects) rainCtx.fillRect(rect.x, rect.y, rect.width, rect.height);
    rainCtx.restore();
    ctx.drawImage(rainCanvas, 0, 0, width, height);
  }

  function drawCaptureLight(ctx: CanvasRenderingContext2D): void {
    const age = time - captureTime;
    if (age < 0 || age > 4 || reduced) return;
    const progress = age / 4;
    const x = width * 0.5;
    const y = height * 0.79;
    const radius = 30 + Math.sin(progress * Math.PI / 2) * width * 0.48;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, `rgba(218,191,115,${Math.sin(progress * Math.PI) * 0.055})`);
    glow.addColorStop(1, 'rgba(218,191,115,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  }

  function draw(): void {
    if (!context || destroyed || document.hidden) return;
    context.clearRect(0, 0, width, height);
    drawRoomLight(context);
    drawLeaves(context);
    drawFireflies(context);
    drawRain(context);
    drawCaptureLight(context);
  }

  function animate(timestamp: number): void {
    frame = 0;
    if (destroyed || reduced || document.hidden || !context) return;
    if (timestamp - previousFrame >= 1000 / 30 - 0.5) {
      if (previousTime) time += Math.min((timestamp - previousTime) / 1000, 0.1);
      previousTime = timestamp;
      previousFrame = timestamp;
      draw();
    }
    frame = requestAnimationFrame(animate);
  }

  function start(): void {
    if (destroyed || frame || reduced || document.hidden || !context) return;
    previousTime = 0;
    previousFrame = -Infinity;
    frame = requestAnimationFrame(animate);
  }

  function visibilityChanged(): void {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
    } else {
      draw();
      start();
    }
  }

  const observer = new ResizeObserver(resize);
  observer.observe(container);
  container.querySelectorAll(PROTECTED).forEach(element => observer.observe(element));
  // The accessibility board is positioned after the Three.js camera projects
  // it. Its inline bounds can change without its DOM parent changing size.
  const boardObserver = new MutationObserver(scheduleMeasurement);
  const board = container.querySelector('.board-access');
  if (board) boardObserver.observe(board, { attributes: true, attributeFilter: ['style', 'hidden'] });
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('scroll', scheduleMeasurement, { passive: true });
  document.addEventListener('visibilitychange', visibilityChanged);
  resize();
  start();

  return {
    setAtmosphere(value) {
      if (destroyed || light === value) return;
      light = value;
      draw();
    },
    setWeather(value) {
      if (destroyed || weather === value) return;
      weather = value;
      draw();
    },
    setReducedMotion(value) {
      if (destroyed || reduced === value) return;
      reduced = value;
      if (reduced) {
        cancelAnimationFrame(frame);
        frame = 0;
        draw();
      } else start();
    },
    celebrateCapture() {
      if (!destroyed && !reduced) captureTime = time;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(measureFrame);
      observer.disconnect();
      boardObserver.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('scroll', scheduleMeasurement);
      document.removeEventListener('visibilitychange', visibilityChanged);
      canvas.remove();
      rainCanvas.width = rainCanvas.height = 0;
      frondImage.width = frondImage.height = 0;
      secondFrondImage.width = secondFrondImage.height = 0;
    },
  };
}
