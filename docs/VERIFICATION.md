# Verification record

First build verification: October 17, 2026 (Africa/Lagos).

## Paperwild repository release — October 17, 2026

- Renamed the app, page metadata, package, favicon, and PGN export to Paperwild. Legacy browser save keys remain compatible.
- Removed the tracked private-hosting configuration and vendor-specific references from the published files. Local configuration, build output, dependencies, and raw TestSprite artifacts remain excluded from source control.
- `npm test`: 13 passed; strict TypeScript and `npm run build` passed after the rebrand. The Paperwild production entry is `index-57Drn_F8.js`.
- Chrome showed the Paperwild title and wordmark and decoded all 32 starting character images. The README screenshot was captured from the actual running game.
- Published source target: [Davidson3556/Paperwild](https://github.com/Davidson3556/Paperwild). Public app deployment and TestSprite Portal/GitHub App execution remain pending.

## Current illustrated Paperwild revision — October 17, 2026

The active renderer is now DOM/SVG with original transparent character illustrations, pencil-style margin drawings, and paper texture. The strict TypeScript chess engine and existing save keys are preserved. The earlier 3D observations below are historical evidence for previous versions, not validation of this renderer.

- `npm test`: all 13 engine tests passed. `npm run build`: strict TypeScript and the production Vite build passed. The current entry bundle is `index-D6Na7teX.js`; no Three.js code is included in the active entry bundle.
- Chrome at 1440 × 1000: all 32 starting character PNGs decoded; pointer selection exposed legal destinations; e2–e4 committed and the computer replied `Nc6`.
- Castling through the actual interface moved the badger from e1 to g1 and the tree stump from h1 to f1. Undo returned both illustrated characters to their original squares.
- En passant (`e5×d6`) removed the Black pawn from d5, retained the White pawn on d6, and added the Indigo acorn to the illustrated sideline collection. Departing animation elements were removed after completion.
- Promotion cancellation preserved the pawn on a7. Choosing knight on a8 displayed the hare and the correct insufficient-material result; undo restored the acorn. Promotion chooser artwork now follows the promoting pawn's color.
- The mate story produced `Qg7#`, the fox queen on g7, and the matching White-wins result.
- Reload retained the game (`e4 Nc6`), Moonlight, and rain. The restored pawn's image matched its semantic square. **Say hello** triggered the tea balloon's greeting without a chess move.
- Chrome at 390 × 844: document width stayed 390 px after resizing; d2–d4 committed, the computer replied `Nf6`, and full-turn undo restored d2 and the preceding history. Responsive hit-target bounds are clipped while resize measurements catch up; animations finish at their canonical destinations when dimensions change.
- Reduced motion produced byte-identical consecutive full-page screenshots after transient toast text settled. No browser warnings or errors appeared in the inspected session.
- Captured actual browser screenshots and a short animated preview of the running application; these are rendered-app evidence, not generated interface mockups.

This is focused Chrome verification, not an exhaustive browser certification. The illustrated interface has not had a new TestSprite cloud run. The historical cloud run below remains inconclusive; Portal 3.0 suite execution and GitHub App checks remain submission work.

## Historical 3D living-world revision — October 17, 2026

Preserved the user's strict TypeScript migration. `npm test` passed all 13 engine tests; `npm run build` passed TypeScript checking and the production build.

Actual Chrome checks at 1440 × 1000 and 390 × 844:

- Robin flight, snail crawling, pollinator movement, shifting shadows, rain, dusk fireflies, and lantern light were inspected in the rendered scene.
- Both the semantic **Say hello** control (including Enter) and directly tapping the visible robin triggered resident responses without changing chess state.
- Weather preference and a captured study position survived reopening the page. Undo restored the White pawn on e4, Black pawn on d5, and zero flowers.
- The first-bloom capture still produced `exd5`, a White pawn on d5, one flower, and a matching garden observation.
- Mobile document width remained 390 px at a 390 px viewport; weather, study, and resident controls remained available.
- On the mobile overhead board, e2–e4 produced one computer reply (`Nc6`), then full-turn undo restored White's pawn to e2 and cleared both plies.
- Reduced motion displayed the correct state and produced byte-identical consecutive full-page screenshots of the static garden.
- No browser warnings or errors appeared in the observed desktop session.

The wildlife implementation also passed a separate 200-second Three.js simulation with capture interruptions: creature roots stayed outside the playable board, shelter states held, and positions remained static under reduced motion. This is geometry/state evidence, not a substitute for visual QA. No new TestSprite cloud run was requested for this revision; the earlier inconclusive results below remain unchanged.

## Historical first 3D build: passed locally

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

The workflow recovered by supplying the app’s product requirements through the existing local TestSprite configuration, without repeating bootstrap. A native MCP cloud run selected exactly six cases against the stable production build on port 4174 (`index-BqFG4EEx.js`) and completed on October 17, 2026, approximately 00:22 WAT. It downloaded six result entities and six generated Python scripts.

**Raw native result: 2 passed / 4 failed. Audited gameplay coverage: all six scenarios inconclusive.** The two passes assert only a nonempty URL; they do not perform their named legal-move or capture flows. The four failures stop at a dropdown action, the first study-button click, or a scroll action before checking computer play, restoration, promotion, or mate. No product defect was confirmed from the returned evidence. These statuses must not be presented as two successfully validated gameplay scenarios.

The runner also recorded a control websocket disconnect, repeated `ENOTFOUND control.tun.testsprite.com`, and backend response failures beginning around 00:20 WAT. The run still completed and released its lock; it did not end through its timeout path. No rerun or source edit followed. The dashboard process was stopped after retaining the artifacts.

The [audited report](TESTSPRITE_RUN_2026-10-17.md) links each actual TestSprite result and the retained local scripts/raw report. The [current 17-scenario acceptance specification](TESTSPRITE_PLAN.md) covers the illustrated version. Source is available at [Davidson3556/Paperwild](https://github.com/Davidson3556/Paperwild). Dedicated Portal 3.0 suite validation, a public hackathon deployment, GitHub App PR checks, and Discord submission remain pending.
