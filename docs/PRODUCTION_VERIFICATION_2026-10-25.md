# Production multiplayer verification — October 25, 2026

Paperwild's public game at **[paperwild.vercel.app](https://paperwild.vercel.app/)** supports online friend rooms after [PR #5](https://github.com/Davidson3556/Paperwild/pull/5) merged. Three independently dispatched Production TestSprite cases passed. The complete post-run artifact audit remains incomplete; this record preserves that distinction.

## Release identity

| Item | Recorded value |
| --- | --- |
| Merged application revision | `31e8b02e62d2095716624c173879ff1c902953b4` on `main` |
| Reviewed test-source revision | `944ba66e9212953ee14c804bdfbee72c138a39f9` |
| Public frontend | `https://paperwild.vercel.app/` |
| Convex environment | Production, `https://grateful-cuttlefish-105.convex.cloud` |
| Vercel deployment | `dpl_5uZMUS4vArHxYwkdLs5T5zVjKohv`, Ready |
| Application bundle | `assets/index-DRVksUc-.js` |
| Reference build | 48 public files; tree SHA-256 `fb141612e7cbb85d89da5b5535219b3893d29ca8da97d639bd67551b55dc2f1c` |
| TestSprite project | `5ac48e78-b1a2-4509-ad73-0b3efe0c3343` |

The original Production frontend was built before `VITE_CONVEX_URL` was saved, so it could not offer online rooms. The fix saved the Production public client URL and rebuilt the same merged application revision. An intermediate value contained a trailing newline; the client trimmed it for gameplay, but the independent build comparison correctly rejected the byte mismatch before dispatch. The final value has no trailing newline, and the rebuilt public assets matched the reference build before the runs below. No application source change was needed for this configuration repair.

The unique deployment URL remains protected by Vercel authentication. The public alias above is the tested player-facing origin. The Development preview continues to use `https://fast-starling-207.convex.cloud`; it has separate room data and credentials.

## Production TestSprite results

These were **three separate single-case CLI executions**, each run once against the public Production alias. Each script creates independent Chromium browser instances with fresh contexts and interacts through the actual invitation, board, and consent controls.

| Case | Actual result | Coverage | Actual run |
| --- | --- | --- | --- |
| ONLN-001 | Passed | Explicit independent seats, no automatic invite join, shared `e4 d5 exd5`, wrong-turn restrictions, rejected third visitor | [Run `5d1bfc54`](https://www.testsprite.com/dashboard-v3/o/f7454a95-e992-581a-98e0-4edd142a0891/projects/5ac48e78-b1a2-4509-ad73-0b3efe0c3343/execution/99ae01b6-788b-4cf1-a8f6-d1681db604f1/test/5d1bfc54-c74b-4065-985d-a223e43742c1) |
| ONLN-002 | Passed | Undo and rematch requests, decline/accept, matching histories and turns | [Run `d5fa5cc2`](https://www.testsprite.com/dashboard-v3/o/f7454a95-e992-581a-98e0-4edd142a0891/projects/5ac48e78-b1a2-4509-ad73-0b3efe0c3343/execution/d925857f-a072-40d7-88a8-d3fa48f17c47/test/d5fa5cc2-712e-44b4-8e54-ecf29490e194) |
| ONLN-003 | Passed | Reload, explicit saved-seat return, and restoration of the separate local game when leaving | [Run `907fd7ea`](https://www.testsprite.com/dashboard-v3/o/f7454a95-e992-581a-98e0-4edd142a0891/projects/5ac48e78-b1a2-4509-ad73-0b3efe0c3343/execution/42a6c42f-5ea8-4802-927f-4911e68f7a73/test/907fd7ea-a9ac-4c5f-a84c-211da433598b) |

The actual backend run records report `source: cli`, the expected project, target `https://paperwild.vercel.app/`, and an unqualified `replay` result for every case. Dispatch used `--no-auto-heal`. Per-run code-version fields are null and the API does not expose an auto-heal field; those omissions are retained rather than treated as positive attestations. Independent stored-code readback established the following unchanged versions before and after execution:

| Case | Hosted version | Source SHA-256 |
| --- | --- | --- |
| ONLN-001 | `v-8c8f963a53be` | `745e2bdcba98c33bd5881e7f0d00932e30587215f0203afefef8e6e3db8fc7a9` |
| ONLN-002 | `v-36829c66b6fc` | `8122a2afb8894234e4b01d4e06861a5157cce9972c5c6e1592c9d4ae31333259` |
| ONLN-003 | `v-36a7112662b4` | `db596f3613055cbcec0f6e172c3616cc98dcb0ddd3fc31e1a5cad0007ec402b3` |

## Evidence boundary

- **Completed:** all 48 public application payloads matched the reference build before dispatch; the three actual replay records passed; project membership and stored bodies/versions were unchanged afterward; `main` remained at the recorded merge revision.
- **Incomplete:** the full post-run 48-file download/hash audit timed out. Read-only retries also encountered transport failures. The saved aggregate verification retains **`verified: false`**. These are three passing gameplay cases with incomplete artifact postflight, rather than a completed strict Production acceptance audit.
- **Not executed on Production:** ONLN-004, the genuine outage/no-queued-move/same-seat recovery case. Its stored diagnostic pins the Development WebSocket hostname. Its [four-case Development acceptance](CONVEX_CLOUD_VERIFICATION_2026-10-24.md) remains valid for that identified environment; it does not establish Production outage behavior.
- **Supplementary manual check:** two tabs in one Chrome profile exercised shared moves and agreed Undo. On the final build, an explicitly restored Black seat showed a connected room, White pawn e4, Black pawn d5, matching `e4 d5` history, and revision 6. This is separate from the independent-browser TestSprite evidence. Earlier capture screenshots were taken before the trailing-newline cleanup and do not identify the final build by themselves.

The source evidence is retained in the workspace's `prod-evidence-2026-10-25` collection: its README, `production-online-smoke-2026-10-25T10-08-15.832Z-verification.json`, the corresponding incomplete-postflight record, and `production-manual-seat-recovery.json`. This public record includes stable run links and sanitized identities; private credentials, seat secrets, and signed recording URLs are excluded.

## Related checks and walkthrough

- [Merged-main CI](https://github.com/Davidson3556/Paperwild/actions/runs/40139506887): 150 app/gate tests, 20 backend tests, TypeScript and production build passed.
- [PR #5 strict regression run](https://github.com/Davidson3556/Paperwild/actions/runs/40137927136): 16/16 frontend cases passed.
- [Historical Development acceptance](CONVEX_CLOUD_VERIFICATION_2026-10-24.md): 4/4 multiplayer cases at `419fdef`, with the complete before/after source and 48-file audit.
- [Live judge tour](../README.md#for-judges) and [two-seat setup walkthrough](CONVEX_SETUP.md#try-two-seats).

These records identify their tested revisions and environments. Later code or CI changes need their own execution evidence; updating documentation does not update TestSprite Sources or complete a hackathon submission.
