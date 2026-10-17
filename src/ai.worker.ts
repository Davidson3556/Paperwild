import { chooseComputerMove } from './game.ts';
import type { Difficulty, MoveCoordinates } from './game.ts';

export interface ComputerRequest { fen: string; difficulty: Difficulty; id: number }
export interface ComputerResponse { move: MoveCoordinates | null; id: number }

// The project compiles against the DOM library, so view the worker scope through its Worker-shaped API.
const scope = self as unknown as Worker;
scope.onmessage = ({ data }: MessageEvent<ComputerRequest>) => {
  try {
    scope.postMessage({ move: chooseComputerMove(data.fen, data.difficulty), id: data.id } satisfies ComputerResponse);
  } catch {
    scope.postMessage({ move: null, id: data.id } satisfies ComputerResponse);
  }
};
