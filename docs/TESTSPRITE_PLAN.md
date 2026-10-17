# TestSprite acceptance plan: The Marginwood Club

## Execution status

**This is the acceptance specification for the illustrated DOM/SVG interface. It has not been cloud-executed.** The current local engine suite passes 13 tests and strict TypeScript checking passes. Actual build and manual browser observations belong in [VERIFICATION.md](VERIFICATION.md), not in this planned suite.

The [historical native run](TESTSPRITE_RUN_2026-10-17.md) targeted the earlier 3D prototype. Its raw result was 2 passed / 4 failed, but all six intended gameplay scenarios were inconclusive after auditing the generated assertions. It is retained as historical evidence, not coverage of Marginwood. TestSprite Portal 3.0 validation and GitHub App integration remain pending.

## Targets and evidence

- Local development: `http://127.0.0.1:4173`, using `npm run dev`.
- Private preview: `https://queens-conservatory-davidson.sweetbox2.chatgpt.site`; its address retains the prototype name.
- Public hackathon target and repository: pending. Use the public deployment for final Portal execution.
- Record the exact commit/build, URL, viewport, browser, run link, assertions, console errors, and screenshots. Preserve failed assertions and rerun evidence.
- Use an isolated browser context for independent cases. Clear only this app’s storage when a clean start is required.
- Exercise desktop and mobile. Wait for observable game state and settled animation, not a fixed computer response or a screenshot alone.
- Before running generated tests, verify they contain every required board/history/capture assertion. A nonempty URL is not an acceptance assertion.

## Semantic targets

| Item | Target and assertion |
| --- | --- |
| Square | `#board-access [data-testid="square-e2"]`; accessible name includes coordinate, conventional role, and side. |
| Contents | Square `data-piece` is `wp`, `bn`, or empty. Use all 64 values when verifying exact preservation/reset. |
| Selection / destinations | Source `aria-pressed="true"`; destination accessible name contains `legal destination`. |
| Role artwork | Active board `.sketch-piece` images use the role/side asset `/art/pieces/{w\|b}{p\|r\|n\|b\|q\|k}.png`. Match the current square and verify image decoding; distinguish these from captured images. |
| Turn / terminal state | `#game-status` exposes `data-turn`, `data-thinking`, and `data-game-over`. |
| History | `#move-history` contains the expected SAN in order. |
| Captures | `#bloom-count` and `#bloom-display` retain legacy IDs; they now describe captured characters in The sideline society, not flowers. Captured images have conventional-role alt text. |
| Modes | `[data-mode="computer"]` / `[data-mode="local"]`, with `aria-pressed`. |
| New game | Accessible name Begin a new game; visible text A fresh page. |
| Stories | Accessible name Explore the chess studies; visible text Little chess stories; then `[data-study="bloom"]`, `promotion`, or `mate`. |
| Promotion | `#promotion-dialog`; choices `[data-promotion="q"]`, `r`, `b`, `n`. |
| Weather / light / motion | `#weather`, `#atmosphere`, `#motion`; check the label/pressed state and saved preference. |

Each story preselects its starting piece. Assert that state, then activate its destination directly. Clicking the selected source again deselects it. Use semantic button activation or keyboard Enter; character animation must not determine which square a test means to choose.

## Priority 0: chess integrity and illustrated roles

### MC-01 — Clean start, complete cast, and local opening

1. Clean storage, load, choose With a friend.
2. Assert all 64 square states match the standard position; White/Amber to move; empty history; zero captured characters; disabled undo/export.
3. Assert all six roles use the right Amber and Indigo images, with no failed image requests. Open Who’s who in the club? and confirm pawn/acorn, rook/stump, knight/hare, bishop/moth, queen/fox, king/badger mappings.
4. Select e2; verify e3/e4 are legal and e5 is not. Commit e4, then e5.
5. Assert source squares empty, correct pawns on e4/e5, exactly two history plies, White to move, and zero captures. Verify images settle on those same squares.

### MC-02 — Illegal and wrong-side moves are atomic

