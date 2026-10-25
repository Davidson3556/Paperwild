# Stored TestSprite Playwright cases

These 16 self-contained Python scripts implement the cases in [the Portal plan](../portal-plan.yaml). They use real controls and keyboard input, with read-only DOM assertions. They do not inject game state or storage, replace timers, force clicks, or manufacture animation/audio flags. Each defines `async def run_test()` and invokes it with `asyncio.run(run_test())`, matching the hosted Python execution format.

The fourteen earlier cases finish mandatory onboarding and explicitly choose an opponent before their chess, sound, or motion assertions. The two ONBD cases exercise that gate without an automatic completion helper.

**Replacement transport: planned direct-public CI replay; execution pending.** The initial PR #6 native-tunnel attempt returned sixteen service-blocked cases before gameplay: TestSprite does not support deterministic `--no-auto-heal` replay through that tunnel. This is not an application failure. The replacement being prepared uses a separate public Vercel project, `paperwild-ci`, built with the Development client URL. Production and the existing feature preview keep their separate configuration and protection settings.

The loopback-target revisions defaulted to `http://127.0.0.1:4173/` and strictly rejected every other origin/path. Subsequent controlled direct-public probes showed that neither `--target-url` alone nor a named `TEST_TARGET_URL` environment option supplied that value to the strict Python worker; both failed at module loading before gameplay. An account environment limit also prevented adding another environment, and this design does not require a plan upgrade.

**Canonical target-only templates:** every committed Python file contains exactly one anchored `TARGET = "__PAPERWILD_CI_TARGET_URL__"` assignment. An unbound template fails closed before navigation. The gate verifies its full canonical source hash, verifies the actual unique HTTPS deployment, then renders only that assignment to the approved URL. It publishes the rendered body with a compare-and-set `--expected-version` guard, reads it back exactly, and records its actual version and rendered SHA-256. All gameplay code and assertions remain unchanged. A global TestSprite-project workflow lock prevents concurrent PR jobs from rebinding the shared cases.

The dedicated Vercel CI project is `paperwild-ci`, ID `prj_K4XUFAg81KYU0YxfC0ISyU3JRhox`. Its generated unique hostname may start with `paperwild-`; a name pattern alone does not prove that it belongs to this project. GitHub deployment evidence, CI configuration and Vercel project metadata must identify the approved source/project before any binding. Neither an older preview pass nor the failed transport probes validate the new binding route; its full-suite result remains pending.

`BOAR-004`, `BOAR-008`, and `PREF-001` each require one same-origin application module whose path matches `/assets/index-<hash>.js`. There is no fixed bundle filename fallback. `TEST_EXPECTED_BUNDLE`, if explicitly available to a worker, adds an exact filename pin; an unset variable leaves the portable module check in place. The CI wrapper independently hashes every public build file before and after replay, so the module-name pattern alone is not the artifact-identity check. In the [current reviewed manifest](../pr5-stored-code-manifest.json), `sha256` identifies the canonical template; `storedSha256` and `codeVersion` identify the seed rendering/version. Each run records its own guarded binding receipt and verifies that actual rendered version/body before and after replay. The seed version is not assumed to be the current per-run version.

