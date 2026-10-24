# Stored TestSprite Playwright cases

These 16 self-contained Python scripts implement the cases in [the Portal plan](../portal-plan.yaml). They use real controls and keyboard input, with read-only DOM assertions. They do not inject game state or storage, replace timers, force clicks, or manufacture animation/audio flags. Each defines `async def run_test()` and invokes it with `asyncio.run(run_test())`, matching the hosted Python execution format.

The current feature adds mandatory first-visit onboarding and an explicit opponent choice. The fourteen historical cases now finish that flow through real controls before their original chess, sound, or motion assertions. The two ONBD cases exercise the gate itself without an automatic completion helper. These corrected files report **16/16 passed** in the [October 24 strict replay](https://www.testsprite.com/dashboard-v3/o/f7454a95-e992-581a-98e0-4edd142a0891/projects/dafdf75c-04a3-467f-acc2-4359af6b1d8e/execution/625ffd76-0868-49a4-b6f2-f7f878e2e965), dispatched with `--no-auto-heal`. The [completed post-run audit](../pr5-strict-verification.json) verifies all sixteen unqualified replay records and unchanged stored-source hashes, plus all 48 public application payloads. The API omits per-run `autoHeal` and returns null code versions; those nulls are retained rather than invented. See the [verification record](../../TESTSPRITE_ONBOARDING_RUN_2026-10-24.md). The October 21 pass below covers the previous versions only. `TEST_TARGET_URL` overrides a script's fallback only when the runner actually supplies that environment variable; do not assume local environment variables reach the hosted runner. All sixteen fallbacks point to the [Convex/onboarding PR preview](https://paperwild-git-feat-convex-multiplayer-davidson3556s-projects.vercel.app/). The inspected application build at `6f17355` serves `index-B86TWJUu.js` and `index-DCOXjeBT.css`; the three `TEST_EXPECTED_BUNDLE` fallbacks match that JS asset. A narrowly scoped deployment-access exception makes this preview available for hosted tests. Verify access again before replay; a protected login page is a blocked test target, not evidence of an application defect.

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

Use the [official CLI](https://github.com/TestSprite/testsprite-cli/blob/main/DOCUMENTATION.md) to store and replay these files. The case labels above are plan identifiers; obtain each actual API test ID with `test list`. Authenticate separately with `testsprite setup --no-agent`; keep credentials out of the repository and command output.

```sh
npm install -g @testsprite/testsprite-cli
testsprite auth status
testsprite test list --project <project-id> --output json
testsprite test code get <test-id> --out <previous-code.py>
testsprite test code put <test-id> --code-file docs/testsprite/overrides/NOTE-001.py
testsprite test code get <test-id> --out <readback.py>
testsprite test run <test-id> --target-url https://paperwild-git-feat-convex-multiplayer-davidson3556s-projects.vercel.app/ --no-auto-heal --wait --timeout 600 --output json
```

Upload the matching file for every case and compare each readback's SHA-256 with the local file. `code put --expected-version <version>` can guard against overwriting a concurrent edit. Inspect the run's actual target, code version and `autoHeal=false`; a successful upload or green GitHub status does not prove the assertions ran. If strict replay is unsupported or stored code is missing, report that failure rather than silently switching to generated code. Once all 16 stored versions are confirmed, run:

```sh
testsprite test run --all --project <project-id> --target-url https://paperwild-git-feat-convex-multiplayer-davidson3556s-projects.vercel.app/ --no-auto-heal --wait --timeout 600 --output json
```

The launch arguments match this project's observed TestSprite template: `--window-size=1280,720`, `--disable-dev-shm-usage`, `--ipc=host`, and `--single-process`. NOTE-001 passed after matching that template; an earlier launcher failed before navigation. NOTE-002/003 retire each isolated browser before starting the next scenario. This is compatibility observed in this runner, not a general Chromium requirement. Cleanup preserves the original failure and phase even when closing resources fails.

NOTE-001–003 install a bounded, read-only observer before navigation in `window.__pwObserved`, so intermediate rendered phases and actual temporal samples are measured. Missing evidence fails the relevant assertion. NOTE-002 requires a same-resident open→closed→open blink cycle and distinct painted-part transforms; frame gaps remain diagnostics. The sound case checks actual scheduling counters after real input; it does not certify physical speaker output or sound quality. None of these checks replaces a human visual review on desktop and phone.

**Historical result:** all 14 previous case versions passed strict hosted replay with auto-heal disabled in the [October 21 execution](https://www.testsprite.com/dashboard-v3/o/f7454a95-e992-581a-98e0-4edd142a0891/projects/dafdf75c-04a3-467f-acc2-4359af6b1d8e/execution/3ab518d1-9f5f-4718-b9e3-4d71ecdff3f2), 06:49:17–06:50:38 UTC. Every script in that historical run was reviewed and its stored code read back byte-for-byte before execution, including the image-readiness helpers used for that release. See the [actual summary](../startup-corrected-strict-summary.json), [stored-code versions/hashes](../stored-code-manifest.json), [replay record](../startup-replay-results.json) and [verification chronology](../../STARTUP_VERIFICATION_2026-10-21.md). That result does not validate the new onboarding helpers or the two ONBD scripts. Check the current PR head's CI and deployment before merging; this preview pass identifies the tested application revision/assets and is not a production deployment. Keep API keys and signed video URLs outside this directory.
