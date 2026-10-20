# A ninety-second visit to Paperwild

Pitch: **Familiar chess. A notebook full of residents who remember their little adventures.**

This is a recording plan for the latest additions, not a claim that the whole edited sequence has been rehearsed. The October 19 verification recorded **78 passing local tests**, strict TypeScript and a production build, plus desktop checks of the named capture, remembrance PNG, cleanup, finale, and Undo. The [October 20 UI fixes](UI_FIXES_VERIFICATION_2026-10-20.md) bring local coverage to **82 passing tests** and verify live remembrance updates, a matching PNG, and the last memorial's revival visibility and cleanup. The additions' native TestSprite audit records four latest service passes and one failed/unmeasured case across two runs, with partial assertion coverage.

The [October 20 PR recovery](TESTSPRITE_PR_RECOVERY_2026-10-20.md) separately recorded **10 passed / 0 failed / 0 blocked** against published `living` head `869a1f9`. Its preview became publicly accessible, and the manual PR dispatch reported success to GitHub. This predates the latest additions and does not establish that a future deployment automatically triggers the suite. Keep the final evidence card accurate to the exact build shown.

## Before recording

- Use a separate browser profile or disposable app origin so the player's saved game stays intact. After the opening, start a fresh standard game, choose **Field kit → With a friend**, and leave motion enabled before demonstrating moves.
- Begin on the notebook opening. The quicker introduction applies after a visit in the same browser session; use a fresh session for the complete opening. A tap during loading requests an early opening; a tap during opening skips it.
- Enable sound through **Sound on** or the guide's **hear me** button if recording app audio. Audition through actual speakers/headphones before making listening-quality claims.
- Record the real UI and its natural timing. Show the actual deployment URL and commit; the `main` baseline, PR evidence at `869a1f9`, and the latest additions must not be presented as the same build.

## Main cut

| Time | Show | Say |
| --- | --- | --- |
| 0–8 s | Let the cover acorn draw, the bookmark advance, and the notebook open. Hold as the residents pop up into the field-notebook board. | “Welcome to Paperwild. The game lives inside a little field notebook.” |
| 8–18 s | Hover one resident, then select White's e2 pawn. Attempt e2–e5 once and show its refusal without committing a move. | “They notice you. They have opinions. But the rules are still chess.” |
| 18–37 s | From the standard start, play **e2–e4, d7–d5, e4×d5**, waiting for each movement to settle. Hold through the scuffle, stretcher, and named acorn sermon. Ring the bell or scatter petals once. | “That was Tuck, taking Rowan. Each resident keeps its name and its story. Even leaving the board is an occasion.” |
| 37–50 s | Open **Journal → The garden of remembrance**. Show Rowan's name and epitaph; activate **Save as a picture** and show the PNG download. Close with **Back to the story**. | “The game remembers where they began, who caught them, and the little journey in between. You can keep the remembrance page.” |
| 50–60 s | Once the captured acorn has a memorial, press **Undo** and hold for the resurrection beat and restored pawns. | “And when you reconsider, nobody stays buried.” |
| 60–73 s | Open **Field kit → Little chess stories → One final move**. The queen is preselected: activate **g7 directly**. Let the role-named finale complete and show the result. | “A final move deserves a final flourish. Underneath it all: legal chess, promotion, en passant, saves, undo, and a computer opponent.” |
| 73–80 s | Close the result. Show the camp's **radio**, then **tune in ♪**; optionally switch Daydream to Moonlight. | “Even the woodland has its own small-hours radio.” |
| 80–90 s | Show the local verification for the exact build recorded, followed by the October 20 TestSprite PR report labelled `869a1f9`. Use a deployment URL for the additions only after that build is deployed and verified. | “Ten TestSprite tests passed on the published living build. These newer additions have separate local verification.” Show the dated results and their coverage limits on the evidence card. |

Timings are an editing guide; give the capture and finale room to finish. Do not speed through every new feature. For a shorter cut, omit the radio and PNG download while retaining the opening, capture story, undo, finale, and honest evidence card.

## Details that keep the demonstration accurate

- Use the standard-game capture line above for **Tuck** and **Rowan**. **Tea on the sidelines** is a custom starting position; without the original history, its residents can use species titles rather than those names.
- The studies replace the current game. Save the remembrance picture before opening **One final move**. That mate study has no captured residents, so its result need not show the remembrance link.
- If showing repeated refusals, stop after the visible angry/sad reaction and give it a calm pause or make a legal move. Do not describe a reaction as a committed chess move.
- A queen's state funeral is an optional longer demonstration. Show a real queen capture and let its longer ceremony run; the standard acorn capture deliberately has a smaller send-off.
- Use **Journal** before showing SAN history. Use **Field kit** for settings or studies on compact layouts. Close overlays before interacting with the board.
- A service pass is not complete assertion coverage. Retain actual failed assertions and rerun evidence; distinguish incorrect test expectations from confirmed product defects. Never simulate a successful test, a GitHub check, or a public deployment.

The [October 19 additions verification](ADDITIONS_VERIFICATION_2026-10-19.md) records the actual Rowan/Tuck capture, downloaded 2264×1112 PNG, reset/revival cleanup, and `Qg7#` finale/Undo. The [October 19 native TestSprite audit](TESTSPRITE_ADDITIONS_RUN_2026-10-19.md) retains the initial two passes, two expectation failures, and one loading blocker, followed by two passes and one failed/unmeasured case in the corrected rerun. Four cases have latest service passes across both runs; complete acceptance coverage is not established. Fresh phone dimensions were not established because viewport overrides did not apply; physical listening and actual background-tab behavior remain unassessed. The separate October 20 PR result above does not replace these historical findings.

The [October 18 release verification](LIVING_RELEASE_VERIFICATION_2026-10-18.md) and [earlier TestSprite audit](TESTSPRITE_LIVING_RUN_2026-10-18.md) remain evidence for their own builds, not substitutes for the current results.
