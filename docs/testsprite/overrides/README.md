# Stored TestSprite Playwright cases

These 16 self-contained Python scripts implement the cases in [the Portal plan](../portal-plan.yaml). They use real controls and keyboard input, with read-only DOM assertions. They do not inject game state or storage, replace timers, force clicks, or manufacture animation/audio flags. Each defines `async def run_test()` and invokes it with `asyncio.run(run_test())`, matching the hosted Python execution format.

The fourteen earlier cases finish mandatory onboarding and explicitly choose an opponent before their chess, sound, or motion assertions. The two ONBD cases exercise that gate without an automatic completion helper.

**Current transport: proposed loopback CI replay; execution pending.** All sixteen scripts default to `http://127.0.0.1:4173/`. Each validates `TEST_TARGET_URL` before launching the browser: only HTTP at the exact host/port `127.0.0.1:4173`, an empty or root path, and no query or fragment are accepted. Supplying a public preview, Production URL, alternate host, or different port fails immediately. Use the native TestSprite CLI tunnel to reach the runner's owned server; local shell environment variables are not assumed to reach hosted Python workers.

`BOAR-004`, `BOAR-008`, and `PREF-001` each require one same-origin application module whose path matches `/assets/index-<hash>.js`. There is no fixed bundle filename fallback. `TEST_EXPECTED_BUNDLE`, when explicitly supplied to a worker, adds an exact filename pin; an unset variable leaves the portable module check in place. The CI wrapper independently hashes every served build file before and after replay, so the module-name pattern alone is not the artifact-identity check. The [current reviewed manifest](../pr5-stored-code-manifest.json) must match every local file and hosted version before dispatch.

