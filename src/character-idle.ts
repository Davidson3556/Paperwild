import './character-idle.css';
import type { Color, PieceSymbol } from './game.ts';

type Point = readonly [number, number];
interface IdlePart {
  readonly name: string;
  readonly origin: Point;
  readonly outline: readonly Point[];
}

// Coordinates are measured on each original 362 × 362 illustration. The ear
// tips stop above their roots; the fox cutout moves only the curled tail tip.
// Adjacent cutouts never overlap, so the even/odd mask has no doubled islands.
const PARTS: Readonly<Record<Color, Partial<Readonly<Record<PieceSymbol, readonly IdlePart[]>>>>> = {
  w: {
    n: [
      { name: 'left-ear', origin: [205, 120], outline: [[119, 45], [159, 45], [200, 76], [213, 112], [210, 120], [190, 120], [153, 105], [133, 82]] },
      { name: 'right-ear', origin: [239, 124], outline: [[204, 39], [239, 39], [259, 73], [262, 109], [253, 124], [236, 126], [220, 116], [207, 88]] },
    ],
    b: [
      { name: 'left-wing', origin: [168, 190], outline: [[39, 207], [96, 168], [150, 162], [174, 183], [165, 219], [151, 259], [137, 289], [101, 310], [66, 290], [39, 266]] },
      { name: 'right-wing', origin: [232, 193], outline: [[232, 166], [266, 181], [299, 212], [322, 242], [321, 267], [291, 289], [268, 297], [245, 278], [232, 240], [229, 202]] },
    ],
    q: [
      { name: 'tail-tip', origin: [217, 263], outline: [[139, 268], [164, 250], [191, 243], [219, 246], [229, 265], [219, 287], [196, 306], [171, 318], [132, 318], [130, 297]] },
    ],
  },
  b: {
    n: [
      { name: 'left-ear', origin: [220, 130], outline: [[130, 50], [172, 49], [212, 80], [232, 119], [223, 132], [201, 132], [163, 110], [142, 83]] },
      { name: 'right-ear', origin: [253, 127], outline: [[210, 37], [242, 37], [266, 71], [277, 112], [270, 128], [249, 132], [232, 114], [216, 83]] },
    ],
    b: [
      { name: 'left-wing', origin: [162, 191], outline: [[37, 215], [95, 174], [146, 166], [168, 185], [160, 222], [150, 260], [135, 291], [101, 311], [65, 289], [38, 265]] },
      { name: 'right-wing', origin: [231, 192], outline: [[232, 169], [269, 184], [301, 215], [324, 243], [321, 267], [291, 291], [267, 298], [245, 278], [232, 240], [228, 201]] },
    ],
    q: [
      { name: 'tail-tip', origin: [222, 252], outline: [[130, 263], [150, 245], [180, 232], [208, 230], [231, 241], [237, 263], [215, 291], [187, 309], [149, 318], [124, 313], [122, 290]] },
    ],
  },
};

const percentage = (value: number) => `${value / 362 * 100}%`;
const polygonPath = (outline: readonly Point[]) => outline.map(([x, y], index) => `${index ? 'L' : 'M'}${x} ${y}`).join(' ') + 'Z';

/** CSS-only idle articulation. Removing the element releases its animations;
 * there are no timers, observers, or game-state resources to dispose. */
export function createCharacterIdle(color: Color, type: PieceSymbol, seed: number): { element: HTMLDivElement; mask: string } | null {
  const parts = PARTS[color][type];
  if (!parts) return null;
  const element = document.createElement('div');
  element.className = `character-idle character-idle-${type}`;
  element.setAttribute('aria-hidden', 'true');
  element.dataset.ready = 'false';
  const hash = Math.imul((seed >>> 0) ^ 0x51ed270b, 0x85ebca6b) >>> 0;
  element.style.setProperty('--part-cycle', `${7.2 + (hash % 3600) / 1000}s`);
  element.style.setProperty('--part-phase', `${-(hash % 6200) / 1000}s`);
  const loaded = new Set<number>();
  parts.forEach((part, index) => {
    const image = document.createElement('img');
    image.className = `character-idle-part character-idle-${part.name}`;
    image.alt = ''; image.draggable = false; image.decoding = 'async';
    image.style.clipPath = `polygon(${part.outline.map(([x, y]) => `${percentage(x)} ${percentage(y)}`).join(',')})`;
    image.style.transformOrigin = `${percentage(part.origin[0])} ${percentage(part.origin[1])}`;
    // Keep the uncut original visible until every replacement has decoded.
    image.onload = () => { loaded.add(index); element.dataset.ready = String(loaded.size === parts.length); };
    image.onerror = () => { element.dataset.ready = 'false'; };
    image.src = `/art/pieces/${color}${type}.png`;
    element.append(image);
    if (image.complete && image.naturalWidth > 0) { loaded.add(index); element.dataset.ready = String(loaded.size === parts.length); }
  });
  const holes = parts.map(part => polygonPath(part.outline)).join(' ');
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="362" height="362" viewBox="0 0 362 362" preserveAspectRatio="xMidYMax meet"><path fill="white" fill-rule="evenodd" d="M0 0H362V362H0Z ${holes}"/></svg>`;
  return { element, mask: `url("data:image/svg+xml,${encodeURIComponent(source)}")` };
}
