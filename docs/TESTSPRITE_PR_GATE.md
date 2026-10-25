# Strict TestSprite pull-request verification

The [Actions workflow](../.github/workflows/testsprite-strict.yml) builds the exact head of each trusted same-repository PR and tests its unique deployment in the dedicated public **paperwild-ci** Vercel project. The main Paperwild project's deployment protection remains separate. Branch aliases and production URLs are not fallback targets.

The check context is **Verify all 16 stored TestSprite scripts**, under **TestSprite strict replay**. Its actual result and proof artifact for the current PR head establish whether that head passed. The first full Actions execution of this public-project flow is still required; a working configuration or an earlier preview result does not establish it.

## Exact deployment discovery

The gate uses read-only GitHub metadata rather than a Vercel token in Actions. It requires the current open same-repository PR head, complete paginated deployment records for that SHA, the observed Vercel bot identity (`35613825`), and a successful latest status in `Production – paperwild-ci` or `Preview – paperwild-ci`. A newer failure cannot fall back to an older success.

The project-specific `Vercel – paperwild-ci` commit status identifies the inspector and deployment ID. The authenticated Vercel bot comment must bind that same inspector to the stable CI project ID, `prj_K4XUFAg81KYU0YxfC0ISyU3JRhox`. The deployment status must provide consistent unique HTTPS origins in its environment, target and log URL fields. These are the actual observed GitHub response shapes; the deployment payload is empty and its optional GitHub App field is null.

The approved unique-host namespaces are `paperwild-<nine-character-id>-davidson3556s-projects.vercel.app` and `paperwild-ci-<nine-character-id>-davidson3556s-projects.vercel.app`. The first real CI deployments used the former prefix, so hostname alone does not prove project identity. Credentials, ports, non-root paths, queries, fragments and mutable aliases are rejected. Discovery has a nine-minute bound; missing or inconsistent evidence fails before test dispatch.

## Reviewed templates and target-only binding

Each [reviewed Python case](testsprite/overrides/README.md) contains exactly one canonical module-level line:

```python
TARGET = "__PAPERWILD_CI_TARGET_URL__"
```

The placeholder fails closed if the committed template is executed without binding. Before publishing a transport binding, the gate checks all sixteen current hosted bodies: replacing only their single canonical `TARGET` line with the placeholder must reproduce every byte of the committed template and its manifest hash. The prior literal must also be an approved unique CI origin. Any scenario, assertion, helper, formatting or other source difference fails verification.

For the discovered exact deployment, the gate changes only that line to its public URL. It publishes using explicit `--expected-version` optimistic guards and reads back the exact rendered bytes and resulting version. An already identical binding needs no write. Conflicts fail without force, regeneration or retry. The [manifest](testsprite/pr5-stored-code-manifest.json) records authoritative canonical template hashes; its seed versions and rendered hashes describe the historical initial binding. Each Actions artifact records the actual bound hashes and versions used for that execution and verifies those same values afterward.

All PRs share one project-wide workflow concurrency group with `cancel-in-progress: false`, covering discovery, binding, replay and postflight. An active or unknown status in any reported TestSprite environment stops rebinding. The older agent-driven App trigger remains disabled. Changes outside this serialized workflow are detected by the optimistic guards and final readbacks.

## Required proof

