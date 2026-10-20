# TestSprite PR recovery — October 20, 2026

## Scope

- Repository: [Davidson3556/Paperwild](https://github.com/Davidson3556/Paperwild).
- Existing [PR #3](https://github.com/Davidson3556/Paperwild/pull/3), living into main, head `869a1f95ded63469033abd9b5f1e64f377540883`.
- Target: <https://paperwild-git-living-davidson3556s-projects.vercel.app/>.
- Local additions were not committed, pushed, deployed, or merged during this recovery.

## Access and dispatch

The living preview was added to Vercel's Deployment Protection Exceptions with the user's approval. This makes that domain publicly accessible until its exception is removed. Project-wide Require Log In remains enabled; the pre-existing ci preview exception remains unchanged. No automation secret was created.

An unauthenticated HEAD request returned **HTTP/2 200 with no redirect**. The browser then loaded Paperwild with the full chess board and controls.

The account reported **Free and 371 credits before this run**. Both the workspace billing page and [current official pricing](https://www.testsprite.com/pricing) list GitHub PR auto-testing for one repository on Free. The historical billing rejection does not establish current ineligibility.

Retrying the last old billing-blocked PR #3 delivery changed it to **Failed to start tests**. A fresh test event was then sent using the existing PR, its Vercel bot comment, and the same target pattern as the saved trigger:

```text
https://paperwild-git-{branch-slug}-davidson3556s-projects.vercel.app
```

The setup wizard was cancelled after sending the event; no duplicate trigger was created. Activity displayed **PR #3 dispatch:manual-test — Tests started — 869a1f9** and linked a new execution. The existing trigger remains configured for Vercel bot comments.

## Execution evidence

- [Portal execution 791945ef-5503-40fc-9d92-e51c74c6e88a](https://www.testsprite.com/dashboard-v3/o/davidson-awokoyas-workspace-f7454a95/projects/dafdf75c-04a3-467f-acc2-4359af6b1d8e/execution/791945ef-5503-40fc-9d92-e51c74c6e88a).
- [New GitHub bot comment](https://github.com/Davidson3556/Paperwild/pull/3#issuecomment-6301796342), created at 21:23:57 UTC (22:23:57 WAT).
- New TestSprite V3 commit status: initially **PENDING** at 21:23:58 UTC, then **SUCCESS** at 21:28:33 UTC.
- Portal run count increased from four to five; all ten tests began execution.
- The opening test's live Run log explicitly records initial navigation to the living preview. The execution header still displays the project's default production domain, so the actual navigation log is the stronger target evidence.

**First execution result: 9 passed / 0 failed / 1 blocked / 10 total.** All eight Board Play cases and the saved-game persistence case passed. The sound case was blocked on the final post-reload keyboard activation. GitHub reported success despite that blocked result. The bot report's narrative says eight passed, but its structured totals, nine-row pass table, and Portal summary agree on nine. The earlier October 18 failed CheckRun remains separate from the new successful status context.

## Sound case investigation

The blocked run reached the guide after reload with sound off, then stopped with **Hear the moth** focused. It did not establish that the hare was unreachable or that its Enter handler failed. Its generated focus-management diagnosis was treated as a hypothesis.

Direct interaction on the same living preview reproduced the relevant state: enable sound through a guide voice, mute it, select local play, reload, and open the guide with sound still off. Starting at Close instructions, five real Tab presses produced this focus sequence:

```text
Hear the badger → Hear the fox → Hear the stump → Hear the moth → Hear the hare
```

Pressing Enter while the hare held focus changed `#sound[aria-pressed]` from `false` to `true`, increased its voice count from absent to `1`, and recorded `data-voice-events="n:greet"`. All 64 square values and the turn/game-over/thinking/moving attributes were unchanged. No product-code change was required for this reproduction; physical playback quality was not assessed.

Only action step 11 of test case `06093f89-2095-4a14-b7db-101e715ae206` was clarified: inspect the focused accessible label after each real Tab, continue one more Tab when on the moth, verify the hare holds focus, then press Enter. The step explicitly retains keyboard activation; a mouse click does not satisfy it. The goal and all assertion steps, including the final sound/event/chess-state assertions, remain unchanged. Save & Run saved the definition and started its required standalone rerun.

The [standalone rerun 914b17c4-cbac-476d-ac07-c3e3ec9117ca](https://www.testsprite.com/dashboard-v3/o/davidson-awokoyas-workspace-f7454a95/projects/dafdf75c-04a3-467f-acc2-4359af6b1d8e/execution/914b17c4-cbac-476d-ac07-c3e3ec9117ca) reported **1 passed / 0 failed / 0 blocked** in the project's default environment. It is separate from the two PR executions and is not counted as PR-preview evidence.

## Corrected PR rerun

A second fresh test event queued the complete ten-case suite after saving that definition, still against unchanged PR head `869a1f9` and the living preview. The unsaved trigger wizard was again cancelled, so no duplicate trigger was created.

- [Second PR execution 94f9ca4e-ebe0-4bf0-b667-08c68cd407a9](https://www.testsprite.com/dashboard-v3/o/davidson-awokoyas-workspace-f7454a95/projects/dafdf75c-04a3-467f-acc2-4359af6b1d8e/execution/94f9ca4e-ebe0-4bf0-b667-08c68cd407a9).
- [Second GitHub bot report](https://github.com/Davidson3556/Paperwild/pull/3#issuecomment-6301978202), created at 21:33:07 UTC (22:33:07 WAT).
- New pending TestSprite status at 21:33:08 UTC, followed by **SUCCESS** at 21:37:09 UTC (22:37:09 WAT).

**Second PR result: 10 passed / 0 failed / 0 blocked / 10 total.** Portal's completed summary, its ten individual Passed rows, and the GitHub bot report agree. The first execution's blocked result remains historical evidence. The run's read-only sound plan includes the clarified keyboard action and all original assertions.

| Case | Final PR service verdict |
| --- | --- |
| Simple opening advances update history and turn | Passed |
| Illegal moves leave the board unchanged | Passed |
| Queen promotion settles as a playable checking position | Passed |
| Undo after a computer reply restores the starting position | Passed |
| Checkmate story blocks further play after the winning move | Passed |
| Undo restores a captured position atomically | Passed |
| Restore a saved game after reload and continue with undo | Passed |
| Knight promotion ends in an insufficient material draw | Passed |
| Enable sound from the character guide | Passed |
| Promotion can be cancelled without committing a move | Passed |

Saved visual evidence: [final Portal result](media/paperwild-pr-10-passed-2026-10-20.jpg) and [the preview-only Vercel exception](media/paperwild-living-preview-public-2026-10-20.jpg).

## Limits

This is a manual dispatch through the GitHub integration. It establishes that a new PR execution can start and report to GitHub; a future Vercel deployment automatically firing the saved trigger has not yet been verified. The cause of the old-delivery retry failures remains unknown.

The tested remote head does not include the unpublished October 19 additions. Service outcomes must be assessed against their actual assertions and do not replace the separate [native additions audit](TESTSPRITE_ADDITIONS_RUN_2026-10-19.md).

The ten passing service verdicts and sampled replay/manual checks are recorded here; a complete audit of every generated runtime assertion was not performed. Physical audio quality, fresh phone sizing, and the unpublished additions are not newly validated by this recovery. No push or merge was performed.
