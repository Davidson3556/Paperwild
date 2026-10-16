# TestSprite acceptance plan

## Execution status

**Portal 3.0 suite creation, execution, and GitHub App integration are pending.** This file is a test specification. It does not claim that TestSprite has run or passed these scenarios.

The separate local engine suite currently passes **13 tests** with `npm test`. Those tests cover game-state integration, not browser layout or end-to-end behavior.

## Target and setup

- Development target: `http://127.0.0.1:4173`, started with `npm run dev`.
- Private preview: `https://queens-conservatory-davidson.sweetbox2.chatgpt.site`.
- Public hackathon target: pending. Use the public URL for the final Portal run so judges can reproduce it.
- Use a clean browser context for independent scenarios. Clear only this application’s storage when a clean start is required.
- Store screenshots, browser console errors, the exact build/commit, target URL, viewport, run link, and assertion failures for each run.
- Use desktop Chromium and at least one mobile viewport. Check another browser for dialog, download, and WebGL compatibility before release.

Do not require a fixed Black move from the computer. Assert legality, turn progression, and bounded completion. Wait for observable state instead of a fixed delay: the computer deliberately pauses briefly and then searches in a worker.

## Reliable targets and assertions

| State or control | Target / observable |
| --- | --- |
| 3D square hit target | `#board-access [data-testid="square-e2"]`, or its accessible name such as `e2, White pawn` |
| Square contents | Main board `data-piece`: `wp`, `bn`, or empty; accessible labels identify the piece in both board modes |
| Selected square | `aria-pressed="true"` on the main square button |
| Legal destination | Accessible name contains `legal destination` |
| Turn and progress | `#game-status` attributes `data-turn`, `data-thinking`, and `data-game-over` |
| Move history | `#move-history` |
| Captures | `#bloom-count` and accessible descriptions inside `#bloom-display` |
| Local/computer mode | `[data-mode="local"]` and `[data-mode="computer"]`, with `aria-pressed` |
| Studies | `#studies`, then `[data-study="bloom"]`, `[data-study="promotion"]`, or `[data-study="mate"]` |
| Promotion choice | `[data-promotion="q"]`, `r`, `b`, or `n` |
| Dialogs | `#promotion-dialog`, `#new-game-dialog`, `#result-dialog`, `#help-dialog` |
| Fallback squares | `#scene-fallback [data-square="e2"]`; use their accessible names for contents |

Each study preselects its starting piece. Verify that selection, then click the destination directly. Clicking the selected source again deselects it. Browser assertions should prefer accessible state; use `data-piece` to verify the exact board when available. Never infer a successful move from an animation alone.

## Priority 0: playable chess and state integrity

### TC-01 — Clean start and legal local opening

1. Start with clean application storage. Open the app and choose **With a friend**.
2. Assert the standard initial position, White to move, no history, `00` flowers, and disabled undo/export.
3. Select e2. Assert e3 and e4 are legal destinations, and e5 is not.
4. Move e2–e4, then e7–e5.
5. Assert e2/e7 are empty; e4 has a White pawn; e5 has a Black pawn; history shows `e4` and `e5`; White is to move; flowers remain `00`.

### TC-02 — Illegal move and wrong-side rejection

1. In a fresh local game, attempt e2–e5.
2. Assert every piece, turn, history entry, and capture count remains unchanged; feedback explains the invalid destination.
3. Attempt to move Black first. Assert no move is committed.
4. After e2–e4, attempt a second White move. Assert Black remains to move and history still contains one ply.

### TC-03 — First bloom study and undo

1. Open Garden studies and choose **The first bloom**.
2. Assert local mode, the study banner, a selected White pawn on e4, and a Black pawn on d5. The initial study position has no recorded captures.
3. Click d5 to play e4×d5.
4. Assert e4 is empty; d5 contains a White pawn; Black is to move; Field notes contains `exd5`; bloom count is `01`; the growing garden identifies a captured Black pawn.
5. Visually verify one flower appears in the surrounding scene without obscuring the board.
6. Undo. Assert both pawns return to e4/d5; history becomes empty; bloom count returns to `00`; White is to move.

### TC-04 — Promotion to queen

