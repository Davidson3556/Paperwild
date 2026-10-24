# Convex Cloud verification — October 24, 2026

Paperwild's friend-room functions are deployed to Cloud Development backend **`fast-starling-207`**, in the `paperwild` project. Only the `feat/convex-multiplayer` branch's Vercel Preview environment uses its public client URL, `https://fast-starling-207.convex.cloud`. Production remains unconfigured and PR #5 is unmerged.

## Release identity

| Item | Verified value |
| --- | --- |
| PR | [Paperwild #5](https://github.com/Davidson3556/Paperwild/pull/5) |
| Preview head | `c6648a023f041e4e7651951cdd7cf92016a5e19e` |
| Application and backend source | `6f173553c54ed3bee61a502d2d77183a07512913`; runtime source unchanged at the preview head |
| Public test target | [PR #5 preview](https://paperwild-git-feat-convex-multiplayer-davidson3556s-projects.vercel.app/) |
| Vercel deployment | `dpl_4KexDkbSJxqX3wVTP4zu7c8RxbQ7` |
| Cloud build | `index-EfeOJs9J.js`, `index-DCOXjeBT.css`; 48 application payloads |
| Backend | Cloud Development `fast-starling-207`, deployed from `5633a86` with the same room functions |

The deployment used an approved 24-hour key with only `deployment:deploy` permission for this backend. No deployment key is required by the game or TestSprite. No key is committed or included in these records. Expiring deployment access does not stop room queries or moves.

## Established checks

- [Regular CI at `c6648a0`](https://github.com/Davidson3556/Paperwild/actions/runs/40126724971) passed **150 application/gate tests, 20 isolated Convex tests, TypeScript and the production build**.
- [Strict TestSprite regression CI at the same head](https://github.com/Davidson3556/Paperwild/actions/runs/40126724942) passed **16/16** reviewed frontend scripts against the cloud-configured preview. The [sanitized artifact](testsprite/pr5-cloud-regression-summary.json) records exact project membership, stored source/version before and after, actual replay facts and matching public payloads. This establishes regression coverage, not the four new multiplayer cases.
- Live browser checks created two seats, played `e4 d5 exd5`, displayed the shared capture and ceremony, and accepted an Undo that restored `e4 d5` in both 64-square boards. These were **two tabs in the same Chrome profile**, not independent browser contexts. The [stored DOM observations](testsprite/convex-cloud-two-tab-observations.json) exclude seat credentials.

## Hosted multiplayer runner investigation

The four new scripts use a dedicated TestSprite project, **Paperwild multiplayer preview** (`5ac48e78-b1a2-4509-ad73-0b3efe0c3343`). The regression project retains its exact sixteen-case boundary. See the [script descriptions](testsprite/online-overrides/README.md) and [current stored-source manifest](testsprite/online-stored-code-manifest.json).

The [initial four-case execution](https://www.testsprite.com/dashboard-v3/o/f7454a95-e992-581a-98e0-4edd142a0891/projects/5ac48e78-b1a2-4509-ad73-0b3efe0c3343/execution/0c2b161d-1e85-4f83-9d5a-fce3f222c94d) finished **0 passed / 4 failed**. Each failed with `BrowserContext.new_page: Target page, context or browser has been closed` before its first page navigation. It did not exercise Paperwild or Convex. The records remain unchanged: [initial summary](testsprite/online-cloud-summary.json), [completed post-run audit](testsprite/online-cloud-verification.json), and [original versions](testsprite/online-initial-stored-code-manifest.json). The available evidence does not identify the browser's underlying exit cause.

A focused compatibility candidate restored the exact Chromium launch arguments used by the passing regression suite, and launched a separate browser with one fresh context/page for each player. It retained every application assertion. The [focused ONLN-001 execution](https://www.testsprite.com/dashboard-v3/o/f7454a95-e992-581a-98e0-4edd142a0891/projects/5ac48e78-b1a2-4509-ad73-0b3efe0c3343/execution/ff4c6d65-c789-456d-83b5-5fc63b2742cf) **passed**, including independent seats, legal shared moves and capture, rejected illegal/wrong-turn attempts, and rejection of a third visitor. The test candidate was uncommitted when executed; the application remained at `c6648a0`. [Its audit](testsprite/online-cloud-bootstrap-probe-verification.json) verifies guarded source `v-8c8f963a53be`, SHA-256 `745e2bdcba98c33bd5881e7f0d00932e30587215f0203afefef8e6e3db8fc7a9`, the unchanged deployment and all 48 public payloads before/after.

The full four-case multiplayer suite remains pending. The focused pass is not a replacement for Undo/rematch, reload/local-save separation and genuine disconnection/reconnection acceptance.

Every dispatch explicitly requests `--no-auto-heal`. The API omits the run's auto-heal field and supplies null run code-version fields; these remain null in the reports. Source/version readback and an unqualified actual replay record are separate verified evidence, not invented API attestations.

## Boundaries

No production Convex backend or production client URL has been configured. The public preview uses a development backend and rooms expire after 24 hours. Production deployment and future backend publishing need their own configuration; merging the frontend alone does not provision a production backend. Backend transaction/rules tests, visual checks and hosted browser acceptance are separate forms of evidence.
