# The Queen’s Conservatory

A playable chess garden in a sunlit, miniature glasshouse. Porcelain pieces sit on a ceramic board framed in brass and walnut. Each captured piece adds a flower to the surrounding garden.

Built for **[TestSprite Hackathon Season 4](https://www.testsprite.com/hackathon-s4)**.

## Preview

[Open the private preview](https://queens-conservatory-davidson.sweetbox2.chatgpt.site).

This is a private development preview. A public hackathon URL and public repository are pending. A six-case native TestSprite run completed with raw statuses of 2 passed and 4 failed; review of the returned scripts left all six intended gameplay scenarios inconclusive. Dedicated Portal 3.0 suite validation and GitHub App checks remain pending.

## Play

- **Play the keeper:** control White against the browser’s computer opponent. Choose Seedling, Gardener, or Wildwood.
- **With a friend:** play both sides on one device.
- Select a piece, then a marked destination. Use the promotion dialog to choose a queen, rook, bishop, or knight.
- Captures add flowers to the garden and journal. Undo restores the board, move history, and capture count together.
- Explore three **Garden studies**: a capture on d5, promotion on a8, and checkmate on g7.
- Change between morning and evening light, perspective and overhead views, and gentle or reduced motion. Sound starts off and can be enabled with the speaker button.
- Meet the residents: tap the robin or snail, or use **Say hello** with a keyboard. The robin changes perches, the snail wanders along the rim, and a bee and butterfly visit the plants and new capture flowers.
- **Let it rain** changes the light and shelters the insects. Evening brings out fireflies and lantern light. Moving leaf shadows, drifting sunlight, and occasional falling leaves continue around the game.
- The game and settings save in this browser. Download the game as PGN from the Field notes panel.

Arrow keys explore the board; Enter chooses a square; Escape clears selection; **U** undoes a turn. A flat board is used when the 3D scene cannot initialize.

## Run locally

Use Node.js 22.18+ and npm. The tests run the TypeScript sources directly through Node's built-in type stripping.

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

`npm run preview` serves the production build on port 4173; stop the development server first. No backend, account, API key, or environment file is required.

## Implementation

- **Vite and strict TypeScript** provide the browser application and build. `npm run build` type-checks with `tsc` before bundling.
- **Three.js** renders the scene. The board, pieces, plants, and materials are generated in code.
- TypeScript modules keep the chess engine, wildlife, and room atmosphere separate. Animation pauses in hidden tabs; reduced motion freezes the decorative world while chess remains playable.
- **chess.js** supplies legal moves, game history, special moves, and game termination.
- The computer uses bounded alpha-beta search at depths 1, 2, and 3. Search normally runs in a Web Worker and has a synchronous fallback.
- `localStorage` stores the starting position and complete move history. Restoration replays the history to retain repetition detection and undo.

The computer is a lightweight opponent for casual play. Saved games are local to the current browser and origin. Local two-player play shares one device; network multiplayer is outside this version’s scope.

## Validation

`npm test` currently passes **13 local engine tests** covering illegal moves, castling, en passant, promotion, mate and stalemate, turn-aware undo, save restoration, repetition, invalid saves, reset, and legal computer responses.

Browser and TestSprite acceptance scenarios are specified in [the TestSprite plan](docs/TESTSPRITE_PLAN.md). The [audited native run report](docs/TESTSPRITE_RUN_2026-10-17.md) records all six actual result links and explains why its raw 2/6 pass count does not establish gameplay coverage: the returned scripts largely assert only that a URL exists, and several interactions timed out. See [manual browser evidence](docs/VERIFICATION.md) for the separate smoke-test observations. No product defect was confirmed from the cloud run alone.

See [product requirements](docs/PRODUCT_REQUIREMENTS.md) for implemented behavior, acceptance criteria, and submission work still outstanding.

## Submission work remaining

- Publish a public repository and public deployment URL.
- Create and execute the project’s suite in TestSprite Portal 3.0.
- Install/configure the TestSprite GitHub App and verify checks trigger for each pull request.
- Attach real test results and a short demonstration to the hackathon submission.
- Confirm the final deadline and schedule in the event Discord before submitting. The official Season 4 page lists October 22, 2026 at 11:59 PM Pacific Time; judging weights are 40% product quality, 40% testing, and 20% innovation.
