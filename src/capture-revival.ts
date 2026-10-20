interface RevivalAnimation {
  readonly finished: Promise<unknown>;
  cancel(): void;
}

interface RevivalNode {
  hidden: boolean | string;
  remove(): void;
}

/** Keeps an undone grave visible independently of the current memorial page.
 * All teardown paths share clear(); late animation completions are harmless. */
export function createCaptureRevivals(onChange: () => void) {
  const active = new Map<RevivalAnimation, { node: RevivalNode; inGarden: boolean }>();
  const finish = (animation: RevivalAnimation) => {
    const revival = active.get(animation);
    if (!revival) return;
    active.delete(animation);
    revival.node.remove();
    onChange();
  };
  return {
    get hasGardenRevival() { return [...active.values()].some(revival => revival.inGarden); },
    track(animation: RevivalAnimation, node: RevivalNode, inGarden: boolean) {
      // Pagination may have hidden this grave before the player pressed Undo.
      if (inGarden) node.hidden = false;
      active.set(animation, { node, inGarden });
      onChange();
      animation.finished.then(() => finish(animation), () => finish(animation));
    },
    clear() {
      if (!active.size) return;
      const previous = [...active.entries()];
      active.clear();
      for (const [animation, { node }] of previous) { animation.cancel(); node.remove(); }
      onChange();
    },
  };
}