1. Reject forks and missing credentials before checkout or build. Trusted same-repository drafts run too. Check out the exact PR SHA without persisting checkout credentials; reject changed commits, dirty source or untracked files.
2. Build with the reviewed public integration backend, `https://fast-starling-207.convex.cloud`. Discover the authenticated exact-head public CI deployment and compare every file in `dist` against its served bytes before replay: currently 48 files, including HTML, JavaScript, CSS, workers and artwork. Only the exact observed appended Vercel feedback tag for that deployment may be normalized; its raw and normalized hashes are recorded.
3. Require exactly the sixteen frontend IDs in the intended TestSprite project, without extra, missing, duplicate or foreign cases. Verify every canonical template and guarded target binding as described above.
4. Invoke official CLI **0.15.0** with explicit `--no-auto-heal`, a 1200-second batch wait timeout, and polling concurrency three. The wrapper has a 25-minute command limit inside the 45-minute Actions job. Poll concurrency does not claim to limit hosted execution concurrency.
5. Require sixteen distinct UUID run IDs, all passed, with zero failure, blockage, skip, cancellation or timeout. Require the public CLI receipt to contain those same terminal test/run identities with no conflicts, deferrals or skipped tests.
6. Read every actual run independently. Require its expected project, CLI source, fresh dispatch timestamps, exact discovered target and unqualified stored-code replay. A contradictory failed actual result or missing actual lookup cannot be overridden by successful batch counts.
7. Read back all sixteen exact rendered bodies and execution versions after replay. Recheck project membership, canonical local templates, clean checkout, unchanged current PR head, unchanged local build, the same authenticated deployment binding and every public build file. Failed or incomplete replay still attempts this read-only postflight; it never dispatches another test or heals a script. Incomplete proof keeps the job red.
8. Publish sanitized JSON and JUnit artifacts. Retain safe UUID identities, statuses, known CLI error codes and fixed platform-error classifications on failures. Do not publish raw errors, CLI output, API responses, signed recordings or authorization values.

## Command and credentials

After discovery and guarded binding, the wrapper invokes:

```sh
testsprite test run --all --project PROJECT_ID \
  --target-url VERIFIED_UNIQUE_CI_ORIGIN --max-concurrency 3 \
  --no-auto-heal --wait --timeout 1200 \
  --report junit --report-file TEMP_JUNIT \
  --summary-file TEMP_SUMMARY --output json
```

The encrypted `TESTSPRITE_API_KEY` is supplied only to trusted steps, never source, argv or reports. Its guarded code-write capability is used solely to bind the reviewed target literal. The GitHub job has read-only contents, pull-request, deployment and commit-status permissions. No Vercel token, deployment-protection bypass, tunnel or environment-variable injection is used by this flow.

The backend can return `codeVersion: null` and omit `autoHeal` on completed runs. Reports retain those facts. They separately record explicit no-auto-heal dispatch, reject `autoHeal:true` or an invalid value, require replay path `replay` with null reason/caveat, and prove unchanged bound source/version before and after. They do not manufacture an individual backend version or `false` healing attestation.

## Scope and merge enforcement

The sixteen cases cover board play, notebook entry, required opponent selection, club and same-device games, save recovery, motion and sound scheduling. They supplement backend tests and separate independent-player multiplayer acceptance. The external Convex development service is not an ephemeral backend deployment of each PR's functions.

Merging is blocked only when the effective rules on `main` require the actual check context. A workflow file alone does not establish that enforcement. The installed GitHub App and this reviewed CLI gate are separate integrations.

## Focused verification and historical evidence

```sh
node --test tests/testsprite-ci.test.mjs
```

The focused tests make no TestSprite request. They cover authenticated deployment discovery, exact origins, stale and foreign metadata, canonical source drift, guarded binding conflicts and readback drift, unknown project activity, secret-safe diagnostics, incomplete results and contradictory actual responses. Historical local-server and HTTPS verification helper contracts remain tested but do not select or serve the current gate target.

PR6's first native-tunnel attempt [failed with sixteen blocked cases](https://github.com/Davidson3556/Paperwild/actions/runs/40196200559): the platform refused deterministic replay through a tunnel before gameplay assertions. A bare target override and a named-environment variable probe also failed to supply the custom Python environment variable. Those failures are preserved separately. The controlled direct-public literal-bound ONBD-001 probe passed; the complete new Actions gate still needs its own current-head result.

PR5's [strict public-preview Actions run](https://github.com/Davidson3556/Paperwild/actions/runs/40136980632), [four-case multiplayer summary](testsprite/online-cloud-acceptance-summary.json) and [source/build audit](testsprite/online-cloud-acceptance-verification.json) remain evidence for their own historical heads and targets. They are not substituted for a future PR's result.
