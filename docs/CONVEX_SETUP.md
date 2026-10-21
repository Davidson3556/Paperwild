# Convex friend-play setup

Paperwild keeps computer and same-device play available without a backend. **Across the woods** adds an optional shared game through Convex while retaining the existing board, postcard, and room dialog.

The implementation is currently local on `feat/convex-multiplayer`. Published `main` contains merged PR #4 at `3240b0d`; the new multiplayer branch has not been deployed to Convex Cloud or the public frontend. The instructions below prepare those environments and do not record a completed cloud release.

## Start local development

Use Node.js **22.18 or later** and install the locked dependencies:

```sh
npm ci
```

For computer and same-device play, run `npm run dev` and open `http://127.0.0.1:4173`. No environment file or backend is required for those modes.

For local online development, open a second terminal in the repository and run:

```sh
npm run convex:dev
```

Follow the interactive setup and choose a local deployment. A fresh setup can select a local project explicitly with:

```sh
npm run convex:dev -- --configure new --dev-deployment local
```

The CLI configures the deployment, writes `.env.local` with `CONVEX_DEPLOYMENT` and the Vite client URL `VITE_CONVEX_URL`, generates `convex/_generated/`, and deploys/watches the room functions and schema. Check that `VITE_CONVEX_URL` matches the local client URL printed by the CLI. [.env.example](../.env.example) documents the public frontend setting.

