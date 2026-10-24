# Convex Cloud verification — October 24, 2026

Paperwild's friend-room functions are deployed to Cloud Development backend **`fast-starling-207`**, in the `paperwild` project. Only the `feat/convex-multiplayer` branch's Vercel Preview environment uses its public client URL, `https://fast-starling-207.convex.cloud`. Production remains unconfigured and PR #5 is unmerged.

## Release identity

| Item | Verified value |
| --- | --- |
| PR | [Paperwild #5](https://github.com/Davidson3556/Paperwild/pull/5) |
| First committed four-case preview head | `66cc12731984413745f2ea0edcc0de944d15104c` |
| Application and backend source | `6f173553c54ed3bee61a502d2d77183a07512913`; runtime source unchanged at the preview head |
| Public test target | [PR #5 preview](https://paperwild-git-feat-convex-multiplayer-davidson3556s-projects.vercel.app/) |
| Vercel deployment | `dpl_BMSpAxoxdf83vWegXWswKESztzuw` |
| Cloud build | `index-EfeOJs9J.js`, `index-DCOXjeBT.css`; 48 application payloads |
| Backend | Cloud Development `fast-starling-207`, deployed from `5633a86` with the same room functions |

The deployment used an approved 24-hour key with only `deployment:deploy` permission for this backend. No deployment key is required by the game or TestSprite. No key is committed or included in these records. Expiring deployment access does not stop room queries or moves.

## Established checks

- [Regular CI at `66cc127`](https://github.com/Davidson3556/Paperwild/actions/runs/40130203087) passed **150 application/gate tests, 20 isolated Convex tests, TypeScript and the production build**.
- [Strict TestSprite regression CI at the same head](https://github.com/Davidson3556/Paperwild/actions/runs/40130203055) passed **16/16** reviewed frontend scripts against the cloud-configured preview. The [earlier cloud-head sanitized artifact](testsprite/pr5-cloud-regression-summary.json) identifies the preceding `c6648a0` pass; the latest job publishes its own exact-head artifact. These establish regression coverage, not the four new multiplayer cases.
- Live browser checks created two seats, played `e4 d5 exd5`, displayed the shared capture and ceremony, and accepted an Undo that restored `e4 d5` in both 64-square boards. These were **two tabs in the same Chrome profile**, not independent browser contexts. The [stored DOM observations](testsprite/convex-cloud-two-tab-observations.json) exclude seat credentials.

## Hosted multiplayer runner investigation

The four new scripts use a dedicated TestSprite project, **Paperwild multiplayer preview** (`5ac48e78-b1a2-4509-ad73-0b3efe0c3343`). The regression project retains its exact sixteen-case boundary. See the [script descriptions](testsprite/online-overrides/README.md) and [current stored-source manifest](testsprite/online-stored-code-manifest.json).

The [initial four-case execution](https://www.testsprite.com/dashboard-v3/o/f7454a95-e992-581a-98e0-4edd142a0891/projects/5ac48e78-b1a2-4509-ad73-0b3efe0c3343/execution/0c2b161d-1e85-4f83-9d5a-fce3f222c94d) finished **0 passed / 4 failed**. Each failed with `BrowserContext.new_page: Target page, context or browser has been closed` before its first page navigation. It did not exercise Paperwild or Convex. The records remain unchanged: [initial summary](testsprite/online-cloud-summary.json), [completed post-run audit](testsprite/online-cloud-verification.json), and [original versions](testsprite/online-initial-stored-code-manifest.json). The available evidence does not identify the browser's underlying exit cause.

A focused compatibility candidate restored the exact Chromium launch arguments used by the passing regression suite, and launched a separate browser with one fresh context/page for each player. It retained every application assertion. The [focused ONLN-001 execution](https://www.testsprite.com/dashboard-v3/o/f7454a95-e992-581a-98e0-4edd142a0891/projects/5ac48e78-b1a2-4509-ad73-0b3efe0c3343/execution/ff4c6d65-c789-456d-83b5-5fc63b2742cf) **passed**, including independent seats, legal shared moves and capture, rejected illegal/wrong-turn attempts, and rejection of a third visitor. The test candidate was uncommitted when executed; the application remained at `c6648a0`. [Its audit](testsprite/online-cloud-bootstrap-probe-verification.json) verifies guarded source `v-8c8f963a53be`, SHA-256 `745e2bdcba98c33bd5881e7f0d00932e30587215f0203afefef8e6e3db8fc7a9`, the unchanged deployment and all 48 public payloads before/after.

The [first committed four-case execution](https://www.testsprite.com/dashboard-v3/o/f7454a95-e992-581a-98e0-4edd142a0891/projects/5ac48e78-b1a2-4509-ad73-0b3efe0c3343/execution/657456b3-12fc-476a-ad57-247971df4d32), at `66cc127`, finished **3 passed / 1 failed**. ONLN-001 (independent seats and capture), ONLN-002 (Undo/rematch consent) and ONLN-003 (reload/local-save separation) passed. ONLN-004 failed after waiting 35 seconds for `reconnecting`; it did not reach its offline-move and restoration assertions. [Its archived summary](testsprite/online-cloud-first-acceptance-summary.json) and [completed audit](testsprite/online-cloud-first-acceptance-verification.json) preserve all four actual run identities, committed source readbacks, unchanged head/deployment and all 48 payloads before/after.

Inspection of the installed Convex SDK found a 60-second server-inactivity watchdog. The 35-second wait did not establish whether the socket was interrupted. A separate, uncommitted ONLN-004 diagnostic (`v-c4051631c928`, SHA-256 `bf6120a0df6bae756be4a276fa17724f3be6511b42f38c591ce1ad622da3ba67`) used a 90-second wait, real browser offline control, same-origin HTTP controls and socket lifecycle/frame counts. It exports no socket URL, frame payload or credential. Its [execution](https://www.testsprite.com/dashboard-v3/o/f7454a95-e992-581a-98e0-4edd142a0891/projects/5ac48e78-b1a2-4509-ad73-0b3efe0c3343/execution/e7c28f31-014c-4f65-9ceb-f50a34a00070) confirmed Black's browser offline state, an actual uncached HTTP failure, White's HTTP 200 control, no additional incoming Convex frames, and the game's actual `reconnecting` state. It then failed a newly added immediate socket-close observation, before the original no-queue assertions. [The completed audit](testsprite/online-cloud-offline-probe-verification.json) and [exact archived Python body](testsprite/online-history/ONLN-004-v-c4051631c928.py.txt) preserve that failure.

Convex starts socket closure asynchronously and publishes its disconnected state without awaiting the browser's close event. The [WebSocket standard](https://websockets.spec.whatwg.org/#dom-websocket-close) likewise separates starting a closing handshake from the later close event. The revised test retains close counts as diagnostic evidence through restoration, while still requiring actual isolated HTTP failure, no incoming-frame increase, real `reconnecting`, unchanged confirmed state, rejected offline move/Undo, no queued work, and same-seat restoration followed by a new explicit move. Every original gameplay assertion remains, and the application source is unchanged. A complete four-case pass remains pending.

Every dispatch explicitly requests `--no-auto-heal`. The API omits the run's auto-heal field and supplies null run code-version fields; these remain null in the reports. Source/version readback and an unqualified actual replay record are separate verified evidence, not invented API attestations.

## Boundaries

No production Convex backend or production client URL has been configured. The public preview uses a development backend and rooms expire after 24 hours. Production deployment and future backend publishing need their own configuration; merging the frontend alone does not provision a production backend. Backend transaction/rules tests, visual checks and hosted browser acceptance are separate forms of evidence.
