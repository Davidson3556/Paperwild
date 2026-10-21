# Product requirements: Paperwild

## Intent

Make a child's pencil-page imagination feel inhabited: a hand-wobbled graphite chessboard, uneven colored-pencil shading, informal handwritten notes, and cheerful little doodles on light paper. The woodland cast and living margins should belong to that page. This is a deliberate drawing style; the chess geometry, readable role labels, input targets, motion, audio, and saved games remain dependable.

The active implementation uses `index.html`, `src/loading-screen.ts`, `src/main.ts`, `src/game.ts`, `src/sketch-scene.ts`, `src/piece-motion.ts`, the character modules, `src/capture-pageant.ts`, `src/field-camp.ts`, and `src/sound.ts`. The older Three.js renderer is retained source history, not the active runtime.

## Notebook entry and returning players

- Show the illustrated notebook immediately while the watercolor cast, paper, and fonts load. Its lettering, acorn, and progress ribbon must remain readable with normal motion, OS reduced motion, and a saved manual pause. Asset failures must release loading rather than strand the page.
- With motion enabled, retain the full cover sketch, ready hop, band snap, cover/page opening, and transition into the game on repeat visits too. A warm cache may shorten resource waiting; it must not replace the choreography with an accelerated version.
- Once the loader reveals the page, draw the pencil grid and unfold the residents row by row. Capture intermediate evidence of the visible grid reveal and character pop-up; running these behind the opaque loader does not satisfy the requirement. Selection/status updates must not restart the introduction.
- Provide a keyboard-operable **Skip introduction** control. During loading it requests opening as soon as resources are ready; during opening it skips the remaining cover sequence. Visible pencil drawing and resident pop-up then follow normally, completing before play. Remove the overlay, release inert input, and leave the saved chess position unchanged. Reduced motion uses a readable static entry without cover spins or folded residents.
- Do not begin a restored computer turn until the whole page entry has settled, including after skipping the cover. An unfinished saved game retains its exact history, mode, difficulty, captures, and matching study. A saved game or study that is already over opens a fresh standard game on the next load, keeping valid preferences and mode/difficulty; it must not reopen a terminal study or its result dialog automatically. Preserve the finished history and study separately for explicit revisiting.
- **Pause animations / Resume animations** names the action explicitly. Pausing leaves eyes open, painted parts at rest, and a usable board; resuming restores actual blinking and autonomous movement. A saved manual pause must survive reload independently of the OS setting. Sound remains an independent preference.

## Illustrated world

