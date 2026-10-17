# Watercolor cast verification — October 17, 2026

This record covers the uncommitted watercolor revision based on `d103453`. Everything remains local at the user's request. No commit, push, deployment, or new TestSprite service run was performed.

The story checked is: opening Paperwild loads the watercolor cast, starts independent character life without input, and preserves correct chess state through movement, capture, promotion, and undo.

## Candidate and assets

- Strict TypeScript and the production build passed. The tested Vite output uses `index-BlgG6Ead.js` and `index-Du23K8lW.css`, served at `http://127.0.0.1:4178/` from an isolated production output directory.
- All twelve original paintings are 1254 × 1254 RGBA PNGs with genuine transparency. All twelve delivery copies are 480 × 480 RGBA PNGs with identical framing, totaling about 3.4 MB, approximately 85% smaller than the originals.
- The same asset helper supplies the board, captured portraits, promotion choices, and character guide. All 32 starting board images and all 32 articulation groups loaded successfully.
- The twelve illustration maps contain 58 traced appendage definitions. In the starting position they produce 158 painted part instances, with one fitted face and one life wrapper per character.

## Observed browser behavior

Chrome was observed at 3200 × 1363 and 390 × 844. The following results come from the actual production preview, using semantic controls and read-only DOM observations.

| Check | Evidence |
| --- | --- |
| Life without interaction | 200 samples over approximately 28 seconds observed changing breathing and gesture transforms on all 32 characters, open and closed blink states on all 32, all twelve side/role combinations blinking, and changing transforms on all 158 painted parts. |
| Chess remains unchanged | The complete 64-square contents, history, turn, and capture count were identical before and after autonomous observation. |
| Pause and resume | Pausing produced zero visible blink overlays, zero displaced parts, and zero displaced life/breath wrappers, including portraits outside the board. Resuming restored the breathing animation. |
| Capture and portraits | The capture story produced White pawn d5, empty e4, Black turn, `exd5`, one captured Black pawn, one matching sideline portrait, and one matching journal portrait. Both rigs were ready. The journal's breathing transform changed across observations. |
| Portrait continuity | Selecting Black's a7 pawn caused a normal render but retained the same journal face identifier, `paperwild-face-46-0`, rather than recreating its animation. |
| Capture undo | Undo restored White pawn e4, Black pawn d5, White turn, empty recorded history, zero captures, zero sideline/journal portraits, and 32 active board sprites. |
| Promotion cancellation | All 64 square contents, history, turn, and captures matched exactly after canceling the promotion choice. |
| Promotion handoff | During travel, the sprite was moving with the pawn image, pawn face, and pawn life wrapper; resting part CSS was disabled. On arrival it became the knight image/face/life with `a8=N` and an insufficient-material draw. |
| Promotion undo | Undo restored pawn a7, empty a8, pawn face/life, unfinished status, and no orphaned knight face. |
| Computer turn | White e4 received exactly one Black reply, `Nc6`; movement and thinking released, White regained control, and 32 sprites remained. Completed-turn undo restored the complete initial position/history/turn/capture snapshot. |
| Painted travel and castling | Legal local play `e4 e5 Nf3 Nc6 Bc4 Nf6 O-O` exercised pawn, hare, moth, badger, and rook movement. Castling left king g1, rook f1, empty e1/h1, 32 sprites, and no departing ghosts. An intermediate moth frame shows folded painted wings in flight. |
| Fox and ending | The mate story produced fox g7, empty g6, `Qg7#`, White checkmate, the correct fox face, and one tail part. Undo reopened play. |
| Phone layout | At 390 × 844 there was no horizontal page overflow, all 32 images and rigs were ready, and there were no departing ghost sprites. The temporary viewport override was reset afterward. |
| Browser diagnostics | The inspected production-preview console contained no warnings or errors. |

The local Node suite passed all 24 tests: 13 chess-engine tests, eight mocked Web Audio lifecycle tests, and three motion invariant tests. These do not establish visual alignment or audible quality; the visual evidence above comes from browser inspection. System reduced-motion and hidden-tab visual behavior were reviewed in code, rather than newly emulated in this browser run. Asset-failure handling was reviewed in code; no failed image request was deliberately injected in this run.

## Saved evidence

- [Full watercolor page](media/paperwild-watercolor-preview.png)
- [Phone page](media/paperwild-watercolor-mobile.png)
- [Intermediate moth flight](media/paperwild-watercolor-moth-flight.png)
- [Recorded autonomous animation](media/paperwild-watercolor-idle.gif): 36 actual browser screenshots over 12.035 seconds, encoded with timestamp-derived frame delays. This is a sampled recording; the live CSS/Web Animations render independently of the recording's frame rate.
- [Artwork prompts, source files, and generation method](WATERCOLOR_ART.md)

The preview was restored to a fresh local game with no captures or open dialogs. The new watercolor revision is not yet the version at `paperwild.vercel.app`. TestSprite Portal coverage and the GitHub App checked PR remain pending; the older MCP reports do not validate this new build.
