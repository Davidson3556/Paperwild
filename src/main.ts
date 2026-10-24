import { createLoadingScreen } from './loading-screen.ts';
import './style.css';
import './child-sketch.css';
import { chooseComputerMove, isDifficulty, isGameMode, PIECE_NAMES, restoreGame } from './game.ts';
import { canRevisitFinishedGame, createStartupGame, preserveFinishedGame, restoreFinishedGame } from './startup-game.ts';
import type { FinishedGameRecord } from './startup-game.ts';
import type { Color, GameMode, Move, MoveCoordinates, MoveInput, PieceSymbol, PromotionPiece, SavedGame, Square } from './game.ts';
import { createOnlineSession } from './online-session.ts';
import { createOnlineRoomUI } from './online-room-ui.ts';
import { planOnlineSync } from './online-sync.ts';
import { entryPolicy } from './entry-policy.ts';
import { createOnboarding } from './onboarding.ts';
import type { OnlineClientState, OnlineRoomSnapshot } from './online-types.ts';
import { createSketchScene } from './sketch-scene.ts';
import type { FinaleCue, RefusalReaction, SketchMotionEvent, SketchScene } from './sketch-scene.ts';
import type { Atmosphere, View } from './scene.ts';
import { createPaperwildSound } from './sound.ts';
import type { ComputerRequest, ComputerResponse } from './ai.worker.ts';
import { createSketchMargins } from './sketch-margins.ts';
import { createCharacterPortrait } from './character-portrait.ts';
import { createCapturePageant } from './capture-pageant.ts';
import { createFieldCamp } from './field-camp.ts';
import { renderRemembrance, saveRemembrancePicture } from './remembrance.ts';
import './remembrance.css';
import './field-notebook.css';
import './new-game.css';

interface Preferences { atmosphere: Atmosphere; weather: 'clear' | 'rain'; sound: boolean; music: boolean; view: View; reducedMotion: boolean }
interface Study { id: string; name: string; label: string; description: string; fen: string; focus: Square }

