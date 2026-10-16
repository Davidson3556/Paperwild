# Verification record

First build verification: October 17, 2026 (Africa/Lagos).

## Passed locally

- Production build: `npm run build`.
- Engine integration suite: `npm test`, 13 tests passed.
- Browser: Chrome, desktop 1440 × 1000 and mobile 390 × 844.
- Browser console: no warnings or errors in the observed game session.

## Exercised through the actual interface

| Flow | Observed result |
| --- | --- |
| Opening against computer | e2 selected; e3/e4 exposed as legal targets; e4 committed; one Black reply completed; White regained control. |
| Computer-turn undo | Undo removed both completed plies and restored the starting position and empty history. |
| First-bloom study | e4×d5 produced a White pawn on d5, `exd5` in history, a captured Black pawn, and one flower. |
| Resume capture | Reload retained the study, move, position, turn, and flower count. |
| Undo capture after reload | Both pawns returned; history and flower count returned to zero. |
| Promotion | a7–a8 opened the four-piece chooser; choosing knight produced a knight on a8 and an insufficient-material draw. |
| Result dialog | Underpromotion displayed the matching draw description and move/flower totals. |
| Checkmate | g6–g7 in the mate study reported `Qg7#` and White wins. |
| Restart | Confirmation preserved the game until accepted; accepting restored the standard board and cleared history/garden. |
| Mobile board | Switching to overhead view retained usable targets; e2–e4 committed correctly. |
| Keyboard play | Enter selected e2, two arrow presses moved focus to e4, and Enter committed exactly one legal move. |
| Raised-piece pointer input | Clicking the visible e1 king and d2 pawn selected the actual pieces even where their shapes projected over neighboring tile buttons. |
| Preferences | Evening lighting and overhead view persisted through reload; evening text contrast was inspected and corrected. |

These observations are a focused smoke test, not an exhaustive cross-browser certification. Castling, en passant, full chess endings, search legality, and repetition-aware restoration also have local engine coverage. The flat WebGL fallback and every difficulty level have not yet been exercised in the browser.

## Corrections made during verification

- Refined lighting so ivory pieces retain detail; strengthened tile and coordinate contrast.
- Fitted the full glasshouse and front plinth into the scene, including after resizing.
- Fixed evening-theme inherited text colors.
- Prevented a corrupt save from attaching an unrelated study banner to a fresh board.
- Preserved the scene and resumed pending computer work when a page is restored from browser back/forward cache.
- Routed pointer input through the 3D raycaster so raised pieces are selected by their visible surfaces; keyboard activation retains exact semantic square selection.

## TestSprite status

The local TestSprite bootstrap was attempted against the production preview on port 4174. Its setup reached the product-document selection screen, but the browser file-chooser flow failed and the native picker did not complete selection. The bootstrap call timed out. Configuration exists, so bootstrap must not be called again for this project.

No TestSprite cloud tests have run. The 18-scenario acceptance specification is in `docs/TESTSPRITE_PLAN.md`. Portal 3.0 suite creation, public hackathon deployment, public GitHub repository, GitHub App PR checks, and Discord submission remain pending.
