# Production multiplayer verification — October 25, 2026

Paperwild's public game at **[paperwild.vercel.app](https://paperwild.vercel.app/)** supports online friend rooms after [PR #5](https://github.com/Davidson3556/Paperwild/pull/5) merged. **Three fresh strict cases passed with literal Production targets, independent browsers and complete source/build verification before and after.** Earlier requested-target passes with unverified Python origin and incomplete artifact postflight are preserved separately below; the new pass does not relabel those records.

## Release identity

| Item | Recorded value |
| --- | --- |
| Merged application revision | `31e8b02e62d2095716624c173879ff1c902953b4` on `main` |
| Earlier reviewed test-source base | `944ba66e9212953ee14c804bdfbee72c138a39f9`; fresh literal-target changes were uncommitted at upload and verified by exact readback |
| Public frontend | `https://paperwild.vercel.app/` |
| Convex environment | Production, `https://grateful-cuttlefish-105.convex.cloud` |
| Vercel deployment | `dpl_5uZMUS4vArHxYwkdLs5T5zVjKohv`, Ready |
| Application bundle | `assets/index-DRVksUc-.js` |
| Reference build | 48 public files; tree SHA-256 `fb141612e7cbb85d89da5b5535219b3893d29ca8da97d639bd67551b55dc2f1c` |
| TestSprite project | `5ac48e78-b1a2-4509-ad73-0b3efe0c3343` |

The original Production frontend was built before `VITE_CONVEX_URL` was saved, so it could not offer online rooms. The fix saved the Production public client URL and rebuilt the same merged application revision. An intermediate value contained a trailing newline; the client trimmed it for gameplay, but the independent build comparison correctly rejected the byte mismatch before dispatch. The final value has no trailing newline, and the rebuilt public assets matched the reference build before the runs below. No application source change was needed for this configuration repair.

The unique deployment URL remains protected by Vercel authentication. The public alias above is the manually tested player-facing origin. The Development preview continues to use `https://fast-starling-207.convex.cloud`; it has separate room data and credentials.

## Literal-target Production results

Fresh ONLN-001–003 executions used `TARGET = "https://paperwild.vercel.app/"` directly in each stored Python body, without an environment override or fallback. Only that target assignment changed from the previously reviewed source; every other byte and the gameplay assertion AST remained unchanged. The changes were uncommitted at upload and are identified by the exact versions/hashes below.