const leaf = '<svg viewBox="0 0 40 48" fill="none" aria-hidden="true"><path d="M20 43V21M20 33C6 34 4 18 7 11c12 0 17 10 13 22ZM20 27C34 26 37 12 33 5c-12 1-17 11-13 22Z" stroke="currentColor" stroke-width="1.4"/><path d="M12 43h16" stroke="currentColor" stroke-width="1.4"/></svg>';
const icons = {
  sound: '<path d="m11 5-6 4H2v6h3l6 4V5ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  mute: '<path d="m11 5-6 4H2v6h3l6 4V5ZM16 9l6 6m0-6-6 6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  moon: '<path d="M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z"/>',
  undo: '<path d="m8 4-5 5 5 5M3 9h10a7 7 0 0 1 0 14"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 8.5a2.5 2.5 0 1 1 3.5 2.3c-1 .5-1 1.2-1 2.2m0 3v.1"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  view: '<path d="m12 3 10 6-10 6L2 9l10-6ZM2 14l10 6 10-6"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  rain: '<path d="M6 15a4 4 0 0 1-.5-8A6 6 0 0 1 17 6a4.5 4.5 0 0 1 1 9M8 18l-1 3m6-3-1 3m6-3-1 3"/>',
};
const icon = (name: keyof typeof icons) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const glyphs: Record<Color, Record<PieceSymbol, string>> = { w: { k:'♔',q:'♕',r:'♖',b:'♗',n:'♘',p:'♙' }, b: { k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟' } };
const clubNames: Record<PieceSymbol, string> = { k:'The bookish badger',q:'The fox queen',r:'The mossy rook',b:'The moth bishop',n:'The wandering hare',p:'The little acorn' };
const voiceNames: Record<PieceSymbol, string> = { k:'badger',q:'fox',r:'stump',b:'moth',n:'hare',p:'acorn' };
const SAVE_KEY = 'queens-conservatory.game.v1';
const PREF_KEY = 'queens-conservatory.preferences.v1';
const FINISHED_KEY = 'queens-conservatory.completed-game.v1';
const ONBOARDING_KEY = 'paperwild.onboarding.v1';
const studies: Study[] = [
  { id:'bloom', name:'Tea on the sidelines', label:'A lesson in captures', description:'White’s pawn on e4 can capture the pawn on d5. The woodland stretcher crew has a very small ceremony prepared.', fen:'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', focus:'e4' },
  { id:'promotion', name:'Room to become', label:'A lesson in promotion', description:'Guide White’s pawn from a7 to a8. Choose what it becomes.', fen:'7k/P7/8/8/8/8/8/7K w - - 0 1', focus:'a7' },
  { id:'mate', name:'One final move', label:'A checkmate in one', description:'White to move. Find the queen move that leaves Black’s king with nowhere to go.', fen:'7k/8/5KQ1/8/8/8/8/8 w - - 0 1', focus:'g6' },
];
const read = (key: string): unknown => { try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; } };
const prefs: Preferences = { atmosphere:'day', weather:'clear', sound:false, music:false, view:'perspective', reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches, ...(read(PREF_KEY) as Partial<Preferences> | null) };
if (!['day','dusk'].includes(prefs.atmosphere)) prefs.atmosphere = 'day';
if (!['clear','rain'].includes(prefs.weather)) prefs.weather = 'clear';
prefs.music = prefs.music === true;
if (!['perspective','overhead'].includes(prefs.view)) prefs.view = 'perspective';
// The notebook and the residents share the same saved motion preference.
const loading = createLoadingScreen({ reducedMotion: !!prefs.reducedMotion });
const saved = read(SAVE_KEY) as { game?: unknown; study?: unknown; opponentChosen?: unknown } | null;
const startup = createStartupGame(saved?.game, saved?.study);
const previousFinished = restoreFinishedGame(read(FINISHED_KEY));
let finishedRecord: FinishedGameRecord | null = startup.finished ?? (previousFinished ? {game:previousFinished.game.serialize(),study:previousFinished.study} : null);
let protectFinishedSave = !preserveFinishedGame(startup.finished, record => localStorage.setItem(FINISHED_KEY,JSON.stringify(record)));
let game = startup.game;
let activeStudy: Study | null = startup.resumed ? studies.find(s => s.id === saved?.study && s.fen === game.serialize().initialFen) || null : null;
let startupReady = false;
let entryStage: 'opening'|'guide'|'choice'|'invitation'|'ready' = 'opening';
let localOpponentChosen = false;
let newGameRequired = false;
let guideSeen = (read(ONBOARDING_KEY) as {seen?:unknown}|null)?.seen === true;
let entryInvitation = new URL(window.location.href).searchParams.get('room');
let appDisposed = false;
let selected: Square | null = null;
let focusedSquare: Square = 'e2';
let thinking = false;
let worker: Worker | null = null;
let computerTimer: ReturnType<typeof setTimeout> | undefined;
let computerEpoch = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let scene: SketchScene | undefined;
let moving = false;
let feedbackEpoch = 0;
let pendingPromotion: MoveInput | null = null;
let resultDismissed = false;
let resizeFrame = 0;
let capturePortraitKey = '';
let savingRemembrance = false;
let onlineState: OnlineClientState = { configured:false,status:'idle',pending:false,error:null,room:null,hasActiveSeat:false,hasSavedSeat:false };
let offlinePage: { game:SavedGame;study:Study|null;selected:Square|null;focus:Square;resultDismissed:boolean } | null = null;
let onlinePresentation = false;
let displayedRoom: {code:string;round:number} | null = null;
let onlineTarget: OnlineRoomSnapshot | null = null;
let onlineSyncError = '';
/** Set only while the checkmating move is being drawn. */
let finaleCue: FinaleCue | null = null;
let finalePlayed = false;
const portraitSlot = (color: Color, type: PieceSymbol, label = '') => `<span class="character-portrait-slot" data-portrait="${color}${type}" data-portrait-label="${label}"></span>`;

document.querySelector('#app')!.innerHTML = `
  <div class="app-shell field-notebook">
    <header class="masthead">
      <a class="brand" href="/" aria-label="Paperwild home"><span class="brand-mark">${leaf}</span><span><span class="brand-word">${[...'Paperwild'].map((letter,i)=>`<span style="--letter-tilt:${[-5,3,-3,5,-2,3,-4,4,-2][i]}deg;--letter-hop:${[0,-2,1,-1,2,0,-2,1,-1][i]}px">${letter}</span>`).join('')}</span><strong>Chess, drawn to life.</strong></span></a>
      <div class="masthead-note"><span class="field-stamp">FIELD NOTES<br><b>No. 001</b></span><span>A small expedition in chess.</span></div>
      <div class="header-actions"><button class="icon-button sound-button" id="sound" aria-label="Turn sound on" title="Hear the creatures and their little footsteps">${icon('mute')}<span>Sound off</span></button><button class="icon-button" id="help" aria-label="How to play" title="How to play">${icon('help')}</button><span class="edition">my sketchbook ♡</span></div>
    </header>
    <main class="experience">
      <aside class="invitation">
        <p class="eyebrow"><span></span> the pocket wilderness</p>
        <h1>Small moves.<br><em>Wild company.</em></h1>
        <p class="intro-copy">A field notebook.<br>A very curious chess club.</p>
        <div class="botanical-divider"><span></span>${leaf}<span></span></div>
        <div class="mode-selector" aria-label="Players"><button data-mode="computer" aria-pressed="true">Against the club</button><button data-mode="local" aria-pressed="false">With a friend</button></div>
        <p class="mode-description" id="mode-description">You play amber. The club plays indigo.</p>
        <div id="online-room-host"></div>
        <label class="field-label" for="difficulty">how tricky shall we be?</label>
        <select id="difficulty"><option value="seedling">Sleepy · a gentle beginning</option><option value="garden">Thoughtful · a friendly challenge</option><option value="wildwood">Mischievous · a little untamed</option></select>
        <button class="primary-button" id="new-game" aria-label="Begin a new game">A fresh page ${icon('arrow')}</button>
        <button class="text-button studies-link" id="studies" aria-label="Explore the chess studies">Little chess stories <span>↗</span></button>
        <div class="garden-note"><span class="note-number">a little note for you</span><p>off the board?<br>tea + biscuits<br>are over here!</p><span class="note-flower" aria-hidden="true">♡</span></div>
        <div id="field-camp-host"></div>
      </aside>
      <section class="game-space" aria-label="Illustrated chess board">
        <div id="field-turn-pocket"></div>
        <div class="scene-topline"><span><i></i> <span id="scene-label">our little chess club</span></span><div class="scene-controls"><button id="atmosphere" aria-label="Switch to evening light">${icon('sun')}<span id="atmosphere-label">Daydream</span></button><button id="weather" aria-label="Let it rain" aria-pressed="false">${icon('rain')}<span>A little rain</span></button><button id="view" hidden aria-label="Flat sketchbook view">${icon('view')}</button></div></div>
        <div class="board-well"><div id="scene" class="scene-stage"><div class="scene-loading">${leaf}<span>Waking the little inklings…</span></div></div><div id="scene-fallback" class="fallback-board" hidden></div></div>
        <div class="board-access" id="board-access" role="group" aria-label="Chess board"></div>
        <div class="scene-caption"><span class="caption-index">your turn,<br>daydreamer</span><p id="garden-observation">The best things happen between the lines.</p><span class="caption-seal" aria-hidden="true">☆</span><div class="toast" id="toast" role="status" aria-live="polite"></div></div>
        <div class="wildlife-note"><span class="wildlife-presence" aria-hidden="true"></span><span id="wildlife-hint">There’s a whole world in the margins.</span><button id="greet" class="resident-greeting">Say hello <span aria-hidden="true">↗</span></button></div>
        <div class="study-banner" id="study-banner" hidden><div><span class="eyebrow">A LITTLE CHESS STORY</span><h2 id="study-name"></h2><p id="study-description"></p></div><button id="leave-study" class="text-button">Return to a full game ${icon('arrow')}</button></div>
      </section>
      <aside class="game-journal">
        <div class="turn-card"><span class="field-label">psst... who's next?</span><div class="turn-heading"><span id="turn-token" class="turn-token"></span><h2 id="game-status" role="status" aria-live="polite">Your move.</h2></div><p id="turn-description">Choose a little character to begin.</p><div class="turn-card-footer"><span id="move-counter">Move 01</span><button id="undo" aria-label="Undo last turn">${icon('undo')} Undo</button></div></div>
        <div id="field-camp-pocket"></div>
        <div id="capture-pageant"></div>
        <section class="blooms-section" aria-labelledby="blooms-title"><div class="section-heading"><h2 id="blooms-title">The sideline society</h2><span id="bloom-count">00</span></div><div class="bloom-display" id="bloom-display" aria-label="No captures yet"><span class="empty-sprout">${leaf}</span><p>The kettle’s on.<br>Everyone is welcome.</p></div><p class="blooms-caption" id="blooms-caption">Captured pieces keep good company.</p></section>
        <section class="journal-section" aria-labelledby="journal-title"><div class="section-heading"><h2 id="journal-title">Field notes</h2><button class="icon-button compact" id="export" aria-label="Download game as PGN" title="Download game">${icon('download')}</button></div><ol id="move-history" class="move-history" aria-label="Move history"><li class="history-empty">Your story starts with a move.</li></ol></section>
        <button class="text-button remembrance-link" id="journal-remembrance">The garden of remembrance <span>↗</span></button><button class="text-button meet-link" id="meet">Who’s who in the club? <span>↗</span></button><div class="saved-note" id="saved-note"><span></span> Your place in the story is saved.</div>
      </aside>
    </main>
    <footer class="footer"><div class="field-tools"><button id="field-options" aria-haspopup="dialog">Field kit ${icon('view')}</button><button id="field-notes" aria-haspopup="dialog">Journal <span id="field-capture-count">00</span></button></div><span class="field-footer-note">Leave the board. Stay in the story.</span><button id="motion" aria-pressed="false">Let it wander</button></footer>
  </div>
  <dialog id="remembrance-dialog" class="modal remembrance-modal"><button class="modal-close icon-button" data-close aria-label="Close the garden of remembrance">${icon('close')}</button><p class="eyebrow">EVERY FRIEND, REMEMBERED</p><h2>The garden of <em>remembrance.</em></h2><p id="remembrance-summary" class="remembrance-summary"></p><div id="remembrance-list" class="remembrance-list"></div><div class="modal-actions"><button class="secondary-button" data-close>Back to the story</button><button class="primary-button" id="remembrance-save">Save as a picture ${icon('download')}</button></div></dialog>
  <dialog id="field-options-dialog" class="modal field-options-dialog"><button class="modal-close icon-button" data-close aria-label="Close field kit">${icon('close')}</button><p class="eyebrow">THE FIELD KIT</p><h2>Set out <em>your way.</em></h2><div id="field-options-host"></div><button id="revisit-finished" class="text-button" hidden>Revisit last finished game <span aria-hidden="true">↗</span></button></dialog>
  <dialog id="field-notes-dialog" class="modal field-notes-dialog"><button class="modal-close icon-button" data-close aria-label="Close field journal">${icon('close')}</button><p class="eyebrow">COLLECTED ALONG THE WAY</p><h2>The field <em>journal.</em></h2><div id="field-notes-host"></div></dialog>
  <dialog id="help-dialog" class="modal"><button class="modal-close icon-button" data-close aria-label="Close instructions">${icon('close')}</button><p class="eyebrow">WELCOME TO THE CLUB</p><h2>Familiar chess.<br><em>Curious company.</em></h2><p>Standard chess, with a woodland cast. Amber is White, indigo is Black. Play the computer or take turns on the same device.</p><p class="voice-invitation">Every friend has a little voice. Tap “hear me” to turn sound on.</p><div class="character-legend">${(['k','q','r','b','n','p'] as const).map(p=>`<div>${portraitSlot('w',p,clubNames[p])}<strong>${PIECE_NAMES[p]}</strong><span>${clubNames[p]}</span><button class="character-voice-button" data-voice="${p}" aria-label="Hear the ${voiceNames[p]}">hear me <span aria-hidden="true">♫</span></button></div>`).join('')}</div><div class="instruction-grid"><div><strong>Choose, then move</strong><p>Select a character, then a marked square. All the usual rules apply, including castling and en passant.</p></div><div><strong>Tea on the sidelines</strong><p>A tiny stretcher crew carries captured friends to the clearing beside the game for a woodland send-off. Ring the bell, scatter petals, or leave a flower. Undo brings everyone back.</p></div><div><strong>The margins are alive</strong><p>Say hello to the little world, invite a shower, or turn the page toward moonlight.</p></div><div><strong>A quieter page</strong><p>Sound is off until you invite it in. Each friend reacts to your moves in its own voice. Pause the wandering for a still, quieter page.</p></div></div><button class="text-button" id="replay-onboarding">Take a quick tour <span aria-hidden="true">↗</span></button><div class="keyboard-note"><kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> explore · <kbd>Enter</kbd> choose · <kbd>Esc</kbd> release · <kbd>U</kbd> undo</div><button class="primary-button" data-close>Back to the story ${icon('arrow')}</button></dialog>
  <dialog id="studies-dialog" class="modal studies-modal"><button class="modal-close icon-button" data-close aria-label="Close chess studies">${icon('close')}</button><p class="eyebrow">THREE LITTLE CHAPTERS</p><h2>Chess <em>stories.</em></h2><p>Small positions. A little room to discover. Both sides are yours to move.</p><div class="study-options">${studies.map((s,i)=>`<button data-study="${s.id}"><span class="study-index">0${i+1}</span><span><strong>${s.name}</strong><small>${s.label}</small></span>${icon('arrow')}</button>`).join('')}</div><p class="fine-print">Opening a story replaces the current game.</p></dialog>
  <dialog id="new-game-dialog" class="modal new-game-modal" aria-labelledby="new-game-title" aria-describedby="new-game-note">
    <button class="modal-close icon-button" id="new-game-close" data-close aria-label="Close new game choices">${icon('close')}</button>
    <p class="eyebrow" id="new-game-eyebrow">A FRESH PAGE</p><h2 id="new-game-title" tabindex="-1">Who will<br>you <em>play?</em></h2>
    <form id="new-game-form">
      <fieldset class="new-opponents"><legend>Choose your opponent</legend>
        <label class="new-opponent"><input type="radio" name="new-opponent" value="computer" checked><span class="new-opponent-portrait">${portraitSlot('w','k')}</span><span class="new-opponent-copy"><strong>Against the club</strong><small>You play Amber. The club plays Indigo.</small></span></label>
        <label class="new-opponent"><input type="radio" name="new-opponent" value="local"><span class="new-opponent-portrait">${portraitSlot('w','n')}</span><span class="new-opponent-copy"><strong>With a friend</strong><small>Take turns on this device.</small></span></label>
        <label class="new-opponent" id="new-online-option"><input type="radio" name="new-opponent" value="online" id="new-opponent-online"><span class="new-opponent-post" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none"><path d="m6 15 34-2 2 24-35 2-1-24Zm1 1 17 13 16-15M8 38l12-13m8 1 13 10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="m32 9 3-4m3 6 5-1M9 9 6 6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg></span><span class="new-opponent-copy"><strong>Across the woods</strong><small id="new-online-description">Invite a friend to play online.</small></span></label>
      </fieldset>
      <p id="new-game-note" class="new-game-note">Your current page stays as it is until you choose to begin.</p>
      <div class="modal-actions"><button class="secondary-button" type="button" id="new-game-cancel" data-close>Keep this page</button><button class="primary-button" type="submit" id="confirm-new">Play against the club ${icon('arrow')}</button></div>
    </form>
  </dialog>
  <dialog id="promotion-dialog" class="modal small-modal"><p class="eyebrow">A LITTLE ACORN. A BIG POSSIBILITY.</p><h2>Who will you <em>become?</em></h2><p>Choose a new role for your pawn.</p><div class="promotion-options">${(['q','r','b','n'] as const).map(p=>`<button data-promotion="${p}" aria-label="Promote to ${PIECE_NAMES[p]}">${portraitSlot('w',p)}${PIECE_NAMES[p]}</button>`).join('')}</div><button class="text-button" data-close>Choose a different move</button></dialog>
  <dialog id="result-dialog" class="modal result-modal"><button class="modal-close icon-button" data-close aria-label="Close result">${icon('close')}</button><div class="result-flower" aria-hidden="true">✧</div><p class="eyebrow">A CHAPTER FOR THE CLUB BOOK</p><h2 id="result-title">What a little<br><em>adventure.</em></h2><p id="result-description"></p><div class="result-stats"><div><strong id="result-moves"></strong><span>MOVES PLAYED</span></div><div><strong id="result-blooms"></strong><span>FRIENDS ON THE SIDELINES</span></div></div><button class="primary-button" id="result-new">Another little adventure ${icon('arrow')}</button><button class="text-button remembrance-open" id="result-remembrance" hidden>Visit the garden of remembrance <span aria-hidden="true">↗</span></button><button class="text-button" data-close>Stay a little longer</button></dialog>
`;

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const dialog = (s: string) => $<HTMLDialogElement>(s);
const button = (s: string) => $<HTMLButtonElement>(s);
const all = <T extends HTMLElement = HTMLButtonElement>(s: string) => document.querySelectorAll<T>(s);
function mountPortraits() {
  for (const [index, slot] of [...all('[data-portrait]')].entries()) {
    const color = slot.dataset.portrait![0] as Color, type = slot.dataset.portrait![1] as PieceSymbol;
    slot.replaceChildren(createCharacterPortrait(color, type, 103 + index * 71, slot.dataset.portraitLabel ?? ''));
  }
}
mountPortraits();
for (const item of all('.game-journal .blooms-section,.game-journal .journal-section,.game-journal .remembrance-link,.game-journal .meet-link,.game-journal .saved-note')) $('#field-notes-host').append(item);
const fieldCompact = matchMedia('(max-width: 900px)');
const fieldShort = matchMedia('(min-width: 901px) and (max-height: 650px)');
const fieldInvitation = $('.invitation'), fieldTurn = $('.turn-card'), fieldCampHost = $('#field-camp-host');
function dockFieldControls() {
  (fieldCompact.matches || fieldShort.matches || dialog('#field-options-dialog').open ? $('#field-options-host') : $('.experience')).prepend(fieldInvitation);
  (fieldCompact.matches ? $('#field-turn-pocket') : $('.game-journal')).prepend(fieldTurn);
  (fieldCompact.matches || fieldShort.matches ? $('#field-camp-pocket') : fieldInvitation).append(fieldCampHost);
}
fieldCompact.addEventListener('change', dockFieldControls);
fieldShort.addEventListener('change', dockFieldControls);
dialog('#field-options-dialog').addEventListener('close', dockFieldControls);
dockFieldControls();
function pageVisibility() { document.documentElement.dataset.pagePaused = String(document.hidden); }
document.addEventListener('visibilitychange', pageVisibility); pageVisibility();
const voiceEvents: string[] = [];
let campRadio: ((playing: boolean) => void) | undefined;
const sound = createPaperwildSound({onRadioChange:playing=>campRadio?.(playing),onCharacterCall:({role,activity})=>{
  const control=button('#sound');
  control.dataset.lastRole=role;control.dataset.lastActivity=activity;
  control.dataset.voiceCount=String(Number(control.dataset.voiceCount ?? 0)+1);
  voiceEvents.push(`${role}:${activity}`);
  if(voiceEvents.length>12)voiceEvents.shift();
  control.dataset.voiceEvents=voiceEvents.join(',');
},onUnavailable:()=>{
  prefs.sound=false;applyPreferences();
  showToast('Sound is unavailable here. The little world is still yours to explore.');
}});
const atmosphere = createSketchMargins(document.body, prefs);
const pageant = createCapturePageant($('#capture-pageant'), {
  reducedMotion: prefs.reducedMotion,
  onCue: (cue, role) => sound.pageant(cue, role),
});
const camp = createFieldCamp(fieldCampHost, resident => {
  const cues = { kettle:'petals', post:'bell', radio:'choir' } as const;
  // A tuned-in radio already announces itself; the choir would talk over it.
  if(!(resident==='radio'&&prefs.music))sound.pageant(cues[resident]);
}, toggleRadio);
const radioState = () => !prefs.music ? 'off' as const : sound.isRadioPlaying() ? 'on' as const : prefs.sound ? 'waiting' as const : 'muted' as const;
campRadio = () => camp.setRadio(radioState());
if(prefs.music)camp.show('radio');
/** Radio Small Hours: tuning in also turns sound on, like the "hear me" buttons. */
function toggleRadio() {
  prefs.music=!prefs.music;
  if(prefs.music&&!prefs.sound)prefs.sound=true;
  applyPreferences();
  $('#garden-observation').textContent=prefs.music?'Radio Small Hours is on. The moth chose something gentle.':'The radio rests. The woodland keeps its own time.';
}
const squareButtons = new Map<Square, HTMLButtonElement>();
const fallbackButtons = new Map<Square, HTMLButtonElement>();
for (let rank = 8; rank >= 1; rank--) {
  for (const file of 'abcdefgh') {
    const square = `${file}${rank}` as Square;
    const button = document.createElement('button');
    button.className = 'square-hit'; button.dataset.square = square; button.dataset.testid = `square-${square}`;
    button.tabIndex = square === focusedSquare ? 0 : -1;
    button.addEventListener('click',event=>{
      // Pointer and keyboard activation resolve the same flat, illustrated grid.
      const target=event.detail>0 ? scene?.pickSquare(event.clientX,event.clientY) ?? square : square;
      selectSquare(target);
    });
    button.addEventListener('keydown',e=>boardKeyboard(e,square));
    button.addEventListener('focus',()=>{ focusedSquare=square; updateSquareFocus(); });
    // A mouse resting on a resident makes it lean in and hop. Touch has no hover;
    // tapping selects instead, and a selected resident jumps for joy.
    button.addEventListener('pointerenter',event=>{if(event.pointerType!=='mouse'||moving)return;const role=scene?.hover(square,event.clientX);if(role)sound.delight(role);});
    button.addEventListener('pointermove',event=>{if(event.pointerType==='mouse')scene?.hover(square,event.clientX);});
    button.addEventListener('pointerleave',event=>{if(event.pointerType==='mouse')scene?.hover(null);});
    $('#board-access').append(button); squareButtons.set(square,button);
    const flat = document.createElement('button');
    flat.dataset.square=square;flat.className=`flat-square ${(file.charCodeAt(0)+rank)%2 ? 'light' : 'dark'}`;
    flat.addEventListener('click',()=>selectSquare(square));
    flat.addEventListener('keydown',e=>boardKeyboard(e,square));
    $('#scene-fallback').append(flat);fallbackButtons.set(square,flat);
  }
}

const online = createOnlineSession({ url:import.meta.env.VITE_CONVEX_URL,onChange:handleOnlineChange });
onlineState=online.state;
const onlineUI = createOnlineRoomUI({
  host:$('#online-room-host'),
  onCreate:()=>beginOnline(()=>{void online.create();}),
  onJoin:code=>beginOnline(()=>{void online.join(code);}),
  onResume:()=>beginOnline(()=>{void online.resume(!online.state.hasActiveSeat);}),
  onLeave:()=>{clearEntryInvitation();online.leave();},
  onRequestUndo:()=>requestOnline('undo'),
  onAnswerUndo:accept=>{void online.answerUndo(accept);},
  onRequestRematch:()=>requestOnline('rematch'),
  onAnswerRematch:accept=>{void online.answerRematch(accept);},
  onCancelRequest:()=>{void online.cancelRequest();},
});
onlineUI.render(onlineState);
const initialEntry = entryPolicy({
  resumed:startup.resumed,hasHistory:game.chess.history().length>0,hasStudy:!!activeStudy,
  opponentChosen:saved?.opponentChosen,hasSeenGuide:guideSeen,
  hasActiveSeat:onlineState.hasActiveSeat,hasInvitation:!!entryInvitation,
});
localOpponentChosen=initialEntry.localConfirmed;
const onboarding = createOnboarding({onFinish:required=>{
  if(appDisposed)return;
  if(required){
    guideSeen=true;
    try{localStorage.setItem(ONBOARDING_KEY,JSON.stringify({seen:true}));}catch{}
    continueEntry();
  }else{render();queueComputer();}
}});

function entryBlocked(): boolean { return entryStage!=='ready'||onboarding.active; }
function clearEntryInvitation() {
  entryInvitation=null;
  const address=new URL(window.location.href);
  if(!address.searchParams.has('room'))return;
  address.searchParams.delete('room');
  try{window.history.replaceState(window.history.state,'',address);}catch{}
}
function continueEntry() {
  if(appDisposed||!startupReady)return;
  if(onlineState.hasActiveSeat){entryStage='invitation';render();beginOnline(()=>{void online.resume();});}
  else if(entryInvitation){entryStage='invitation';render();onlineUI.open(entryInvitation);}
  else if(localOpponentChosen){entryStage='ready';render();queueComputer();}
  else openOpponentChoice(true);
}
function startEntry() {
  if(initialEntry.showGuide){entryStage='guide';onboarding.open(true);render();}
  else continueEntry();
}
function finishOnlineDialog() {
  if(appDisposed||!startupReady||onboarding.active||onlineEngaged())return;
  if(!localOpponentChosen)openOpponentChoice(true);
  else{entryStage='ready';render();queueComputer();}
}
function replayOnboarding() {
  if(appDisposed||!startupReady)return;
  if(entryStage!=='ready'){startEntry();return;}
  cancelComputer();dialog('#help-dialog').close();onboarding.open(false);render();
}

function onlineEngaged(): boolean {
  return onlineState.hasActiveSeat||Boolean(onlineState.room)||onlineState.status==='joining'||onlineState.status==='reconnecting';
}
function closeGameDialogs() {
  for(const selector of ['#promotion-dialog','#result-dialog','#new-game-dialog','#studies-dialog','#remembrance-dialog']){
    const openDialog=dialog(selector);if(openDialog.open)openDialog.close();
  }
  pendingPromotion=null;
}
function enterOnlinePresentation() {
  if(!offlinePage)offlinePage={game:game.serialize(),study:activeStudy,selected,focus:focusedSquare,resultDismissed};
  if(onlinePresentation)return;
  cancelFeedback();cancelComputer();closeGameDialogs();
  onlinePresentation=true;selected=null;activeStudy=null;game.mode='local';
  displayedRoom=null;onlineTarget=null;onlineSyncError='';
}
function beginOnline(action:()=>void) {
  if(appDisposed)return;
  if(!startupReady){showToast('The page is still opening. Your letter will be ready in a moment.');return;}
  entryStage='invitation';newGameRequired=false;
  enterOnlinePresentation();
  action();
}
function restoreOfflinePage(keepSeat:boolean) {
  if(offlinePage&&onlinePresentation){
    cancelFeedback();cancelComputer();closeGameDialogs();
    const restored=restoreGame(offlinePage.game);
    if(restored){game=restored;activeStudy=offlinePage.study;selected=offlinePage.selected;focusedSquare=offlinePage.focus;resultDismissed=offlinePage.resultDismissed;}
    pageant.reset();onlinePresentation=false;displayedRoom=null;onlineTarget=null;onlineSyncError='';
    render(false);
  }
  if(!keepSeat)offlinePage=null;
}
function onlineInSync(): boolean {
  const room=onlineState.room;
  return Boolean(room&&displayedRoom&&planOnlineSync({...displayedRoom,game:game.serialize()},room).kind==='same');
}
function mayMoveOnline(): boolean {
  const room=onlineState.room;
  return Boolean(startupReady&&!entryBlocked()&&!appDisposed&&room&&onlineState.status==='connected'&&!onlineState.pending&&!moving&&!onlineSyncError
    &&room.opponentJoined&&room.phase==='playing'&&room.seat===game.chess.turn()&&onlineInSync());
}
function onlineMoveHint(): string {
  if(onlineState.status==='error')return 'Your local page is safe. Open Across the woods to reconnect, or return to your page.';
  if(onlineState.status!=='connected')return 'Wait for your shared page to reconnect before moving.';
  if(!onlineState.room?.opponentJoined)return 'Share your invitation. The first move waits until your friend takes a seat.';
  if(onlineState.pending||moving||!onlineInSync())return 'One little moment. Your shared page is catching up.';
  if(onlineState.room.phase==='finished')return 'This chapter is complete. Ask your friend for a fresh page.';
  return 'It’s your friend’s turn. Your own characters will be ready next.';
}
function requestOnline(kind:'undo'|'rematch') {
  onlineUI.open();
  const room=onlineState.room;
  if(!room||onlineState.status!=='connected'||onlineState.pending||moving||!onlineInSync()){
    showToast('Let your shared page catch up before sending a request.');return;
  }
  if(!room.opponentJoined){showToast('Your friend needs to take a seat before you can send a request.');return;}
  if(room.undoRequest||room.rematchRequest){showToast('Answer or take back the current request first.');return;}
  if(kind==='undo')void online.requestUndo();else void online.requestRematch();
}
function leaveOnlineFirst(): boolean {
  if(!onlineEngaged())return false;
  showToast('Choose “Back to my page” in Across the woods before changing your local game.');
  onlineUI.open();return true;
}
function handleOnlineChange(next:OnlineClientState) {
  if(appDisposed)return;
  const previousError=onlineState.error;
  onlineState=next;
  if(next.room)entryStage='ready';
  else if(!next.hasActiveSeat&&localOpponentChosen)entryStage='ready';
  else if(!localOpponentChosen)entryStage='invitation';
  if(next.status==='joining'||next.status==='reconnecting'||next.room){
    enterOnlinePresentation();cancelComputer();
    onlineTarget=next.room;
  }else if(!next.room&&(next.status==='error'||!next.hasActiveSeat)){
    restoreOfflinePage(next.hasActiveSeat);
  }
  onlineUI.render(next);
  if(next.room)drainOnlineSnapshots();else render(false);
  if(next.error&&next.error!==previousError)showToast(next.error);
  if(!onlineEngaged())queueComputer();
}
function drainOnlineSnapshots() {
  const room=onlineTarget;
  if(!startupReady||appDisposed||!room||!onlinePresentation)return;
  const plan=planOnlineSync(displayedRoom?{...displayedRoom,game:game.serialize()}:null,room);
  if(plan.kind==='restore'){
    const restored=restoreGame(room.game);
    if(!restored){
      onlineSyncError='This shared page could not be read. Return to your page and reconnect.';
      onlineTarget=null;onlineUI.render({...onlineState,error:onlineSyncError});render(false);return;
    }
    cancelFeedback();cancelComputer();closeGameDialogs();
    restored.mode='local';game=restored;activeStudy=null;selected=null;focusedSquare=room.seat==='w'?'e2':'e7';
    displayedRoom={code:room.code,round:room.round};resultDismissed=true;pendingPromotion=null;
    onlineSyncError='';
    if(plan.reason!=='rewind')pageant.reset();
    render(plan.reason==='rewind');
    if(plan.reason!=='first'){
      onlineUI.close();
      if(plan.reason==='rewind'){sound.undo();showToast('Agreed. One move back, together.');}
      else if(plan.reason==='round')showToast('A fresh page, agreed by both of you.');
    }
    return;
  }
  if(plan.kind==='same'){render();return;}
  // Only appends wait for the current animation. Rewinds and a new round above
  // invalidate old feedback immediately, even during a capture or finale.
  if(moving){render();return;}
  const move=game.move(plan.moves[0]);
  if(!move){
    displayedRoom=null;drainOnlineSnapshots();return;
  }
  animateCommittedMove(move);
}

function showToast(message: string) {
  clearTimeout(toastTimer); $('#toast').textContent=message;$('#toast').classList.add('visible');
  toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3500);
}
function persist(explicit = false) {
  if(onlineEngaged()||onlinePresentation){$('#saved-note').textContent='Your shared page is saved by the woodland post. Your local game is waiting.';return;}
  if(!localOpponentChosen){$('#saved-note').textContent='Choose your company to begin. Your board is waiting.';return;}
  // A fresh-looking starter is safe even with blocked storage, but it must not
  // silently replace the only copy of the player's completed chapter.
  if(protectFinishedSave&&!explicit&&!activeStudy&&!game.chess.history().length){
    $('#saved-note').textContent='Your finished chapter is safe. Make a move to start the next.';return;
  }
  protectFinishedSave=false;
  try { localStorage.setItem(SAVE_KEY,JSON.stringify({game:game.serialize(),study:activeStudy?.id ?? null,opponentChosen:true}));$('#saved-note').innerHTML='<span></span> Your place in the story is saved.'; }
  catch { $('#saved-note').textContent='Storage unavailable. Keep this tab open to continue.'; }
}
function savePreferences() { try {localStorage.setItem(PREF_KEY,JSON.stringify(prefs));} catch {} }
function onMotion(event: SketchMotionEvent) {
  if(event.phase==='start')sound.moveStart(event.type,{durationMs:event.durationMs,contactTimesMs:event.contactTimesMs});
  if(event.phase==='cancel')sound.cancel();
}
function cancelFeedback() {
  feedbackEpoch++;moving=false;finaleCue=null;finalePlayed=false;sound.cancel();scene?.settle();
}
function cancelComputer() {
  computerEpoch++;clearTimeout(computerTimer);computerTimer=undefined;worker?.terminate();worker=null;thinking=false;
}
function queueComputer() {
  if (appDisposed||onlineEngaged()||onlinePresentation||!startupReady||entryBlocked()||!localOpponentChosen||dialog('#new-game-dialog').open||document.querySelector('.online-room-dialog[open]')||game.mode!=='computer'||game.chess.turn()!=='b'||game.status().over||thinking) return;
  thinking=true;selected=null;render();
  const id=++computerEpoch,fen=game.chess.fen();
  const complete=(move: MoveCoordinates | null)=>{
    if (id!==computerEpoch||fen!==game.chess.fen()||onlineEngaged()||onlinePresentation) return;
    worker?.terminate();worker=null;thinking=false;
    if (move) commitMove(move); else {render();showToast('The club paused. Undo the turn or begin again.');}
  };
  computerTimer=setTimeout(()=>{
    try {
      worker=new Worker(new URL('./ai.worker.ts',import.meta.url),{type:'module'});
      worker.onmessage=({data}: MessageEvent<ComputerResponse>)=>complete(data.move);
      worker.onerror=()=>complete(chooseComputerMove(fen,game.difficulty));
      worker.postMessage({fen,difficulty:game.difficulty,id} satisfies ComputerRequest);
    } catch {complete(chooseComputerMove(fen,game.difficulty));}
  },prefs.reducedMotion ? 150 : 650);
}
function selectSquare(square: Square) {
  if (!startupReady||entryBlocked()) return;
  // A click during a capture skips straight to the result; chess resumes as normal.
  if(moving){scene?.settle();return;}
  if(onlineEngaged()&&!mayMoveOnline()){showToast(onlineMoveHint());return;}
  if (thinking) {showToast('The club is considering a move.');return;}
  if (game.status().over) {showToast('This chapter is complete. Begin a new game to play again.');return;}
  if (game.mode==='computer'&&game.chess.turn()!=='w') return;
  const piece=game.chess.get(square);
  if (selected===square) {
    // Asking a stuck piece again counts as another try; it gets more upset.
    if(piece&&piece.color===game.chess.turn()&&!game.moves(square).length){stuck(square,piece.type);return;}
    selected=null;render();return;
  }
  if (selected) {
    const from=selected,legal=game.moves(from).filter(m=>m.to===square);
    if (legal.length) {
      if (legal.some(m=>m.promotion)) {
        pendingPromotion={from,to:square};
        const color=game.chess.get(from)?.color ?? game.chess.turn();
        for(const option of all('[data-promotion]')){
          const slot=option.querySelector<HTMLElement>('[data-portrait]');
          if(slot){slot.dataset.portrait=`${color}${option.dataset.promotion}`;slot.replaceChildren(createCharacterPortrait(color,option.dataset.promotion as PieceSymbol,option.dataset.promotion!.charCodeAt(0)*17));}
        }
        dialog('#promotion-dialog').showModal();return;
      }
      commitMove({from,to:square});return;
    }
    if (!piece||piece.color!==game.chess.turn()) {
      // The selected resident shakes its head, and the square it can't reach is crossed out.
      const reaction=scene?.refuse(from,'illegal',square);
      sound.invalid(reaction?.role ?? game.chess.get(from)?.type ?? 'p',reaction?.mood,reaction?.level);
      showToast(game.status().check?'Your king is in check. Choose a move that keeps it safe.':moodHint(reaction) ?? 'That square isn’t a legal move. Follow the marked possibilities.');return;
    }
  }
  if (piece?.color===game.chess.turn()) {
    selected=square;focusedSquare=square;render();
    if(game.moves(square).length){scene?.delight(square);sound.select(piece.type);}
    else stuck(square,piece.type);
  }
  else {
    selected=null;render();
    // Touching the other side's piece: it politely declines.
    if(piece){const reaction=scene?.refuse(square,'not-yours');sound.invalid(piece.type,reaction?.mood,reaction?.level);showToast(moodHint(reaction) ?? `That’s ${piece.color==='w'?'amber':'indigo'}’s ${PIECE_NAMES[piece.type]}. Choose one of your own.`);}
  }
}
/** A piece with nowhere to go says so, rather than silently showing no marks. */
function stuck(square: Square, role: PieceSymbol) {
  const reaction=scene?.refuse(square,'stuck');sound.invalid(role,reaction?.mood,reaction?.level);
  showToast(game.status().check?'Your king is in check, and this one can’t help.':moodHint(reaction) ?? 'This one has nowhere to go right now.');
}
/** A friendlier nudge once a resident is upset by repeated tries. */
function moodHint(reaction: RefusalReaction | null | undefined): string | undefined {
  if(!reaction||reaction.mood==='nope')return undefined;
  const name=clubNames[reaction.role];
  return reaction.mood==='angry'
    ?`${name} is losing patience. Only the circled squares will do.`
    :`${name}’s feelings are a little hurt. Try one of the circled squares.`;
}
function commitMove(input: MoveInput) {
  if(entryBlocked())return;
  if(onlineEngaged()){
    if(!mayMoveOnline()){showToast(onlineMoveHint());return;}
    selected=null;pendingPromotion=null;render();
    // The subscription, rather than this click, commits and animates the move.
    void online.move(input);return;
  }
  const move=game.move(input);if(!move)return;
  animateCommittedMove(move);
}
function animateCommittedMove(move:Move) {
  const epoch=++feedbackEpoch,fen=game.chess.fen();
  sound.cancel();moving=true;
  // The mating move gets the cinematic finisher instead of an ordinary step.
  const matedKing=game.status().checkmate?game.chess.board().flat().find(p=>p?.type==='k'&&p.color===game.chess.turn())?.square:undefined;
  finalePlayed=!!(matedKing&&scene&&!prefs.reducedMotion);
  finaleCue=finalePlayed&&matedKing?{kingSquare:matedKing}:null;
  selected=null;pendingPromotion=null;resultDismissed=false;persist();render();finaleCue=null;
  if(move.captured){
    atmosphere.celebrateCapture();
    $('#garden-observation').textContent='A little tussle. A victory hop. Then the stretcher crew.';
    showToast(`${clubNames[move.piece]} challenges ${clubNames[move.captured]}!`);
  }
  void (scene?.whenSettled() ?? Promise.resolve()).then(()=>{
    if(epoch!==feedbackEpoch||fen!==game.chess.fen())return;
    moving=false;
    const status=game.status();
    // The finisher's own soundtrack already ended on the winner's chord.
    if(!finalePlayed)sound.land(move.promotion ?? move.piece,{capture:!!move.captured,promotion:!!move.promotion,check:status.check,ending:status.over?(status.checkmate?'win':'draw'):undefined});
    finalePlayed=false;
    render();
    if(status.over){
      if(status.winner)sound.radioFlourish(status.winner);
      if(!resultDismissed&&!dialog('#result-dialog').open&&!onlineState.room?.undoRequest&&!onlineState.room?.rematchRequest)dialog('#result-dialog').showModal();
    }else queueComputer();
    if(onlineEngaged())drainOnlineSnapshots();
  });
}
function undo() {
  if(entryBlocked())return;
  if(onlineEngaged()){requestOnline('undo');return;}
  cancelFeedback();cancelComputer();const undone=game.undoTurn();selected=null;pendingPromotion=null;resultDismissed=true;
  if(dialog('#result-dialog').open)dialog('#result-dialog').close();
  if(!undone.length){showToast('The story is still at its beginning.');return;}
  persist();render();sound.undo();showToast('A little room to reconsider. Your last turn is undone.');queueComputer();
}
function newOpponent(): 'computer'|'local'|'online'|null {
  const choice=document.querySelector<HTMLInputElement>('input[name="new-opponent"]:checked')?.value;
  if(!choice)return null;
  return choice==='online'&&onlineState.configured?'online':choice==='local'?'local':'computer';
}
function renderNewGameChoices() {
  const choice=newOpponent();
  button('#confirm-new').disabled=!choice;
  $('#confirm-new').innerHTML=`${!choice?'Choose how to play':choice==='online'?'Open invitation':choice==='local'?'Play together here':'Play against the club'} ${icon('arrow')}`;
  $('#new-game-note').textContent=!choice?'Choose the club or a friend before your first move.':choice==='online'
    ?newGameRequired?'Send an invitation or join your friend. Your board will wait for both seats.':'Your current page stays saved while you arrange an online game.'
    :newGameRequired?'Your company is chosen. Amber makes the first move.':game.chess.history().length||activeStudy?'Starting will replace this page and its sideline society.':'A clean board. Amber moves first.';
}
function chooseNewGame() {
  if(appDisposed||!startupReady)return;
  dialog('#field-options-dialog').close();
  if(onlineEngaged()){requestOnline('rematch');return;}
  openOpponentChoice(!localOpponentChosen);
}
function openOpponentChoice(required:boolean) {
  if(appDisposed||!startupReady)return;
  newGameRequired=required;
  if(required)entryStage='choice';
  // Choosing is not a chess action. Keep a pending club reply on hold until
  // the player either starts the chosen game or returns to this page.
  cancelComputer();
  for(const d of all<HTMLDialogElement>('dialog[open]'))if(d.id!=='new-game-dialog')d.close();
  for(const option of all<HTMLInputElement>('input[name="new-opponent"]'))option.checked=!required&&option.value==='computer';
  button('#new-game-close').hidden=required;button('#new-game-cancel').hidden=required;
  dialog('#new-game-dialog').dataset.required=String(required);
  $('#new-game-eyebrow').textContent=required?'BEFORE YOUR FIRST MOVE · 2 OF 2':'A FRESH PAGE';
  $<HTMLInputElement>('#new-opponent-online').disabled=!onlineState.configured;
  $('#new-online-option').dataset.available=String(onlineState.configured);
  $('#new-online-description').textContent=onlineState.configured?'Invite a friend to play online.':'Online invitations are resting here.';
  renderNewGameChoices();render();
  if(!dialog('#new-game-dialog').open)dialog('#new-game-dialog').showModal();
  if(required)$('#new-game-title').focus();else $<HTMLInputElement>('input[name="new-opponent"][value="computer"]').focus();
}
function newGame(mode:GameMode) {
  if(onlineEngaged()){requestOnline('rematch');return;}
  if(game.status().over){
    finishedRecord={game:game.serialize(),study:activeStudy?.id ?? null};
    preserveFinishedGame(finishedRecord,record=>localStorage.setItem(FINISHED_KEY,JSON.stringify(record)));
  }
  cancelFeedback();cancelComputer();activeStudy=null;selected=null;resultDismissed=false;game.reset({mode});focusedSquare='e2';
  localOpponentChosen=true;newGameRequired=false;entryStage='ready';
  clearEntryInvitation();
  pageant.reset();
  for(const d of all<HTMLDialogElement>('dialog[open]'))d.close();persist(true);render();$('#garden-observation').textContent='The best things happen between the lines.';showToast('A fresh page. A whole little world.');
}
const directions: Record<string, [number, number]> = {ArrowUp:[0,1],ArrowDown:[0,-1],ArrowLeft:[-1,0],ArrowRight:[1,0]};
function boardKeyboard(event: KeyboardEvent,square: Square) {
  const direction=directions[event.key];
  if(direction) {
    event.preventDefault();const [dx,dy]=direction;
    const file=Math.max(0,Math.min(7,square.charCodeAt(0)-97+dx)),rank=Math.max(1,Math.min(8,Number(square[1])+dy));
    focusedSquare=`${String.fromCharCode(97+file)}${rank}` as Square;updateSquareFocus();
    ($('#scene-fallback').hidden?squareButtons:fallbackButtons).get(focusedSquare)?.focus();
  } else if(event.key==='Escape'){event.preventDefault();selected=null;render();}
  else if(event.key.toLowerCase()==='u'){event.preventDefault();undo();}
}
function updateSquareFocus(){for(const [s,b] of squareButtons)b.tabIndex=s===focusedSquare?0:-1;}
function positionSquares() {
  if(!scene)return;
  const stage=$('#scene'),space=$('.game-space');
  const sr=stage.getBoundingClientRect(),pr=space.getBoundingClientRect();
  const layer=$('#board-access');layer.style.top=`${sr.top-pr.top}px`;layer.style.left=`${sr.left-pr.left}px`;layer.style.width=`${sr.width}px`;layer.style.height=`${sr.height}px`;
  for(const [square,button] of squareButtons){
    const p=scene.projectSquare(square);
    Object.assign(button.style,{left:`${p.x}px`,top:`${p.y}px`,width:`${p.width}px`,height:`${p.height}px`});
    if(p.points.length)button.style.clipPath=`polygon(${p.points.map(v=>`${((v.x-p.x)/p.width)*100}% ${((v.y-p.y)/p.height)*100}%`).join(',')})`;
  }
}
function render(animate = true) {
  const status=game.status(),history=game.chess.history({verbose:true}),last=history.at(-1),captures=game.captures();
  const isOnline=onlineEngaged(),room=onlineState.room,inSync=!isOnline||onlineInSync();
  const waitingOnline=isOnline&&(!room||onlineState.status!=='connected'||!room.opponentJoined||onlineState.pending||!inSync);
  const legal=selected?game.moves(selected).map(m=>m.to):[];
  const checkSquare=status.check?game.chess.board().flat().find(p=>p?.type==='k'&&p.color===status.turn)?.square ?? null:null;
  scene?.sync({board:game.chess.board(),selected,legal,lastMove:last||null,captures,checkSquare,finale:finaleCue,animate});
  // Let the characters finish their tussle and departure before the clearing
  // welcomes the latest capture. Undo/reset still reconcile immediately.
  const stories=game.captureStories();
  pageant.sync(moving && last?.captured ? stories.slice(0,-1) : stories,animate);
  const boardBusy=String(!startupReady||entryBlocked()||moving||(isOnline&&(onlineState.pending||onlineState.status!=='connected'||!inSync)));
  $('#board-access').setAttribute('aria-busy',boardBusy);$('#scene-fallback').setAttribute('aria-busy',boardBusy);
  $('#board-access').inert=entryBlocked();$('#scene-fallback').inert=entryBlocked();
  for(const surface of [document.documentElement,$('.game-space'),$('#game-status')]){
    surface.dataset.entryStage=entryStage;surface.dataset.opponentChosen=String(isOnline?!!room:localOpponentChosen);surface.dataset.localOpponentChosen=String(localOpponentChosen);surface.dataset.guideSeen=String(guideSeen);
    surface.dataset.online=String(isOnline);surface.dataset.onlineSeat=room?.seat ?? '';
    surface.dataset.onlineRevision=room?String(room.revision):'';surface.dataset.onlineRound=room?String(room.round):'';
    surface.dataset.onlineConnection=onlineState.status;surface.dataset.onlineInSync=String(inSync);
  }
  for(const [square,button] of squareButtons){
    const piece=game.chess.get(square),label=`${square}, ${piece?`${piece.color==='w'?'White':'Black'} ${PIECE_NAMES[piece.type]}`:'empty'}${legal.includes(square)?', legal destination':''}`;
    button.setAttribute('aria-label',label);button.setAttribute('aria-pressed',String(selected===square));button.dataset.piece=piece?`${piece.color}${piece.type}`:'';
    const flat=fallbackButtons.get(square)!;flat.textContent=piece?glyphs[piece.color][piece.type]:'';flat.setAttribute('aria-label',label);flat.dataset.piece=piece?`${piece.color}${piece.type}`:'';flat.classList.toggle('selected',selected===square);flat.classList.toggle('legal',legal.includes(square));flat.tabIndex=square===focusedSquare?0:-1;
  }
  updateSquareFocus();positionSquares();
  const capturing=moving&&!!last?.captured;
  const onlineStatus=onlineSyncError?'Your shared page needs a retry.':onlineState.status==='error'?'Your local page is safe.':onlineState.status==='joining'||!room?'Finding your shared page…':onlineState.status==='reconnecting'?'Finding the clearing again…':!room.opponentJoined?'Waiting for your friend.':onlineState.pending?'Sending your change…':!inSync?'Catching up…':status.over?status.text:room.seat===status.turn?(status.check?'Your king is in check.':'Your move.'):(status.check?'A check for your friend.':'Your friend’s move.');
  const statusText=entryStage==='guide'?'Welcome to the club.':entryStage==='choice'?'Choose your company.':entryStage==='invitation'&&!isOnline?'Choose your shared page.':capturing?'A little tussle…':isOnline?onlineStatus:status.over?status.text:thinking?'A little thinking…':status.check?'Oh, a check!':game.mode==='computer'?'Your move.':`${status.turn==='w'?'Amber':'Indigo'} to move.`;
  $('#game-status').textContent=statusText;
  $('#game-status').dataset.turn=status.turn;$('#game-status').dataset.gameOver=String(status.over);$('#game-status').dataset.thinking=String(thinking);$('#game-status').dataset.moving=String(moving);
  $('#game-status').dataset.entering=String(!startupReady);
  $('#turn-token').classList.toggle('ink',status.turn==='b');$('#turn-token').classList.toggle('thinking',thinking);
  const selectedType=selected?game.chess.get(selected)?.type:undefined;
  const onlineDescription=onlineSyncError||onlineState.status==='error'?'Open Across the woods to reconnect, or choose Back to my page.':onlineState.status!=='connected'?'Your local game is waiting safely while the shared page reconnects.':!room?.opponentJoined?'Send your invitation. The first move waits until both seats are taken.':onlineState.pending||!inSync?'One little moment while your shared page catches up.':status.over?'A chapter, shared. A fresh page begins when your friend agrees.':room.seat===status.turn?`You move ${room.seat==='w'?'amber':'indigo'}. Choose one of your little characters.`:'Your friend moves the other side. Your turn will come back to you.';
  $('#turn-description').textContent=entryBlocked()&&!isOnline?'Choose the club or a friend before moving. Your little world is ready when you are.':capturing?'A woodland scuffle, then the winner claims the square.':isOnline&&(waitingOnline||!selected)?onlineDescription:status.over?'A chapter for the club book. Time for tea?':status.check?`${status.turn==='w'?'White’s':'Black’s'} king is in check. Find a safe move.`:thinking?'Even daydreamers need a moment.':selected?`${selectedType?clubNames[selectedType]:'A friend'} on ${selected}. Choose a marked square.`:'Choose a little character to see its possibilities.';
  $('#move-counter').textContent=`Move ${String(Number(game.chess.fen().split(' ')[5])).padStart(2,'0')}`;
  button('#undo').disabled=!history.length||(isOnline&&(!room?.opponentJoined||onlineState.status!=='connected'||onlineState.pending||moving||!inSync||Boolean(room.undoRequest||room.rematchRequest)));button('#export').disabled=!history.length;
  button('#undo').setAttribute('aria-label',isOnline?'Request undo from your friend':'Undo last turn');
  button('#new-game').setAttribute('aria-label',isOnline?'Request a new game with your friend':'Begin a new game');
  button('#revisit-finished').hidden=isOnline||!finishedRecord||!canRevisitFinishedGame(game,!!activeStudy);
  $('#bloom-count').textContent=String(captures.length).padStart(2,'0');
  $('#field-capture-count').textContent=String(captures.length).padStart(2,'0');
  $('#bloom-display').setAttribute('aria-label',`${captures.length} captured ${captures.length===1?'piece':'pieces'} on the sidelines`);
  const nextCapturePortraitKey=captures.map(c=>`${c.color}${c.type}${c.by}${c.moveNumber}`).join('|');
  if(nextCapturePortraitKey!==capturePortraitKey){
    capturePortraitKey=nextCapturePortraitKey;
    if(captures.length){
      const collection=document.createElement('div');collection.className='bloom-collection';
      captures.forEach((c,i)=>{
        const label=`${c.color==='w'?'White':'Black'} ${PIECE_NAMES[c.type]} captured`;
        const token=document.createElement('span');token.className=`bloom-token bloom-${i%4}`;token.title=label;
        token.append(createCharacterPortrait(c.color,c.type,127*i+41,label));collection.append(token);
      });
      $('#bloom-display').replaceChildren(collection);
    }else $('#bloom-display').innerHTML=`<span class="empty-sprout">${leaf}</span><p>The kettle’s on.<br>Everyone is welcome.</p>`;
  }
  $('#blooms-caption').textContent=captures.length?`${captures.length} ${captures.length===1?'friend':'friends'} off the board. Still part of the story.`:'Captured pieces keep good company.';
  const rows: {n:number;w:string;b:string}[]=[];for(const m of history){const n=Number(m.before.split(' ')[5]);let row=rows.at(-1);if(!row||row.n!==n){row={n,w:'',b:''};rows.push(row);}row[m.color]=m.san;}
  $('#move-history').innerHTML=rows.length?rows.map((row,i)=>`<li${i===rows.length-1?' class="latest"':''}><span class="move-number">${row.n}.</span><span>${row.w||'…'}</span><span>${row.b||'—'}</span></li>`).join(''):'<li class="history-empty">Your story starts with a move.</li>';
  $('#move-history').scrollTop=$('#move-history').scrollHeight;
  for(const b of all('[data-mode]'))b.setAttribute('aria-pressed',String(localOpponentChosen&&!isOnline&&b.dataset.mode===game.mode));
  $('#mode-description').textContent=isOnline?'Across the woods. One shared page, two places.':game.mode==='computer'?'You play amber. The computer plays indigo.':'One page. Two people. Take turns together.';
  const difficulty=$<HTMLSelectElement>('#difficulty');difficulty.value=game.difficulty;difficulty.disabled=entryBlocked()||isOnline||game.mode==='local';
  $('#study-banner').hidden=!activeStudy;$('#scene-label').textContent=isOnline?'a shared woodland clearing':activeStudy?'a little chess story':'our little chess club';
  if(isOnline)$('#saved-note').textContent='Your local game is waiting safely. The woodland post keeps your shared page.';
  if(activeStudy){$('#study-name').textContent=activeStudy.name;$('#study-description').textContent=activeStudy.description;}
  $('#result-title').innerHTML=status.checkmate?'What a little<br><em>adventure.</em>':'A peaceful<br><em>ending.</em>';
  $('#result-description').textContent=`${status.text}. Every move left its mark.`;
  $('#result-moves').textContent=String(history.length);$('#result-blooms').textContent=String(captures.length);
  button('#result-remembrance').hidden=!captures.length;
  // The computer can finish a turn while this page is open.
  if(dialog('#remembrance-dialog').open)refreshRemembrance();
}
function applyPreferences() {
  document.documentElement.dataset.atmosphere=prefs.atmosphere;
  document.documentElement.classList.toggle('reduced-motion',!!prefs.reducedMotion);
  $('#sound').innerHTML=`${icon(prefs.sound?'sound':'mute')}<span>Sound ${prefs.sound?'on':'off'}</span>`;$('#sound').setAttribute('aria-label',prefs.sound?'Turn sound off':'Turn sound on');$('#sound').setAttribute('aria-pressed',String(!!prefs.sound));
  void sound.setEnabled(!!prefs.sound);
  sound.radioMood(prefs.atmosphere);sound.radio(prefs.music);camp.setRadio(radioState());
  $('#atmosphere').innerHTML=`${icon(prefs.atmosphere==='day'?'sun':'moon')}<span>${prefs.atmosphere==='day'?'Daydream':'Moonlight'}</span>`;
  $('#atmosphere').setAttribute('aria-label',prefs.atmosphere==='day'?'Switch to evening light':'Switch to morning light');
  $('#view').setAttribute('aria-label',prefs.view==='perspective'?'Switch to overhead view':'Switch to perspective view');
  $('#weather').innerHTML=`${icon(prefs.weather==='rain'?'sun':'rain')}<span>${prefs.weather==='rain'?'Clear skies':'A little rain'}</span>`;
  $('#weather').setAttribute('aria-label',prefs.weather==='rain'?'Let it clear':'Let it rain');
  $('#weather').setAttribute('aria-pressed',String(prefs.weather==='rain'));
  document.documentElement.dataset.weather=prefs.weather;
  $('#motion').setAttribute('aria-pressed',String(!!prefs.reducedMotion));$('#motion').textContent=prefs.reducedMotion?'Resume animations':'Pause animations';
  $('#motion').setAttribute('aria-label',prefs.reducedMotion?'Resume animations':'Pause animations');
  scene?.setAtmosphere(prefs.atmosphere);scene?.setWeather(prefs.weather);scene?.setReducedMotion(!!prefs.reducedMotion);scene?.setView(prefs.view);
  atmosphere.setAtmosphere(prefs.atmosphere);atmosphere.setWeather(prefs.weather);atmosphere.setReducedMotion(!!prefs.reducedMotion);
  pageant.setReducedMotion(!!prefs.reducedMotion);
  $('#wildlife-hint').textContent=!scene?'A quiet page. All the usual chess rules.':prefs.reducedMotion?'A still page. Let it wander when you’re ready.':'There’s a whole world in the margins.';
  button('#greet').hidden=!scene;
  positionSquares();savePreferences();
}

