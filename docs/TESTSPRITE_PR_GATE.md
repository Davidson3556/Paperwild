# Strict TestSprite pull-request verification

The [strict Actions workflow](../.github/workflows/testsprite-strict.yml) checks out and builds the exact head of each trusted same-repository PR. It serves that build on an owned `127.0.0.1:4173` HTTP server and runs the sixteen reviewed scripts through the official TestSprite CLI's native tunnel. Branch names do not choose the target, and this workflow does not change Vercel deployment protection or test a mutable public branch alias.

The check context is **Verify all 16 stored TestSprite scripts**, under **TestSprite strict replay**. Its actual result for the current PR head establishes whether that head passed. A workflow file or a passing older execution is not evidence that a new head passed. This localhost-tunnel flow requires its own successful Actions execution; historical preview passes below do not establish that result.

## What the gate verifies

1. Reject fork PRs and missing credentials before checkout or build. Trusted same-repository drafts run too. Actions receives read-only contents and pull-request permissions; checkout does not persist its credential.
2. Check out the exact PR head, run the gate's focused tests, install dependencies and build the checked-out app. Recheck the current open PR head and reject a dirty checkout, untracked source changes or a changed local commit.
3. Bind a new server exclusively to `127.0.0.1:4173`. An occupied port fails before TestSprite dispatch; an existing server is never reused. The server holds a frozen snapshot of `dist`, serves only exact snapshot paths, rejects symlinks and unsafe paths, and supports GET/HEAD only. The wrapper closes its own server and sockets in `finally`, including failure paths.
4. Compare every built file's SHA-256 against bytes served by that owned server before replay. This includes HTML, JavaScript, CSS, workers and art: currently 48 files, or the complete file set produced by a future build. Repeat the byte comparison afterward and reject any local build-file addition, removal or mutation. Local HTML must match exactly; no Vercel tag normalization is needed.
5. Require exactly the sixteen frontend IDs in the [reviewed manifest](testsprite/pr5-stored-code-manifest.json), with no missing, extra, duplicate or foreign case. Read all sixteen hosted Python bodies, saved code versions and local source hashes against the manifest before dispatch and afterward. Source or version drift fails the gate.
6. Run the project through one owned native tunnel using CLI **0.15.0**, explicit `--no-auto-heal`, concurrency 3 and a 1200-second per-run timeout. The command remains attached until completion; the CLI owns tunnel credentials and cleanup. It does not use a saved borrowed tunnel. The wrapper has a 40-minute command limit inside a 45-minute Actions job.
7. Require all sixteen distinct test IDs and run IDs to pass, with zero failed, skipped, blocked, cancelled or timed-out cases. A missing or zero-test summary fails. Match the native tunnel receipt to those same run identities. Read each actual run and require the expected project, CLI source, fresh dispatch timestamps, exact localhost target and unqualified stored-code replay.
8. Recheck project membership, hosted code, source cleanliness, PR head and every served build file after execution. Failed or incomplete replay still attempts this read-only postflight; postflight never dispatches or heals a test. Any incomplete required proof keeps the job red.
9. Publish only sanitized JSON and JUnit as Actions artifacts. Raw CLI output, API responses, signed videos and authorization values are excluded. The nonsecret tunnel clientID may be recorded; its secret is never included.

Only `http://127.0.0.1:4173` and its root trailing-slash form are accepted as the HTTP run target. Another port, hostname, path, userinfo, query or fragment fails. The reviewed scripts also guard this browser origin, so a missing or incorrect worker URL override cannot silently send them back to an old preview. The three former hardcoded hashed-bundle checks require an active same-origin hashed client instead; the CI build-byte proof establishes the exact app artifact identity.

## Command and credential handling

The wrapper starts and verifies the build server, then invokes:

```sh
testsprite test run --all --project PROJECT_ID \
  --local 4173 --local-host 127.0.0.1 --max-concurrency 3 \
  --no-auto-heal --wait --timeout 1200 \
  --report junit --report-file TEMP_JUNIT \
  --summary-file TEMP_SUMMARY --output json
```

`--local` uses TestSprite's native forwarding service. The execution browser navigates to the runner's localhost address through that tunnel; there is no public preview URL or third-party tunnel domain to allowlist. The CLI holds the tunnel in its process and closes it at the end. An interrupted owned tunnel causes unfinished runs to be cancelled by the CLI's default behavior.

The encrypted repository secret `TESTSPRITE_API_KEY` is supplied only to the trusted credential check and verification step. It is not placed in source, argv, reports or raw logs. The app is served from an in-memory build snapshot rather than exposing the checkout or its files. The job uses the public integration-test backend `VITE_CONVEX_URL=https://fast-starling-207.convex.cloud`; this is client configuration, not a deployment key. Production keeps its separate configuration.

The backend may return `codeVersion: null` and omit `autoHeal` on completed runs. Reports retain those null/absent facts. They separately record explicit no-auto-heal dispatch, reject `autoHeal:true` or an invalid value, require replay path `replay` with null reason/caveat, and prove unchanged hosted source/version before and after. They do not manufacture an individual backend version or `false` healing attestation.

## Scope and merge enforcement

The sixteen cases cover board play, notebook entry, required opponent selection, club and same-device games, save recovery, motion and sound scheduling. They do not replace backend tests or separate independent-player multiplayer acceptance. The selected external Convex development service is not an ephemeral backend deployment of each PR's functions.

A green job blocks merging only when the repository's current branch rules require its actual check context. Inspect the effective rules on `main`; do not infer enforcement from a workflow file alone. GitHub App executions and this reviewed CLI gate are separate results. The App remains installed, while its older agent-driven trigger was disabled so it could not replace reviewed stored scripts during strict verification.

## Focused local verification

```sh
node --test tests/testsprite-ci.test.mjs
```

These tests make no TestSprite API call. They cover incomplete and misleading results, source/version drift, wrong identities and replay qualifications, strict localhost URLs, future branch names, dirty source, tunnel-receipt ownership, occupied ports, cleanup on failure, safe paths, symlinks and changed build files. Tests also retain the historical HTTPS/Vercel verification contracts, which are exported for reading earlier evidence but are not used to select the current gate target.

## Historical evidence

PR #5's public-preview verification remains historical evidence: [strict 16-case Actions run](https://github.com/Davidson3556/Paperwild/actions/runs/40136980632), [four-case multiplayer summary](testsprite/online-cloud-acceptance-summary.json), and [multiplayer source/build audit](testsprite/online-cloud-acceptance-verification.json). Those records bind their own source heads, public targets and deployments. The [earlier automatic-run audit](TESTSPRITE_AUTOMATIC_PR_AUDIT_2026-10-24.md) retains its failures separately. None is substituted for a future PR's localhost-tunnel result.
