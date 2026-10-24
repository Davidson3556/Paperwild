# Strict TestSprite pull-request verification

The GitHub App's automatic PR execution and a reviewed stored-code replay are separate results. The automatic run on PR #5 at `51db5fa` finished with **8 passed, 3 failed, 3 blocked and 2 cancelled**. Its GitHub check is a failure; a different passing execution does not make that App check pass. The [automatic-run audit](TESTSPRITE_AUTOMATIC_PR_AUDIT_2026-10-24.md) preserves the result and confirmed test-sequence defects.

## Workflow in this PR

The [strict Actions workflow](../.github/workflows/testsprite-strict.yml) in this PR runs the sixteen reviewed scripts for `feat/convex-multiplayer`. It uses the official TestSprite CLI pinned to **0.15.0**, with `test run --all --project`, `--no-auto-heal`, `--wait`, and a checked summary. Before dispatch, the complete project test list must match exactly the sixteen IDs in the [current reviewed manifest](testsprite/pr5-stored-code-manifest.json). An extra or missing test fails the gate before execution. The CLI requires this project command for batches against public URLs; several explicit IDs require a local tunnel. View the [current PR checks](https://github.com/Davidson3556/Paperwild/pull/5/checks) for the result attached to the latest head.

The suite contains the eight board cases, four notebook cases, preference and sound cases, and two onboarding cases in [the stored scripts](testsprite/overrides/README.md). Its scope is notebook entry, required opponent selection, club and same-device games, saved-state recovery, motion and sound scheduling. A pass does not establish remote multiplayer acceptance; that requires the deployed Convex functions and separate tests using two independent browser contexts.

At cloud-configured head `66cc12731984413745f2ea0edcc0de944d15104c`, [strict run 40130203055](https://github.com/Davidson3556/Paperwild/actions/runs/40130203055) passed **16/16** with the preview bound to `fast-starling-207` and Vercel deployment `dpl_BMSpAxoxdf83vWegXWswKESztzuw`. [Regular CI 40130203087](https://github.com/Davidson3556/Paperwild/actions/runs/40130203087) passed **150 app/gate tests, 20 backend tests, TypeScript and build**. These results belong to that exact head; later commits require their own checks.

The separate multiplayer acceptance execution `657456b3-12fc-476a-ad57-247971df4d32` passed ONLN-001–003 and failed ONLN-004 after 35 seconds; the SDK permits 60 seconds of inactivity. Diagnostic execution `e7c28f31-014c-4f65-9ceb-f50a34a00070` reached actual reconnecting and verified Black offline/uncached HTTP failure, White HTTP 200 and no received-frame increase. It then failed a newly introduced immediate browser-close-counter check, before original no-queue/recovery assertions. A reviewed revision keeps close counts diagnostic and preserves all original gameplay and mandatory network-loss assertions; it has no passing result yet. The [first acceptance summary](testsprite/online-cloud-first-acceptance-summary.json), [audit](testsprite/online-cloud-first-acceptance-verification.json) and [cloud verification record](CONVEX_CLOUD_VERIFICATION_2026-10-24.md) retain the failed history. Full four-case acceptance remains pending and cannot be inferred from the sixteen-case regression pass.

The workflow performs these checks:

1. Reject fork PRs and missing credentials before checking out or building the branch. Trusted same-repository draft PRs run the suite too; PR #5 can stay draft while hosted Convex work remains pending.
2. Check out the exact PR head, validate the gate's failure handling, and build that source. GitHub Actions receives read-only repository, status and pull-request permissions; checkout does not persist its credential.
3. Read the PR's current head and wait for the successful Vercel status belonging to that exact commit and Paperwild project.
4. Compare **every local build file's SHA-256** with the reviewed public feature preview before testing, including JavaScript, CSS, workers, artwork and HTML. The branch alias is mutable, so it is not described as an immutable deployment.
5. Verify that the complete project contains exactly the sixteen reviewed frontend test IDs. Verify all sixteen hosted source bodies, saved code versions and local script hashes against the reviewed manifest before dispatch. A missing or extra case, duplicate identity or source/version drift fails the job.
6. Run the verified project using explicit `--no-auto-heal`. Require sixteen distinct passing run IDs and no failed, skipped, blocked, cancelled or timed-out result. Read each actual run to verify its project, test ID, target, CLI source and unqualified stored-code replay path. Recheck exact project membership after execution; concurrent membership changes cannot produce a passing gate.
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

The strict job supplies the public client variable `VITE_CONVEX_URL=https://fast-starling-207.convex.cloud` to both its build and verification process. This is the Paperwild development backend selected for the `feat/convex-multiplayer` preview; it is not a deploy key or other credential. The Vercel Preview variable must be scoped to that branch and use the same URL. Production, other previews and the general verification workflow do not receive this binding from the strict workflow.

The runner's preview allowlist remains bound to `feat/convex-multiplayer`. A future branch or backend change requires an explicit update to the preview binding, build environment and reviewed script/bundle expectations together. A frontend/backend configuration mismatch fails the complete artifact comparison before tests are charged. Supplying the URL only selects the client backend; it does not prove the functions are deployed or that hosted multiplayer works. The development functions have been deployed; two-context multiplayer acceptance remains pending until independently verified.
