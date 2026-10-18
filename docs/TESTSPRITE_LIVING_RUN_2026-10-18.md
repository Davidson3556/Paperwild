# TestSprite living-build execution audit — October 18, 2026

## 1. Document metadata

- **Project / build:** Paperwild `living` branch, local production bundle `index-7OlxKUu2.js` (35 Vite modules). Strict TypeScript and production build passed; 64 local tests passed. Build and direct-browser evidence are recorded in [Living release verification](LIVING_RELEASE_VERIFICATION_2026-10-18.md).
- **Execution:** TestSprite native MCP browser workflow against the production preview on port **4176**, reached through its temporary tunnel. These runs are separate from Portal 3.0 execution, GitHub App PR checks and deployed-preview testing.
- **Plan:** [Nine-case living-build plan](testsprite/living-plan.json). For the corrected run, complete action/assertion instructions were included in each case description because the initial MCP configuration did not retain the separate step fields.
- **Outcome:** All eight cases supported by this runner eventually received a service pass across reruns. TC208 phone resizing remained blocked. There was **no single nine-case green run**, and service passes do not establish full acceptance coverage.
- **Artifacts:** Sanitized snapshots retain titles, statuses, errors and dashboard links: [initial nine cases](testsprite/living-initial-results.json), [corrected eight cases](testsprite/living-corrected-results.json), [final capture rerun](testsprite/living-capture-rerun-results.json). Raw runner configuration, exports and signed media remain in ignored `testsprite_tests/`.

## 2. Requirement validation summary

Two reported failures came from test expectations, without an application change between the corrected and final runs:

- **TC206 weather:** The initial test interpreted “Clear skies” as the current weather. In this UI it offers the next action: rain-on has `aria-label="Let it clear"`, `aria-pressed="true"` and `html[data-weather=rain]`. The corrected export checks the pressed state and the service passed. Direct Chrome reload observations independently confirmed rain persistence.
- **TC202 capture Undo:** The study starts at fullmove **2** with White to move. Undo correctly restores “Amber to move,” “Move 02,” empty recorded history and disabled Undo. The corrected run called these indicators inconsistent; the final case explicitly described the study reference frame and passed. Earlier exports also placed mutually exclusive capture and restored-position assertions after Undo. The final export removes that contradiction.

The table below audits the latest available generated Python for each case. File line references refer to the ignored `TC20x_*.py` exports, except TC208, whose export remains from the initial run. Comments describing checks are not executable assertions.

| Case / service history | Exported evidence and limits |
| --- | --- |
| **TC201 — passed initially and corrected** | Attempts illegal e2–e5, plays e4/e5 and opens Journal. Latest assertions only check empty e2/e7 (83–86); they replaced the initial destination-pawn checks. No immediate illegal-state comparison, exact SAN, complete board, turn or capture-count assertions. **Partial opening smoke coverage.** |
| **TC202 — passed initially; corrected failure; final pass** | Final export captures and Undoes, then checks e4 White pawn / d5 Black pawn (73–76) and panel text (81). It does not assert the pre-Undo winner, Black turn, capture ply/count, 31 residents, both teams’ mittens, settled artwork or phase cleanup. The “No little send-offs yet” text remains in hidden DOM when memorials exist, so `to_contain_text` does not prove zero memorials. **Partial capture/Undo smoke coverage.** |
| **TC203 — initially blocked; corrected pass** | Opens Journal after en passant and Undo. Corrected assertions check e5 White pawn / f6 empty (93–96), removing the initial contradictory f6 White-pawn check and blocked exception. No f5 victim-restoration, exact history, capture count or adjacent-victim choreography assertion. **Partial en-passant Undo coverage.** |
| **TC204 — passed initially and corrected** | Cancels promotion, promotes to knight, closes the result and Undoes. All four checks execute afterward: a7 pawn / a8 empty twice (93–104). The first pair is described as cancellation evidence but occurs after Undo. Knight identity, cancellation atomicity, promotion SAN and insufficient-material draw are not asserted at their relevant stages. **Partial restored-position coverage.** |
| **TC205 — passed initially and corrected** | Plays mate, closes the result, attempts king selection, Undoes and reselects the queen. Assertions check restored g6 queen and legal g7 (88–91); the legal-destination check is valid after reselection. No explicit winner, mate SAN or before/after terminal-position comparison. **Partial mate/Undo smoke coverage.** |
| **TC206 — initial expectation failure; corrected pass** | Captures, changes preferences, reloads, opens/closes Journal and Undoes. Assertions check restored pawns (100–103), Moonlight (108), rain pressed=true (113) and paused motion (118). This is substantive preference persistence evidence, but no saved pre-Undo capture/history/count snapshot is asserted. |
| **TC207 — passed initially and corrected** | Plays e2–e4 and Undoes; only restored e2 pawn / e4 empty are asserted (69–72). Export line 47 uses `select_option("")`, although valid difficulty values are `seedling`, `garden`, `wildwood`; the downloaded replay needs correction. No exact Black reply, ply count, full-turn restoration or late-reply stability assertion. **Partial Undo smoke coverage.** |
| **TC208 — initial run blocked; not rerun** | Initial export checks captured board labels and radio/memorial response text (83–96), then explicitly raises the viewport blocker (100). The native report observed camp responses, but could not set the requested phone viewport. No phone bounds or overflow assertions were executed. |
| **TC209 — passed initially and corrected** | Clicks all six auditions, mutes and plays e2–e4. Its only assertion checks “Sound off” (103). No activity-counter increments, per-role events, source cancellation or unchanged counter after the muted move. **Audition interaction and mute-state smoke coverage.** |

