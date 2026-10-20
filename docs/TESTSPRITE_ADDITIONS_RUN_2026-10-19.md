# TestSprite additions audit — October 19, 2026

## 1️⃣ Document Metadata

- Project: Paperwild, local uncommitted `living` working tree based on 869a1f9.
- Target: production preview of the fixed 43-module build on local port 4182, through the TestSprite native MCP tunnel.
- Build: `index-J8UhEskH.js`; local tests 78/78 and strict production build passed.
- Initial execution: five cases; corrected execution: only TC301, TC302 and TC303.
- [Initial plan](testsprite/additions-initial-plan.json), [corrected plan](testsprite/additions-plan.json), [initial sanitized results](testsprite/additions-initial-results.json), [corrected sanitized results](testsprite/additions-corrected-results.json).
- Sensitive configuration, account identifiers, credentials and signed recordings are excluded from these artifacts. Raw generated exports remain in ignored `testsprite_tests/`.

## 2️⃣ Requirement Validation Summary

| Case | Initial service result | Corrected service result | Interpretation |
| --- | --- | --- | --- |
| TC301 Notebook/refusal/atomic moves | Failed | Passed | Initial oracle incorrectly expected Journal01 after e4. The badge counts captures and correctly stays00. Chrome separately verified illegal-state preservation, turn and SAN. |
| TC302 Named capture/remembrance/Undo | Blocked | Passed | Initial browser remained at loading. The initial instructions also swapped Rowan/Tuck; corrected roles are victim Rowan, capturer Tuck. The rerun completed, but its exported assertions principally cover restored pawns and empty remembrance after Undo. |
| TC303 Fresh game/study cleanup | Failed | Failed | Initial check mistook permanent hidden .pageant-stretcher scaffolding for stale board motion. Corrected verdict says the exact 32-occupied-square requirement was not measured, rather than identifying a wrong position. Chrome separately measured all 32 occupied starting squares, 32 sprites and zero obsolete overlays after a settled capture was reset. Do not convert this to a service pass. |
| TC304 Checkmate/finale/Undo | Passed | Not rerun | Interaction smoke: exported assertions only check that two square controls are visible. Direct Chrome verified queen identity, SAN, winner and cleanup. |
| TC305 Radio preference/mute/reload | Passed | Not rerun | Export meaningfully checks the reloaded muted and tuned-in UI state. It does not establish actual audio output. |

Initial five-case result: **2 passed / 2 failed / 1 blocked**. Corrected three-case result: **2 passed / 1 failed**. Latest per-case status across the two runs: **4 service passes / 1 failed case**.

The initial loading block is unresolved in cause. Chrome loaded the app and the corrected case completed; available initial artifacts do not establish whether app initialization, a resource request, the tunnel or the runner caused that attempt to stall.

## 3️⃣ Coverage & Matching Metrics

All five planned cases received a service result. Four have a latest service pass. This is not one five-case green run, and service status is not equivalent to substantive assertion coverage.

The generated code was inspected:

- Initial TC301 checked a capture-count badge as though it counted moves. Its corrected export checks final e2/e4/e5 piece values and capture count, without the complete illegal-state snapshot or exact SAN/turn assertions.
- Initial TC302 exported no capture sequence and used an exact-class XPath that would miss multi-class sprites. Corrected assertions cover restored e4/d5 pawns, the empty garden and disabled export after Undo; named card details,31 residents and a PNG download are not fully asserted there.
- TC303's corrected export checks promotion-study piece attributes and zero captures. It omits the fresh full-board occupancy measurement and complete transient-overlay checks.
- TC304's square controls exist regardless of what pieces occupy them; their visibility alone does not verify checkmate or Undo integrity.
- TC305 covers muted/tuned-in preference UI, not audio graphs, audible quality or scheduling.

The exports mark assertions unverified at export and omit explicit loader/movement settlement waits in places. No percentage of full acceptance coverage is claimed. Focused direct browser checks and the 78 local tests provide separate evidence in the [release verification record](ADDITIONS_VERIFICATION_2026-10-19.md).

## 4️⃣ Key Gaps / Risks

**Portal/GitHub App:** The account check still reports Free. PR #3 activity remains billing-blocked; one Run Now retry returned without starting a run. GitHub still shows the older failed TestSprite V3 check and unchanged head 869a1f9. The local MCP results do not satisfy or replace a completed Portal PR suite.

**Build availability:** These additions and documentation remain local. No push, merge, deployment, paid upgrade, protection exception or bypass credential was created during this verification.

**Remaining verification:** TC303 retains its failed service verdict for an unmeasured assertion. Fresh phone sizing was unavailable through the current viewport control; physical listening and actual background-tab lifecycle were not assessed. A public deployment of the current build and substantive Portal assertions remain necessary before claiming that release path is verified.

Convex and online multiplayer remain deferred.
