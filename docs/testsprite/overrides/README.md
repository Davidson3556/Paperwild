# Stored TestSprite Playwright cases

These 14 self-contained Python scripts implement the cases in [the Portal plan](../portal-plan.yaml). They use real controls and keyboard input, with read-only DOM assertions. They do not inject game state or storage, replace timers, force clicks, or manufacture animation/audio flags. Each defines `async def run_test()` and invokes it with `asyncio.run(run_test())`, matching the hosted Python execution format.

The default target is **<https://paperwild-git-living-davidson3556s-projects.vercel.app/>**, the public [PR #4](https://github.com/Davidson3556/Paperwild/pull/4) preview. The application revision under test is `e23a745`, with `index-Dg2nj_lq.js` and `index-B8LLeYdr.css`; documentation commits can change the PR head without changing those application assets. This correction has not yet been merged into production. `TEST_TARGET_URL` overrides the script's target only when the runner actually supplies that environment variable; do not assume local environment variables reach the hosted runner.

| Case | Script | Assertions |
| --- | --- | --- |
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
testsprite test run <test-id> --target-url https://paperwild-git-living-davidson3556s-projects.vercel.app/ --no-auto-heal --wait --timeout 600 --output json
```

Upload the matching file for every case and compare each readback's SHA-256 with the local file. `code put --expected-version <version>` can guard against overwriting a concurrent edit. Inspect the run's actual target, code version and `autoHeal=false`; a successful upload or green GitHub status does not prove the assertions ran. If strict replay is unsupported or stored code is missing, report that failure rather than silently switching to generated code. Once all 14 stored versions are confirmed, run:

```sh
testsprite test run --all --project <project-id> --target-url https://paperwild-git-living-davidson3556s-projects.vercel.app/ --no-auto-heal --wait --timeout 600 --output json
```

The launch arguments match this project's observed TestSprite template: `--window-size=1280,720`, `--disable-dev-shm-usage`, `--ipc=host`, and `--single-process`. NOTE-001 passed after matching that template; an earlier launcher failed before navigation. NOTE-002/003 retire each isolated browser before starting the next scenario. This is compatibility observed in this runner, not a general Chromium requirement. Cleanup preserves the original failure and phase even when closing resources fails.

NOTE-001–003 install a bounded, read-only observer before navigation in `window.__pwObserved`, so intermediate rendered phases and actual temporal samples are measured. Missing evidence fails the relevant assertion. NOTE-002 requires a same-resident open→closed→open blink cycle and distinct painted-part transforms; frame gaps remain diagnostics. The sound case checks actual scheduling counters after real input; it does not certify physical speaker output or sound quality. None of these checks replaces a human visual review on desktop and phone.

**All 14 cases passed strict hosted replay with auto-heal disabled** in the [October 21 execution](https://www.testsprite.com/dashboard-v3/o/f7454a95-e992-581a-98e0-4edd142a0891/projects/dafdf75c-04a3-467f-acc2-4359af6b1d8e/execution/3ab518d1-9f5f-4718-b9e3-4d71ecdff3f2), 06:49:17–06:50:38 UTC. Every script was reviewed and its stored code read back byte-for-byte before the run, including the final image-readiness helpers. See the [actual summary](../startup-corrected-strict-summary.json), [stored-code versions/hashes](../stored-code-manifest.json), [replay record](../startup-replay-results.json) and [verification chronology](../../STARTUP_VERIFICATION_2026-10-21.md). Check the current PR head's CI and deployment before merging; this preview pass identifies the tested application revision/assets and is not a production deployment. Keep API keys and signed video URLs outside this directory.