Keep `convex:dev` running. Its local backend is a subprocess and stops with it; local backend data stays in the ignored `.convex/` directory. Anonymous local development can run without a Convex account. These behaviors follow the [Convex local-deployment guide](https://docs.convex.dev/cli/local-deployments) and [CLI overview](https://docs.convex.dev/cli/overview).

Start or restart Vite after the environment file is generated:

```sh
npm run dev
```

Vite reads its environment at startup and substitutes `VITE_*` values into a production bundle at build time. Restart development after a URL change, and rebuild a deployed frontend after a hosting-environment change. The client URL is public; private keys must never use a `VITE_` prefix. See [Vite environment variables](https://vite.dev/guide/env-and-mode).

## Try two seats

1. Open Paperwild and let the notebook introduction settle. Open **Across the woods**, then choose **Write an invitation**. The creator takes Amber/White.
2. Copy the invitation. Open it in a separate tab or browser context, or enter the 12-character code in its room dialog, then choose **Take a seat**. The first independent join takes Indigo/Black.
3. Wait for both seats to be taken and for your own connection to show connected. Move White, then Black, and confirm that both histories and boards agree.
4. Ask for Undo. The other player can accept or decline; the sender can cancel. Acceptance removes one ply. A new move clears a pending request.
5. Ask for another game. Acceptance resets both boards with the same colors and original expiry; declining preserves the game.
6. Reload one tab to resume that tab's active seat after the introduction. **Back to my page** restores its previous local game. A later saved-seat return is explicit.

A new tab does not automatically use the other tab's locally saved seat just because it opened an invitation. For independent browser-context verification, use a separate profile or private window. A loopback backend works for browsers on this machine; remote friends need the cloud setup below.

## State and authorization

Each room has a random 12-character invitation code and expires **24 hours after creation**. A 256-bit random credential authorizes each seat; the backend stores only its SHA-256 hash. Every room read and change requires a recognized credential. The invitation URL contains the code only, and a caller cannot select its own role or read a room with only its code. Whoever first joins using the invitation takes the vacant second seat.

The active credential is stored in deployment-scoped per-tab `sessionStorage`, so a reload can return to its seat. Separate `localStorage` holds the last saved seat for an explicit return. Neither storage key replaces the offline game or preference keys. Clearing browser storage can lose access to a seat; there is no account-based recovery or transfer flow.

Room mutations check the expected revision and authorize the requested action transactionally. Moves replay the complete history through chess.js to check legality, turn, repetition, and endings. Only a server-confirmed snapshot advances the displayed online game. The client waits for missing animations, restores accepted rewinds/rematches safely, and ignores old callbacks after leaving or switching rooms.

Disconnected or busy clients cannot submit new moves or requests. Reconnection keeps the same credential. Missing, expired, or unauthorized rooms show an error and end the apparent connection; a client timer also expires an idle snapshot. Reconnects and rematches do not extend room lifetime. An internal hourly cleanup deletes expired rooms in batches of at most 100, scheduling another batch only when more expired rows remain. Expiry is enforced immediately on access even before cleanup runs; clients cannot invoke cleanup or delete rooms.

The connection badge reports this browser's WebSocket. **Friend · seat taken** records that a seat was claimed; it does not report whether the opponent is currently online. There is no presence service, public lobby, chat, or spectator mode.

## Run the test layers

| Command | Scope | Current local result |
| --- | --- | --- |
| `npm test` | Browser-independent rules, startup, motion/audio, transport, and snapshot-planning tests | 122 passed, including 20 transport and 8 reconciliation tests |
| `npm run test:convex` | Room functions in isolated `convex-test` transactions: authorization, races, rules, consent, and expiry | 20 passed |
| `npm run typecheck` | Strict frontend and Convex TypeScript | Passed |
| `npm run build` | Type checks and Vite production assets | Passed |
| `npm run test:online:live` | Real WebSocket clients against an explicitly selected local backend | 2 passed in local verification |

Unit/backend tests require no running server and create no cloud rooms. To run the live suite, keep the local backend running and set its actual client endpoint explicitly:

```sh
CONVEX_TEST_URL=http://127.0.0.1:3210 npm run test:online:live
```

Replace port `3210` if your CLI prints a different local client URL. The suite requires a loopback host (`127.0.0.1`, `localhost`, or IPv6 loopback) and rejects cloud endpoints. It creates test rooms in that local deployment, checks both clients' snapshots, consent, reconnect, and concurrent room/seat/move transactions. These are protocol tests; browser layout, animation, and accessibility observations are separate evidence.

The earlier **14/14 TestSprite** result belongs to the published startup correction. It has no invitation, two-player synchronization, or reconnect assertions for this branch. A new online TestSprite suite has not yet run. The separate [ten-case online proposal](testsprite/online-plan.yaml) is **not executed or uploaded** and requires independent contexts plus real network controls. See the [product requirements](PRODUCT_REQUIREMENTS.md) and [historical startup record](STARTUP_VERIFICATION_2026-10-21.md) for the evidence boundary.

## Prepare a cloud backend and matching frontend

Keep the backend and frontend on the same source revision. A hosted frontend must connect to its intended cloud deployment; a loopback URL points each visitor at their own machine.

1. Sign in to Convex and select or create the intended cloud project. For an anonymous local project, `npx convex login` starts account linking. Configure an existing cloud project with `npm run convex:dev -- --configure existing --dev-deployment cloud`, or use `--configure new --dev-deployment cloud` to create one. Confirm the project/deployment shown by the CLI before proceeding.
2. Validate the source with `npm test`, `npm run test:convex`, and `npm run build`. Publish the intended production backend using `npm run convex:deploy`. This deploys functions, schema, and indexes to the selected project's production deployment; follow the CLI confirmation. Obtain that production deployment's public client URL from the Convex dashboard.
3. In the frontend host's Production environment, set `VITE_CONVEX_URL` to that public client URL, such as `https://your-deployment.convex.cloud`. Use the Convex client URL, rather than its HTTP-actions `.convex.site` URL. Install with `npm ci`, build with `npm run build`, and publish `dist/` from the matching revision. On Vercel, these are the project install command, build command, and output-directory settings.
4. Trigger a new frontend build after setting or changing the URL. Existing bundles retain their earlier value. Verify the resulting public origin in a signed-out browser, create a room in one independent browser context, join in another, and exercise moves, reconnect, consent, and return to the local game.

Convex documents the deployment commands in its [CLI overview](https://docs.convex.dev/cli/overview). Backend data is deployment-specific: a room code and saved credential from local development do not identify a room in a different cloud backend.

For a manual local frontend build targeting the deployed backend, set only the public client URL for the build:

```sh
VITE_CONVEX_URL=https://your-deployment.convex.cloud npm run build
```

Deploying only `dist/` does not publish `convex/` functions. Deploying only Convex does not rebuild the frontend URL. Record the source revision, backend deployment, and frontend origin together when recording release evidence.

## Optional combined Vercel build

Convex supports deploying the backend and building the matching frontend in one hosting build. Use this Vercel Build Command:

```sh
npx convex deploy --cmd-url-env-var-name VITE_CONVEX_URL --cmd 'npm run build'
```

Store the appropriate **production** `CONVEX_DEPLOY_KEY` only in the host's private Production build environment, with deployment permissions. The CLI supplies the matching public client URL to the frontend build. Configure preview deployment keys separately in the host's Preview environment so branch previews use their intended preview backend. Follow the [official Convex/Vercel deployment guide](https://docs.convex.dev/production/hosting/vercel) for key creation and environment scoping; [custom hosting](https://docs.convex.dev/production/hosting/custom) explains the combined command.

An admin or deploy key must never appear in browser code, a `VITE_*` variable, an invitation, a committed `.env` file, or a published artifact. `.env.local`, other real `.env` files, and `.convex/` are ignored by this repository. The checked-in `.env.example` contains a public placeholder only. The ordinary unit/backend CI checks need no deployment key.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Online dialog says the post is unavailable | Confirm `VITE_CONVEX_URL` is set for this Vite process/build, then restart or rebuild. Local modes remain usable without it. |
| Joining or reconnecting cannot reach the server | Keep the selected backend running and use its client URL. Confirm a deployed frontend was not built with a loopback URL. |
| Room not found after switching environments | Use a room created in the current deployment. A copied code does not move room data between backends. |
| Room has expired | Create a new room. Reconnect or an accepted rematch cannot renew the original 24-hour lifetime. |
| Seat storage is unavailable | Enable browser storage before claiming a seat. The app reports the failure and protects the local game. If only longer-term storage fails, keep the working tab open. |
| A new tab offers a saved seat while an invite is open | Choose **Take a seat** to join as a new independent player, or explicitly return to the saved seat when that is your intention. |
| A stale-board error follows a reconnect | Wait for the latest snapshot and movement to settle, then retry. Unconfirmed moves are not applied locally. |