1. Open **Room to become**. Assert White pawn a7 is selected.
2. Click a8. Assert the promotion dialog is open, the pawn remains on a7, and all four choices are offered.
3. Choose **queen**.
4. Assert a7 is empty; a8 contains a White queen; history includes promotion to Q; the dialog closes; Black is to move; game-over is false.
5. Undo. Assert the White pawn returns to a7 and the promoted queen disappears.

### TC-05 — Underpromotion to knight and promotion cancellation

1. Reopen **Room to become** and click a8.
2. Cancel with **Choose a different move**. Assert no piece, turn, capture, or history changes.
3. Select a7 if needed, click a8, and choose **knight**.
4. Assert a8 has a White knight and a7 is empty. Assert a draw by insufficient material, with no winning side.
5. Close the result dialog and attempt another move. Assert the terminal position is unchanged.
6. Undo. Assert the pawn returns to a7 and game-over is false.

### TC-06 — Checkmate in one and terminal lock

1. Open **One final move**. Assert the White queen on g6 is selected and White king is on f6.
2. Click g7 to play Qg7#.
3. Assert g6 is empty; g7 has a White queen; status identifies checkmate and White as winner; game-over is true; history includes `Qg7#`.
4. Wait for the result dialog. Assert one recorded ply and zero planted flowers.
5. Close the dialog and attempt another move. Assert no mutation.
6. Undo. Assert queen g6, an unfinished White turn, and no result dialog.

### TC-07 — Computer turn at every difficulty

For Seedling, Gardener, and Wildwood, use a fresh standard computer game:

1. Select the level, play e2–e4, and assert a pending Black turn.
2. Wait until thinking is false and White is to move, allowing a generous 10-second browser timeout.
3. Assert exactly two plies, one legal Black reply, no extra reply, and no browser/worker exception. Cross-check the downloaded PGN by replaying it with chess.js if the test environment supports it.
4. Attempt a White move while thinking. Assert it cannot commit prematurely.

### TC-08 — Undo before and after the computer reply

1. In computer mode, play e2–e4 and immediately undo while Black is pending.
2. Assert the exact initial board, White to move, empty history, and no flowers.
3. Wait beyond the normal reply window. Assert no late computer move appears.
4. Play e2–e4 again; wait for Black’s reply; undo.
5. Assert both plies are removed and the exact initial state is restored.

### TC-09 — Mode changes cancel obsolete computer work

1. Play e2–e4 in computer mode; immediately switch to **With a friend**.
2. Assert Black remains to move and no computer reply arrives. Move a legal Black pawn manually.
3. Switch to computer mode with White to move. Assert no automatic White move.
4. From a local position with Black to move, switch to computer mode. Assert exactly one legal Black reply, then White control.

### TC-10 — New-game confirmation and pending work cancellation

1. Make at least one move and click **Begin a new game**.
2. Assert the confirmation dialog opens. Choose **Keep playing**; assert the game survives.
3. Open again and confirm. Assert standard position, empty history, no flowers, White to move, no study banner, and retained mode/difficulty.
4. Repeat while a Black computer reply is pending. Wait after confirming; assert no stale reply changes the new game.

## Priority 1: persistence, export, accessibility, and fallback

### TC-11 — Resume captures and study after reload

1. Complete the first-bloom capture and change lighting to evening, view to overhead, and motion to reduced.
2. Reload the same origin.
3. Assert White pawn d5, recorded `exd5`, Black to move in local mode, one flower, the matching study banner, and the saved preferences.
4. Undo after reload. Assert the original study position and zero captures.

### TC-12 — Resume a pending computer turn

1. In computer mode play e2–e4 and reload before Black replies.
2. Assert the restored history contains the White move, then exactly one legal Black reply completes the turn.
3. Reload again. Assert no additional Black reply is appended and White remains to move.
4. Undo. Assert both recorded plies are removed.

### TC-13 — Corrupt saves and unavailable storage

1. In an isolated test context, set `queens-conservatory.game.v1` to malformed JSON; reload. Assert a fresh usable game and no uncaught exception.
2. Repeat with parseable data containing an invalid FEN, an illegal history, and a recognized study ID. Assert recovery to a fresh game without a misleading study banner.
3. Simulate storage writes failing in a separate context. Make a legal move. Assert play continues and the saved-note explains that storage is unavailable.
4. Restore normal storage behavior before other scenarios.

