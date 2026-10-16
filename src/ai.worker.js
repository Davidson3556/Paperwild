import { chooseComputerMove } from './game.js';
self.onmessage = ({ data }) => {
  try {
    self.postMessage({ move: chooseComputerMove(data.fen, data.difficulty), id: data.id });
  } catch {
    self.postMessage({ move: null, id: data.id });
  }
};