**Historical October 24 result:** earlier preview-target script versions reported **16/16 passed** in the [strict replay](https://www.testsprite.com/dashboard-v3/o/f7454a95-e992-581a-98e0-4edd142a0891/projects/dafdf75c-04a3-467f-acc2-4359af6b1d8e/execution/625ffd76-0868-49a4-b6f2-f7f878e2e965), dispatched with `--no-auto-heal`. Its [completed audit](../pr5-strict-verification.json), [pre-cloud manifest](../pr5-pre-cloud-stored-code-manifest.json), and [verification record](../../TESTSPRITE_ONBOARDING_RUN_2026-10-24.md) identify those older sources, replay records, and 48 public application payloads. The [manifest archived before the tunnel change](../history/pr5-stored-code-manifest-before-tunnel-2026-10-25.json) preserves the later reviewed preview versions. Neither record is a pass for later loopback or public-CI Python revisions. The API's absent per-run `autoHeal` and null code versions remain absent/null in those records. Historical Vercel access exceptions and fixed bundle names do not configure the new CI project.

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
testsprite test code put <test-id> --expected-version <old-version-from-readback> --code-file <verified-rendered-NOTE-001.py>
testsprite test code get <test-id> --out <readback.py>
```

Every `code put` must include `--expected-version` with the version just read from the existing hosted case. Stop on a version conflict, inspect the new source, and resolve the concurrent change before publishing. Publish only a rendering whose sole change from the verified canonical template is the one approved target literal. Compare each readback's SHA-256 with that exact rendering and save its new version in the run's binding receipt. Do not upload an unbound template for execution or treat a changed gameplay body as a target-only update. A successful upload or green GitHub status does not prove the assertions ran. Missing stored code or unsupported strict replay must fail visibly, without a switch to generated code.

Before execution, build the exact intended source with the public Development URL `VITE_CONVEX_URL=https://fast-starling-207.convex.cloud`. Deploy that source to the approved public CI project and compare every public payload with the local reference build. A reachable page alone is insufficient: exact PR source, deployment identity, complete project membership and reviewed hosted code must match before dispatch. Production keeps its separate backend configuration.

```sh
VITE_CONVEX_URL=https://fast-starling-207.convex.cloud npm run build
```

Once the public target and all sixteen bound bodies/version receipts are confirmed, the planned direct-public command is:

```sh
testsprite test run --all --project <project-id> --target-url <approved-unique-https-ci-origin> --max-concurrency 3 --no-auto-heal --wait --timeout 1200 --summary-file <private-summary.json> --report junit --report-file <private-junit.xml> --output json
```

The placeholder must match the approved URL already bound into the stored Python bodies; the CLI target option does not replace that binding. It is not the Production game or a borrowed tunnel. For a public run, `--max-concurrency 3` limits CLI polling concurrency, not the service's execution concurrency. Keep raw summaries and reports private until sanitized. The [Actions gate](../../TESTSPRITE_PR_GATE.md) must verify the exact PR revision, canonical templates, all sixteen actual bound bodies/version receipts and membership, actual target/replay outcomes, and every public build file before and after execution. Preserve unavailable per-run API code-version/auto-heal fields as null or absent; explicit dispatch options, unqualified replay, and independent source readbacks establish their separate evidence. The replacement public route has not yet produced a passing full-suite run.

The launch arguments match this project's observed TestSprite template: `--window-size=1280,720`, `--disable-dev-shm-usage`, `--ipc=host`, and `--single-process`. NOTE-001 passed after matching that template; an earlier launcher failed before navigation. NOTE-002/003 retire each isolated browser before starting the next scenario. This is compatibility observed in this runner, not a general Chromium requirement. Cleanup preserves the original failure and phase even when closing resources fails.

NOTE-001–003 install a bounded, read-only observer before navigation in `window.__pwObserved`, so intermediate rendered phases and actual temporal samples are measured. Missing evidence fails the relevant assertion. NOTE-002 requires a same-resident open→closed→open blink cycle and distinct painted-part transforms; frame gaps remain diagnostics. The sound case checks actual scheduling counters after real input; it does not certify physical speaker output or sound quality. None of these checks replaces a human visual review on desktop and phone.

**Historical result:** all 14 previous case versions passed strict hosted replay with auto-heal disabled in the [October 21 execution](https://www.testsprite.com/dashboard-v3/o/f7454a95-e992-581a-98e0-4edd142a0891/projects/dafdf75c-04a3-467f-acc2-4359af6b1d8e/execution/3ab518d1-9f5f-4718-b9e3-4d71ecdff3f2), 06:49:17–06:50:38 UTC. Every script in that historical run was reviewed and its stored code read back byte-for-byte before execution, including the image-readiness helpers used for that release. See the [actual summary](../startup-corrected-strict-summary.json), [stored-code versions/hashes](../stored-code-manifest.json), [replay record](../startup-replay-results.json) and [verification chronology](../../STARTUP_VERIFICATION_2026-10-21.md). That result does not validate the new onboarding helpers or the two ONBD scripts. Check the current PR head's CI and deployment before merging; this preview pass identifies the tested application revision/assets and is not a production deployment. Keep API keys and signed video URLs outside this directory.