| Element | Implemented behavior | Acceptance requirement |
| --- | --- | --- |
| Pencil board | Three imperfect graphite passes draw the grid; uneven colored-pencil scribbles shade individual squares. DOM/SVG rendering places transparent characters on the underlying eight-by-eight geometry. | Visual wobble must not change square centers or hit targets. Coordinates, accessible labels, and pointer targets agree after resize; scribbles stay light enough to read the cast and legal marks. |
| Childlike page lettering | Schoolbell/Gloria handwriting, uneven colorful title letters, informal labels, and penciled circles/frames replace the editorial treatment. | Functional text remains legible, controls preserve their semantic names and focus states, and the Sound/help header and dialogs remain usable at 320 px. |
| Light paper and doodles | Lighter paper supports naive sun, star, heart, and daisy marks around the existing margin residents. | Doodles remain decorative and do not intercept input, obscure controls, or reduce board contrast. |
| First-board drawing | Main graphite lines reveal once after the notebook gives way to the visible board, followed by the residents' pop-up. Reduced motion settles it directly. | Intermediate drawing and pop-up poses are visible to the player. Introduction settles before a computer reply; it does not restart on selection, change chess state, or leave incomplete lines/folded residents after skip, pause, or resize. |
| Woodland cast | Pawn = acorn sprite; rook = stump; knight = hare; bishop = moth; queen = fox; king = badger. Twelve watercolor cartoon assets provide Amber/White and Indigo/Black variants, with natural animal colors and distinct club accessories. The 480 px delivery copies share a single source path across the board, portraits, and promotion choices. | Each board image matches its chess role and side; help explains every mapping. |
| Character motion | Acorns walk with articulated painted feet; hares anticipate, leap, and land; moths flap; stumps shuffle; foxes double-pounce; badgers waddle. Drawn shadows, dust, and footprints follow the choreography. | Inspect an intermediate pose as well as the final square. Motion must show the role's gait, agree with its ground contacts, and leave no duplicate sprites, feet, or effects after settling. |
| Idle expressions | All twelve watercolor illustrations have fitted eyelids with staggered single/double blinks. Independent breathing and seeded role gestures start without interaction; all six roles have separately articulated painted appendages. Board sidelines, journal captures, the guide, and promotion choices share living portraits. | Overlays align with the current watercolor artwork at desktop and phone sizes. Board state remains unchanged during autonomous observation; unrelated renders do not recreate journal portraits. Idle articulation yields to movement, promotion changes faces on arrival, loading/fallback keeps intact artwork, and paused/reduced motion leaves eyes open and parts at rest. |
| Turn choreography | The board is busy during a core move/capture sequence; the computer waits for settlement before replying. | A second board move cannot interrupt the first. Undo, a new game, and story replacement can cancel safely; canceled work must not produce a late move, landing cue, or result. |
| Sideline society | Captured characters remain visible off the board and in the journal. | Their number, side, and role match legal capture history. Undo and restore derive the same collection. |
| Field camp and remembrance | A leaf-tent kettle, beetle post, mushroom radio, and queued capture ceremonies occupy the notebook's margins. Captured residents have named stories and remembrance cards with a PNG export. | Visits respond without changing chess. Counts and identities follow legal capture history. The clearing and board stay in one viewport; controls and dialogs remain reachable. Undo/reset removes obsolete ceremonies and memorials. |
| Ambient life | Residents blink, breathe, and gesture without pointer input; the camp and page edges carry decorative motion. | Observe real changes over time, not just declared animation names. Life must not obscure chess, intercept controls, or change the board/history/turn/captures. |
| Daydream / Moonlight | Warm cream paper changes to pale cool paper with indigo ink and warm small lights. | Labels and saved preferences match the current treatment; contrast remains usable. |
| Rain | A passing shower changes the margin mood and opens the tea-party umbrella. | Weather control label, pressed state, and restored preference agree; chess state is unchanged. |
| Greetings | Say hello cycles through resident reactions and updates a textual observation. | A greeting produces the matching response without committing a move or changing captures. |
| Reduced motion | The initial preference respects the system setting; Pause animations / Resume animations remembers the user's choice. | Ambient loops stop with open eyes and neutral parts; active movement settles without a long gait or capture arc. The loader stays fully drawn/readable after a saved manual pause. Resume restores temporal life; chess and opted-in sound remain usable. |
| Hidden page | CSS and tracked Web Animations pause when the page is hidden. | Returning does not duplicate animations, moves, or capture reactions. |
| Asset failure | A character whose image cannot load has a conventional chess-symbol fallback. | The position stays readable and playable even if a PNG fails. |

Artwork provenance and exact generation prompts are in [ART_PROMPTS.md](ART_PROMPTS.md) and [WATERCOLOR_ART.md](WATERCOLOR_ART.md).

The pencil-page revision changes presentation only. Piece roles, square geometry, semantic input, move choreography, procedural audio, storage keys, and chess behavior retain their existing contracts.

## Chess and controls

