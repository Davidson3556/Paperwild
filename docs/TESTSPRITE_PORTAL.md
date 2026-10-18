# TestSprite Portal evidence

**October 18 update:** [PR #3 (`living`)](https://github.com/Davidson3556/Paperwild/pull/3) now contains the field-notebook and capture-story build. Its ordinary CI passed 64 tests and the production build; Vercel's preview is Ready but requires sign-in. The [new TestSprite V3 check](https://github.com/Davidson3556/Paperwild/pull/3/checks?check_run_id=117638045330) repeated the Free-plan gate and executed no tests. Separate current native MCP runs reached eight supported service passes across reruns, with phone resizing blocked and assertion gaps retained in [the current audit](TESTSPRITE_LIVING_RUN_2026-10-18.md). They are not new Portal executions. The October 17 record below remains historical.

Recorded October 17, 2026. This is the current Portal setup record; the older native MCP reports remain historical evidence.

## App and pull request

- Public app: [paperwild.vercel.app](https://paperwild.vercel.app/), published source revision `50f632e`.
- Current PR: [#2 — CI setup](https://github.com/Davidson3556/Paperwild/pull/2). Ordinary CI passed for workflow revision `dc4a2c3`. This is not a TestSprite PR check. PR #1 was superseded and closed.
- Local validation: 34 tests and the strict TypeScript production build pass. These are separate from Portal service results.
- Portal project: [Paperwild](https://www.testsprite.com/dashboard-v3/o/davidson-awokoyas-workspace-f7454a95/projects/dafdf75c-04a3-467f-acc2-4359af6b1d8e).

## First Portal execution

Ten reviewed cases were generated and executed against the public app. [Initial execution](https://www.testsprite.com/dashboard-v3/o/davidson-awokoyas-workspace-f7454a95/projects/dafdf75c-04a3-467f-acc2-4359af6b1d8e/execution/5f72431b-fd18-46c0-a33f-d94963a2dccc): `5f72431b-fd18-46c0-a33f-d94963a2dccc`.

The service reported **8 passed / 2 failed**. Review identified incorrect expectations in the two failed cases:

| Expectation corrected | Actual behavior the test must verify |
| --- | --- |
| Undo restores the story's initial selection | Undo restores the position and clears the selection. Reselect the piece before attempting another move. |
| Weather button text describes the current weather | The button offers the next action: **Clear skies** appears while rain is on. Verify the rain state and saved preference separately from the action label. |

Both corrected cases subsequently returned **PASS**. The latest suite view shows all ten cases passed across the original execution and these two reruns; this was not one new execution of all ten cases. The initial failures remain test-expectation errors, not confirmed product defects.

| Focused corrected rerun | Execution ID | Service result |
| --- | --- | --- |
| Capture and undo | [db290c8e-86bb-45ec-ae20-8af65639ee24](https://www.testsprite.com/dashboard-v3/o/davidson-awokoyas-workspace-f7454a95/projects/dafdf75c-04a3-467f-acc2-4359af6b1d8e/execution/db290c8e-86bb-45ec-ae20-8af65639ee24) | 1 passed / 0 failed |
| Saved-game persistence | [f405902f-ecc0-4128-856f-84b0a6b0cb5f](https://www.testsprite.com/dashboard-v3/o/davidson-awokoyas-workspace-f7454a95/projects/dafdf75c-04a3-467f-acc2-4359af6b1d8e/execution/f405902f-ecc0-4128-856f-84b0a6b0cb5f) | 1 passed / 0 failed |

**After those runs**, all ten saved definitions were updated to require the current execution's configured target origin for initial navigation, later navigation, and reloads. During a PR execution this must be the PR preview. The [saved Portal YAML plan](testsprite/portal-plan.yaml) is a snapshot of the definitions saved through the UI; it is a plan, not an executable deterministic test suite. Its completed manual preview execution and assertion limits are recorded below.

## Evidence limits

The service result describes the Portal execution. Review of earlier exported Python found unverified or incorrect assertions and a hardcoded production URL. The saved definitions have since been corrected to use the configured target origin, but this does not validate those earlier exports. The export has not been established as a reliable deterministic replay suite or as a PR-preview test. A service pass is not a code-coverage percentage or proof that every acceptance assertion ran correctly.

The ten-case Portal suite does not certify the full [20-scenario acceptance specification](TESTSPRITE_PLAN.md). Timed visual behavior, physical sound quality, and other unexercised assertions retain the limits documented in the individual verification records. Raw exports and credentials remain outside the public documentation.

## GitHub App setup and remaining submission work

The TestSprite GitHub App is connected with access restricted to **Paperwild**. The PR trigger is now **saved and active** with this configuration:

| Setting | Saved value |
| --- | --- |
| Repository | Paperwild |
| Trigger | PR comment from `vercel[bot]` |
| Target pattern | `https://paperwild-git-{branch-slug}-davidson3556s-projects.vercel.app` |
| Draft PR runs | Off |
| Merge gate | Off |

For the short branch `ci`, the target pattern resolves to the observed [PR #2 preview](https://paperwild-git-ci-davidson3556s-projects.vercel.app). Vercel can truncate and hash long branch aliases, which this pattern cannot reconstruct; verify the actual alias before using another branch.

With the user's approval, a public-access exception was applied **only** to `paperwild-git-ci-davidson3556s-projects.vercel.app`. An unauthenticated HEAD request returned 200 and a browser opened the game. Project-wide standard login protection remains on; other previews remain protected. This access check does not establish that a TestSprite PR execution has reached the preview.

A manual **Send Test Event** attempt made before the trigger was created produced no observed execution, comment, check, or activity. That attempt is not evidence of a dispatched run.

## PR event received; test execution blocked

At **22:03 WAT (21:03 UTC) on October 17**, TestSprite V3 posted a failed check on PR #2 head `e2aa53d156668df0ae01f10bc68290c5b5e12649`. Its exact title was:

> GitHub CI runs not on the Free plan. No tests were run.

[GitHub check details showing the failed gate](https://github.com/Davidson3556/Paperwild/pull/2/checks?check_run_id=117503333603).

This establishes that the integration received the event and posted a check. There was **no test execution and no TestSprite PR comment**. The failed check reports a plan gate, not a failing chess assertion.

The [official pricing page](https://www.testsprite.com/pricing), checked October 17, advertises GitHub PR auto-testing for one repository on Free. That advertised entitlement conflicts with the observed gate; the account's actual entitlement needs confirmation from TestSprite. No Season 4 voucher was found, and no paid upgrade or subscription was taken.

## Manual PR-preview execution

The separate [manual Portal execution](https://www.testsprite.com/dashboard-v3/o/davidson-awokoyas-workspace-f7454a95/projects/dafdf75c-04a3-467f-acc2-4359af6b1d8e/execution/38cecb1c-5ed2-492d-8655-77d8ef334dd0), ID `38cecb1c-5ed2-492d-8655-77d8ef334dd0`, completed with **10 service passes / 0 failures / 0 blocked** against PR #2 preview app head `e2aa53d156668df0ae01f10bc68290c5b5e12649`.

The [sanitized runtime logs](testsprite/preview-runtime-logs.json) show all ten cases initially navigating to `https://paperwild-git-ci-davidson3556s-projects.vercel.app/`. Persistence also records its later reload navigation on that preview. The sound log contains only one visible navigation; it does not establish a post-audition reload. These observations establish the recorded origins, not every navigation requested by the plan.

**Acceptance coverage is partial despite the ten service passes.** The principal gaps are:

| Runtime evidence | Acceptance limit |
| --- | --- |
| Illegal-move case selected local mode, opened a fresh page, and asserted generic button presence. | No illegal move attempt or unchanged-state comparison is shown. Illegal-move rejection is unestablished by this case. |
| Sound case activated one hear-me button, scrolled, and made presence/text assertions. | No scheduled-event/count, all-six-role, mute, keyboard, or post-audition reload checks are shown. Its unexecuted export asserts only a non-null URL; it is not a complete audio test. |
| The other cases exercised opening, capture/undo, promotion, ending, computer/undo, or persistence interactions with some board/history assertions. | These provide meaningful partial evidence, but omit parts of their saved acceptance definitions; their service passes do not certify each named scenario in full. |

The Free account's one-environment limit required temporarily changing the existing default target URL to the approved preview. After completion, the UI confirmed that **Default** was restored to `https://paperwild.vercel.app/`, with no test account. This manual run supplies preview evidence independently of the blocked automated PR execution.

Still required:

1. Confirm or activate the advertised Free or Season 4 GitHub CI entitlement with TestSprite.
2. Repair and execute the missing acceptance checks, retaining runtime evidence rather than treating the ten service passes as complete coverage.
3. After the entitlement issue is resolved, retain an actual automated PR test execution and its result.
4. Verify the final README links and submit the required PR link, public app URL, and account details through the official hackathon channel.

The posted check does not establish executed test coverage. No completed hackathon submission or final eligibility determination is claimed here.

## Support message draft — not sent

Hello TestSprite team, I'm building Paperwild for Hackathon Season 4. The GitHub App is connected to only Davidson3556/Paperwild, and the saved trigger received an event for [PR #2](https://github.com/Davidson3556/Paperwild/pull/2). At 22:03 WAT (21:03 UTC) on October 17, its TestSprite V3 check failed with “GitHub CI runs not on the Free plan. No tests were run.” Your [pricing page](https://www.testsprite.com/pricing) currently lists GitHub PR auto-testing for one repository on Free. Could you confirm and enable that entitlement, or provide the Season 4 activation steps? The approved PR preview is publicly reachable. [GitHub check details](https://github.com/Davidson3556/Paperwild/pull/2/checks?check_run_id=117503333603). No upgrade has been started.
