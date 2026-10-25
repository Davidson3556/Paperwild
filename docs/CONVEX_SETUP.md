# Convex friend-play setup

Paperwild keeps computer and same-device play available without a backend. **Across the woods** adds an optional shared game through Convex while retaining the existing board, postcard, and room dialog.

The implementation is merged through [PR #5](https://github.com/Davidson3556/Paperwild/pull/5) into `main` at `31e8b02e62d2095716624c173879ff1c902953b4`. **[The public game](https://paperwild.vercel.app/) supports online friend play** through a configured Convex Production deployment. The Development preview has its own backend and historical acceptance evidence.

## Current Production configuration

| Binding | Value |
| --- | --- |
| Frontend origin | [paperwild.vercel.app](https://paperwild.vercel.app/) |
| Application revision | `31e8b02e62d2095716624c173879ff1c902953b4` |
| Public client URL | `https://grateful-cuttlefish-105.convex.cloud` |
| Vercel variable | `VITE_CONVEX_URL`, Production environment |
| Ready Vercel deployment | `dpl_5uZMUS4vArHxYwkdLs5T5zVjKohv` |
| Frontend bundle | `assets/index-DRVksUc-.js` |

The frontend was rebuilt after saving the Production URL without a trailing newline. An environment change does not update an already built Vite bundle. Use the public alias above: the unique deployment URL retains Vercel authentication protection.

Production multiplayer was checked manually on the actual public origin, including a user check in two independent browsers. Three fresh strict TestSprite cases also passed with literal Production target URLs, independent browsers, exact stored-body/version readbacks and **all 48 public files matching before and after**. The [October 25 Production record](PRODUCTION_VERIFICATION_2026-10-25.md) links the completed audit and preserves the earlier requested-target runs with unverified Python origin and incomplete postflight. Those historical limitations are not rewritten by the fresh pass. The online project now contains three Production cases and one unchanged Development-only outage case; its older four-case Development acceptance remains separate.

## Development preview acceptance — October 24

On October 24, the Paperwild project in team `awokoya-davidson` deployed its room functions and schema to the US East **Development** deployment `fast-starling-207` from `5633a86`. The application and Convex source are unchanged from `6f17355`.

| Binding | Value |
| --- | --- |
| Public client URL | `https://fast-starling-207.convex.cloud` |
| Vercel variable | `VITE_CONVEX_URL`, Preview only, branch `feat/convex-multiplayer` |
| Frontend origin | [PR #5 preview](https://paperwild-git-feat-convex-multiplayer-davidson3556s-projects.vercel.app/) |
| Acceptance source head | `419fdef2b848796fd909aa86656aef760583b07d` |
| Acceptance Vercel deployment | `dpl_9DNGdtNoT7C1Ldwfo8UkWfY1Cs4W` |
| Matching public frontend build | `index-EfeOJs9J.js`; all 48 application payloads verified |

The URL is public client configuration, not a deploy credential. Other previews and Production do not inherit this branch override; Production has the separate binding above. The [strict regression workflow](TESTSPRITE_PR_GATE.md) used the matching Development URL and compared every public application payload for this recorded acceptance. [Run 40136980632](https://github.com/Davidson3556/Paperwild/actions/runs/40136980632) passed all sixteen frontend regression cases at acceptance source head `419fdef`; the separate four-case execution establishes its own multiplayer assertions.

The [four hosted multiplayer scripts](testsprite/online-overrides/README.md) target separate TestSprite project `5ac48e78-b1a2-4509-ad73-0b3efe0c3343`. [Execution `5db8197c`](https://www.testsprite.com/dashboard-v3/o/f7454a95-e992-581a-98e0-4edd142a0891/projects/5ac48e78-b1a2-4509-ad73-0b3efe0c3343/execution/5db8197c-e6f9-4342-bc7d-5f98095166d7) at acceptance source head `419fdef` passed **4/4**, with no failed, skipped or timed-out case. All original invitation/capture, consent, reload/local-save and offline/no-queue/same-seat recovery assertions passed. The [summary](testsprite/online-cloud-acceptance-summary.json) and [completed audit](testsprite/online-cloud-acceptance-verification.json) verify committed source and hosted versions before/after, all 48 payloads and stable source/deployment identity. API run-version/auto-heal nulls remain null; replay and source checks are recorded separately.

The [cloud verification record](CONVEX_CLOUD_VERIFICATION_2026-10-24.md) preserves earlier browser-start failures, the [3/1 first acceptance result](testsprite/online-cloud-first-acceptance-verification.json) and the [failed immediate-close-event diagnostic](testsprite/online-cloud-offline-probe-verification.json). Those records remain failed historical results and are not relabeled by the final pass.

A manual check in two tabs of the same Chrome profile completed `e4 d5 exd5` and agreed Undo. It is supplementary interaction evidence; those tabs were **not independent browser contexts**. The earlier pre-cloud sixteen-case passes remain identified by their [archived manifest](testsprite/pr5-pre-cloud-stored-code-manifest.json).

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

## First visit and opponent choice

Use a new private window to check a first visit without deleting your existing game's storage. After the notebook opens, the short guide introduces the board, **Field kit**, **Journal**, and optional **Sound**. Complete the guide to reach **Who will you play?**. Completing it alone does not enable chess or sound.

For an unconfirmed fresh game, nothing is preselected. Choose **Against the club**, **With a friend**, or configured **Across the woods**, then confirm. The required chooser cannot be escaped or closed into play. Guide completion is remembered separately, so reloading an unconfirmed fresh page still asks for an opponent. An existing unfinished history, explicit study, or previously confirmed empty board resumes without resetting its saved game for onboarding.

Check these entry behaviors before the two-player walkthrough:

1. In a fresh private context, observe guide first, then the required chooser with no selected opponent. Before confirmation, try Escape, dismissal, board input, and reload. The board must remain unavailable and no computer move may occur.
2. Select **Against the club**, then **Play against the club**. Play **e2 → e4** and wait for exactly one legal Indigo/Black reply. Reload and confirm that the same unfinished game returns.
3. In another fresh private context, select **With a friend**, then **Play together here**. After **e2 → e4**, Indigo must wait for the second person's input; no computer reply should appear.
4. From a chosen game, open **How to play → Take a quick tour**. Finish or dismiss the replay and confirm that the position, history, selected opponent, and study context are unchanged. A confirmed starting board must also remain confirmed on reload before its first move.
5. On an unconfirmed fresh page with online play configured, choose **Across the woods** and open its invitation dialog. Close it without taking a seat. The required opponent chooser must return and the board must remain gated. Repeat from an already chosen local game: closing the dialog must instead preserve that game.
6. Open a valid invitation in a fresh context. Its code must remain prefilled after any first-visit guide. Do not select **Take a seat** yet: no seat may be occupied and no online game may start merely from opening the link. For a tab with its own active saved credential, reload and wait for the server to confirm the seat before trying a move.

The [onboarding verification record](ONBOARDING_VERIFICATION_2026-10-24.md) documents the local browser observations and 131 passing app tests for this flow. The later [sixteen-case TestSprite record](TESTSPRITE_ONBOARDING_RUN_2026-10-24.md) covers onboarding on the identified pre-cloud frontend. Neither record establishes hosted two-player acceptance.

## Try two seats

Use a normal window and an incognito/private window **on the same computer** for a clear two-player check. Keep the local Convex process and the frontend running. Open the frontend URL printed by Vite or preview; its usual port is `4173`, while the existing local multiplayer preview uses `http://127.0.0.1:4191/` when that process is running.

1. Open Paperwild in the normal window and let the notebook introduction settle. On a first visit, complete the guide, select **Across the woods** in the required opponent chooser, then **Open invitation**. From an already chosen local game, open **Across the woods** directly; on a smaller screen, find it in **Field kit**. Choose **Write an invitation**. The creator takes Amber/White, and moves remain unavailable while the second seat is empty.
2. Copy the invitation link. Paste it into the private window, finish its notebook opening and any first-visit guide, and check that the invitation code is still prefilled. Choose **Take a seat** explicitly. You can also enter the 12-character code in its room dialog. The first independent join takes Indigo/Black.
3. Wait for both seats to be taken and for each window's own connection to show connected. Turn **Sound on** in **each** window if you want to check voices, movement, and capture audio; a trusted interaction must unlock sound separately in each context.
4. Make **e2 → e4** in the Amber window, then **d7 → d5** in the Indigo window. Make **e4 → d5** in the Amber window to trigger a capture fight. After every move settles, compare the boards and move histories. After the capture, both should show the Amber acorn at d5, e4 empty, `exd5` in the history, and one captured Indigo acorn. Watch the fight and send-off without allowing them to advance the legal position again.
5. Ask for Undo in one window. First decline it in the other and confirm that neither board changes. Ask again and accept: both boards should return to the position before the capture, with Amber at e4, Indigo at d5, no captured acorns, and Amber to move. The sender can also cancel a pending request; a new move clears one.
6. Reload one window. After its introduction, confirm that it resumes the same seat and shared history rather than taking a new seat or replaying old captures.
7. Ask for another game. Decline once and confirm that both boards stay unchanged, then ask and accept. Both should reset to the standard 32-piece position with empty history, the same colors, and the original expiry. Neither player's **A fresh page** action may reset an online board unilaterally.
8. Choose **Back to my page** to restore that window's previous local game. If no local opponent had been confirmed, choose one before the offline board can be played. A later saved-seat return is explicit. If an old room has expired, return to the local page and write a fresh invitation; reloading or accepting a rematch does not renew it.

A new tab does not automatically use the other tab's locally saved seat just because it opened an invitation. Independent normal/private contexts also keep sound and local settings separate. A loopback backend works only for browsers on this machine; playing from separate devices or inviting a remote friend requires the cloud setup below.

## Choose an opponent for a new game

For a player with a chosen game or study, **A fresh page**, the result card's **Another adventure**, and a study's **Return to a full game** open the optional **Who will you play?** chooser. **Against the club** is selected by default: choose **Play against the club** to play Amber/White against the computer. Select **With a friend**, then **Play together here** for alternating turns on the same device. Select **Across the woods**, then **Open invitation** for online friend play; that option is unavailable until a backend is configured. The mandatory first-game chooser described above has no default or cancellation into play.

Opening the optional chooser, changing a choice, or choosing **Keep this page** must preserve the board, history, and study. Confirming a computer or same-device game starts a fresh standard position in that mode. Choosing online opens the invitation dialog without replacing the local game; the shared board takes over only after a room is created or joined, and **Back to my page** restores the waiting local game. When that local game is still unconfirmed, its required opponent choice remains in force. Inside an active online room, a new-game action remains an opponent-approved rematch.

To check this flow, make a local move, open the chooser, switch choices, and cancel: the position and history should still match. Open it again and confirm **Against the club**: the full standard board should appear with Amber to move, followed by exactly one computer reply after your first legal move. Repeat with **With a friend** and confirm there is no automatic reply. When configured, select **Across the woods**, close the invitation dialog without taking a seat, and confirm that the original local game is intact.

## State and authorization

Each room has a random 12-character invitation code and expires **24 hours after creation**. A 256-bit random credential authorizes each seat; the backend stores only its SHA-256 hash. Every room read and change requires a recognized credential. The invitation URL contains the code only, and a caller cannot select its own role or read a room with only its code. Whoever first joins using the invitation takes the vacant second seat.

The active credential is stored in deployment-scoped per-tab `sessionStorage`, so a reload can return to its seat. Separate `localStorage` holds the last saved seat for an explicit return. Neither storage key replaces the offline game or preference keys. Clearing browser storage can lose access to a seat; there is no account-based recovery or transfer flow.

Room mutations check the expected revision and authorize the requested action transactionally. Moves replay the complete history through chess.js to check legality, turn, repetition, and endings. Only a server-confirmed snapshot advances the displayed online game. The client waits for missing animations, restores accepted rewinds/rematches safely, and ignores old callbacks after leaving or switching rooms.

Disconnected or busy clients cannot submit new moves or requests. Reconnection keeps the same credential. Missing, expired, or unauthorized rooms show an error and end the apparent connection; a client timer also expires an idle snapshot. Reconnects and rematches do not extend room lifetime. An internal hourly cleanup deletes expired rooms in batches of at most 100, scheduling another batch only when more expired rows remain. Expiry is enforced immediately on access even before cleanup runs; clients cannot invoke cleanup or delete rooms.

The connection badge reports this browser's WebSocket. **Friend · seat taken** records that a seat was claimed; it does not report whether the opponent is currently online. There is no presence service, public lobby, chat, or spectator mode.

## Run the test layers

[Merged-main CI](https://github.com/Davidson3556/Paperwild/actions/runs/40139506887) passed **150 app/gate tests, 20 backend tests, TypeScript and build**. The [PR #5 regression run](https://github.com/Davidson3556/Paperwild/actions/runs/40137927136) passed **16/16 strict TestSprite cases**. The later [three-case literal-target Production pass](PRODUCTION_VERIFICATION_2026-10-25.md#literal-target-production-results) and its complete source/build audit are separate from that frontend regression run and from the older ambiguous-target evidence. Later source changes require new checks.

At PR #6 head `6c727f4123b09602240ffa3f867ed4d2278708e9`, [regular CI](https://github.com/Davidson3556/Paperwild/actions/runs/40231487274) passed **172 app/gate tests, 20 backend tests, TypeScript and build**, and the [first full public strict run](https://github.com/Davidson3556/Paperwild/actions/runs/40231487297) passed **16/16**. Its [complete audit](testsprite/public-ci-acceptance-2026-10-25.json) verifies source/version receipts, membership, replay and all 48 files before and after. The [active main ruleset](https://github.com/Davidson3556/Paperwild/rules/25836565) requires a PR with both GitHub Actions checks up to date; the [effective-rule receipt](testsprite/main-required-checks-2026-10-25.json) records no bypass actors. Later source heads need their own checks.

The [general PR regression workflow](TESTSPRITE_PR_GATE.md) matches the exact PR source and reference build to a deployment in the separate public Vercel project `paperwild-ci` (`prj_K4XUFAg81KYU0YxfC0ISyU3JRhox`), using the Development `VITE_CONVEX_URL`. It retains direct-public `--no-auto-heal` replay. After verifying the canonical scripts, the gate binds only each template's single target-URL literal through a guarded stored-code update, records the actual version/body receipt, and checks those bound bodies, membership, replay results and all public files before and after execution. A project-wide lock serializes this binding across PRs. Unique deployment hostnames need not contain the CI project name; identity comes from deployment evidence and project metadata.

The earlier native-tunnel attempt returned sixteen service-blocked cases before gameplay because strict replay is unsupported through that tunnel. Subsequent controlled probes showed that the strict Python worker did not receive the target from CLI target/environment options, prompting the literal-only binding design. Production and the existing preview keep their separate configuration and protection settings; the regression suite does not establish new multiplayer acceptance.

The [October 24 chooser verification](NEW_GAME_VERIFICATION_2026-10-24.md) records 122 passing app tests, strict TypeScript/build, and browser checks before the first-visit guide and mandatory entry choice were added. The table below preserves the earlier local multiplayer verification date.

| Command | Scope | Recorded local result (October 22) |
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

The earlier **14/14 TestSprite** result belongs to the published startup correction, and the archived October 24 **16/16** runs identify their pre-cloud frontend. The **16/16** regression run at acceptance source head `419fdef` remains separate from its **4/4** multiplayer execution. The regression suite has no invitation, two-player synchronization or reconnect assertions. The original [ten-case online proposal](testsprite/online-plan.yaml) is still **not executed or uploaded**; the executed four scripts consolidate those scenarios. See the [product requirements](PRODUCT_REQUIREMENTS.md) and [historical startup record](STARTUP_VERIFICATION_2026-10-21.md) for the evidence boundary.

## Prepare a cloud backend and matching frontend

Keep the backend and frontend on the same source revision. A hosted frontend must connect to its intended cloud deployment; a loopback URL points each visitor at their own machine.

The current Production binding is recorded above. For a new environment or later release, deploy the matching backend, save its public client URL, rebuild the frontend, and verify the resulting public origin. Merging frontend source alone cannot configure a backend or replace a URL already compiled into a bundle.

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
