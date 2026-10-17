# The Marginwood Club

**Meet you in the margins.** A playable chess sketchbook with a woodland cast and a little world carrying on around the game.

Acorns take the first step. Hares hop, moths drift, and bookish badgers guard their kingside. Captured characters join the sideline society instead of disappearing. Beyond the board, a leaf-lifted tea balloon wanders past a sleepy cloud, a tortoise carries its cottage home, and a rabbit and hedgehog share a pot of tea.

Built for **[TestSprite Hackathon Season 4](https://www.testsprite.com/hackathon-s4)**.

## Preview

[Open the private development preview](https://queens-conservatory-davidson.sweetbox2.chatgpt.site).

The hosting address retains the prototype’s original name. A public repository, public playable URL, TestSprite Portal 3.0 suite, and verified GitHub App checks remain submission work. No submission has been made.

## Play

- **Against the club:** play Amber (White) against Indigo (Black). Choose Sleepy, Thoughtful, or Mischievous.
- **With a friend:** take turns on the same device.
- Choose a character, then a marked destination. Standard chess rules apply, including castling, en passant, and all four promotion choices.
- Captured characters travel to the sidelines. Undo restores the board, history, and sideline society together.
- Open **Little chess stories** for **Tea on the sidelines** (capture on d5), **Room to become** (promotion on a8), or **One final move** (checkmate on g7). Each story preselects its starting piece.
- Turn Daydream into Moonlight, invite a little rain, or **Say hello** to the residents. The margin drawings respond without changing the chess position.
- Pause the wandering for reduced motion. Sound is off until enabled.
- Your game and preferences save in this browser. Download the moves as PGN from **Field notes**.

Arrow keys explore the board; Enter chooses a square; Escape clears selection; **U** undoes a turn. Coordinate, color, and conventional chess-role labels remain available even though the pieces are woodland characters. **Who’s who in the club?** explains the cast.

| Chess role | Club character |
| --- | --- |
| Pawn | Acorn sprite |
| Rook | Tree stump |
| Knight | Hare |
| Bishop | Moth |
| Queen | Fox |
| King | Badger |

## Run locally

Use **Node.js 22.18+** and npm. Tests run the TypeScript sources through Node’s built-in type stripping.

```sh
npm ci
npm run dev
```

Open **http://127.0.0.1:4173**.

```sh
npm test
npm run typecheck
npm run build
npm run preview
```

Development and preview both use port 4173; stop one before starting the other. No backend, account, API key, or environment file is needed to run the game.

## How it is built

- **Vite and strict TypeScript:** the production build type-checks before bundling.
- **DOM, SVG, and original transparent PNG artwork:** a flat illustrated board, twelve woodland character assets in Amber and Indigo palettes, textured paper, and fine pencil-style margin drawings. There is no WebGL dependency in the active renderer.
- **CSS and Web Animations:** gentle idle gestures, movement suited to each character, capture arcs, drifting leaves, rising tea steam, and resident greetings. Reduced motion settles the action; hidden-page animations pause.
- **chess.js:** legal moves, complete history, special moves, game termination, undo, and PGN.
- **A bounded computer search:** three search depths run in a worker with a synchronous fallback. These are casual difficulty levels, not claimed Elo ratings.
- **Validated local saves:** the starting position and full history are replayed on restore to preserve undo and repetition detection.

See [art provenance and exact generation prompts](docs/ART_PROMPTS.md) for the original character and paper assets. The earlier prototype’s `scene.ts`, `wildlife.ts`, and `atmosphere.ts` remain in the source tree but are not imported by the current application entry point.

Saved games stay on the current browser and origin. Two-player mode shares one device; network multiplayer and cloud accounts are outside this version’s scope.

## Validation and submission

The local engine suite passes **13 tests**, and strict TypeScript checking passes. These checks cover game-state behavior and types; they do not establish browser animation, layout, or cloud acceptance coverage. Current browser and build evidence belongs in [the verification record](docs/VERIFICATION.md).

**The illustrated Marginwood interface has not yet had a TestSprite cloud run.** The [historical audited native run](docs/TESTSPRITE_RUN_2026-10-17.md) targeted the earlier 3D prototype: raw statuses were 2 passed / 4 failed, but all six intended gameplay scenarios were inconclusive after reviewing the generated assertions. That run is not validation of this interface.

The [current acceptance plan](docs/TESTSPRITE_PLAN.md) specifies meaningful board, role-image, history, capture, persistence, and accessibility assertions for the next run. See also [product requirements](docs/PRODUCT_REQUIREMENTS.md) and [the one-minute demo](docs/DEMO_SCRIPT.md).

Before hackathon submission:

- Publish a public repository and a public playable deployment.
- Create and execute the required suite in TestSprite Portal 3.0; retain real assertions, failures, fixes, and rerun evidence.
- Configure the TestSprite GitHub App and demonstrate an actual pull-request check.
- Attach the public links, test evidence, and a short demonstration.
- Confirm the final schedule and submission instructions in the event Discord.
