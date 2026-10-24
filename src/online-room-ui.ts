import './online-room.css';
import { formatRoomCode, ROOM_CODE_PATTERN } from './online-types.ts';
import type { OnlineClientState, OnlineRoomSnapshot } from './online-types.ts';

interface OnlineRoomUIOptions {
  host: HTMLElement;
  onCreate: () => void;
  onJoin: (code: string) => void;
  onResume: () => void;
  onLeave: () => void;
  onRequestUndo: () => void;
  onAnswerUndo: (accept: boolean) => void;
  onRequestRematch: () => void;
  onAnswerRematch: (accept: boolean) => void;
  onCancelRequest: () => void;
}

export interface OnlineRoomUI {
  open: (code?: string) => void;
  close: () => void;
  render: (state: OnlineClientState) => void;
  destroy: () => void;
}

let nextInstance = 0;

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', copy = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = copy;
  return node;
}

function setText(node: HTMLElement, value: string): void {
  if (node.textContent !== value) node.textContent = value;
}

function makeButton(copy: string, className = 'online-button'): HTMLButtonElement {
  const button = element('button', className, copy);
  button.type = 'button';
  return button;
}

function cleanCode(value: string): string {
  return value.trim().toUpperCase().replace(/[\s·-]/g, '');
}

function seatName(seat: 'w' | 'b'): string {
  return seat === 'w' ? 'Amber' : 'Indigo';
}

function roomTurn(room: OnlineRoomSnapshot): 'w' | 'b' {
  const startingTurn = room.game.initialFen.split(' ')[1] === 'b' ? 'b' : 'w';
  return room.game.history.length % 2 === 0 ? startingTurn : startingTurn === 'w' ? 'b' : 'w';
}

function invitationURL(code: string): string {
  const invitation = new URL(window.location.pathname, window.location.origin);
  invitation.searchParams.set('room', code);
  return invitation.href;
}