### TC-14 — PGN download

1. Assert download is disabled in a game with no history.
2. Play a local opening and click **Download game as PGN**.
3. Capture the download. Assert filename `a-conservatory-game.pgn`, Event and player headers, and the played moves.
4. Repeat with a study promotion. Assert a setup FEN is present for the custom starting position, promotion notation is present, and the PGN replays to the displayed final position.

### TC-15 — Keyboard and dialog control

1. Focus e2. Use arrows to navigate; assert focus stays within board bounds.
2. Press Enter to select a piece and Enter on a legal destination. Assert the move commits once.
3. Press Escape to clear a selection without moving. Press U to undo once.
4. Open help and navigate the native dialog with the keyboard; close it with its button and Escape. Assert background board moves are unavailable while modal.
5. Verify accessible square labels, focus visibility, and announcements for turn, check, invalid moves, and results.

### TC-16 — Preferences and opt-in sound

1. With clean storage, assert the sound control says **Turn sound on** and `aria-pressed` is false. Confirm no sound plays before opting in.
2. Toggle sound on, make a move, and verify audio manually if the runner cannot inspect Web Audio output. Toggle off and verify silence.
3. Toggle evening/morning, overhead/perspective, and reduced/gentle motion. Verify control labels, scene changes, and legal square hit targets after each.
4. Reload and assert settings persist. A clean context with the system reduced-motion preference should initially enable reduced motion.

### TC-17 — WebGL initialization fallback

1. Use a separate browser context that cannot create a WebGL rendering context, then load the app.
2. Assert the flat board is visible, the main board-access overlay is hidden, and feedback explains the fallback.
3. Play a legal local opening and reject an illegal move.
4. Run the capture, promotion, checkmate, undo, reload, and PGN flows using flat-square accessible labels.
5. Assert 3D view/lighting controls do not break flat-board play.

### TC-18 — Narrow screen and resize integrity

1. Test a 390×844 mobile viewport and a 1440×1000 desktop viewport; resize while a piece is selected.
2. Assert the board and all essential controls are usable, dialog actions fit the viewport, and no horizontal page overflow hides a control.
3. In both views, click/tap e2–e4 and use a capture study. Assert hit targets match the visibly chosen squares.
4. Verify that large piece geometry does not cause adjacent-square clicks to select the wrong square and that the journal remains reachable by scrolling.

## Additional chess coverage

The local suite covers castling, en passant, stalemate, repetition restoration, invalid preferences, atomic reset, and computer move legality. Add browser scenarios if Portal can reliably create the necessary legal sequences:

- Castling: local moves e4, e5, Nf3, Nc6, Bc4, Nf6, O-O; verify king g1 and rook f1, then undo and reload.
- En passant: local e4, a6, e5, d5, exd6; verify d5 is empty, the captured piece is a Black pawn, and undo restores it.
- Threefold repetition: local Nf3, Nf6, Ng1, Ng8 twice; verify draw status survives reload and undo reopens play.

Avoid creating a false coverage claim by listing unexecuted browser cases as passing.

## Evidence and release gate

For every TestSprite finding, record the failing assertion, reproduction, root cause, fix commit, and rerun. Separate product defects from browser/runner environment failures. Keep any remaining failures visible.

Before the [Season 4 hackathon](https://www.testsprite.com/hackathon-s4) submission:

1. Publish the repository and deployment; verify access from a fresh, signed-out context.
2. Create the suite in TestSprite Portal 3.0 using these requirements and the actual deployed build.
3. Run and triage the suite. Fix confirmed defects and rerun affected scenarios.
4. Configure the TestSprite GitHub App and demonstrate that a pull request triggers the expected check.
5. Include real Portal run URLs and the demonstrated GitHub check in the submission. Testing has a stated 40% judging weight; the run evidence should show what the assertions verified.

### Run record — fill only after execution

| Item | Actual value |
| --- | --- |
| Public target URL | Pending |
| Public repository / commit | Pending |
| Portal suite link | Pending |
| Portal run link and date | Pending |
| Scenarios passed / failed / blocked | Pending |
| Confirmed product defects and fixes | Pending |
| Remaining limitations | Pending |
| GitHub App check / PR link | Pending |
