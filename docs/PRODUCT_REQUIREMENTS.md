# Product requirements: Paperwild

## Intent

Make a child's pencil-page imagination feel inhabited: a hand-wobbled graphite chessboard, uneven colored-pencil shading, informal handwritten notes, and cheerful little doodles on light paper. The woodland cast and living margins should belong to that page. This is a deliberate drawing style; the chess geometry, readable role labels, input targets, motion, audio, and saved games remain dependable.

The active implementation uses `src/main.ts`, `src/game.ts`, `src/sketch-scene.ts`, `src/piece-motion.ts`, `src/character-face.ts`, `src/character-idle.ts`, `src/character-life.ts`, `src/character-portrait.ts`, `src/sketch-margins.ts`, `src/character-voice.ts`, and `src/sound.ts`. The older Three.js scene, wildlife, and atmosphere modules are retained source history, not the active runtime.

## Illustrated world

| Element | Implemented behavior | Acceptance requirement |
| --- | --- | --- |
| Pencil board | Three imperfect graphite passes draw the grid; uneven colored-pencil scribbles shade individual squares. DOM/SVG rendering places transparent characters on the underlying eight-by-eight geometry. | Visual wobble must not change square centers or hit targets. Coordinates, accessible labels, and pointer targets agree after resize; scribbles stay light enough to read the cast and legal marks. |
| Childlike page lettering | Schoolbell/Gloria handwriting, uneven colorful title letters, informal labels, and penciled circles/frames replace the editorial treatment. | Functional text remains legible, controls preserve their semantic names and focus states, and the Sound/help header and dialogs remain usable at 320 px. |
| Light paper and doodles | Lighter paper supports naive sun, star, heart, and daisy marks around the existing margin residents. | Doodles remain decorative and do not intercept input, obscure controls, or reduce board contrast. |
| First-board drawing | The main graphite lines reveal once when the board is first rendered. Reduced motion skips this introduction. | The reveal does not hold the board busy, block the first move, restart during selection renders, or alter chess state. Cancel/settle and resize leave complete grid lines visible. |
| Woodland cast | Pawn = acorn sprite; rook = stump; knight = hare; bishop = moth; queen = fox; king = badger. Twelve watercolor cartoon assets provide Amber/White and Indigo/Black variants, with natural animal colors and distinct club accessories. The 480 px delivery copies share a single source path across the board, portraits, and promotion choices. | Each board image matches its chess role and side; help explains every mapping. |
| Character motion | Acorns walk with articulated painted feet; hares anticipate, leap, and land; moths flap; stumps shuffle; foxes double-pounce; badgers waddle. Drawn shadows, dust, and footprints follow the choreography. | Inspect an intermediate pose as well as the final square. Motion must show the role's gait, agree with its ground contacts, and leave no duplicate sprites, feet, or effects after settling. |
| Idle expressions | All twelve watercolor illustrations have fitted eyelids with staggered single/double blinks. Independent breathing and seeded role gestures start without interaction; all six roles have separately articulated painted appendages. Board sidelines, journal captures, the guide, and promotion choices share living portraits. | Overlays align with the current watercolor artwork at desktop and phone sizes. Board state remains unchanged during autonomous observation; unrelated renders do not recreate journal portraits. Idle articulation yields to movement, promotion changes faces on arrival, loading/fallback keeps intact artwork, and paused/reduced motion leaves eyes open and parts at rest. |
| Turn choreography | The board is busy during a core move/capture sequence; the computer waits for settlement before replying. | A second board move cannot interrupt the first. Undo, a new game, and story replacement can cancel safely; canceled work must not produce a late move, landing cue, or result. |
| Sideline society | Captured characters remain visible off the board and in the journal. | Their number, side, and role match legal capture history. Undo and restore derive the same collection. |
| Margin residents | A tea balloon carried by leaves, a cloud with dangling boots, a cottage-carrying tortoise, and a rabbit/hedgehog tea party inhabit the page. | Decorations leave game controls usable and do not intercept chess input. |
| Ambient life | Birds, a moth, dragonfly, floating leaves, cottage smoke, and tea steam move around the page edges. | The page feels active without obscuring the board or making text difficult to read. |
| Daydream / Moonlight | Warm cream paper changes to pale cool paper with indigo ink and warm small lights. | Labels and saved preferences match the current treatment; contrast remains usable. |
| Rain | A passing shower changes the margin mood and opens the tea-party umbrella. | Weather control label, pressed state, and restored preference agree; chess state is unchanged. |
| Greetings | Say hello cycles through resident reactions and updates a textual observation. | A greeting produces the matching response without committing a move or changing captures. |
| Reduced motion | The initial preference respects the system setting; the user can pause wandering. | Ambient loops stop and active game movement settles without a long gait or capture arc. Chess and opted-in sound remain usable; the computer is not stuck waiting for an omitted animation. |
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
- Restore by validating and replaying the history so undo and repetition remain correct. A study banner is restored only when its starting FEN matches the restored game.
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

Current local evidence: **34 tests pass: 13 engine, 13 sound lifecycle/activity, 5 PCM signal, and 3 motion invariant tests.** Strict TypeScript checking and the production build pass. Sound tests verify unlock, cancellation, mute, hidden-page behavior, refusal handling, activity routing, cooldowns, castling contact preservation, voice limits, and cleanup with mocked Web Audio. PCM tests verify bounded signals and variation across roles, activities, and sample rates; neither assesses subjective audible quality. See [the sound verification record](SOUND_VERIFICATION_2026-10-17.md).

Recorded Chrome checks observed all six active movement profiles, with intermediate hare anticipation/leap and articulated pawn-foot screenshots. Castling moved king and rook together. Undo during a capture removed departures, restored both pawns, and released busy state; a completed capture left one matching sideline image. Promotion retained the moving acorn until arrival, then displayed a knight and the correct draw. The computer began thinking after the human landed, made one legal reply, and returned control after settling. Sound toggle/reload persistence and reduced-motion movement were checked; 320/390 px layouts remained usable; no browser warnings/errors appeared. Audio initialized without availability errors, but its audible character and quality were not listened to or captured. The newest pencil-page visual QA is recorded separately in [VERIFICATION.md](VERIFICATION.md); the existing 24 local tests do not establish that styling's visual quality. The current [TestSprite native audit](TESTSPRITE_CURRENT_RUN_2026-10-17.md) records two partial smoke tests and one invalid exported replay despite three reported passes; full acceptance coverage remains unestablished.

The [historical October 17 native run](TESTSPRITE_RUN_2026-10-17.md) targeted the earlier 3D prototype. Raw 2 passed / 4 failed became all six intended feature scenarios inconclusive after assertion review. It establishes no acceptance coverage for the current UI. The [current TestSprite plan](TESTSPRITE_PLAN.md) is a specification, not an executed suite.

## Submission work

The public source repository is [Davidson3556/Paperwild](https://github.com/Davidson3556/Paperwild), and the public game is [paperwild.vercel.app](https://paperwild.vercel.app/). The [Portal evidence record](TESTSPRITE_PORTAL.md) links the ten-case execution and two corrected-case reruns, with their assertion limits. The GitHub App is restricted to Paperwild and its PR trigger is saved and active. Only the approved PR #2 preview has a public-access exception; other previews remain protected. An actual TestSprite PR execution and comment or status check, plus the hackathon submission, remain pending. Retain real failing assertions, fixes, and successful reruns; do not present a saved trigger or planned cases as executed evidence.