/** The online room is one small postcard in the notebook; its details stay in a dialog. */
export function createOnlineRoomUI(options: OnlineRoomUIOptions): OnlineRoomUI {
  const id = `online-room-${++nextInstance}`;
  let state: OnlineClientState = {
    configured: false, status: 'idle', pending: false, error: null,
    room: null, hasActiveSeat: false, hasSavedSeat: false,
  };
  let actionLocked = false;
  let actionTimer: ReturnType<typeof setTimeout> | undefined;
  let copying = false;
  let copiedCode = '';
  let lastIncomingRequest = '';
  let localError = '';
  let destroyed = false;

  const card = element('div', 'online-postcard');
  card.dataset.testid = 'online-room-card';
  const entry = makeButton('', 'online-entry');
  entry.id = 'online-play';
  entry.dataset.testid = 'online-open';
  entry.setAttribute('aria-label', 'Play online with a friend');
  entry.setAttribute('aria-pressed', 'false');
  entry.setAttribute('aria-haspopup', 'dialog');
  entry.setAttribute('aria-controls', `${id}-dialog`);
  entry.setAttribute('aria-describedby', `${id}-card-note`);
  const envelope = element('span', 'online-envelope');
  envelope.setAttribute('aria-hidden', 'true');
  const entryText = element('span', 'online-entry-copy');
  const entryTitle = element('strong', '', 'Across the woods');
  const cardNote = element('span', 'online-card-note', 'A shared page, from anywhere.');
  cardNote.id = `${id}-card-note`;
  const entryArrow = element('span', 'online-entry-arrow', '↗');
  entryArrow.setAttribute('aria-hidden', 'true');
  entryText.append(entryTitle, cardNote);
  entry.append(envelope, entryText, entryArrow);
  const cardCode = element('span', 'online-card-code');
  cardCode.hidden = true;
  card.append(entry, cardCode);
  options.host.append(card);

  const dialog = element('dialog', 'online-room-dialog');
  dialog.id = `${id}-dialog`;
  dialog.dataset.testid = 'online-room-dialog';
  dialog.setAttribute('aria-labelledby', `${id}-title`);
  const closeButton = makeButton('×', 'online-close');
  closeButton.setAttribute('aria-label', 'Close online room');
  const heading = element('header', 'online-letter-heading');
  const eyebrow = element('p', 'online-eyebrow', 'THE WOODLAND POST OFFICE');
  const title = element('h2', 'online-letter-title', 'A letter to a friend.');
  title.id = `${id}-title`;
  const stamp = element('div', 'online-postage');
  stamp.setAttribute('aria-hidden', 'true');
  stamp.append(element('span', 'online-stamp-leaf', '♧'), element('span', '', 'PAPERWILD'), element('small', '', 'ONE SHARED PAGE'));
  heading.append(eyebrow, title, stamp);

  const unavailable = element('p', 'online-unavailable', 'The woodland post is resting here. You can still share this board on one device, or play against the club.');
  const introduction = element('p', 'online-introduction', 'Different places. The same little clearing. Invite a friend and take a seat on either side of the board.');
  const starting = element('div', 'online-starting');
  const savedSeat = element('div', 'online-saved-seat');
  const savedSeatNote = element('p', '', 'There’s a place with your name on it.');
  const resumeButton = makeButton('Return to my seat ↗', 'online-button online-button-primary');
  resumeButton.dataset.testid = 'online-resume';
  savedSeat.append(savedSeatNote, resumeButton);
  const createSection = element('section', 'online-create-section');
  const createButton = makeButton('Write an invitation ↗', 'online-button online-button-primary');
  createButton.dataset.testid = 'online-create';
  createSection.append(createButton, element('p', 'online-fineprint', 'A new game. You take Amber; your friend takes Indigo.'));

  const joinForm = element('form', 'online-join-form');
  joinForm.noValidate = true;
  const joinLabel = element('label', 'online-small-label', 'ALREADY HAVE A LETTER?');
  joinLabel.htmlFor = `${id}-code`;
  const joinRow = element('div', 'online-join-row');
  const codeInput = element('input', 'online-code-input');
  codeInput.id = `${id}-code`;
  codeInput.name = 'room-code';
  codeInput.type = 'text';
  codeInput.placeholder = 'ABCD · EFGH · JKLM';
  codeInput.autocomplete = 'off';
  codeInput.setAttribute('autocapitalize', 'characters');
  codeInput.spellcheck = false;
  codeInput.maxLength = 28;
  codeInput.setAttribute('aria-label', 'Invitation code');
  codeInput.setAttribute('aria-describedby', `${id}-code-hint ${id}-error`);
  codeInput.dataset.testid = 'online-code-input';
  const joinButton = makeButton('Take a seat', 'online-button online-join-button');
  joinButton.type = 'submit';
  joinButton.dataset.testid = 'online-join';
  joinRow.append(codeInput, joinButton);
  const codeHint = element('p', 'online-fineprint', 'Enter the 12 letters and numbers on your invitation.');
  codeHint.id = `${id}-code-hint`;
  joinForm.append(joinLabel, joinRow, codeHint);
  starting.append(savedSeat, createSection, joinForm);

  const roomSection = element('section', 'online-room-section');
  const roomHeading = element('div', 'online-room-heading');
  const roomLabel = element('span', 'online-small-label', 'YOUR SHARED CLEARING');
  const connection = element('span', 'online-connection');
  roomHeading.append(roomLabel, connection);
  const roomCode = element('p', 'online-room-code');
  roomCode.dataset.testid = 'online-room-code';
  const shareRow = element('div', 'online-share-row');
  const copyButton = makeButton('Copy invitation ↗', 'online-button online-button-primary');
  copyButton.dataset.testid = 'online-copy';
  const copyNote = element('p', 'online-copy-note');
  copyNote.setAttribute('role', 'status');
  copyNote.setAttribute('aria-live', 'polite');
  const shareLabel = element('label', 'online-link-label', 'Invitation link');
  shareLabel.htmlFor = `${id}-link`;
  const shareLink = element('input', 'online-invitation-link');
  shareLink.id = `${id}-link`;
  shareLink.type = 'text';
  shareLink.readOnly = true;
  shareLink.setAttribute('aria-label', 'Invitation link, ready to select and copy');
  shareLink.dataset.testid = 'online-invitation-link';
  shareRow.append(copyButton, copyNote, shareLabel, shareLink);
  const seats = element('div', 'online-seats');
  const yourSeat = element('p', 'online-seat');
  const friendSeat = element('p', 'online-seat');
  seats.append(yourSeat, friendSeat);
  const permission = element('p', 'online-permission');
  const requestPanel = element('div', 'online-request');
  requestPanel.setAttribute('role', 'group');
  requestPanel.setAttribute('aria-labelledby', `${id}-request-title`);
  const requestTitle = element('p', 'online-request-title');
  requestTitle.id = `${id}-request-title`;
  requestTitle.tabIndex = -1;
  const requestDescription = element('p', 'online-fineprint');
  const replyButtons = element('div', 'online-request-actions');
  const acceptButton = makeButton('Yes, undo it', 'online-button online-button-primary');
  acceptButton.dataset.testid = 'online-request-accept';
  const declineButton = makeButton('Keep this page', 'online-button');
  declineButton.dataset.testid = 'online-request-decline';
  const cancelRequestButton = makeButton('Take back my request', 'online-button');
  cancelRequestButton.dataset.testid = 'online-request-cancel';
  replyButtons.append(acceptButton, declineButton);
  requestPanel.append(requestTitle, requestDescription, replyButtons, cancelRequestButton);
  const gameActions = element('div', 'online-game-actions');
  const undoButton = makeButton('Ask to undo ↶', 'online-button');
  undoButton.dataset.testid = 'online-undo';
  const rematchButton = makeButton('Ask for another game ↗', 'online-button');
  rematchButton.dataset.testid = 'online-rematch';
  gameActions.append(undoButton, rematchButton);
  const consentNote = element('p', 'online-fineprint online-consent-note', 'One move goes back only if your friend agrees.');
  const retryButton = makeButton('Reconnect to my seat ↗', 'online-button');
  retryButton.dataset.testid = 'online-reconnect';
  roomSection.append(roomHeading, roomCode, shareRow, seats, permission, requestPanel, gameActions, consentNote, retryButton);

  const statusNote = element('p', 'online-status-note');
  statusNote.setAttribute('role', 'status');
  statusNote.setAttribute('aria-live', 'polite');
  const errorNote = element('p', 'online-error');
  errorNote.id = `${id}-error`;
  errorNote.setAttribute('role', 'alert');
  const leaveArea = element('footer', 'online-leave-area');
  const leaveButton = makeButton('Back to my page', 'online-button online-leave');
  leaveButton.dataset.testid = 'online-leave';
  const leaveNote = element('p', 'online-fineprint');
  leaveArea.append(leaveButton, leaveNote);
  dialog.append(closeButton, heading, unavailable, introduction, starting, roomSection, statusNote, errorNote, leaveArea);
  document.body.append(dialog);

  function busy(): boolean {
    return actionLocked || state.pending || state.status === 'joining' || state.status === 'reconnecting';
  }

  function perform(callback: () => void): void {
    if (destroyed || busy()) return;
    actionLocked = true;
    localError = '';
    refresh();
    try {
      callback();
    } catch (error) {
      localError = error instanceof Error ? error.message : 'That letter didn’t go through. Please try again.';
      actionLocked = false;
    }
    // The transport owns the long-lived pending state. Also guard fast duplicate
    // activations when a callback finishes without changing the room.
    clearTimeout(actionTimer);
    actionTimer = setTimeout(() => { actionLocked = false; refresh(); }, 500);
    refresh();
  }

  function request(): { kind: 'undo' | 'rematch'; own: boolean } | null {
    const room = state.room;
    if (!room) return null;
    if (room.undoRequest) return { kind: 'undo', own: room.undoRequest.by === room.seat };
    if (room.rematchRequest) return { kind: 'rematch', own: room.rematchRequest.by === room.seat };
    return null;
  }

  function refresh(): void {
    if (destroyed) return;
    const room = state.room;
    const currentRequest = request();
    const occupied = Boolean(room?.opponentJoined);
    const locked = busy();
    card.dataset.status = state.status;
    card.dataset.active = String(Boolean(room || state.hasActiveSeat));
    entry.setAttribute('aria-pressed', String(Boolean(room || state.hasActiveSeat)));
    card.dataset.needsReply = String(Boolean(currentRequest && !currentRequest.own));
    dialog.dataset.status = state.status;
    dialog.setAttribute('aria-busy', String(state.pending || state.status === 'joining'));
    unavailable.hidden = state.configured;
    introduction.hidden = !state.configured || Boolean(room);
    starting.hidden = !state.configured || Boolean(room);
    roomSection.hidden = !state.configured || !room;
    savedSeat.hidden = !state.hasSavedSeat && !state.hasActiveSeat;
    setText(savedSeatNote, state.hasActiveSeat ? 'Let’s find your shared page again.' : 'There’s a place with your name on it.');
    setText(resumeButton, state.hasActiveSeat ? 'Try my connection again ↗' : 'Return to my seat ↗');
    createButton.disabled = locked || !state.configured || state.hasActiveSeat;
    joinButton.disabled = locked || !state.configured || state.hasActiveSeat;
    codeInput.disabled = state.status === 'joining' || state.hasActiveSeat;
    resumeButton.disabled = locked || !state.configured;
    setText(createButton, state.status === 'joining' ? 'Opening the letter…' : 'Write an invitation ↗');
    leaveArea.hidden = !state.hasActiveSeat && !room;
    setText(leaveNote, state.hasSavedSeat
      ? 'Your seat stays saved on this device. Return before the room expires; invitations last 24 hours.'
      : room ? 'Return to the local board. This browser couldn’t save your seat for a later visit.'
        : 'Return to the local board. This unfinished invitation attempt will close.');
    // Returning to the local page is always available, including while reconnecting.
    leaveButton.disabled = false;
    retryButton.hidden = state.status !== 'error';
    retryButton.disabled = locked;
    cardCode.hidden = !room;

    let summary = state.status === 'error' ? 'Open your invitation to try again.' : state.hasSavedSeat ? 'Return to a saved seat.' : state.configured ? 'A shared page, from anywhere.' : 'Invite a friend to a shared page.';
    let status = '';
    if (state.status === 'joining') {
      summary = 'Opening your shared page…';
      status = 'Finding your place in the clearing…';
    } else if (state.status === 'reconnecting') {
      summary = 'Finding the clearing again…';
      status = 'Your connection is returning. Moves will wait until the page is in sync.';
    } else if (state.pending || actionLocked) {
      summary = 'Sending your change…';
      status = 'Sending your change. One little moment…';
    }

    if (room) {
      setText(cardCode, formatRoomCode(room.code));
      setText(roomCode, formatRoomCode(room.code));
      roomCode.setAttribute('aria-label', `Invitation code ${room.code.split('').join(' ')}`);
      const link = invitationURL(room.code);
      if (shareLink.value !== link) shareLink.value = link;
      copyButton.disabled = copying;
      setText(copyButton, copying ? 'Folding the letter…' : copiedCode === room.code ? 'Copy invitation again ↗' : 'Copy invitation ↗');
      setText(connection, state.status === 'connected' ? 'your connection · connected' : state.status === 'reconnecting' ? 'your connection · reconnecting' : state.status === 'error' ? 'your connection · interrupted' : 'your connection · connecting');
      setText(yourSeat, `You · ${seatName(room.seat)} (${room.seat === 'w' ? 'White' : 'Black'})`);
      yourSeat.dataset.seat = room.seat;
      const otherSeat = room.seat === 'w' ? 'b' : 'w';
      setText(friendSeat, `Friend · ${seatName(otherSeat)}${occupied ? ' · seat taken' : ' · waiting'}`);
      friendSeat.dataset.seat = otherSeat;
      const yourMove = roomTurn(room) === room.seat;
      let instruction = !occupied
        ? 'A place is set for your friend. Share the invitation; the first move waits until both seats are taken.'
        : room.phase === 'finished'
          ? 'This chapter is complete. Another game begins when you both agree.'
          : yourMove
            ? `Your move. The ${seatName(room.seat).toLowerCase()} characters are yours; your friend moves the other side.`
            : `Your friend’s move. You’ll move ${seatName(room.seat).toLowerCase()} when the page comes back to you.`;
      if (state.status === 'reconnecting') instruction = 'Keep your place. The board will be ready when your connection returns.';
      else if (state.status === 'error') instruction = 'Your connection was interrupted. Reconnect before making another move.';
      setText(permission, instruction);
      if (state.status !== 'joining' && state.status !== 'reconnecting' && !state.pending && !actionLocked) {
        summary = currentRequest
          ? currentRequest.own ? 'Your request is with your friend.' : currentRequest.kind === 'undo' ? 'A friend asks to undo a move.' : 'A friend asks for another game.'
          : !occupied ? 'Your invitation is ready to send.'
            : room.phase === 'finished' ? 'A chapter, shared.'
              : `You’re ${seatName(room.seat)} · ${yourMove ? 'your move' : 'friend’s move'}`;
      }
      requestPanel.hidden = !currentRequest;
      if (currentRequest) {
        requestPanel.dataset.kind = currentRequest.kind;
        setText(requestTitle, currentRequest.own
          ? currentRequest.kind === 'undo' ? 'You asked to turn back one move.' : 'You asked for another little adventure.'
          : currentRequest.kind === 'undo' ? 'Your friend asks to undo the last move.' : 'Your friend asks for another game.');
        setText(requestDescription, currentRequest.own ? 'Waiting for your friend’s answer. A new move cancels this request.' : currentRequest.kind === 'undo' ? 'Say yes and the last move will be taken back.' : 'Say yes and a fresh board will open for both of you.');
        replyButtons.hidden = currentRequest.own;
        cancelRequestButton.hidden = !currentRequest.own;
        setText(acceptButton, currentRequest.kind === 'undo' ? 'Yes, undo it' : 'Yes, a fresh page');
        setText(declineButton, currentRequest.kind === 'undo' ? 'Keep this move' : 'Stay with this page');
      }
      for (const control of [acceptButton, declineButton, cancelRequestButton]) control.disabled = locked || state.status !== 'connected';
      undoButton.disabled = locked || state.status !== 'connected' || !occupied || Boolean(currentRequest) || !room.game.history.length;
      rematchButton.hidden = false;
      rematchButton.disabled = locked || state.status !== 'connected' || !occupied || Boolean(currentRequest);
      gameActions.hidden = Boolean(currentRequest);
      consentNote.hidden = Boolean(currentRequest);
    }
    setText(cardNote, summary);
    setText(statusNote, status);
    statusNote.hidden = !status || !state.configured;
    const message = localError || state.error || '';
    setText(errorNote, message);
    errorNote.hidden = !message;
  }

  function open(code?: string): void {
    if (destroyed) return;
    localError = '';
    codeInput.removeAttribute('aria-invalid');
    if (code !== undefined && !state.room && document.activeElement !== codeInput) codeInput.value = formatRoomCode(cleanCode(code));
    refresh();
    if (!dialog.open) dialog.showModal();
    if (request() && !request()?.own) requestTitle.focus();
    else if (state.room) copyButton.focus();
    else if (state.configured && !codeInput.disabled && (code || !state.hasSavedSeat)) codeInput.focus();
    else if (state.configured && (state.hasSavedSeat || state.hasActiveSeat)) resumeButton.focus();
    else closeButton.focus();
  }

  entry.addEventListener('click', () => open());
  closeButton.addEventListener('click', () => dialog.close());
  createButton.addEventListener('click', () => perform(options.onCreate));
  resumeButton.addEventListener('click', () => perform(options.onResume));
  retryButton.addEventListener('click', () => perform(options.onResume));
  codeInput.addEventListener('input', () => {
    if (localError) { localError = ''; refresh(); }
    codeInput.removeAttribute('aria-invalid');
  });
  joinForm.addEventListener('submit', event => {
    event.preventDefault();
    if (busy() || !state.configured || state.hasActiveSeat) return;
    const code = cleanCode(codeInput.value);
    if (!ROOM_CODE_PATTERN.test(code)) {
      localError = 'That invitation needs 12 letters and numbers. Check the code and try again.';
      codeInput.setAttribute('aria-invalid', 'true');
      refresh();
      codeInput.focus();
      return;
    }
    perform(() => options.onJoin(code));
  });
  leaveButton.addEventListener('click', () => {
    if (!state.hasActiveSeat && !state.room) return;
    options.onLeave();
    if (dialog.open) dialog.close();
  });
  undoButton.addEventListener('click', () => perform(options.onRequestUndo));
  rematchButton.addEventListener('click', () => perform(options.onRequestRematch));
  cancelRequestButton.addEventListener('click', () => perform(options.onCancelRequest));
  function answer(accept: boolean): void {
    const current = request();
    if (!current || current.own) return;
    perform(() => current.kind === 'undo' ? options.onAnswerUndo(accept) : options.onAnswerRematch(accept));
  }
  acceptButton.addEventListener('click', () => answer(true));
  declineButton.addEventListener('click', () => answer(false));
  shareLink.addEventListener('click', () => shareLink.select());
  copyButton.addEventListener('click', async () => {
    if (!state.room || copying || destroyed) return;
    const code = state.room.code;
    const link = invitationURL(code);
    copying = true;
    setText(copyNote, '');
    refresh();
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(link);
      if (destroyed || state.room?.code !== code) return;
      copiedCode = code;
      setText(copyNote, 'Invitation copied. Send it to your friend.');
    } catch {
      if (destroyed || state.room?.code !== code) return;
      setText(copyNote, 'The post couldn’t copy it. Select the link below and copy it yourself.');
      shareLink.focus();
      shareLink.select();
    } finally {
      copying = false;
      refresh();
    }
  });
  refresh();

  return {
    open,
    close: () => { if (dialog.open) dialog.close(); },
    render: next => {
      if (destroyed) return;
      const previousCode = state.room?.code;
      state = next;
      if (state.room?.code !== previousCode) {
        copiedCode = '';
        setText(copyNote, '');
      }
      refresh();
      const currentRequest = request();
      const incomingKey = state.room && currentRequest && !currentRequest.own
        ? `${state.room.code}/${state.room.round}/${state.room.revision}/${currentRequest.kind}` : '';
      const shouldOpen = Boolean(incomingKey && incomingKey !== lastIncomingRequest);
      lastIncomingRequest = incomingKey;
      if (shouldOpen) open();
      else if (dialog.open && state.room && state.room.code !== previousCode) copyButton.focus();
    },
    destroy: () => {
      destroyed = true;
      clearTimeout(actionTimer);
      if (dialog.open) dialog.close();
      card.remove();
      dialog.remove();
    },
  };
}
