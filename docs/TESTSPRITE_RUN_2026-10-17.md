# TestSprite native MCP run: audited results

## 1️⃣ Document Metadata

- **Project:** The Queen’s Conservatory (`conservatory`).
- **Date:** October 17, 2026, Africa/Lagos; run records span approximately 00:09–00:22 WAT.
- **Target:** local production preview, `http://localhost:4174/`, asset `index-BqFG4EEx.js`.
- **Runner:** TestSprite native MCP; six selected scenarios; generated Python uses headless Chromium at 1280 × 720.
- **Prepared by:** engineering review of the downloaded TestSprite result JSON, raw report, generated scripts, and runner logs.
- **Outcome:** the native run completed and returned **2 PASSED / 4 FAILED**. **All six intended feature scenarios remain inconclusive after assertion review.** The two service passes do not establish successful chess play.
- **Retained local evidence:** raw report (local only: `testsprite_tests/tmp/raw_report.md`), result JSON (local only: `testsprite_tests/tmp/test_results.json`), and bounded six-case plan (local only: `testsprite_tests/testsprite_frontend_test_plan.json`). These files are excluded from source control. This sanitized report contains shareable findings and stable per-case portal links; it omits configuration, signed video URLs, and tunnel addresses.

## 2️⃣ Requirement Validation Summary

### Legal chess and illegal-move rejection

**TC002 — Native status: PASSED. Audited coverage: inconclusive.**