1. Snapshot all square values, history, captures, and turn.
2. Attempt e2–e5 and moving Black before White. Assert no changes to the snapshot and no sideline character appears.
3. Play e4; attempt another White move. Assert Black still has the turn and only one ply exists.

### MC-03 — Hare hop, capture departure, and undo

1. From a fresh local game play g1–f3. Assert the White knight/hare moves exactly once and g1 becomes empty. Manually inspect its hop and settled silhouette.
2. Open Tea on the sidelines. Verify selected White pawn e4, Black pawn d5, local mode, empty recorded history, zero captured characters.
3. Activate d5. Assert White pawn at d5, e4 empty, Black to move, `exd5`, capture count one, and one captured Black pawn/acorn image in the society.
4. Manually inspect the departure arc and margin reaction. The effect must not add chess pieces or duplicate the captured character.
5. Undo; assert both pawns restored, empty history, zero captured characters, and no stale departing image after settling.

### MC-04 — Queen promotion and image replacement

1. Open Room to become; verify selected White pawn a7. Activate a8.
2. Assert four promotion choices; pawn still on a7; a8 empty; no history committed yet.
3. Choose queen. Assert White queen/fox image on a8, no pawn there, promotion SAN, Black to move, dialog closed, and game unfinished.
4. Undo; verify the pawn/acorn returns to a7 and the fox disappears.

### MC-05 — Promotion cancellation and knight draw

1. Open the promotion dialog and choose Choose a different move. Compare the full position/history/capture snapshot with the pre-dialog state.
2. Promote to knight. Assert White knight/hare on a8, a7 empty, insufficient-material draw, no winner, and game-over true.
3. Dismiss the result and attempt a move; assert terminal state unchanged. Undo and verify the original pawn and unfinished game.
4. Run separate queen, rook, bishop, and knight choices; each must use the matching fox, stump, moth, or hare image.

### MC-06 — Checkmate, result, and terminal lock

1. Open One final move; verify selected queen g6 and king f6. Activate g7.
2. Assert queen/fox on g7, g6 empty, `Qg7#`, White winner, game-over true, and result dialog with one recorded ply/zero captures.
3. Dismiss and attempt another move; assert no mutation. Undo; verify queen g6, White turn, unfinished game, and no remaining result dialog.

### MC-07 — Castling moves king and rook together

1. In local mode play e4, e5, Nf3, Nc6, Bc4, Nf6, O-O.
2. Assert White king/badger g1 and rook/stump f1; e1/h1 empty; SAN O-O; correct turn; no capture.
3. Reload and reassert those contents and images. Undo; assert king e1 and rook h1 restored together.

### MC-08 — En passant removes the correct pawn

1. In local mode play e4, a6, e5, d5, exd6.
2. Assert White pawn/acorn d6; e5 and d5 empty; `exd6`; one captured Black pawn/acorn; correct turn.
3. Undo; assert White pawn e5 and Black pawn d5, with no captures. Reload and reassert the restored history.

### MC-09 — Computer response at every level

For Sleepy, Thoughtful, and Mischievous, use a fresh Against the club game:

1. Play e4; observe pending Black turn. Attempt a premature White move and confirm it is rejected.
2. Wait until thinking is false and White is to move, using a 10-second timeout.
3. Assert exactly two legal plies, one Black reply, matching images, and no worker exception. Do not require a particular Black move.
4. Export/replay the PGN when supported; it must reach the displayed position.

### MC-10 — Undo, mode, restart, and obsolete computer work

1. Play e4 against the computer and immediately undo. Assert the exact initial state, then wait beyond the normal reply window; no late move may appear.
2. Play e4, wait for its reply, then undo. Assert both plies removed.
3. Play e4 and immediately switch to With a friend. Assert no automatic Black move; move Black manually. Switching back with White to move must not create a White computer move.
4. Start a game with history, choose A fresh page, then Keep playing. Assert preservation. Confirm a fresh page instead; assert standard position, no captures/story, retained mode/difficulty, and no stale reply.

## Priority 1: saves, access, and the living page

