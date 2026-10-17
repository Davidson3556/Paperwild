## 1️⃣ Document Metadata

- **Project / date:** Paperwild, October 17, 2026; TestSprite native MCP browser workflow.
- **Original build:** `d103453`, production port 4175, asset `index-21OT-O0U.js`. An eight-case attempt started around 09:18 UTC and was stopped after two generation blockers were observed. This was not a completed eight-case acceptance run.
- **Candidate correction:** `src/style.css` changes semantic square-button opacity from zero to one, retaining transparent backgrounds. The candidate remains **local and unpushed**.
- **Fixed build:** immutable production preview on port 4176, JavaScript `index-DfrSQ1Xo.js`, CSS `index-JLMv7wtf.css`. The three-case rerun completed around 09:40 UTC.
- **Outcome:** TestSprite reports **3 PASSED / 0 FAILED**. Assertion audit finds **two partial smoke tests and one invalid exported replay**. No complete named acceptance scenario is certified by these scripts.
- Raw configuration, logs, scripts, and signed media remain local under ignored `testsprite_tests/`. This report contains only stable result links and sanitized findings.

## 2️⃣ Requirement Validation Summary

**Initial interaction and environment blockers.** TC101 enumerated all 64 square buttons but could not obtain actionable browser indexes for their zero-opacity targets. TC108 could not create the requested phone viewport or block a PNG before navigation. The other six initial cases were not audited to completion. These observations do not establish chess-engine defects.

**Candidate correction.** Fully opaque buttons with transparent backgrounds retained the visible pencil board. Chrome confirmed all 64 computed opacities were one and backgrounds transparent, then played `e4 e5`. All 24 local tests, strict TypeScript, and the production build passed. The TestSprite rerun also executed actual square clicks against port 4176, establishing that this targeting blocker was resolved for the exercised flows.

| Case / native status | Audited evidence and limits |
| --- | --- |
| [TC101 — Passed](https://www.testsprite.com/dashboard/mcp/tests/78b89942-deeb-5cc4-82ea-744261173379/test/28611344-ed3d-491a-9893-d9067b8afc82) | Executes local mode, an illegal e2–e5 attempt, then e4/e5. Script lines 78, 81, and 86 assert destination pawn labels and ordered opening SAN. It does **not** assert preservation immediately after the illegal attempt, the complete board, source emptiness, turn, capture count, exact ply count, or artwork. **Partial opening smoke coverage.** |
| [TC102 — Passed](https://www.testsprite.com/dashboard/mcp/tests/78b89942-deeb-5cc4-82ea-744261173379/test/d257147a-61c8-4f9e-b272-dc1660175547) | Executes study capture/undo interactions twice. Lines 88, 91, and 96 assert only the final restored pawn labels and zero captures. Post-capture board, `exd5`, Black turn, count one, captured artwork/face, and cleanup are not asserted. **Partial capture/undo smoke coverage; matching-face acceptance unverified.** |
| [TC104 — Passed](https://www.testsprite.com/dashboard/mcp/tests/78b89942-deeb-5cc4-82ea-744261173379/test/2182f109-36c7-436f-9ba6-1d82732a2eff) | Executes cancellation, knight promotion, result close, and Undo. All assertions appear afterward. Without another action, lines 91, 96, and 104 require a8 to be empty, then contain a White knight, then be empty. These checks cannot all pass as an exported replay. Cancellation and arrival are not asserted at their actual phases; face/artwork, notation, and insufficient-material result checks are absent. **Exported replay invalid; full promotion coverage unestablished.** |

All three exported scripts omit explicit movement-settlement waits. A replay can therefore race the next click against the game’s busy state. Comments such as “Verify…” and “Assert-outcome: passed” are not executable assertions. The service statuses describe the native run; they do not prove that the downloaded scripts form a reliable replay suite.

## 3️⃣ Coverage & Matching Metrics

| Layer | Result |
| --- | --- |
| Initial current-build attempt | Stopped; two observed blockers, six cases not audited. No acceptance verdict. |
| Fixed-build native rerun | 3 reported passes, 0 reported failures. |
| Audited exported evidence | 2 partial smoke tests; 1 contradictory replay; 0 complete named acceptance scenarios certified. |
| Local tests and build | 24 passing tests; strict TypeScript and production build passed. |
| Full acceptance specification | 20 scenarios; full cloud coverage remains pending. |

The native service pass rate is 100%; it must not be presented as 100% acceptance coverage. Local engine, mocked audio lifecycle, and movement-invariant tests remain separate evidence.

## 4️⃣ Key Gaps / Risks

- **Further pushes are held.** No GitHub changes were pushed during this audit. The local candidate and this evidence remain reviewable in the workspace.
- **Repair and execute the acceptance suite before treating it as a gate.** Put each assertion beside the action it verifies, add observable busy/thinking waits, and require board/history/turn/capture/artwork assertions. Retain the contradictory promotion export as evidence; do not silently relabel it a pass.
- **Scope remains limited.** Actual timed blinks, idle gestures, computer sequencing, persistence, sound, phone layout, and missing-art behavior are not validated by this three-case TestSprite rerun. Prior Chrome and local-test observations remain documented separately in [VERIFICATION.md](VERIFICATION.md).
- **Connection warnings:** the runner logged a tunnel TCP close near the end of the run and control websocket code 1006 after completion. Results and scripts were downloaded. These warnings do not explain or excuse the missing or contradictory assertions.
- **Hackathon gates remain separate.** The full [20-scenario specification](TESTSPRITE_PLAN.md), public playable deployment, required Portal 3.0 suite, and demonstrated GitHub App PR check remain pending. Audible quality also requires a listening check.