[TestSprite result](https://www.testsprite.com/dashboard/mcp/tests/78b89942-deeb-5cc4-82ea-744261173379/test/07af59d8-a59d-408f-959b-7238b4d22659) · local generated script (local only: `testsprite_tests/TC002_Local_legal_opening_and_illegal_move_rejection_preserve_correct_state.py`)

The generated script navigates, opens another tab, locates a button named `Reload`, and asserts only that `window.location.href` is nonempty. `Reload` is absent from the application’s controls. The script contains no board move, illegal-move attempt, piece-state assertion, or turn/history assertion. A nonempty URL is insufficient to validate this requirement. No product defect is established by this record.

### Computer reply and turn-aware undo

**TC015 — Native status: FAILED. Audited coverage: inconclusive.**

[TestSprite result](https://www.testsprite.com/dashboard/mcp/tests/78b89942-deeb-5cc4-82ea-744261173379/test/a360cb04-ff83-43cd-951b-05ae87333983) · local generated script (local only: `testsprite_tests/TC015_Keeper_makes_one_reply_and_undo_restores_completed_and_pending_turns.py`)

The script’s exported failure comment says `Error executing action dropdown_options due to timeout.` It does not select a difficulty or move a piece. Its remaining assertions concern the initial `Your move.` prompt and Undo visibility. There is no computer-reply or undo assertion. This is an incomplete runner interaction; the evidence does not show the computer implementation failing.

### Capture garden and undo

**TC012 — Native status: PASSED. Audited coverage: inconclusive.**

[TestSprite result](https://www.testsprite.com/dashboard/mcp/tests/78b89942-deeb-5cc4-82ea-744261173379/test/f3bad63d-f3a7-423e-9876-202fb3dd11bf) · local generated script (local only: `testsprite_tests/TC012_First_bloom_capture_creates_one_flower_and_undo_removes_it.py`)

The generated script calls `page.goto(...)` twice and asserts only a nonempty current URL. It never opens a study, captures, checks a flower count, or undoes. The native pass does not establish capture-garden coverage. No product defect is established.

### Saved-game restoration

**TC019 — Native status: FAILED. Audited coverage: inconclusive.**

[TestSprite result](https://www.testsprite.com/dashboard/mcp/tests/78b89942-deeb-5cc4-82ea-744261173379/test/5a072374-7c7b-424d-819c-27e3575e70ff) · local generated script (local only: `testsprite_tests/TC019_Capture_study_resumes_after_reload_and_retains_undo_history.py`)

The exported failure comment records a browser-use click watchdog timing out after 15 seconds while opening `Explore the garden studies ↗`. The generated script stops at that entry action and has only a URL assertion afterward. It never captures, reloads a saved game, or validates restored history. The interaction timeout’s cause is unconfirmed; it is not evidence of a persistence defect.

### Promotion cancellation and knight draw

**TC022 — Native status: FAILED. Audited coverage: inconclusive.**

[TestSprite result](https://www.testsprite.com/dashboard/mcp/tests/78b89942-deeb-5cc4-82ea-744261173379/test/03a86cce-a611-42d4-8e40-bb6ab21fc8e5) · local generated script (local only: `testsprite_tests/TC022_Promotion_cancellation_preserves_position_and_knight_promotion_produces_a_reversible_draw.py`)

The same initial study-button click timed out in the browser-use watchdog. The generated script never reaches a promotion choice, cancellation, knight, draw, or undo assertion; its final assertion checks only the URL. The record cannot establish a promotion defect or successful promotion coverage.

### Checkmate and terminal lock

**TC004 — Native status: FAILED. Audited coverage: inconclusive.**

[TestSprite result](https://www.testsprite.com/dashboard/mcp/tests/78b89942-deeb-5cc4-82ea-744261173379/test/6b643cd5-063b-4314-a4e2-6b4c52d786c1) · local generated script (local only: `testsprite_tests/TC004_Queen_g7_checkmate_declares_White_winner_and_blocks_further_moves.py`)

The failure comment says `Failed to execute scroll action.` The exported script creates a new page and scrolls it without navigating to the application, then asserts only a nonempty URL. It contains no checkmate or terminal-state assertion. This generated test is insufficient to evaluate the requirement and does not establish a game defect.

## 3️⃣ Coverage & Matching Metrics

| Requirement | Native passed | Native failed | Feature scenarios adequately validated |
| --- | ---: | ---: | ---: |
| Legal / illegal local chess | 1 | 0 | 0 |
| Computer reply and undo | 0 | 1 | 0 |
| Capture garden and undo | 1 | 0 | 0 |
| Saved-game restoration | 0 | 1 | 0 |
| Promotion and draw | 0 | 1 | 0 |
| Checkmate and terminal lock | 0 | 1 | 0 |
| **Total** | **2** | **4** | **0 of 6** |

The service’s raw pass rate is **33.33%**. Audited gameplay coverage is **unestablished for all six selected scenarios**. The broader 18-scenario plan was not executed in full. Separate local engine tests and manual browser observations remain documented in [the verification record](VERIFICATION.md).

All six downloaded result entities have an empty `testError` field. Error descriptions above come from the generated script comments. Only TC002 includes a video reference in the raw entity; no additional step-by-step trace was present in the downloaded records. Signed video credentials are not included in this report.

## 4️⃣ Key Gaps / Risks

- **Test generation did not preserve the acceptance assertions.** None of the returned scripts exercises and checks its complete named chess flow. The two service passes must not be presented as feature validation.
- **Remote interaction failures precede the target features.** The dropdown, study-button, and scroll failures leave their underlying product causes unconfirmed. No source change is justified solely by these records.
- **Runner connectivity was interrupted.** At 23:20:12 UTC the control websocket closed with code 1006. Subsequent logs repeatedly show `getaddrinfo ENOTFOUND control.tun.testsprite.com` and `No response from backend` while fetching results. This limits confidence in the remote execution environment; it does not prove every failure had the same cause.
- **The native run nevertheless reached completion.** It saved six result entities and six scripts and released its execution lock. The CLI’s documented request timeout is 10 minutes and polling ceiling is 20 minutes; this run did not end through the terminal timeout path. The local dashboard process was stopped after artifacts were retained.
- **No rerun or source edit followed this result.** A future run should first confirm connectivity and require generated assertions for board contents, turn, history, and captures before treating its statuses as acceptance evidence.
- **Submission work remains.** A dedicated required Portal 3.0 suite, public repository/deployment, and TestSprite GitHub App pull-request checks have not been demonstrated by this MCP run.