**Historical October 24 result:** earlier preview-target script versions reported **16/16 passed** in the [strict replay](https://www.testsprite.com/dashboard-v3/o/f7454a95-e992-581a-98e0-4edd142a0891/projects/dafdf75c-04a3-467f-acc2-4359af6b1d8e/execution/625ffd76-0868-49a4-b6f2-f7f878e2e965), dispatched with `--no-auto-heal`. Its [completed audit](../pr5-strict-verification.json), [pre-cloud manifest](../pr5-pre-cloud-stored-code-manifest.json), and [verification record](../../TESTSPRITE_ONBOARDING_RUN_2026-10-24.md) identify those older sources, replay records, and 48 public application payloads. The [manifest archived before the tunnel change](../history/pr5-stored-code-manifest-before-tunnel-2026-10-25.json) preserves the later reviewed preview versions. Neither record is a pass for the current loopback-target Python files. The API's absent per-run `autoHeal` and null code versions remain absent/null in those records. Historical Vercel access exceptions and fixed bundle names do not configure this new transport.

The historical-case entry helper deliberately chooses club play unless a scenario explicitly requests same-device play. Before an initial choice, the application correctly leaves both underlying mode buttons unpressed; the helper does not infer a mode from them. NOTE-004 explicitly selects local play after completed study reloads so its original retained-mode assertions still apply.

| Case | Script | Assertions |
| --- | --- | --- |
| ONBD-001 | [ONBD-001.py](ONBD-001.py) | Fresh guide, required unselected chooser, Escape/backdrop gating, pre-choice reload, confirmed zero-ply reload and same-device play. |
| ONBD-002 | [ONBD-002.py](ONBD-002.py) | Explicit club choice produces one legal reply; replaying the tour and canceling a later new-game choice preserve the exact game. |
| BOAR-001 | [BOAR-001.py](BOAR-001.py) | Illegal and wrong-side moves leave chess state unchanged. |
| BOAR-002 | [BOAR-002.py](BOAR-002.py) | Legal local opening produces the exact board, history and turn. |
| BOAR-003 | [BOAR-003.py](BOAR-003.py) | Capture and Undo restore board, capture state and history together. |
| BOAR-004 | [BOAR-004.py](BOAR-004.py) | Cancelling promotion preserves the pending position. |
| BOAR-005 | [BOAR-005.py](BOAR-005.py) | Queen promotion produces a playable checking position. |
| BOAR-006 | [BOAR-006.py](BOAR-006.py) | Knight promotion reaches the expected draw and supports Undo. |
| BOAR-007 | [BOAR-007.py](BOAR-007.py) | Checkmate locks play; Undo restores play. |
| BOAR-008 | [BOAR-008.py](BOAR-008.py) | Computer reply settles; Undo restores the whole turn. |
| PREF-001 | [PREF-001.py](PREF-001.py) | Saved capture, light, weather and pause restore; Undo remains usable. |
| SOUN-001 | [SOUN-001.py](SOUN-001.py) | Six voice auditions schedule sounds; mute persists; actual Tab/Enter activates the hare. |
| NOTE-001 | [NOTE-001.py](NOTE-001.py) | Normal and repeat openings visibly progress through cover, pencil drawing and resident entry. |
| NOTE-002 | [NOTE-002.py](NOTE-002.py) | Saved pause keeps the loader readable; Resume produces an observed blink cycle and part motion; OS reduced motion stays static. |
| NOTE-003 | [NOTE-003.py](NOTE-003.py) | Keyboard skip works early and during opening; an unfinished computer game restores and defers its reply until entry settles. |
| NOTE-004 | [NOTE-004.py](NOTE-004.py) | Terminal reload starts fresh; explicit revisit restores the archive; unfinished capture, study and remembrance restore and support Undo. |

Use the [official CLI](https://github.com/TestSprite/testsprite-cli/blob/main/DOCUMENTATION.md), pinned to **0.15.0**, to store and replay these files. The case labels above are plan identifiers; obtain each actual API test ID with `test list`. Authenticate separately with `testsprite setup --no-agent`, or supply `TESTSPRITE_API_KEY` through private process/CI configuration. Keep the key out of files, command arguments, logs, and repository history.

```sh
npm install -g @testsprite/testsprite-cli@0.15.0
testsprite auth status
testsprite test list --project <project-id> --output json
testsprite test code get <test-id> --out <previous-code.py>
testsprite test code put <test-id> --expected-version <old-version-from-readback> --code-file docs/testsprite/overrides/NOTE-001.py
testsprite test code get <test-id> --out <readback.py>
```

Every `code put` must include `--expected-version` with the version just read from the existing hosted case. Stop on a version conflict, inspect the new source, and resolve the concurrent change before publishing. Upload the matching file for every case, compare each readback's SHA-256 with its local file, and record the new versions in the reviewed manifest. A successful upload or green GitHub status does not prove the assertions ran. Missing stored code or unsupported strict replay must fail visibly, without a switch to generated code.

Before execution, build the exact intended source and serve **that `dist/`** at `http://127.0.0.1:4173/`; do not point the tunnel at a development server or another checkout. For the CI regression binding, build with the public Development URL `VITE_CONVEX_URL=https://fast-starling-207.convex.cloud`. Production keeps its separate backend configuration. For a manual replay, leave the built server running in a separate terminal:

```sh
VITE_CONVEX_URL=https://fast-starling-207.convex.cloud npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

Once all sixteen stored versions and exact project membership are confirmed, run the native local tunnel with bounded concurrency:

```sh
testsprite test run --all --project <project-id> --local 4173 --local-host 127.0.0.1 --max-concurrency 3 --no-auto-heal --wait --timeout 1200 --output json
```

Use the local-tunnel options above without `--target-url`. No public Vercel preview exception is needed. The [Actions gate](../../TESTSPRITE_PR_GATE.md) additionally verifies the exact PR revision, all sixteen stored bodies/versions and membership, actual target/replay outcomes, and every served build file before and after execution. Preserve unavailable per-run API code-version/auto-heal fields as null or absent; explicit dispatch options, unqualified replay, and independent source readbacks establish their separate evidence. The revised tunnel path has not yet produced a passing run.

The launch arguments match this project's observed TestSprite template: `--window-size=1280,720`, `--disable-dev-shm-usage`, `--ipc=host`, and `--single-process`. NOTE-001 passed after matching that template; an earlier launcher failed before navigation. NOTE-002/003 retire each isolated browser before starting the next scenario. This is compatibility observed in this runner, not a general Chromium requirement. Cleanup preserves the original failure and phase even when closing resources fails.

NOTE-001–003 install a bounded, read-only observer before navigation in `window.__pwObserved`, so intermediate rendered phases and actual temporal samples are measured. Missing evidence fails the relevant assertion. NOTE-002 requires a same-resident open→closed→open blink cycle and distinct painted-part transforms; frame gaps remain diagnostics. The sound case checks actual scheduling counters after real input; it does not certify physical speaker output or sound quality. None of these checks replaces a human visual review on desktop and phone.

**Historical result:** all 14 previous case versions passed strict hosted replay with auto-heal disabled in the [October 21 execution](https://www.testsprite.com/dashboard-v3/o/f7454a95-e992-581a-98e0-4edd142a0891/projects/dafdf75c-04a3-467f-acc2-4359af6b1d8e/execution/3ab518d1-9f5f-4718-b9e3-4d71ecdff3f2), 06:49:17–06:50:38 UTC. Every script in that historical run was reviewed and its stored code read back byte-for-byte before execution, including the image-readiness helpers used for that release. See the [actual summary](../startup-corrected-strict-summary.json), [stored-code versions/hashes](../stored-code-manifest.json), [replay record](../startup-replay-results.json) and [verification chronology](../../STARTUP_VERIFICATION_2026-10-21.md). That result does not validate the new onboarding helpers or the two ONBD scripts. Check the current PR head's CI and deployment before merging; this preview pass identifies the tested application revision/assets and is not a production deployment. Keep API keys and signed video URLs outside this directory.
