# Startup correction — October 21, 2026

**Current result: 14/14 TestSprite cases passed with auto-heal disabled.** The [full strict execution](https://www.testsprite.com/dashboard-v3/o/f7454a95-e992-581a-98e0-4edd142a0891/projects/dafdf75c-04a3-467f-acc2-4359af6b1d8e/execution/3ab518d1-9f5f-4718-b9e3-4d71ecdff3f2) ran October 21, 06:49:17–06:50:38 UTC, with no failures, blocked cases or timeouts. All 14 reviewed stored scripts were read back byte-for-byte before replay.

**Release state:** the tested application correction is `e23a745` in [PR #4](https://github.com/Davidson3556/Paperwild/pull/4), with 94/94 local tests, TypeScript, build, CI and Vercel preview passing for that revision. The [public preview](https://paperwild-git-living-davidson3556s-projects.vercel.app/) serves `index-Dg2nj_lq.js`; production remains on `main` until the PR is merged. Check the current PR head's CI and deployment before merging; this record identifies the tested application revision and assets.

## Reproduced problems

Production and the previously tested PR preview served the same `index-DM9560hN.js` / `index-B8LLeYdr.css` assets after PR #3 merged. The source trees were identical. The merge did not introduce a different build.

The live browser restored a finished checkmate study and saved Moonlight, rain and paused motion. Reloading with that manual pause reproduced a blank notebook title: all nine title letters had computed opacity `0`. The global paused-motion rule canceled their animations, while the loader's static fallback covered only the operating-system media query. The pencil-grid drawing also ran during initial render, finishing beneath the notebook overlay. Repeat visits deliberately shortened the opening and hid the fluttering pages.

![Before: paused loader hides the title and character](media/paperwild-loader-before-2026-10-21.jpg)

## Correction

- Finished saves open a fresh, playable standard board. Their validated history and study are archived first. **Field kit → Revisit last finished game** restores the previous finished chapter explicitly, including its captures and remembrance. Revisit cannot replace an ongoing game or a study. Failed archive writes protect the original finished save during automatic startup/pagehide saves.
- Unfinished games retain the existing full-history restore and Undo behavior.
- The loader and residents use the same saved motion preference. A paused cover has readable text and complete static artwork; its brief entry can still be skipped.
- Every visit retains the complete notebook choreography unless the player skips it. The native **Skip introduction** button supports keyboard activation and cleans up pending timers/image callbacks.
- The pencil grid starts after the cover clears, followed by the residents rising. Startup input and a restored computer turn wait for entry settlement. Disposed pages cannot resume startup work.
- The motion control names its action: **Pause animations** / **Resume animations**.

![After: complete static cover with the same saved pause](media/paperwild-loader-fixed-2026-10-21.jpg)

## Local validation

The final production build is `index-Dg2nj_lq.js` with the unchanged `index-B8LLeYdr.css`. **94/94 local tests**, strict TypeScript, production build and whitespace checks passed. New tests exercise loader timing/cancellation/asset ceiling, unfinished and terminal restore, archive validation/write failure and the guarded revisit path.

Chrome exercised the production build on the isolated local origin `127.0.0.1:4184` through actual controls:

| Check | Observed result |
| --- | --- |
| Normal entry during development | Notebook kept the board folded; after its removal, computed pencil offsets changed during `drawing`, resident transforms changed during `rising`, then 32 pieces and 64 controls settled to `ready`. |
| Final-build saved manual pause | All nine loader title letters had computed opacity `1`; sampled pencil paths had dash offset `0`. The full artwork was visible. |
| Keyboard skip | Enter on the native button requested early opening; a second activation skipped the cover. Entry then settled and released the board. |
| Finished study reload | Actual Qg7# produced a completed study. Same-origin reload opened the standard 32-piece board, White turn, unfinished, no result dialog and no active study. A new e2-e4 move was accepted. |
| Explicit archive revisit | The untouched fresh board offered Revisit in Field kit. It restored the queen on g7, terminal three-piece study, enabled Undo and study context, with no replayed finale overlay. |
| Unfinished reload | A real local e2-e4 position returned with e4 occupied, e2 empty, Black turn, unfinished state and saved pause. Resume restored gentle motion. |
| Browser diagnostics | No warnings or errors were captured during these checks. |

The normal timing observation preceded the archive follow-up; final-build checks above identify the narrower scenarios observed again after that follow-up. Physical sound quality, fresh phone sizing and every possible animation state are not established by this record.

![Corrected full board](media/paperwild-startup-fixed-2026-10-21.jpg)

## TestSprite synchronization

The Portal now has **14 saved cases**, retaining the original ten and adding `NOTE-001`–`NOTE-004` for entry, saved pause/temporal life, keyboard skip/computer timing, and terminal-versus-unfinished reload. The saved plan is [portal-plan.yaml](testsprite/portal-plan.yaml). The existing sound case retains its proven keyboard-focus instructions. The current dated requirements source `PAPERWILD_CURRENT_REQUIREMENTS_2026-10-21.md` is visibly attached in Sources; the earlier document remains historical.

## Earlier Portal execution and runner investigation

The automatic [PR #4 execution](https://www.testsprite.com/dashboard-v3/o/davidson-awokoyas-workspace-f7454a95/projects/dafdf75c-04a3-467f-acc2-4359af6b1d8e/execution/ada30691-cf10-4566-88cd-0f751c9349ef) at `e23a745` reported **11 passed / 1 failed / 2 blocked**. GitHub nevertheless displayed SUCCESS; that integration status is not a clean-suite verdict.

| Added case | Service outcome and audited limit |
| --- | --- |
| NOTE-001: normal/repeat entry | Blocked; cloud evidence did not establish the transient entry assertions. |
| NOTE-002: saved pause and temporal life | Blocked; cloud evidence did not establish its planned temporal assertions. |
| NOTE-003: keyboard skip and deferred reply | Failed. Exported code contained navigation and an unrelated e4 assertion, omitting the planned keyboard, skip, move, entry and computer-timing actions. This is a test-generation gap, not proof the app's skip control is absent. |
| NOTE-004: terminal/unfinished restore | Reported passed. Keep its service verdict separate from unexecuted entry/animation assertions in the other cases. |

Self-contained Python [stored-code overrides](testsprite/overrides/NOTE-001.py) install a bounded read-only observer before navigation, retain the planned assertions, and use actual UI/keyboard actions. The first strict runs of all three failed with a cleanup exception that masked the earlier cause. Cleanup was hardened without removing assertions. The subsequent [NOTE-001 replay](https://www.testsprite.com/dashboard-v3/o/davidson-awokoyas-workspace-f7454a95/projects/dafdf75c-04a3-467f-acc2-4359af6b1d8e/execution/ef8d594b-4ed9-49a7-be36-5aa598d35cd0) (run `1a28c646-2d9e-48fa-936d-aba0a4799534`) exposed the original error:

```text
phase=context.new_page
TargetClosedError: BrowserContext.new_page: Target page, context or browser has been closed
```

This occurred before navigation to Paperwild, so it does not demonstrate an app, asset or animation failure. A controlled follow-up changed only the launch arguments to match the observed generated template, including `--single-process`, while retaining the substantive NOTE-001 assertions. That [strict replay passed](https://www.testsprite.com/dashboard-v3/o/davidson-awokoyas-workspace-f7454a95/projects/dafdf75c-04a3-467f-acc2-4359af6b1d8e/execution/0ad64a4a-c390-4569-b84f-d4c7b3f83c85) at 06:30:44–06:31:09 UTC, run `e0cce4ed-acfe-409b-ba89-541608de2420`, stored code version `v-46256b513908`, with auto-heal disabled. That focused result alone established normal/repeat entry, rather than a full-suite verdict or a general documented browser-flag requirement.

The aligned NOTE-002/003 runners subsequently produced these separate failed attempts:

| Strict attempt | Actual failure | Interpretation |
| --- | --- | --- |
| [NOTE-002](https://www.testsprite.com/dashboard-v3/o/davidson-awokoyas-workspace-f7454a95/projects/dafdf75c-04a3-467f-acc2-4359af6b1d8e/execution/76341962-a490-4219-8ad2-77a45319361e), run `f006472e-9c9f-4db6-a910-209434b189ac` | `UNMEASURED`: a browser-frame gap exceeded the script's 100 ms guard. | The guard stopped execution before the complete blink/part verdict; it did not demonstrate absent animation. |
| [NOTE-003](https://www.testsprite.com/dashboard-v3/o/davidson-awokoyas-workspace-f7454a95/projects/dafdf75c-04a3-467f-acc2-4359af6b1d8e/execution/09b083f1-2c04-4022-a234-734532d93d83), run `412e1909-8d3e-46fa-8a24-b15a00d5a939` | `TargetClosedError` during `context.new_page`. | An isolated context could not create its page; this does not establish an app/keyboard failure. |

The revised NOTE-002 requires actual timestamped open → closed → open blink evidence over its natural idle window, retains changing painted-part transforms and unchanged-chess assertions, and reports maximum sampling gap as a diagnostic. NOTE-002/003 capture each completed scenario, retire its browser/context, and relaunch the matched template for the next isolated scenario. Context-ordinal phases and primary-error-preserving cleanup remain. These runner corrections do not alter the app, manufacture game state, or delay app animation.

### Focused strict replays after runner correction

| Case | Strict replay | Stored code version |
| --- | --- | --- |
| NOTE-001: full normal/repeat entry | [Passed](https://www.testsprite.com/dashboard-v3/o/davidson-awokoyas-workspace-f7454a95/projects/dafdf75c-04a3-467f-acc2-4359af6b1d8e/execution/0ad64a4a-c390-4569-b84f-d4c7b3f83c85) | `v-46256b513908` |
| NOTE-002: saved pause and temporal life | [Passed](https://www.testsprite.com/dashboard-v3/o/davidson-awokoyas-workspace-f7454a95/projects/dafdf75c-04a3-467f-acc2-4359af6b1d8e/execution/7000d9d5-e129-4a48-b360-2491f5f5d997) | `v-036dd065a36e` |
| NOTE-003: keyboard skip and deferred reply | [Passed](https://www.testsprite.com/dashboard-v3/o/davidson-awokoyas-workspace-f7454a95/projects/dafdf75c-04a3-467f-acc2-4359af6b1d8e/execution/7ed05da6-f36a-4683-b38e-049adba8b6ae) | `v-3125e1508c49` |

All three used strict stored-code replay with auto-heal disabled. Readback was byte-identical to the scripts; their SHA-256 values, target, build and run identifiers are recorded in [startup-replay-results.json](testsprite/startup-replay-results.json). These focused results preceded the full-suite attempts below.

### First full strict batch and legacy repair

The full strict batch `508a04e8-add2-46c3-8c5c-bab4bcbecdbb` completed with **6 passed / 8 failed**. NOTE-001–003 passed again. Two confirmed test-code problems are:

| Case / run | Actual result | Stored-code correction |
| --- | --- | --- |
| NOTE-004, `3a4fdbe7-d191-491a-aabf-b6ae6248af86` | `no_stored_code`; no app code executed. | [Stored-code scenario](testsprite/overrides/NOTE-004.py): finish the real mate, reload fresh, revisit its history/study, protect a new game, reload a terminal draw, then restore/undo an unfinished capture with matching remembrance. |
| SOUN-001, `72b7a9bf-4b80-4476-8c17-ef8fe9351847` | Exported code reopened the guide, omitted Tab/Enter, then expected the still-off sound control to be on. The error does not establish an app ARIA defect. | [Stored-code scenario](testsprite/overrides/SOUN-001.py): real six-role auditions, counter/role events, mute/reload, inspected Tab traversal to Hear the hare, and actual Enter before checking its new scheduled greeting. |

The sound failure bundle was downloaded through the official CLI and its saved code inspected. The replacement tests use actual UI changes and read-only DOM assertions, without injecting game/storage/audio state. Voice callbacks establish scheduling, not physical sound quality.

Review also found missing intermediate assertions in three legacy cases that had reported service passes: BOAR-005/006 checked only the pawn/squares after Undo; BOAR-007 checked only g6/h8 square visibility. Those exports did not establish the planned promotion, checking/drawn position, winner, terminal rejection or full state restoration. The replacement scripts check those intermediate outcomes and exact Undo restoration. All 14 scripts were reviewed, including the other failing legacy cases; fixes changed test execution and assertions without changing the tested app or manufacturing state.

### Corrected full strict batch: 14/14 passed

The [corrected execution](https://www.testsprite.com/dashboard-v3/o/f7454a95-e992-581a-98e0-4edd142a0891/projects/dafdf75c-04a3-467f-acc2-4359af6b1d8e/execution/3ab518d1-9f5f-4718-b9e3-4d71ecdff3f2) began at **06:49:17 UTC**, with the last NOTE-004 scenario completing at **06:50:38 UTC**. It returned **14 passed / 0 failed / 0 blocked / 0 timed out**, with auto-heal disabled, against application `e23a745` / `index-Dg2nj_lq.js` on the public PR preview.

Before replay, every stored Python code field was read back and byte-compared with its local file. The [actual full-suite summary](testsprite/startup-corrected-strict-summary.json) records all 14 runs; the [stored-code manifest](testsprite/stored-code-manifest.json) records each case, version and SHA-256. The [replay record](testsprite/startup-replay-results.json) links the successful batch to its earlier attempts. The [self-contained scripts](testsprite/overrides/README.md) preserve real input, exact chess assertions, pre-navigation temporal observation where needed, and bounded image readiness rather than arbitrary entry delays.

![TestSprite hosted strict replay: all 14 cases passed](media/paperwild-strict-14-passed-2026-10-21.jpg)

This establishes the corrected 14-case desktop suite on the identified preview. It does not execute every scenario in the broader 24-scenario acceptance specification or certify physical audio quality and fresh phone layout. The earlier 10/10 results belong to `5867e28`; the automatic 11/1/2 and first strict 6/8 outcomes above remain historical evidence. Check the current PR head's CI and deployment before merging; verify production separately after the user merges the PR.
