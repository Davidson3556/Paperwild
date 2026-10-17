# Product requirements: The Marginwood Club

## Intent

Make a chess sketchbook feel inhabited. The game is a clear, usable flat board; the original pencil-and-wash woodland cast and the life in the page margins make it distinctive. Motion should suggest small creatures with their own habits while preserving readable squares, conventional chess roles, and dependable rules.

The active implementation uses `src/main.ts`, `src/game.ts`, `src/sketch-scene.ts`, and `src/sketch-margins.ts`. The older Three.js scene, wildlife, and atmosphere modules are retained source history, not the active runtime.

## Illustrated world

| Element | Implemented behavior | Acceptance requirement |
| --- | --- | --- |
| Flat sketchbook board | DOM/SVG rendering places transparent character images on an eight-by-eight board. | Visible squares, pointer targets, coordinates, and accessible labels agree after resize. |
| Woodland cast | Pawn = acorn sprite; rook = stump; knight = hare; bishop = moth; queen = fox; king = badger. Twelve assets provide Amber/White and Indigo/Black variants. | Each board image matches its chess role and side; help explains every mapping. |
| Character motion | Idle gestures and move styles differ by role; captured characters arc toward the sidelines. | Movement never changes the legal outcome, hides the chosen destination, or leaves duplicate pieces after settling. |
| Sideline society | Captured characters remain visible off the board and in the journal. | Their number, side, and role match legal capture history. Undo and restore derive the same collection. |
| Margin residents | A tea balloon carried by leaves, a cloud with dangling boots, a cottage-carrying tortoise, and a rabbit/hedgehog tea party inhabit the page. | Decorations leave game controls usable and do not intercept chess input. |
| Ambient life | Birds, a moth, dragonfly, floating leaves, cottage smoke, and tea steam move around the page edges. | The page feels active without obscuring the board or making text difficult to read. |
| Daydream / Moonlight | Warm cream paper changes to pale cool paper with indigo ink and warm small lights. | Labels and saved preferences match the current treatment; contrast remains usable. |
| Rain | A passing shower changes the margin mood and opens the tea-party umbrella. | Weather control label, pressed state, and restored preference agree; chess state is unchanged. |
| Greetings | Say hello cycles through resident reactions and updates a textual observation. | A greeting produces the matching response without committing a move or changing captures. |
| Reduced motion | The initial preference respects the system setting; the user can pause wandering. | Ambient loops stop and active game movement settles. Keyboard and pointer chess continue to work. |
| Hidden page | CSS and tracked Web Animations pause when the page is hidden. | Returning does not duplicate animations, moves, or capture reactions. |
| Asset failure | A character whose image cannot load has a conventional chess-symbol fallback. | The position stays readable and playable even if a PNG fails. |

Artwork provenance and exact generation prompts are in [ART_PROMPTS.md](ART_PROMPTS.md).

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
| Sound | Audio begins off and requires opt-in. | The control and saved setting agree; a clean load is silent. |

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
- Export PGN as `a-marginwood-game.pgn`, including The Marginwood Club event, player headers, moves, and setup FEN where needed. Export is disabled before a move.

Saves remain local to the same browser and origin. There are no accounts, network multiplayer, or cloud synchronization.

## Quality and evidence

1. Visible characters, square labels, history, turn, captures, and the rules engine must describe the same position.
2. Undo, restart, study selection, and mode/difficulty changes must safely cancel obsolete computer work.
3. Motion must stay decorative: reduced motion, image loading failure, hidden-page transitions, and resize must preserve play.
4. Test assertions must check complete feature outcomes. A screenshot, nonempty URL, or successful button click alone does not prove correct chess.
5. Build and strict type checking must succeed; local engine tests must pass before release.

Current evidence: **13 local engine tests pass, and strict TypeScript checking passes.** Build and browser observations are recorded separately in [VERIFICATION.md](VERIFICATION.md). No TestSprite cloud run has yet targeted the illustrated Marginwood interface.

The [historical October 17 native run](TESTSPRITE_RUN_2026-10-17.md) targeted the earlier 3D prototype. Raw 2 passed / 4 failed became all six intended feature scenarios inconclusive after assertion review. It establishes no acceptance coverage for the current UI. The [current TestSprite plan](TESTSPRITE_PLAN.md) is a specification, not an executed suite.

## Submission work

The current private preview address remains https://queens-conservatory-davidson.sweetbox2.chatgpt.site. Public source and deployment, a meaningful TestSprite Portal 3.0 suite, a demonstrated GitHub App pull-request check, and the actual hackathon submission remain pending. Retain real failing assertions, fixes, and successful reruns; do not present planned cases as passing evidence.
