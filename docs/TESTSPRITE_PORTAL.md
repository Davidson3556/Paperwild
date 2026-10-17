# TestSprite Portal evidence

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

**After those runs**, all ten saved definitions were updated to require the current execution's configured target origin for initial navigation, later navigation, and reloads. During a PR execution this must be the PR preview. The [saved Portal YAML plan](testsprite/portal-plan.yaml) is a snapshot of the definitions saved through the UI; it is a plan, not an executable deterministic test suite. These revised navigation requirements have not yet been executed. The saved plan awaits its first PR-preview execution.

## Evidence limits

The service result describes the Portal execution. Review of earlier exported Python found unverified or incorrect assertions and a hardcoded production URL. The saved definitions have since been corrected to use the configured target origin, but this does not validate those earlier exports. The export has not been established as a reliable deterministic replay suite or as a PR-preview test. A service pass is not a code-coverage percentage or proof that every acceptance assertion ran correctly.

The ten-case Portal suite does not certify the full [20-scenario acceptance specification](TESTSPRITE_PLAN.md). Timed visual behavior, physical sound quality, and other unexercised assertions retain the limits documented in the individual verification records. Raw exports and credentials remain outside the public documentation.

## GitHub App setup and remaining submission work

The TestSprite GitHub App is connected with access restricted to **Paperwild**. The PR trigger has **not** been saved or executed. The current PR preview is protected by Vercel authentication, so preview access must be resolved before enabling the trigger. Public production access does not establish that the runner can reach a PR preview.

The prepared trigger uses the Vercel bot's PR comment and target pattern `https://paperwild-git-{branch-slug}-davidson3556s-projects.vercel.app`. For the short branch `ci`, this resolves to the observed [PR #2 preview](https://paperwild-git-ci-davidson3556s-projects.vercel.app). Keep branch names short: Vercel can truncate and hash long branch aliases, which this pattern cannot reconstruct. Verify the actual first navigation and reload origin in the PR run before treating it as preview coverage.

Still required:

1. Resolve PR-preview access and execute the saved plan with its revised target-origin requirements against the preview.
2. Save the TestSprite trigger and retain an actual TestSprite comment or status check on the current PR.
3. Verify the final README links and submit the required PR link, public app URL, and account details through the official hackathon channel.

Connecting the App and passing ordinary CI do not complete the TestSprite PR-check requirement. No completed hackathon submission is claimed here.