Every latest export marks its assertions “not verified — the export-time check could not be evaluated.” This annotation limits what can be concluded from the downloaded replay; it does not reverse the native service status. None of these exports relies on URL-only assertions, but all hardcode `http://localhost:4176` and omit explicit moving/thinking settlement waits between actions.

## 3. Coverage and matching metrics

| Run / layer | Result |
| --- | --- |
| Initial nine-case native run | **6 passed / 1 failed / 2 blocked**. TC206 failed on the weather-label expectation; TC203 history inspection and TC208 viewport changes were blocked. |
| Corrected eight-case native run | **7 passed / 1 failed / 0 blocked**. TC203 and TC206 passed; TC202 failed on the study turn/fullmove expectation and incomplete capture-artwork verification. TC208 was excluded. |
| Final TC202 native rerun | **1 passed / 0 failed / 0 blocked** after explicitly stating the fullmove-2 study frame. |
| Latest service outcome per original case | **8 passed / 1 blocked across three runs**. This is not one nine-case execution or a complete acceptance verdict. |
| Export audit | Useful smoke assertions, a corrected weather oracle and limited phase coverage. No complete visual/audio acceptance claim follows from the scripts. |
| Separate local validation | **64 tests passed**, strict TypeScript and production build passed. These include engine, capture-motion, pageant-state, PCM voice and mocked audio-lifecycle checks. |
| Separate direct Chrome phone check | **390×844 observed without document scrolling**, including active scuffle and reduced-motion interruption. This does not convert TC208’s native blocked outcome into a pass. |

## 4. Key gaps and risks

- **Reliable exported replay remains unfinished.** Put pre-Undo and cancellation assertions beside their actions, correct TC207’s difficulty value, parameterize the base URL and wait for observable moving/thinking=false before subsequent actions. The raw service statuses alone are not a reliable acceptance gate.
- **Named visual requirements exceed exported coverage.** Capture phases, winner claim, stretcher handoff, team mittens, artwork/role matching and full memorial cleanup were not comprehensively asserted by TestSprite. Direct observations and local invariants are documented separately in [Living release verification](LIVING_RELEASE_VERIFICATION_2026-10-18.md).
- **Sound quality and actual background-tab behavior remain unassessed.** Scripted audition clicks, counters and mocked source/lifecycle tests cannot certify physical listening quality; actual hidden-tab animation/audio behavior was not certified by this run.
- **Environment coverage stays separate.** TC208 is still blocked in native MCP. Portal 3.0, GitHub App PR execution, deployment verification and hackathon submission are not claimed by these local-tunnel runs.
