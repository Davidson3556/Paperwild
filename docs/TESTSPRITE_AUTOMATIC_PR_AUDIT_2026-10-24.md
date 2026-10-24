# PR #5 automatic TestSprite run audit — October 24, 2026

The GitHub App's [automatic execution](https://www.testsprite.com/dashboard-v3/o/f7454a95-e992-581a-98e0-4edd142a0891/projects/dafdf75c-04a3-467f-acc2-4359af6b1d8e/execution/29f85f46-1b25-444a-9d27-4b97a3ded3ee) on PR #5 at `51db5fa` ended with **8 passed / 3 failed / 3 blocked / 2 cancelled**. Its **TestSprite V3** GitHub status is **FAILURE**. The [sanitized final result](testsprite/pr5-app-results.json) preserves all sixteen case/run identities and that check's execution link.

Two long-running cases were explicitly cancelled by the operator after defects in the automatic sequence were established. Cancellation is not a pass. This execution remains separate from the [earlier 16-pass strict stored-code replay](TESTSPRITE_ONBOARDING_RUN_2026-10-24.md); that successful replay does not overwrite this App result or make its GitHub check green.

## Confirmed observations

A read-only inspection of recorded action steps, snapshots and matching application code found these test defects. The [sanitized audit](testsprite/pr5-app-audit.json) records the derived state comparisons without publishing raw snapshots or signed artifact URLs.

| Case | Evidence |
| --- | --- |
| BOAR-002 | All 64 recorded squares matched the expected 32-piece position. The board was ready in same-device mode, White to move, with no active movement, thinking or finished game. The claimed position mismatch contradicted that snapshot. |
| ONBD-001 | All 64 recorded squares also matched the expected fresh same-device position with an explicitly chosen opponent. The analysis additionally demanded an empty-save action and a dismissible required chooser, which conflict with the explicit first-opponent requirement. |
| NOTE-001 | The action sequence selected e2, reloaded without clicking e4, then asserted that the pawn had moved to e4. |
| NOTE-002 | The sequence clicked **Resume animations**, then asserted that the saved pause was still active. |
| NOTE-003 | The sequence started **Play against the club**, then asserted a local one-ply position without the computer's Black reply. |

These findings identify concrete test or agent defects. They do not establish that every automatic case, temporal animation assertion or physical sound observation passed. No failed or blocked result was relabelled as successful.

## Replacement check

The user approved storing `TESTSPRITE_API_KEY` as an encrypted repository Actions secret and disabling the agent-driven trigger while keeping the TestSprite GitHub App installed. Both setup actions were verified. The reviewed [strict workflow](TESTSPRITE_PR_GATE.md) uses sixteen specific stored scripts, verifies source/version integrity, requests `--no-auto-heal`, and checks the exact PR head and preview before and after execution.

The replacement workflow's verdict is recorded in the [current PR checks](https://github.com/Davidson3556/Paperwild/pull/5/checks); the separate manual replay is not substituted for that result. Its secret is configured and the old trigger is disabled. PR #5 remains draft, with Convex Cloud deployment and remote-player acceptance pending. No merge or branch-ruleset change is included in this setup.
