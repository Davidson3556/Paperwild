import './style.css';
import { createGame, restoreGame, chooseComputerMove, PIECE_NAMES } from './game.js';
import { createConservatory } from './scene.js';

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
};
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const glyphs = { w: { k:'♔',q:'♕',r:'♖',b:'♗',n:'♘',p:'♙' }, b: { k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟' } };
const SAVE_KEY = 'queens-conservatory.game.v1';
const PREF_KEY = 'queens-conservatory.preferences.v1';
const studies = [
  { id:'bloom', name:'The first bloom', label:'A lesson in captures', description:'White’s pawn on e4 can capture the pawn on d5. Watch what happens in the garden.', fen:'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', focus:'e4' },
  { id:'promotion', name:'Room to become', label:'A lesson in promotion', description:'Guide White’s pawn from a7 to a8. Choose what it becomes.', fen:'7k/P7/8/8/8/8/8/7K w - - 0 1', focus:'a7' },
  { id:'mate', name:'One final move', label:'A checkmate in one', description:'White to move. Find the queen move that leaves Black’s king with nowhere to go.', fen:'7k/8/5KQ1/8/8/8/8/8 w - - 0 1', focus:'g6' },
];
const read = (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } };
const prefs = { atmosphere:'day', sound:false, view:'perspective', reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches, ...read(PREF_KEY) };
if (!['day','dusk'].includes(prefs.atmosphere)) prefs.atmosphere = 'day';
if (!['perspective','overhead'].includes(prefs.view)) prefs.view = 'perspective';
const saved = read(SAVE_KEY);
const restoredGame = restoreGame(saved?.game);
let game = restoredGame || createGame();
let activeStudy = restoredGame ? studies.find(s => s.id === saved?.study && s.fen === saved.game.initialFen) || null : null;
let selected = null;
let focusedSquare = 'e2';
let thinking = false;
let worker = null;
let computerTimer = null;
let computerEpoch = 0;
let toastTimer;
let scene;
let audio;
let pendingPromotion = null;
let resultDismissed = false;
let resizeFrame;

document.querySelector('#app').innerHTML = `
  <div class="app-shell">
    <header class="masthead">
      <a class="brand" href="/" aria-label="The Queen’s Conservatory home"><span class="brand-mark">${leaf}</span><span>The Queen’s<br><strong>Conservatory</strong></span></a>
      <div class="masthead-note"><span class="small-star">✳</span> A little strategy. A little wonder.</div>
      <div class="header-actions"><button class="icon-button" id="sound" aria-label="Turn sound on" title="Sound">${icon('mute')}</button><button class="icon-button" id="help" aria-label="How to play" title="How to play">${icon('help')}</button><span class="edition">EST. MMXXVI</span></div>
    </header>
    <main class="experience">
      <aside class="invitation">
        <p class="eyebrow"><span></span> A LIVING CHESS GARDEN</p>
        <h1>Every game,<br>a <em>garden.</em></h1>
        <p class="intro-copy">Make a move. Plant a possibility.<br>Leave something beautiful behind.</p>
        <div class="botanical-divider"><span></span>${leaf}<span></span></div>
        <div class="mode-selector" aria-label="Players"><button data-mode="computer" aria-pressed="true">Play the keeper</button><button data-mode="local" aria-pressed="false">With a friend</button></div>
        <p class="mode-description" id="mode-description">You are ivory. The keeper plays ink.</p>
        <label class="field-label" for="difficulty">THE KEEPER’S TEMPERAMENT</label>
        <select id="difficulty"><option value="seedling">Seedling · a gentle beginning</option><option value="garden">Gardener · a thoughtful match</option><option value="wildwood">Wildwood · a little untamed</option></select>
        <button class="primary-button" id="new-game">Begin a new game ${icon('arrow')}</button>
        <button class="text-button studies-link" id="studies">Explore the garden studies <span>↗</span></button>
        <div class="garden-note"><span class="note-number">FIELD NOTE No. 01</span><p>Nothing is lost here.<br>Every captured piece<br>becomes a flower.</p><span class="note-flower" aria-hidden="true">✳</span></div>
      </aside>
      <section class="game-space" aria-label="Chess conservatory">
        <div class="scene-topline"><span><i></i> <span id="scene-label">THE GLASSHOUSE</span></span><div class="scene-controls"><button id="atmosphere" aria-label="Switch to evening light">${icon('sun')}<span id="atmosphere-label">Morning light</span></button><button id="view" aria-label="Switch to overhead view">${icon('view')}</button></div></div>
        <div id="scene" class="scene-stage"><div class="scene-loading">${leaf}<span>Opening the glasshouse…</span></div></div>
        <div class="board-access" id="board-access" role="group" aria-label="Chess board"></div>
        <div id="scene-fallback" class="fallback-board" hidden></div>
        <div class="scene-caption"><span class="caption-index">01 / 01</span><p>Take your time. Good things grow slowly.</p><span class="caption-seal" aria-hidden="true">✳</span></div>
        <div class="study-banner" id="study-banner" hidden><div><span class="eyebrow">GARDEN STUDY</span><h2 id="study-name"></h2><p id="study-description"></p></div><button id="leave-study" class="text-button">Return to a full game ${icon('arrow')}</button></div>
      </section>
      <aside class="game-journal">
        <div class="turn-card"><span class="field-label">IN THE CONSERVATORY</span><div class="turn-heading"><span id="turn-token" class="turn-token"></span><h2 id="game-status" role="status" aria-live="polite">Your move.</h2></div><p id="turn-description">Choose a piece to see its possibilities.</p><div class="turn-card-footer"><span id="move-counter">Move 01</span><button id="undo" aria-label="Undo last turn">${icon('undo')} Undo</button></div></div>
        <section class="blooms-section" aria-labelledby="blooms-title"><div class="section-heading"><h2 id="blooms-title">The growing garden</h2><span id="bloom-count">00</span></div><div class="bloom-display" id="bloom-display" aria-label="No captures yet"><span class="empty-sprout">${leaf}</span><p>A little space for<br>what comes next.</p></div><p class="blooms-caption" id="blooms-caption">A bloom for every captured piece.</p></section>
        <section class="journal-section" aria-labelledby="journal-title"><div class="section-heading"><h2 id="journal-title">Field notes</h2><button class="icon-button compact" id="export" aria-label="Download game as PGN" title="Download game">${icon('download')}</button></div><ol id="move-history" class="move-history" aria-label="Move history"><li class="history-empty">Your story starts with a move.</li></ol></section>
        <div class="saved-note" id="saved-note"><span></span> Your game is saved as you play.</div>
      </aside>
    </main>
    <footer class="footer"><span>THE ART OF THINKING, GROWING & BEGINNING AGAIN.</span><div><button id="motion" aria-pressed="false">Gentle motion</button><span>Crafted for a slower moment.</span></div></footer>
  </div>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>
  <dialog id="help-dialog" class="modal"><button class="modal-close icon-button" data-close aria-label="Close instructions">${icon('close')}</button><span class="modal-mark">${leaf}</span><p class="eyebrow">WELCOME TO YOUR GLASSHOUSE</p><h2>A little room<br>to <em>think.</em></h2><p>Play a complete game of chess against the keeper, or share the board with a friend. You play the ivory pieces against the computer.</p><div class="instruction-grid"><div><strong>Choose, then move</strong><p>Select a piece, then one of its marked squares. A ring means you can capture.</p></div><div><strong>Make something grow</strong><p>Every capture plants a flower around the board. Undo a turn and that flower returns to a seed.</p></div><div><strong>Take the scenic route</strong><p>Try a garden study for captures, promotion, or a checkmate in one.</p></div><div><strong>A quieter experience</strong><p>Sound is off until you invite it in. Switch the light or reduce motion at any time.</p></div></div><div class="keyboard-note"><kbd>↑</kbd><kbd>↓</kbd><kbd>←</kbd><kbd>→</kbd> explore · <kbd>Enter</kbd> choose · <kbd>Esc</kbd> release · <kbd>U</kbd> undo</div><button class="primary-button" data-close>Back to the garden ${icon('arrow')}</button></dialog>
  <dialog id="studies-dialog" class="modal studies-modal"><button class="modal-close icon-button" data-close aria-label="Close garden studies">${icon('close')}</button><p class="eyebrow">SMALL MOMENTS. NEW POSSIBILITIES.</p><h2>Garden <em>studies.</em></h2><p>Three little positions to explore. Both sides are yours to move.</p><div class="study-options">${studies.map((s,i)=>`<button data-study="${s.id}"><span class="study-index">0${i+1}</span><span><strong>${s.name}</strong><small>${s.label}</small></span>${icon('arrow')}</button>`).join('')}</div><p class="fine-print">Opening a study replaces the current game.</p></dialog>
  <dialog id="new-game-dialog" class="modal small-modal"><span class="modal-mark">${leaf}</span><p class="eyebrow">A FRESH PATCH OF POSSIBILITY</p><h2>Begin <em>again?</em></h2><p>Your current game and its garden will be cleared.</p><div class="modal-actions"><button class="secondary-button" data-close>Keep playing</button><button class="primary-button" id="confirm-new">Plant a new beginning ${icon('arrow')}</button></div></dialog>
  <dialog id="promotion-dialog" class="modal small-modal"><p class="eyebrow">ROOM TO BECOME</p><h2>A new <em>possibility.</em></h2><p>Choose a piece for your pawn.</p><div class="promotion-options">${['q','r','b','n'].map(p=>`<button data-promotion="${p}" aria-label="Promote to ${PIECE_NAMES[p]}"><span>${glyphs.w[p]}</span>${PIECE_NAMES[p]}</button>`).join('')}</div><button class="text-button" data-close>Choose a different move</button></dialog>
  <dialog id="result-dialog" class="modal result-modal"><button class="modal-close icon-button" data-close aria-label="Close result">${icon('close')}</button><div class="result-flower" aria-hidden="true">✳</div><p class="eyebrow">SOMETHING BEAUTIFUL WAS MADE</p><h2 id="result-title">A garden,<br><em>complete.</em></h2><p id="result-description"></p><div class="result-stats"><div><strong id="result-moves"></strong><span>MOVES PLAYED</span></div><div><strong id="result-blooms"></strong><span>FLOWERS PLANTED</span></div></div><button class="primary-button" id="result-new">Grow another garden ${icon('arrow')}</button><button class="text-button" data-close>Stay a little longer</button></dialog>
`;

const $ = (s) => document.querySelector(s);
const squareButtons = new Map();
const fallbackButtons = new Map();
for (let rank = 8; rank >= 1; rank--) {
  for (const file of 'abcdefgh') {
    const square = `${file}${rank}`;
    const button = document.createElement('button');
    button.className = 'square-hit'; button.dataset.square = square; button.dataset.testid = `square-${square}`;
    button.tabIndex = square === focusedSquare ? 0 : -1;
    button.addEventListener('click',event=>{
      // Raised pieces can project over a neighboring tile. Pointer input must
      // follow the visible 3D surface; keyboard activation names a precise square.
      const target=event.detail>0 ? scene?.pickSquare(event.clientX,event.clientY) ?? square : square;
      selectSquare(target);
    });
    button.addEventListener('keydown',e=>boardKeyboard(e,square));
    button.addEventListener('focus',()=>{ focusedSquare=square; updateSquareFocus(); });
    $('#board-access').append(button); squareButtons.set(square,button);
    const flat = document.createElement('button');
    flat.dataset.square=square;flat.className=`flat-square ${(file.charCodeAt(0)+rank)%2 ? 'light' : 'dark'}`;
    flat.addEventListener('click',()=>selectSquare(square));
    flat.addEventListener('keydown',e=>boardKeyboard(e,square));
    $('#scene-fallback').append(flat);fallbackButtons.set(square,flat);
  }
}

function showToast(message) {
  clearTimeout(toastTimer); $('#toast').textContent=message;$('#toast').classList.add('visible');
  toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3500);
}
function persist() {
  try { localStorage.setItem(SAVE_KEY,JSON.stringify({game:game.serialize(),study:activeStudy?.id ?? null}));$('#saved-note').innerHTML='<span></span> Your game is saved as you play.'; }
  catch { $('#saved-note').textContent='Storage unavailable. Keep this tab open to continue.'; }
}
function savePreferences() { try {localStorage.setItem(PREF_KEY,JSON.stringify(prefs));} catch {} }
function playTone(capture=false) {
  if (!prefs.sound) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();audio.resume();
    const now=audio.currentTime;
    for (const [i,f] of (capture ? [523.25,659.25,783.99] : [392,523.25]).entries()) {
      const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.type='sine';oscillator.frequency.value=f;
      gain.gain.setValueAtTime(0,now+i*.07);gain.gain.linearRampToValueAtTime(.035,now+i*.07+.015);gain.gain.exponentialRampToValueAtTime(.0001,now+i*.07+.75);
      oscillator.connect(gain);gain.connect(audio.destination);oscillator.start(now+i*.07);oscillator.stop(now+i*.07+.8);
    }
  } catch { prefs.sound=false;applyPreferences(); }
}
function cancelComputer() {
  computerEpoch++;clearTimeout(computerTimer);computerTimer=null;worker?.terminate();worker=null;thinking=false;
}
function queueComputer() {
  if (game.mode!=='computer'||game.chess.turn()!=='b'||game.status().over||thinking) return;
  thinking=true;selected=null;render();
  const id=++computerEpoch,fen=game.chess.fen();
  const complete=(move)=>{
    if (id!==computerEpoch||fen!==game.chess.fen()) return;
    worker?.terminate();worker=null;thinking=false;
    if (move) commitMove(move); else {render();showToast('The keeper paused. Undo the turn or begin again.');}
  };
  computerTimer=setTimeout(()=>{
    try {
      worker=new Worker(new URL('./ai.worker.js',import.meta.url),{type:'module'});
      worker.onmessage=({data})=>complete(data.move);
      worker.onerror=()=>complete(chooseComputerMove(fen,game.difficulty));
      worker.postMessage({fen,difficulty:game.difficulty,id});
    } catch {complete(chooseComputerMove(fen,game.difficulty));}
  },prefs.reducedMotion ? 150 : 650);
}
function selectSquare(square) {
  if (thinking) {showToast('The keeper is considering a move.');return;}
  if (game.status().over) {showToast('This garden is complete. Begin a new game to play again.');return;}
  if (game.mode==='computer'&&game.chess.turn()!=='w') return;
  const piece=game.chess.get(square);
  if (selected===square) {selected=null;render();return;}
  if (selected) {
    const legal=game.moves(selected).filter(m=>m.to===square);
    if (legal.length) {
      if (legal.some(m=>m.promotion)) {pendingPromotion={from:selected,to:square};$('#promotion-dialog').showModal();return;}
      commitMove({from:selected,to:square});return;
    }
    if (!piece||piece.color!==game.chess.turn()) {showToast('That square isn’t a legal move. Follow the marked possibilities.');return;}
  }
  if (piece?.color===game.chess.turn()) {selected=square;focusedSquare=square;render();}
  else {selected=null;render();}
}
function commitMove(input) {
  const move=game.move(input);if(!move)return;
  selected=null;pendingPromotion=null;resultDismissed=false;persist();render();playTone(!!move.captured);
  if(move.captured)showToast(`A ${PIECE_NAMES[move.captured]} becomes a flower. ${game.captures().length} growing in your garden.`);
  if(game.status().over) setTimeout(()=>{if(game.status().over&&!resultDismissed&&!$('#result-dialog').open)$('#result-dialog').showModal();},prefs.reducedMotion?0:1100);
  else queueComputer();
}
function undo() {
  cancelComputer();const undone=game.undoTurn();selected=null;pendingPromotion=null;resultDismissed=true;
  if($('#result-dialog').open)$('#result-dialog').close();
  if(!undone.length){showToast('The garden is still at its beginning.');return;}
  persist();render();showToast('A little room to reconsider. Your last turn is undone.');queueComputer();
}
function newGame() {
  cancelComputer();activeStudy=null;selected=null;resultDismissed=false;game.reset();focusedSquare='e2';
  for(const d of document.querySelectorAll('dialog[open]'))d.close();persist();render();showToast('A fresh garden. A world of possibilities.');
}
function boardKeyboard(event,square) {
  const directions={ArrowUp:[0,1],ArrowDown:[0,-1],ArrowLeft:[-1,0],ArrowRight:[1,0]};
  if(directions[event.key]) {
    event.preventDefault();const [dx,dy]=directions[event.key];
    const file=Math.max(0,Math.min(7,square.charCodeAt(0)-97+dx)),rank=Math.max(1,Math.min(8,Number(square[1])+dy));
    focusedSquare=`${String.fromCharCode(97+file)}${rank}`;updateSquareFocus();
    ($('#scene-fallback').hidden?squareButtons:fallbackButtons).get(focusedSquare).focus();
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
    const p=scene.projectSquare(square);if(!p)continue;
    Object.assign(button.style,{left:`${p.x}px`,top:`${p.y}px`,width:`${p.width}px`,height:`${p.height}px`});
    if(p.points?.length)button.style.clipPath=`polygon(${p.points.map(v=>`${((v.x-p.x)/p.width)*100}% ${((v.y-p.y)/p.height)*100}%`).join(',')})`;
  }
}
function render() {
  const status=game.status(),history=game.chess.history({verbose:true}),last=history.at(-1),captures=game.captures();
  const legal=selected?game.moves(selected).map(m=>m.to):[];
  const checkSquare=status.check?game.chess.board().flat().find(p=>p?.type==='k'&&p.color===status.turn)?.square:null;
  scene?.sync({board:game.chess.board(),selected,legal,lastMove:last||null,captures,checkSquare});
  for(const [square,button] of squareButtons){
    const piece=game.chess.get(square),label=`${square}, ${piece?`${piece.color==='w'?'White':'Black'} ${PIECE_NAMES[piece.type]}`:'empty'}${legal.includes(square)?', legal destination':''}`;
    button.setAttribute('aria-label',label);button.setAttribute('aria-pressed',String(selected===square));button.dataset.piece=piece?`${piece.color}${piece.type}`:'';
    const flat=fallbackButtons.get(square);flat.textContent=piece?glyphs[piece.color][piece.type]:'';flat.setAttribute('aria-label',label);flat.classList.toggle('selected',selected===square);flat.classList.toggle('legal',legal.includes(square));flat.tabIndex=square===focusedSquare?0:-1;
  }
  updateSquareFocus();positionSquares();
  const statusText=status.over?status.text:thinking?'The keeper thinks.':status.check?'A little caution.':game.mode==='computer'?'Your move.':`${status.turn==='w'?'Ivory':'Ink'} to move.`;
  $('#game-status').textContent=statusText;
  $('#game-status').dataset.turn=status.turn;$('#game-status').dataset.gameOver=String(status.over);$('#game-status').dataset.thinking=String(thinking);
  $('#turn-token').classList.toggle('ink',status.turn==='b');$('#turn-token').classList.toggle('thinking',thinking);
  $('#turn-description').textContent=status.over?'This chapter is complete. Its garden stays with you.':status.check?`${status.turn==='w'?'White’s':'Black’s'} king is in check. Find a safe move.`:thinking?'A moment of thought, then a possibility.':selected?`${PIECE_NAMES[game.chess.get(selected)?.type] ?? 'Piece'} on ${selected}. Choose a marked square.`:'Choose a piece to see its possibilities.';
  $('#move-counter').textContent=`Move ${String(Number(game.chess.fen().split(' ')[5])).padStart(2,'0')}`;
  $('#undo').disabled=!history.length;$('#export').disabled=!history.length;
  $('#bloom-count').textContent=String(captures.length).padStart(2,'0');
  $('#bloom-display').setAttribute('aria-label',`${captures.length} captured ${captures.length===1?'piece':'pieces'}, ${captures.length} ${captures.length===1?'flower':'flowers'}`);
  $('#bloom-display').innerHTML=captures.length?`<div class="bloom-collection">${captures.map((c,i)=>`<span class="bloom-token bloom-${i%4}" title="${c.color==='w'?'White':'Black'} ${PIECE_NAMES[c.type]} captured" aria-label="${c.color==='w'?'White':'Black'} ${PIECE_NAMES[c.type]} captured">✳</span>`).join('')}</div>`:`<span class="empty-sprout">${leaf}</span><p>A little space for<br>what comes next.</p>`;
  $('#blooms-caption').textContent=captures.length?`${captures.length} ${captures.length===1?'flower':'flowers'}. A garden only this game could grow.`:'A bloom for every captured piece.';
  const rows=[];for(const m of history){const n=Number(m.before.split(' ')[5]);let row=rows.at(-1);if(!row||row.n!==n){row={n,w:'',b:''};rows.push(row);}row[m.color]=m.san;}
  $('#move-history').innerHTML=rows.length?rows.map((row,i)=>`<li${i===rows.length-1?' class="latest"':''}><span class="move-number">${row.n}.</span><span>${row.w||'…'}</span><span>${row.b||'—'}</span></li>`).join(''):'<li class="history-empty">Your story starts with a move.</li>';
  $('#move-history').scrollTop=$('#move-history').scrollHeight;
  for(const b of document.querySelectorAll('[data-mode]'))b.setAttribute('aria-pressed',String(b.dataset.mode===game.mode));
  $('#mode-description').textContent=game.mode==='computer'?'You are ivory. The keeper plays ink.':'One board. Two people. Take turns together.';
  $('#difficulty').value=game.difficulty;$('#difficulty').disabled=game.mode==='local';
  $('#study-banner').hidden=!activeStudy;$('#scene-label').textContent=activeStudy?'A GARDEN STUDY':'THE GLASSHOUSE';
  if(activeStudy){$('#study-name').textContent=activeStudy.name;$('#study-description').textContent=activeStudy.description;}
  $('#result-title').innerHTML=status.checkmate?'A garden,<br><em>complete.</em>':'A peaceful<br><em>ending.</em>';
  $('#result-description').textContent=`${status.text}. Every move left its mark.`;
  $('#result-moves').textContent=history.length;$('#result-blooms').textContent=captures.length;
}
function applyPreferences() {
  document.documentElement.dataset.atmosphere=prefs.atmosphere;
  document.documentElement.classList.toggle('reduced-motion',!!prefs.reducedMotion);
  $('#sound').innerHTML=icon(prefs.sound?'sound':'mute');$('#sound').setAttribute('aria-label',prefs.sound?'Turn sound off':'Turn sound on');$('#sound').setAttribute('aria-pressed',String(!!prefs.sound));
  $('#atmosphere').innerHTML=`${icon(prefs.atmosphere==='day'?'sun':'moon')}<span>${prefs.atmosphere==='day'?'Morning light':'Evening light'}</span>`;
  $('#atmosphere').setAttribute('aria-label',prefs.atmosphere==='day'?'Switch to evening light':'Switch to morning light');
  $('#view').setAttribute('aria-label',prefs.view==='perspective'?'Switch to overhead view':'Switch to perspective view');
  $('#motion').setAttribute('aria-pressed',String(!!prefs.reducedMotion));$('#motion').textContent=prefs.reducedMotion?'Motion reduced':'Gentle motion';
  scene?.setAtmosphere(prefs.atmosphere);scene?.setReducedMotion(!!prefs.reducedMotion);scene?.setView(prefs.view);positionSquares();savePreferences();
}