button('#new-game').onclick=chooseNewGame;button('#result-new').onclick=chooseNewGame;button('#leave-study').onclick=()=>{if(!leaveOnlineFirst())chooseNewGame();};
for(const option of all<HTMLInputElement>('input[name="new-opponent"]'))option.onchange=renderNewGameChoices;
$<HTMLFormElement>('#new-game-form').onsubmit=event=>{
  event.preventDefault();
  if(appDisposed||!startupReady||!dialog('#new-game-dialog').open)return;
  if(onlineEngaged()){dialog('#new-game-dialog').close();requestOnline('rematch');return;}
  const choice=newOpponent();
  if(!choice)return;
  if(choice==='online'){
    newGameRequired=false;entryStage='invitation';dialog('#new-game-dialog').close();render();onlineUI.open();return;
  }
  newGame(choice);
};
button('#undo').onclick=undo;button('#help').onclick=()=>dialog('#help-dialog').showModal();button('#studies').onclick=()=>{if(leaveOnlineFirst())return;dialog('#field-options-dialog').close();dialog('#studies-dialog').showModal();};
button('#meet').onclick=()=>dialog('#help-dialog').showModal();
button('#replay-onboarding').onclick=replayOnboarding;
button('#revisit-finished').onclick=()=>{
  // Never replace an ongoing chapter or a study, even if an old click arrives.
  if(leaveOnlineFirst()||appDisposed||!startupReady||!canRevisitFinishedGame(game,!!activeStudy))return;
  const finished=restoreFinishedGame(finishedRecord);if(!finished)return;
  cancelFeedback();cancelComputer();game=finished.game;
  activeStudy=studies.find(study=>study.id===finished.study&&study.fen===game.serialize().initialFen) ?? null;
  selected=null;pendingPromotion=null;resultDismissed=true;focusedSquare='e2';pageant.reset();
  for(const d of all<HTMLDialogElement>('dialog[open]'))d.close();persist(true);render(false);
  showToast('Your finished chapter is back, with every friend remembered.');
};
/** A keepsake page of every fallen friend, which can be saved as a picture. */
function remembranceSummary() {
  const status=game.status(),moves=game.chess.history().length;
  return {line:`${status.over?status.text:'A game in progress'} · ${moves} ${moves===1?'move':'moves'}`};
}
function refreshRemembrance() {
  const stories=game.captureStories();
  renderRemembrance($('#remembrance-list'),stories);
  $('#remembrance-summary').textContent=remembranceSummary().line;
  button('#remembrance-save').disabled=savingRemembrance||!stories.length;
}
function openRemembrance() {
  refreshRemembrance();
  for(const d of all<HTMLDialogElement>('dialog[open]'))d.close();
  dialog('#remembrance-dialog').showModal();
}
button('#result-remembrance').onclick=openRemembrance;button('#journal-remembrance').onclick=openRemembrance;
button('#remembrance-save').onclick=async()=>{
  if(savingRemembrance||!game.captureStories().length)return;
  savingRemembrance=true;
  const save=button('#remembrance-save');save.disabled=true;
  try{await saveRemembrancePicture(game.captureStories(),remembranceSummary());showToast('Your garden of remembrance is saved as a picture.');}
  catch{showToast('The picture could not be made here. The garden is still yours to visit.');}
  finally{savingRemembrance=false;refreshRemembrance();}
};
button('#field-options').onclick=()=>{dialog('#field-options-dialog').showModal();dockFieldControls();};
button('#field-notes').onclick=()=>dialog('#field-notes-dialog').showModal();
button('#sound').onclick=()=>{prefs.sound=!prefs.sound;applyPreferences();if(prefs.sound)sound.toggle();};
button('#atmosphere').onclick=()=>{prefs.atmosphere=prefs.atmosphere==='day'?'dusk':'day';applyPreferences();$('#garden-observation').textContent=prefs.atmosphere==='dusk'?'The paper turns blue. The moths take the next watch.':'Another golden afternoon between the lines.';};
button('#weather').onclick=()=>{prefs.weather=prefs.weather==='clear'?'rain':'clear';applyPreferences();$('#garden-observation').textContent=prefs.weather==='rain'?'A passing shower. The tea tastes even better.':'The shower passes. The little world wakes again.';};
button('#view').onclick=()=>{prefs.view=prefs.view==='perspective'?'overhead':'perspective';applyPreferences();};
button('#motion').onclick=()=>{prefs.reducedMotion=!prefs.reducedMotion;applyPreferences();};
button('#greet').onclick=()=>{scene?.greetResident();};
for(const b of all('[data-voice]'))b.onclick=()=>{
  prefs.sound=true;applyPreferences();sound.greeting(b.dataset.voice as PieceSymbol);
};
$<HTMLSelectElement>('#difficulty').onchange=e=>{if(!localOpponentChosen&&!onlineEngaged()){openOpponentChoice(true);return;}if(leaveOnlineFirst()){render();return;}const value=(e.currentTarget as HTMLSelectElement).value;if(!isDifficulty(value))return;cancelFeedback();cancelComputer();game.difficulty=value;persist();render();queueComputer();};
for(const b of all('[data-mode]'))b.onclick=()=>{if(!localOpponentChosen&&!onlineEngaged()){openOpponentChoice(true);return;}if(leaveOnlineFirst())return;const mode=b.dataset.mode;if(!isGameMode(mode))return;cancelFeedback();cancelComputer();game.mode=mode;selected=null;persist();render();queueComputer();};
for(const b of all('[data-close]'))b.onclick=()=>b.closest('dialog')?.close();
for(const d of all<HTMLDialogElement>('dialog')){
  d.addEventListener('click',e=>{if(e.target===d){if(d.id==='new-game-dialog'&&newGameRequired)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientY<r.top||e.clientX>r.right||e.clientY>r.bottom)d.close();}});
  d.addEventListener('cancel',e=>{if(d.id==='new-game-dialog'&&newGameRequired)e.preventDefault();});
  d.addEventListener('close',()=>{
    if(d.id==='promotion-dialog')pendingPromotion=null;
    if(d.id==='result-dialog')resultDismissed=true;
    if(d.id==='new-game-dialog'){
      if(newGameRequired&&entryStage==='choice'&&!appDisposed){queueMicrotask(()=>{if(!appDisposed&&newGameRequired&&!d.open)d.showModal();});return;}
      queueComputer();
    }
    if(d.classList.contains('online-room-dialog'))finishOnlineDialog();
  });
}
for(const b of all('[data-study]'))b.onclick=()=>{
  if(!localOpponentChosen&&!onlineEngaged()){openOpponentChoice(true);return;}
  if(leaveOnlineFirst())return;
  const study=studies.find(s=>s.id===b.dataset.study);if(!study)return;
  cancelFeedback();cancelComputer();activeStudy=study;game.reset({fen:study.fen,mode:'local'});selected=study.focus;focusedSquare=study.focus;resultDismissed=false;
  pageant.reset();
  dialog('#studies-dialog').close();persist();render();showToast(study.description);
};
for(const b of all('[data-promotion]'))b.onclick=()=>{const move=pendingPromotion;if(!move)return;dialog('#promotion-dialog').close();commitMove({...move,promotion:b.dataset.promotion as PromotionPiece});};
button('#export').onclick=()=>{
  game.chess.header('Event','Paperwild','White',game.mode==='computer'?'You':'Amber','Black',game.mode==='computer'?'The club':'Indigo');
  const url=URL.createObjectURL(new Blob([game.chess.pgn()],{type:'application/x-chess-pgn'}));const a=document.createElement('a');a.href=url;a.download='paperwild-game.pgn';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
document.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='u'&&!document.querySelector('dialog[open]')&&!['INPUT','TEXTAREA','SELECT'].includes((e.target as HTMLElement).tagName)&&!e.ctrlKey&&!e.metaKey){if(!e.defaultPrevented){e.preventDefault();undo();}}});
try {
  scene=createSketchScene($('#scene'),{onSquare:selectSquare,onMotion,onCaptureBeat:beat=>sound.captureBeat(beat),onFinale:event=>sound.finale(event),onIdle:role=>{
    if(!moving&&!thinking&&!prefs.reducedMotion&&!game.status().over)sound.idle(role);
  },reducedMotion:prefs.reducedMotion,onCreature:creature=>{
    const residents = { robin:'post', snail:'kettle', butterfly:'radio', bee:'post' } as const;
    camp.greet(residents[creature]);
    const observations={robin:'A letter has arrived at the beetle post.',snail:'The camp kettle has a little more time for you.',butterfly:'Radio Small Hours is taking requests.',bee:'Special delivery. The stamp is bigger than the postman.'};
    $('#garden-observation').textContent=observations[creature];
  },onReady:()=>queueMicrotask(()=>{document.querySelector('.scene-loading')?.remove();render();})});
  document.querySelector('.scene-loading')?.remove();
  // The board waits folded flat until the notebook opens.
  if(loading.active)scene.fold();
} catch(error) {
  console.warn('Using the accessible chess board:',error instanceof Error ? error.message : error);$('#scene').hidden=true;$('#board-access').hidden=true;$('#scene-fallback').hidden=false;
  showToast('The quiet board is ready. All chess features are available.');
}
const observer=new ResizeObserver(()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{scene?.resize();positionSquares();});});observer.observe($('.game-space'));observer.observe($('#scene'));
applyPreferences();render();
if (!startup.resumed) persist();
void loading.finish().then(async()=>{
  if(appDisposed)return;
  await scene?.popUp(()=>sound.pagePop());
  if(appDisposed)return;
  startupReady=true;startEntry();
});
for(const eventName of ['pointerdown','keydown'])document.addEventListener(eventName,event=>{if(event.isTrusted&&prefs.sound)void sound.unlock();},{capture:true});
window.addEventListener('pagehide',event=>{
  if(!event.persisted)appDisposed=true;
  persist();cancelFeedback();cancelComputer();
  if(!event.persisted){
    online.dispose();onlineUI.destroy();onboarding.destroy();
    observer.disconnect();cancelAnimationFrame(resizeFrame);clearTimeout(toastTimer);
    fieldCompact.removeEventListener('change',dockFieldControls);
    fieldShort.removeEventListener('change',dockFieldControls);
    dialog('#field-options-dialog').removeEventListener('close',dockFieldControls);
    sound.destroy();scene?.destroy();atmosphere.destroy();pageant.destroy();camp.destroy();
  }
});
window.addEventListener('pageshow',event=>{if(event.persisted){scene?.resize();onlineState=online.state;onlineUI.render(onlineState);render(false);if(onlineEngaged())drainOnlineSnapshots();else queueComputer();}});