| Case | Result | Actual run ID | Verified stored version | Stored source SHA-256 |
| --- | --- | --- | --- | --- |
| ONLN-001: independent seats and shared capture | Passed | [Run `6de6bb2c`](https://www.testsprite.com/dashboard-v3/o/f7454a95-e992-581a-98e0-4edd142a0891/projects/5ac48e78-b1a2-4509-ad73-0b3efe0c3343/execution/9432bb36-0d50-4864-91f2-ef49f2402dfc/test/6de6bb2c-c55e-4619-b860-90d6344bece0) | `v-11d29e749ff2` | `6575363a2e73eb14f192948b5e65682ee06405038475b40378378cd89b6b4063` |
| ONLN-002: Undo/rematch consent | Passed | [Run `f599a052`](https://www.testsprite.com/dashboard-v3/o/f7454a95-e992-581a-98e0-4edd142a0891/projects/5ac48e78-b1a2-4509-ad73-0b3efe0c3343/execution/c544f6dc-d991-43f3-9a49-f632eeb10499/test/f599a052-26e7-4e4c-9363-e24772d646c3) | `v-c96feb712dee` | `d518fec9b694094410651b9765428c0b860fdc4face7de4ad7d2f28d5889b62f` |
| ONLN-003: reload, saved seat and separate local game | Passed | [Run `042d18eb`](https://www.testsprite.com/dashboard-v3/o/f7454a95-e992-581a-98e0-4edd142a0891/projects/5ac48e78-b1a2-4509-ad73-0b3efe0c3343/execution/a4424c25-c078-45c0-b046-c4ddfa367618/test/042d18eb-9078-4575-978e-2fafad454a65) | `v-2132d695ff06` | `bbf33bbfca8b402bfd2a0660f5be14bf80566ec9dd9805eb499a7ea1da519066` |

The [verified summary](testsprite/production-literal-target-summary-2026-10-25.json) and [complete audit](testsprite/production-literal-target-verification-2026-10-25.json) record **3 requested / 3 passed**, with actual CLI source, the literal target and unqualified strict replay for every case. Dispatch used `--no-auto-heal`; unavailable per-run API code-version/auto-heal values remain null rather than being fabricated. The source binding is established separately by exact pre/post body/version readbacks.

All **48 Production public files** matched the reference build before and after testing, with unchanged tree hash `fb141612e7cbb85d89da5b5535219b3893d29ca8da97d639bd67551b55dc2f1c`, application head `31e8b02` and Ready deployment `dpl_5uZMUS4vArHxYwkdLs5T5zVjKohv`. All four online-project bodies/versions were audited; the unused ONLN-004 body remained unchanged at `v-b27cfd4d1cfa`. The new aggregate audit is **`verified: true`**.

This online project now has **three Production cases and one Development-only outage case**. ONLN-004 was neither changed nor executed in this fresh Production run. Do not run or describe the mixed project as a four-case Production suite. Its historical four-case Development acceptance identifies older source versions and remains separate.

## Manual Production checks

The user verified the Production game in two independent browsers on the actual public origin. Separate computer-control checks also observed actual Production gameplay. The saved `production-manual-seat-recovery.json` records the final Production bundle, a connected Black seat, White pawn e4, Black pawn d5, matching `e4 d5` history and revision 6 after explicit seat return and agreed Undo.

That saved computer-control session used two tabs in one Chrome profile; it does not itself establish storage isolation. The user's independent-browser check is separate from it. The [Production screenshot](media/paperwild-production-multiplayer-2026-10-25.jpg) shows the final build. Earlier capture screenshots predate the trailing-newline cleanup and do not identify the final build by themselves.

## Historical requested-target results — runtime origin unverified

These older records were **three separate single-case CLI executions**, each requested once with target `https://paperwild.vercel.app/`. Their scripts created independent Chromium browsers and exercised real invitation, board and consent controls, but used `os.environ.get('TEST_TARGET_URL', <old PR #5 preview URL>)` to choose where Python navigated. Controlled strict-runtime probes later confirmed that neither `--target-url` alone nor a named environment option injects that variable. The Preview fallback therefore prevents these older records from establishing Production runtime origin. The fresh literal-target executions above are separate evidence.

| Case | Recorded result; runtime origin unverified | Script scenario | Actual run |
| --- | --- | --- | --- |
| ONLN-001 | Passed | Explicit independent seats, no automatic invite join, shared `e4 d5 exd5`, wrong-turn restrictions, rejected third visitor | [Run `5d1bfc54`](https://www.testsprite.com/dashboard-v3/o/f7454a95-e992-581a-98e0-4edd142a0891/projects/5ac48e78-b1a2-4509-ad73-0b3efe0c3343/execution/99ae01b6-788b-4cf1-a8f6-d1681db604f1/test/5d1bfc54-c74b-4065-985d-a223e43742c1) |
| ONLN-002 | Passed | Undo and rematch requests, decline/accept, matching histories and turns | [Run `d5fa5cc2`](https://www.testsprite.com/dashboard-v3/o/f7454a95-e992-581a-98e0-4edd142a0891/projects/5ac48e78-b1a2-4509-ad73-0b3efe0c3343/execution/d925857f-a072-40d7-88a8-d3fa48f17c47/test/d5fa5cc2-712e-44b4-8e54-ecf29490e194) |
| ONLN-003 | Passed | Reload, explicit saved-seat return, and restoration of the separate local game when leaving | [Run `907fd7ea`](https://www.testsprite.com/dashboard-v3/o/f7454a95-e992-581a-98e0-4edd142a0891/projects/5ac48e78-b1a2-4509-ad73-0b3efe0c3343/execution/42a6c42f-5ea8-4802-927f-4911e68f7a73/test/907fd7ea-a9ac-4c5f-a84c-211da433598b) |

The backend records report `source: cli`, the expected project, requested target `https://paperwild.vercel.app/`, and an unqualified `replay` result for every case. **That target is metadata, not a readback of the Python browser's actual URL.** Dispatch used `--no-auto-heal`. Per-run code-version fields are null and the API does not expose an auto-heal field; those omissions are retained rather than treated as positive attestations. Stored-code readback established the following unchanged bodies/versions, but does not override their environment-dependent target selection:

| Case | Hosted version | Source SHA-256 |
| --- | --- | --- |
| ONLN-001 | `v-8c8f963a53be` | `745e2bdcba98c33bd5881e7f0d00932e30587215f0203afefef8e6e3db8fc7a9` |
| ONLN-002 | `v-36829c66b6fc` | `8122a2afb8894234e4b01d4e06861a5157cce9972c5c6e1592c9d4ae31333259` |
| ONLN-003 | `v-36a7112662b4` | `db596f3613055cbcec0f6e172c3616cc98dcb0ddd3fc31e1a5cad0007ec402b3` |

## Evidence boundary

- **Fresh completed Production evidence:** literal-target ONLN-001–003 passed with independent browsers, exact stored-body/version readbacks, unchanged project membership, stable Production source/deployment and all 48 reference-matching files before and after. Its new aggregate audit is `verified: true`.
- **Historical runtime origin unverified:** the older three scripts retained the Preview fallback, and later controlled probes confirmed absent CLI target/environment injection. Requested Production metadata, Production asset checks and unchanged stored code did not establish that their browsers visited Production. The earlier interpretation of those older passes as Production gameplay validation remains withdrawn; they are not reused as evidence for the fresh literal-target pass.
- **Historical artifact postflight incomplete:** the earlier full post-run 48-file download/hash audit timed out, including read-only retries. That original aggregate record remains **`verified: false`**. The fresh complete audit is a separate execution and does not turn the old audit green.
- **Not executed on Production:** ONLN-004, the genuine outage/no-queued-move/same-seat recovery case. Its stored diagnostic pins the Development WebSocket hostname. Its [four-case Development acceptance](CONVEX_CLOUD_VERIFICATION_2026-10-24.md) remains valid for that identified environment; it does not establish Production outage behavior.

The source evidence is retained in the workspace's `prod-evidence-2026-10-25` collection: its README, `production-online-smoke-2026-10-25T10-08-15.832Z-verification.json`, the corresponding incomplete-postflight record, and `production-manual-seat-recovery.json`. Earlier saved descriptions predate the runtime-origin discovery; this correction supersedes their interpretation of requested target metadata as Production gameplay proof. Run identities and original outcomes are preserved. Private credentials, seat secrets, and signed recording URLs are excluded.

## Related checks and walkthrough

- [Merged-main CI](https://github.com/Davidson3556/Paperwild/actions/runs/40139506887): 150 app/gate tests, 20 backend tests, TypeScript and production build passed.
- [PR #5 strict regression run](https://github.com/Davidson3556/Paperwild/actions/runs/40137927136): 16/16 frontend cases passed.
- [Historical Development acceptance](CONVEX_CLOUD_VERIFICATION_2026-10-24.md): 4/4 multiplayer cases at `419fdef`, with the complete before/after source and 48-file audit.
- [Live judge tour](../README.md#for-judges) and [two-seat setup walkthrough](CONVEX_SETUP.md#try-two-seats).

These records identify their tested revisions and environments. Later code or CI changes need their own execution evidence; updating documentation does not update TestSprite Sources or complete a hackathon submission.