$('#new-game').onclick=()=>game.chess.history().length?$('#new-game-dialog').showModal():newGame();
$('#confirm-new').onclick=newGame;$('#result-new').onclick=newGame;$('#leave-study').onclick=newGame;
$('#undo').onclick=undo;$('#help').onclick=()=>$('#help-dialog').showModal();$('#studies').onclick=()=>$('#studies-dialog').showModal();
$('#sound').onclick=()=>{prefs.sound=!prefs.sound;applyPreferences();if(prefs.sound)playTone(true);};
$('#atmosphere').onclick=()=>{prefs.atmosphere=prefs.atmosphere==='day'?'dusk':'day';applyPreferences();};
$('#view').onclick=()=>{prefs.view=prefs.view==='perspective'?'overhead':'perspective';applyPreferences();};
$('#motion').onclick=()=>{prefs.reducedMotion=!prefs.reducedMotion;applyPreferences();};
$('#difficulty').onchange=e=>{cancelComputer();game.difficulty=e.target.value;persist();render();queueComputer();};
for(const b of document.querySelectorAll('[data-mode]'))b.onclick=()=>{cancelComputer();game.mode=b.dataset.mode;selected=null;persist();render();queueComputer();};
for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>b.closest('dialog').close();
for(const d of document.querySelectorAll('dialog')){d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}});d.addEventListener('close',()=>{if(d.id==='promotion-dialog')pendingPromotion=null;if(d.id==='result-dialog')resultDismissed=true;});}
for(const b of document.querySelectorAll('[data-study]'))b.onclick=()=>{
  cancelComputer();activeStudy=studies.find(s=>s.id===b.dataset.study);game.reset({fen:activeStudy.fen,mode:'local'});selected=activeStudy.focus;focusedSquare=activeStudy.focus;resultDismissed=false;
  $('#studies-dialog').close();persist();render();showToast(activeStudy.description);
};
for(const b of document.querySelectorAll('[data-promotion]'))b.onclick=()=>{const move=pendingPromotion;if(!move)return;$('#promotion-dialog').close();commitMove({...move,promotion:b.dataset.promotion});};
$('#export').onclick=()=>{
  game.chess.header('Event','The Queen’s Conservatory','White',game.mode==='computer'?'You':'Ivory','Black',game.mode==='computer'?'The keeper':'Ink');
  const url=URL.createObjectURL(new Blob([game.chess.pgn()],{type:'application/x-chess-pgn'}));const a=document.createElement('a');a.href=url;a.download='a-conservatory-game.pgn';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
document.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='u'&&!document.querySelector('dialog[open]')&&!['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)&&!e.ctrlKey&&!e.metaKey){if(!e.defaultPrevented){e.preventDefault();undo();}}});
try {
  scene=createConservatory($('#scene'),{onSquare:selectSquare,reducedMotion:prefs.reducedMotion,onReady:()=>queueMicrotask(()=>{document.querySelector('.scene-loading')?.remove();render();})});
  document.querySelector('.scene-loading')?.remove();
} catch(error) {
  console.warn('Using the accessible flat chess board:',error.message);$('#scene').hidden=true;$('#board-access').hidden=true;$('#scene-fallback').hidden=false;
  showToast('Your browser is using our quiet, flat board. All chess features are available.');
}
const observer=new ResizeObserver(()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{scene?.resize();positionSquares();});});observer.observe($('.game-space'));
applyPreferences();render();queueComputer();
window.addEventListener('pagehide',()=>{persist();cancelComputer();});
window.addEventListener('pageshow',event=>{if(event.persisted){scene?.resize();render();queueComputer();}});