| Capability | Implemented behavior | Acceptance requirement |
| --- | --- | --- |
| Standard chess | chess.js enforces legal moves, turns, check, and endings. | Illegal and wrong-side moves leave board, history, and captures unchanged. |
| Against the club | The player controls Amber/White; the computer controls Indigo/Black. | Exactly one legal Black reply follows an unfinished White turn. |
| Difficulty | Sleepy, Thoughtful, and Mischievous use bounded search depths 1, 2, and 3. | All produce legal responses within the browser timeout; no fixed response or Elo is promised. |
| With a friend | Two people alternate on one device. | No automatic reply is made in local mode. |
| Selection | Choose a piece, then a marked legal destination. | Selected and legal states agree with the rules engine and accessible labels. |
| Special moves | Castling, en passant, and four promotion choices are supported. | Board images, history, captures, save, and undo agree after each move. |
| Promotion | Queen, rook, bishop, and knight are chosen in a dialog. | No move commits before a choice; cancellation preserves the position. The promoted image matches its new role. |
| Endings | Checkmate, stalemate, repetition, insufficient material, and fifty-move draws are recognized. | Terminal moves are rejected; only checkmate declares a winner. |
| Result | A result dialog reports the ending, recorded plies, and captured friends. | Dialog and status agree with the actual history. |
| Undo | Local mode removes one ply; computer mode removes a pending White move or the completed White/Black pair. | Board, history, side to move, captures, and terminal status restore atomically. Canceled computer work cannot reapply an undone move. |
| A fresh page | The accessible name is Begin a new game. A game with history asks for confirmation. | Cancel preserves the game; confirm clears history and sidelines, keeps mode/difficulty, and cancels obsolete work. |
| Keyboard | Arrows explore squares; Enter chooses; Escape clears selection; U undoes. | Each interaction commits at most one move and retains a visible focus indicator. |
| Sound | A visible Sound off/on button controls remembered opt-in. Six procedural cartoon voices change expression with activity; paper, wood, paw, wing, and pluck Foley accompanies movement contacts and controls. Guide auditions explicitly enable sound; quiet idle calls follow autonomous gestures with global/per-role cooldowns. | A fresh or restored page is silent until a trusted input unlocks audio. Cues match successful actions and contact timing, with no duplicate landing/end cues on rerender, restore, or canceled promotion. Mute and page hiding stop current and scheduled voices immediately. |

## Little chess stories

Opening a story replaces the current position and uses local mode. Its starting piece is selected. The dialog discloses replacement; Return to a full game resets directly to the standard position.

| Story | Interaction | Required result |
| --- | --- | --- |
| Tea on the sidelines | White pawn e4 captures Black pawn d5. | White acorn at d5; e4 empty; `exd5` in Field notes; one captured Black acorn in the society. Undo restores both pawns and no recorded captures. |
| Room to become | White pawn a7 advances to a8; choose a role. | The chosen role and image replace the pawn. A knight produces an insufficient-material draw; a queen leaves a playable position. Cancel commits nothing. |
| One final move | White queen g6 moves to g7, protected by king f6. | `Qg7#`, White wins, and additional moves are blocked. Undo restores the fox on g6 and an unfinished game. |

## Persistence and export

- Store starting FEN, complete move history, mode, difficulty, and study identifier in `queens-conservatory.game.v1`. The legacy key preserves compatible local games from the earlier prototype.
- Store sound, atmosphere, weather, motion, and the retained compatibility view setting in `queens-conservatory.preferences.v1`. The active board is flat; the view control is hidden.
- Validate and replay saved history. Restore an **unfinished** game so undo and repetition remain correct; a study banner returns only when its starting FEN matches. If the replayed game is **complete** (including a terminal study), preserve its validated game/study in `queens-conservatory.completed-game.v1`, then show a fresh standard position with empty history/captures and no study/result, retaining valid mode/difficulty and preferences. This is page-entry policy; in-session Undo still restores the position before a terminal move.
- **Field kit → Revisit last finished game** appears only when a valid archive exists and the current board is the untouched standard start with no active study. Explicit revisiting restores the completed history, captures, matching study and remembrance without replaying the finale/result automatically. Hide and guard this action once another game has begun or a study is active. If archive storage fails, keep the original completed save rather than overwrite its only copy during automatic startup; normal play stays available, and an explicit new chapter can replace the active save.
- Recover from malformed saves with a usable fresh game. Failed storage writes must not prevent play; show the unavailable-storage state.
- Export PGN as `paperwild-game.pgn`, including the Paperwild event, player headers, moves, and setup FEN where needed. Export is disabled before a move.

Saves remain local to the same browser and origin. There are no accounts, network multiplayer, or cloud synchronization.

