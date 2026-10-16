# Product requirements: The Queen’s Conservatory

## Product intent

Create a distinctive, dependable browser chess game whose board sits inside a miniature botanical conservatory. Captures accumulate flowers, giving the player a visible record of the match. The visual treatment should invite a slower, thoughtful game while keeping every piece, destination, turn, and result clear.

This document describes the current implementation in `src/main.js`, `src/game.js`, and `src/scene.js`. Planned submission tasks are identified separately.

## Current product

### Chess and controls

| Capability | Implemented behavior | Acceptance criterion |
| --- | --- | --- |
| Standard chess | Legal moves and turn order are enforced through chess.js. | Illegal moves leave all board, history, and capture state unchanged. |
| Computer opponent | The player controls White; the keeper controls Black. | One legal Black reply follows each unfinished White turn. |
| Difficulty | Seedling, Gardener, and Wildwood map to bounded search depths 1, 2, and 3. | Every selection produces legal moves; changing difficulty cancels an obsolete pending reply. |
| Local play | “With a friend” allows both sides on the same device. | White and Black alternate without an automatic reply. |
| Selection | Click/tap a piece and then a legal destination. | The selected square and legal destinations are indicated; capture targets use rings. |
| Special moves | Castling, en passant, and promotion are supported. | Board, captures, history, persistence, and undo agree after each special move. |
| Promotion | Choose queen, rook, bishop, or knight in a dialog. | The pawn remains unmoved until a choice is made; canceling leaves the position unchanged. |
| Endings | Check, checkmate, stalemate, repetition, insufficient material, and the fifty-move rule are reported. | Terminal positions reject additional moves and identify a winner only for checkmate. |
| Result | A result dialog appears after a completed move ends the game. | The description agrees with the status; the move statistic counts plies and the flower statistic counts captures. |
| Undo | In computer mode undo a White move awaiting a reply, or the completed White/Black pair. In local mode undo one ply. | Undo also restores capture count, available moves, history, and terminal status. Pending computer work cannot reapply an undone move. |
| New game | Starting again clears the board history and garden. A game with history prompts for confirmation from the main new-game button. | Cancel preserves the current game; confirm returns to standard chess and retains the current mode/difficulty. |

Selecting a study replaces the current position and starts local play. The studies dialog explicitly states that it replaces the current game. “Return to a full game” resets directly to a standard position.

### Garden studies

The study’s starting piece is already selected when the study opens.

| Study | Starting position and interaction | Required result |
| --- | --- | --- |
| The first bloom | White pawn e4 captures Black pawn d5. | White pawn on d5; e4 empty; one capture, one flower, and `exd5` in Field notes. |
| Room to become | White pawn a7 advances to a8. | Promotion dialog offers all four pieces. A queen promotes to a playable queen position; a knight produces a draw by insufficient material. |
| One final move | White queen g6 moves to g7, protected by the king on f6. | Checkmate; White wins; no further move is accepted. |

### Scene, preferences, and accessibility

| Capability | Implemented behavior | Acceptance criterion |
| --- | --- | --- |
| Conservatory | A procedurally modeled scene contains ceramic tiles, recognizable porcelain chess pieces, plants, glass, brass, and walnut. | The scene is readable and usable on desktop and narrow mobile screens. |
| Capture garden | Each capture adds one flower to the scene and one token to the growing-garden journal. | Garden count always matches captured-piece history; undo removes the corresponding flower. |
| Lighting | Morning and evening treatments can be toggled. | The controls update their accessible label and retain the chosen setting after reload. |
| View | Perspective and overhead views are available. | Controls and board square targets remain aligned and usable after the view changes or viewport resizes. |
| Motion | Gentle motion can be reduced; the system’s reduced-motion preference is the initial default. | Reduced motion stops scene ambient movement and settles active animations. |
| Sound | Audio is off by default and enabled explicitly. | No sound plays on a clean initial load; the sound button reflects the saved setting. |
| Keyboard | Arrow keys navigate squares; Enter selects; Escape clears selection; U undoes. | Square labels identify coordinates, color, piece, and legal destinations; keyboard interactions produce the same chess state as pointer input. |
| Status | Turn, check, result, and transient feedback are exposed as text and live regions. | Core game state remains understandable without reading the 3D artwork. |
| Flat fallback | If creation of the WebGL scene throws, the app displays a flat Unicode chess board. | Legal play, studies, promotion, undo, persistence, and export continue to work. |

Flower placement and appearance depend on capture order, captured piece type and color, and the capture’s move number. Undo restores the garden derived from the remaining legal history.

### Persistence and export

- Save the complete legal move history, starting FEN, mode, difficulty, and study identifier under `queens-conservatory.game.v1`.
- Save sound, atmosphere, view, and reduced-motion settings under `queens-conservatory.preferences.v1`.
- Restore positions by replaying validated history so repetition and undo remain correct.
- Recover from malformed saved game data with a fresh game. Unavailable storage must not prevent in-tab play; show the storage-unavailable message when a save fails.
- Export a PGN download with the app’s Event, White, and Black headers. Export is disabled before any move.

Saves remain on the same browser and origin. There is no account system, server synchronization, network multiplayer, or cloud storage.

## Quality criteria

1. Every visible interaction must agree with the underlying chess state.
2. A pending computer turn must be canceled safely by undo, restart, study selection, or mode changes.
3. Loading, saving, and restoring must preserve moves, captures, turn, preferences, and game-over state.
4. All three studies must be usable as short, repeatable demonstrations of the product.
5. Essential play must remain accessible with a keyboard and through the flat fallback.
6. Production builds must succeed and local engine tests must pass before release.
7. Browser tests must verify semantic outcomes as well as the displayed interface. A screenshot alone is insufficient evidence of legal chess behavior.

## Validation status

- **Local engine tests:** 13 passing tests via `npm test`.
- **TestSprite native MCP:** six-case run completed; raw 2 passed / 4 failed, with all six feature scenarios inconclusive after assertion audit. See [the audited report](TESTSPRITE_RUN_2026-10-17.md).
- **Dedicated TestSprite Portal 3.0 suite:** configuration and meaningful acceptance validation pending.
- **TestSprite GitHub App:** installation/configuration and pull-request checks pending.
- **Public repository:** pending.
- **Public hackathon deployment:** pending. The current private preview is https://queens-conservatory-davidson.sweetbox2.chatgpt.site.

The [TestSprite plan](TESTSPRITE_PLAN.md) contains the acceptance scenarios and evidence requirements. Do not treat the planned suite as executed coverage.

## Hackathon submission checklist

The [official Season 4 brief](https://www.testsprite.com/hackathon-s4) calls for a public repository, a public playable URL, a TestSprite Portal 3.0 suite, and the TestSprite GitHub App running checks on every pull request. The stated judging weights are **40% product quality, 40% testing, and 20% innovation**.

The listed deadline is **October 22, 2026 at 11:59 PM Pacific Time**. Confirm the final schedule and submission instructions in the event Discord before submitting. Add the final submission links to the repository once available.

Submission evidence still to produce:

- Public source and deployment links that judges can open.
- A real TestSprite run with clear assertions, recorded findings, fixes, and rerun results.
- A pull request demonstrating the configured GitHub App check.
- A short demo covering the first bloom, a full turn against the keeper, promotion, checkmate, undo, and saved-game restoration.
