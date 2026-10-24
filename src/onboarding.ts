import './onboarding.css';
import { createCharacterPortrait } from './character-portrait.ts';

interface OnboardingOptions {
  onFinish: (required: boolean) => void;
}

export interface Onboarding {
  readonly active: boolean;
  open: (required: boolean) => void;
  close: () => void;
  destroy: () => void;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', copy = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = copy;
  return node;
}

function button(copy: string, className: string, id: string): HTMLButtonElement {
  const node = element('button', className, copy);
  node.type = 'button';
  node.id = id;
  return node;
}

/** A short map of the notebook, followed by an explicit choice of opponent. */
export function createOnboarding(options: OnboardingOptions): Onboarding {
  let visit: { required: boolean } | null = null;
  let destroyed = false;

  const dialog = element('dialog', 'onboarding-dialog');
  dialog.id = 'onboarding-dialog';
  dialog.dataset.testid = 'onboarding-dialog';
  dialog.setAttribute('aria-labelledby', 'onboarding-title');
  dialog.setAttribute('aria-describedby', 'onboarding-intro');

  const closeButton = button('×', 'onboarding-close', 'onboarding-close');
  closeButton.setAttribute('aria-label', 'Close the quick guide');
  const eyebrow = element('p', 'onboarding-eyebrow', 'YOUR FIRST LITTLE ADVENTURE · 1 OF 2');
  const title = element('h2', 'onboarding-title', 'Welcome to Paperwild');
  title.id = 'onboarding-title';
  title.tabIndex = -1;
  const introduction = element('p', 'onboarding-intro', 'A living woodland, a familiar game of chess. Here is your little map.');
  introduction.id = 'onboarding-intro';

  const demonstration = element('div', 'onboarding-demonstration');
  const board = element('div', 'onboarding-mini-board');
  board.setAttribute('aria-hidden', 'true');
  for (let index = 0; index < 9; index++) {
    const square = element('span', 'onboarding-mini-square');
    square.dataset.shaded = String(index % 2 === 0);
    if (index === 1) square.append(element('span', 'onboarding-legal-circle'));
    if (index === 7) {
      square.classList.add('onboarding-selected-square');
      square.append(createCharacterPortrait('w', 'p', 701));
    }
    board.append(square);
  }
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  path.setAttribute('viewBox', '0 0 144 144');
  path.setAttribute('class', 'onboarding-move-path');
  path.setAttribute('aria-hidden', 'true');
  path.innerHTML = '<path d="M78 96C96 77 95 56 79 38M79 38l-2 11m2-11 10 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="3 4"/>';
  board.append(path);

  const demoCopy = element('div', 'onboarding-demo-copy');
  const demoTitle = element('h3', '', 'Pick a character. Find a circle.');
  const demoDescription = element('p', '', 'Select one of your characters, then a pencilled circle to make a legal move.');
  const teams = element('p', 'onboarding-teams');
  teams.append(element('span', 'onboarding-amber', 'Amber = White'), element('span', 'onboarding-indigo', 'Indigo = Black'));
  demoCopy.append(demoTitle, demoDescription, teams);
  demonstration.append(board, demoCopy);

  const tips = element('ul', 'onboarding-tips');
  const tipData = [
    ['board', 'The board', 'Choose a character, then its circle. Amber moves first.'],
    ['kit', 'Field kit', 'Your opponent, club difficulty, and a fresh page live here.'],
    ['journal', 'Journal', 'Find your moves and captured friends beside the board.'],
    ['sound', 'Sound', 'Off to begin with. Turn it on to hear the woodland voices.'],
  ] as const;
  const icons: Record<typeof tipData[number][0], string> = {
    board: '<path d="M6 5 27 6 26 27 5 26 6 5Zm7 0-1 21m8-20-1 21M5 12l22 1M5 19l21 1"/>',
    kit: '<path d="m4 12 24 1-1 15-22-1-1-15Zm7 0 1-6 9 1 1 6M4 18l11 2 13-1m-14-2 5 0-1 5-4-1 0-4Z"/>',
    journal: '<path d="M6 4 27 5 26 29 5 27 6 4Zm5 0-1 24m4-17 9 1m-9 4 7 1m-7 4 9 1M4 8l4 1M4 16h4M3 24l4 1"/>',
    sound: '<path d="m4 13 6 0 8-7-1 22-7-8-6-1v-6Zm19-2q6 6-1 12m4-16q10 11-1 20"/>',
  };
  for (const [kind, heading, copy] of tipData) {
    const tip = element('li', `onboarding-tip onboarding-tip-${kind}`);
    const drawing = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    drawing.setAttribute('viewBox', '0 0 32 32');
    drawing.setAttribute('class', 'onboarding-tip-icon');
    drawing.setAttribute('aria-hidden', 'true');
    drawing.innerHTML = icons[kind];
    const text = element('div');
    text.append(element('strong', '', heading), element('p', '', copy));
    tip.append(drawing, text);
    tips.append(tip);
  }

  const next = element('p', 'onboarding-next', 'Next: choose the club, a friend beside you, or a friend online.');
  const actions = element('div', 'onboarding-actions');
  const primary = button('Choose who to play', 'primary-button onboarding-continue', 'onboarding-continue');
  const skip = button('Skip the tips', 'onboarding-skip', 'onboarding-skip');
  actions.append(primary, skip);
  dialog.append(closeButton, eyebrow, title, introduction, demonstration, tips, next, actions);
  document.body.append(dialog);

  function finish(): void {
    if (destroyed || !visit) return;
    const required = visit.required;
    visit = null;
    if (dialog.open) dialog.close();
    options.onFinish(required);
  }

  primary.addEventListener('click', finish);
  skip.addEventListener('click', finish);
  closeButton.addEventListener('click', finish);
  dialog.addEventListener('cancel', (event) => {
    // Escape can skip the tips, but it cannot skip the required opponent choice.
    event.preventDefault();
    finish();
  });
  dialog.addEventListener('close', () => {
    // A caller closing the native dialog must pass through the same completion gate.
    if (!dialog.open) finish();
  });

  return {
    get active() { return visit !== null; },
    open(required: boolean) {
      if (destroyed) return;
      if (visit) {
        title.focus({ preventScroll: true });
        return;
      }
      visit = { required };
      dialog.dataset.required = String(required);
      eyebrow.textContent = required ? 'YOUR FIRST LITTLE ADVENTURE · 1 OF 2' : 'A LITTLE MAP OF THE NOTEBOOK';
      primary.textContent = required ? 'Choose who to play' : 'Back to my game';
      closeButton.hidden = required;
      skip.hidden = !required;
      next.hidden = !required;
      dialog.showModal();
      title.focus({ preventScroll: true });
    },
    close: finish,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      visit = null;
      if (dialog.open) dialog.close();
      dialog.remove();
    },
  };
}