## Sound and movement lifecycle

- The rules engine commits a legal move once. Its finite movement/capture sequence then owns the board's busy state; selection/status rerenders must not restart or truncate it.
- Movement plans provide contact times to the sound score. Launch/contact and arrival sounds must follow the same choreography, rather than unrelated timers.
- Promotion remains uncommitted until the choice is made. A settled promotion, check, or terminal move receives its appropriate feedback once; render and reload are silent state reconstruction.
- Undo, restart, mode changes, and story replacement invalidate pending feedback as well as obsolete computer work. Intentional cancellation must settle the displayed board and release waiting tasks.
- Sound uses browser-generated sources, a bounded voice pool, and a master mute. It needs no external audio assets or backend. A refused resume or unsupported audio must leave chess usable without an uncaught rejection.
- An enabled saved preference does not authorize page-load autoplay. After hiding, sound requires a fresh trusted interaction and must not replay stale cues.
- Reduced motion and sound are independent preferences. A static board can still provide concise feedback after the player opts into sound.

## Quality and evidence

1. Visible characters, square labels, history, turn, captures, and the rules engine must describe the same position.
2. Undo, restart, study selection, and mode/difficulty changes must safely cancel obsolete computer work.
3. Motion must stay decorative: reduced motion, image loading failure, hidden-page transitions, and resize must preserve play.
4. Test assertions must check complete feature outcomes. A screenshot, nonempty URL, or successful button click alone does not prove correct chess.
5. Build and strict type checking must succeed; local engine tests must pass before release.

The merged release `e891906` contains source head `5867e28`, which passed **82 local tests**, strict TypeScript, and the production build. Its [automatic Portal execution](https://www.testsprite.com/dashboard-v3/o/davidson-awokoyas-workspace-f7454a95/projects/dafdf75c-04a3-467f-acc2-4359af6b1d8e/execution/ce0df644-76de-4cf3-a579-c95dd4cb55a5) and [diagnostic retry](https://www.testsprite.com/dashboard-v3/o/davidson-awokoyas-workspace-f7454a95/projects/dafdf75c-04a3-467f-acc2-4359af6b1d8e/execution/f7a5bf72-766a-4f8d-b926-f050c5e30515) each reported **10 passed / 0 failed / 0 blocked** against that PR preview. These are two runs of the same ten cases, not twenty unique cases. They did not assert notebook presentation, temporal idle animation, or completed-game reload behavior.

The October 21 startup correction passes **94/94 local tests**, strict TypeScript and production build (`index-Dg2nj_lq.js`). Direct checks of that build verified all nine paused-loader title letters visible, sampled cover drawing complete, keyboard skip, a completed Qg7# study reloading into a fresh 32-piece unfinished game, and explicit revisit restoring the terminal study/history without replaying a finale. The visible pencil drawing and resident pop-up were observed during development. See [STARTUP_VERIFICATION_2026-10-21.md](STARTUP_VERIFICATION_2026-10-21.md) for evidence and limits. The fix is local until its new PR is merged/deployed; the expanded Portal cases have not yet run on it. Earlier [native](TESTSPRITE_ADDITIONS_RUN_2026-10-19.md), [visual](VERIFICATION.md), and [sound](SOUND_VERIFICATION_2026-10-17.md) reports retain their own builds and limits. Functional passes alone do not establish complete visual or physical sound quality.

## Submission work

The public source repository is [Davidson3556/Paperwild](https://github.com/Davidson3556/Paperwild), and the public game is [paperwild.vercel.app](https://paperwild.vercel.app/). PR #3 was merged; source head `5867e28` has successful automatic Portal execution evidence. Earlier billing/access failures in the [Portal history](TESTSPRITE_PORTAL.md) are historical. The expanded [Portal plan](testsprite/portal-plan.yaml) is saved with 14 definitions, including NOTE-001–004; this is not a 14-case passing result. Verify the revised PRD attachment, then execute the new substantive assertions against the corrected build. Repository edits alone do not update the Portal project. Final hackathon submission remains separate.