### MC-11 — Reload restores story, sidelines, and preferences

1. Make the Tea on the sidelines capture; select Moonlight, rain, and paused motion.
2. Reload. Assert pawn d5, `exd5`, one captured Black acorn, local Black turn, correct story banner, and all chosen preferences.
3. Undo after reload; assert both original pawns and empty captures/history. Restoration must not replay a capture burst as a new event.

### MC-12 — Pending reply, repetition, and invalid saves

1. Reload during a pending computer reply. Assert the restored White move gets exactly one legal Black reply. Reload again; no extra reply may be appended.
2. In local mode repeat Nf3, Nf6, Ng1, Ng8 twice; assert repetition draw survives reload. Undo must reopen play.
3. In isolated contexts, test malformed JSON, invalid FEN, illegal history, and mismatched story metadata. Assert recovery to a usable fresh game without a false story banner.
4. Simulate storage writes failing. Legal play must continue and the saved-note must report unavailable storage.

### MC-13 — PGN download is the game shown

1. Assert export disabled with empty history. Make a local opening and capture the download.
2. Assert filename `a-marginwood-game.pgn`, Event The Marginwood Club, player headers, and exact moves. Replay to the displayed position.
3. Repeat with a promotion story; assert setup FEN and promotion SAN, then replay to the same final board.

### MC-14 — Keyboard, dialogs, and role-independent access

1. Focus e2, navigate with arrows, select with Enter, and commit a legal move with Enter. Assert exactly one ply and correct focus/selection state.
2. Escape clears selection without moving; U undoes exactly once. Focus remains visible against both paper treatments.
3. Verify every square announces coordinate, conventional role/side, and legal-destination state. A player must not need to recognize the illustrated species to know the chess role.
4. Open help/promotion/new-game dialogs by keyboard; check focus containment, close controls, and Escape. Modal input must not move the background board.

### MC-15 — World controls leave chess unchanged

1. Snapshot board/history/captures/turn. Cycle Say hello through four observations; assert each text changes and the snapshot remains identical. Manually inspect balloon, tortoise, moth, and tea-party greetings.
2. Toggle A little rain / Clear skies and Daydream / Moonlight. Assert accessible labels, weather pressed state, document treatment, saved preferences, and unchanged chess state.
3. Manually inspect cloud rain, tea umbrella, paper/ink contrast, stars, and warm fireflies. Decorations must not block text or square targets.
4. Confirm sound starts off in a clean context; opt in/out and check its saved state. Assess audible output manually if the runner cannot inspect it.

### MC-16 — Reduced motion and hidden-page lifecycle

1. Start with system reduced motion; assert paused initial setting. Confirm consecutive settled frames have no ambient wandering, idle movement, or long move/capture arc.
2. Make a legal move/capture while paused; assert correct final board/sidelines and usable keyboard input.
3. Enable movement and manually inspect resumed life. Hide the page during an animation, then return; assert no duplicate pieces, moves, or captured characters.
4. Confirm reduced-motion preference survives reload. No ongoing JavaScript frame loop should be needed for the margin’s CSS decorations.

### MC-17 — Missing image and mobile integrity

1. Block one character PNG in a separate context. Assert its chess-symbol fallback appears; square role/side remains available; a legal move still works.
2. At 390×844 and 1440×1000, assert no horizontal overflow, usable board/control targets, reachable journal, and dialogs that fit.
3. Resize with a selection active, then move and capture. Assert visible cells and semantic targets agree. Check that mobile margin art stays clear of essential controls.

## Release evidence

Before calling the illustrated UI cloud-validated, run these cases with their substantive assertions against the exact current build. For each failure, retain reproduction, failing assertion, evidence, root cause, fix commit, and affected-case rerun. Distinguish confirmed product defects from test-generation, connectivity, and runner failures.

Submission gates remain: public GitHub source, public playable deployment, the required TestSprite Portal 3.0 suite with real result links, and a demonstrated TestSprite GitHub App pull-request check. Do not mark these complete based on a planned scenario, local type check, or the historical prototype run.
