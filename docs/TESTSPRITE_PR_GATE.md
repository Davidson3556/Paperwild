# Strict TestSprite pull-request verification

The GitHub App's automatic PR execution and a reviewed stored-code replay are separate results. The automatic run on PR #5 at `51db5fa` finished with **8 passed, 3 failed, 3 blocked and 2 cancelled**. Its GitHub check is a failure; a different passing execution does not make that App check pass. The [automatic-run audit](TESTSPRITE_AUTOMATIC_PR_AUDIT_2026-10-24.md) preserves the result and confirmed test-sequence defects.

## Workflow in this PR

The [strict Actions workflow](../.github/workflows/testsprite-strict.yml) in this PR runs the sixteen reviewed scripts for `feat/convex-multiplayer`. It uses the official TestSprite CLI pinned to **0.15.0**, with the explicit test IDs in the [current reviewed manifest](testsprite/pr5-stored-code-manifest.json), `--no-auto-heal`, `--wait`, and a checked summary. It does not select every future test added to the project, regenerate scripts, or infer success from a green aggregate badge. View the [current PR checks](https://github.com/Davidson3556/Paperwild/pull/5/checks) for the result attached to the latest head.

The suite contains the eight board cases, four notebook cases, preference and sound cases, and two onboarding cases in [the stored scripts](testsprite/overrides/README.md). Its scope is notebook entry, required opponent selection, club and same-device games, saved-state recovery, motion and sound scheduling. Remote multiplayer still needs a matching hosted Convex backend and its own two-context acceptance tests.

The workflow performs these checks:

1. Reject fork PRs and missing credentials before checking out or building the branch. Trusted same-repository draft PRs run the suite too; PR #5 can stay draft while hosted Convex work remains pending.
2. Check out the exact PR head, validate the gate's failure handling, and build that source. GitHub Actions receives read-only repository, status and pull-request permissions; checkout does not persist its credential.
3. Read the PR's current head and wait for the successful Vercel status belonging to that exact commit and Paperwild project.
4. Compare **every local build file's SHA-256** with the reviewed public feature preview before testing, including JavaScript, CSS, workers, artwork and HTML. The branch alias is mutable, so it is not described as an immutable deployment.
5. Verify all sixteen hosted source bodies, saved code versions and local script hashes against the reviewed manifest before dispatch. A missing case, duplicate identity or source/version drift fails the job.
6. Request only those sixteen cases using explicit `--no-auto-heal`. Require sixteen distinct passing run IDs and no failed, skipped, blocked, cancelled or timed-out result. Read each actual run to verify its project, test ID, target, CLI source and unqualified stored-code replay path.
7. Read every stored source/version again, confirm that the PR head and Vercel deployment identity have not changed, and repeat the complete preview byte comparison. Recheck the PR head after that comparison.
8. Retain a sanitized JSON report and JUnit result as Actions artifacts. Raw API responses, signed recordings, authorization values and raw CLI logs are excluded.

Vercel can append its feedback script after the application HTML. The gate permits only the one exact observed tag whose deployment ID matches the successful Vercel status for this PR head. It records the raw and application HTML hashes separately. Changed application HTML, an extra script, a duplicate tag or a tag naming another deployment fails verification.

The backend can return **`codeVersion: null` and `autoHeal: null`** in completed run facts. The report preserves those nulls. It records the requested `--no-auto-heal` behavior, rejects `autoHeal: true`, requires replay path `replay` with null reason/caveat, and verifies unchanged reviewed source/version before and after execution. It does not convert an unavailable individual attestation into a backend `false` or a supplied per-run version.

## Authorized Actions setup

The user approved configuring the encrypted repository Actions secret **`TESTSPRITE_API_KEY`** and disabling the agent-driven TestSprite trigger while keeping the GitHub App installed. The encrypted secret was saved and verified through GitHub's secret metadata at **2026-10-24 17:10:49 UTC**. No credential value is included in source, documentation, logs or reports.

The Portal trigger was verified **Disabled**, with its enable control unchecked. The App remains installed. Disabling the agent-driven trigger prevents it from generating different stored scripts while the reviewed versions and final manifest are restored. The two remaining long-running automatic cases were explicitly cancelled after the sequence defects were established; they remain cancelled in the preserved result.

The replacement job is **Verify all 16 stored TestSprite scripts** under **TestSprite strict replay**. Its actual job result and sanitized artifact on the [current PR checks](https://github.com/Davidson3556/Paperwild/pull/5/checks) establish whether a particular head passed. Trusted draft PRs run it, so PR #5 can remain draft while Convex Cloud work is pending. The earlier 16-pass hosted replay remains separate historical evidence; it is not substituted for an Actions result.

A workflow pass becomes an enforced merge requirement only when a branch rule requires its actual check context. No `main` ruleset change is requested or applied by this setup. Local gate tests verify failure handling, not a hosted TestSprite execution.

## Local verification

```sh
node --test tests/testsprite-ci.test.mjs
```

The focused tests cover missing and duplicate cases/results, local and hosted source drift, wrong stored versions, misleading summary counters, failed/blocked/cancelled outcomes, wrong run/project/target identities, auto-heal and replay qualifications, exact Vercel commit/project binding, every build asset, and strict HTML normalization. Importing the gate in these tests makes no API call and triggers no hosted test.

The workflow builds without a Convex URL because the reviewed PR preview currently has no hosted backend. If a later frontend build adds public backend configuration, update the build environment, reviewed script/bundle binding and deployed-backend acceptance together. A frontend/backend configuration mismatch fails the artifact comparison before tests are charged.
