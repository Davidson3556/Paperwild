# TestSprite acceptance plan: Paperwild

## Execution status

**This is the 20-scenario acceptance specification for the illustrated DOM/SVG interface. The full specification has not been cloud-executed.** All **34 local tests pass: 13 engine, 13 mocked Web Audio lifecycle/activity, 5 procedural voice signal, and 3 motion invariant tests**. Strict TypeScript checking and the production build pass. Signal tests verify PCM properties, not perceived sound quality; see [SOUND_VERIFICATION_2026-10-17.md](SOUND_VERIFICATION_2026-10-17.md).

Focused current Chrome QA observed the six active gait profiles, recorded intermediate hare/pawn poses, simultaneous castling, capture interruption/undo cleanup, promotion's arrival-time image change, sequential human/computer movement, sound toggle/save behavior, reduced motion, and usable 320/390 px layouts, without observed warnings/errors. Audio initialized without availability errors, but audible quality was not assessed. These observations do not mark this entire specification as executed. Exact browser evidence and limitations belong in [VERIFICATION.md](VERIFICATION.md).

The [current Portal record](TESTSPRITE_PORTAL.md) tracks ten reviewed cases against the public app: initially eight service passes and two failures caused by incorrect test expectations, followed by service passes for both corrected cases. The suite now shows all ten passed across those executions. The saved [Portal YAML plan](testsprite/portal-plan.yaml) requires each execution's configured target origin; PR-preview execution remains unverified. The GitHub App is connected for Paperwild and its Vercel-comment PR trigger is saved and active, but still displays Never run. This does not establish full execution of this specification.

The [historical native run](TESTSPRITE_RUN_2026-10-17.md) targeted the earlier 3D prototype; its six intended scenarios were inconclusive after assertion review. The later [native MCP audit](TESTSPRITE_CURRENT_RUN_2026-10-17.md) recorded two partial smoke tests and one contradictory exported replay despite three service passes. Those dated reports are separate evidence and do not certify this full specification.

## Targets and evidence

- Local development: `http://127.0.0.1:4173`, using `npm run dev`.
- Repository: [Davidson3556/Paperwild](https://github.com/Davidson3556/Paperwild).
- Public deployment: [paperwild.vercel.app](https://paperwild.vercel.app/). The approved [PR #2 preview](https://paperwild-git-ci-davidson3556s-projects.vercel.app/) now opens without authentication through an exception for that exact domain; other previews remain protected. A TestSprite execution against it is still pending.
- Record the exact commit/build, URL, viewport, browser, run link, assertions, console errors, and screenshots. Preserve failed assertions and rerun evidence.
- Use an isolated browser context for independent cases. Clear only this app’s storage when a clean start is required.
- Exercise desktop and mobile. Wait for observable game state and settled animation, not a fixed computer response or a screenshot alone.
- Before running generated tests, verify they contain every required board/history/capture assertion. A nonempty URL is not an acceptance assertion.

## Semantic targets

| Item | Target and assertion |
| --- | --- |
| Square | `#board-access [data-testid="square-e2"]`; accessible name includes coordinate, conventional role, and side. |
| Contents | Square `data-piece` is `wp`, `bn`, or empty. Use all 64 values when verifying exact preservation/reset. |
| Selection / destinations | Source `aria-pressed="true"`; destination accessible name contains `legal destination`. |
| Role artwork | Active board `.sketch-piece` images use the role/side asset `/art/watercolor/web/{w\|b}{p\|r\|n\|b\|q\|k}.png`. Match the current square and verify image decoding; distinguish these from captured images. |
| Turn / terminal state | `#game-status` exposes `data-turn`, `data-thinking`, and `data-game-over`. |
| Movement busy state | `#board-access` exposes `aria-busy`. Wait for false before committing the next turn; assert true during a non-reduced move/capture sequence. |
| History | `#move-history` contains the expected SAN in order. |
| Captures | `#bloom-count` and `#bloom-display` retain legacy IDs; they now describe captured characters in The sideline society, not flowers. Captured images have conventional-role alt text. |
| Modes | `[data-mode="computer"]` / `[data-mode="local"]`, with `aria-pressed`. |
| New game | Accessible name Begin a new game; visible text A fresh page. |
| Stories | Accessible name Explore the chess studies; visible text Little chess stories; then `[data-study="bloom"]`, `promotion`, or `mate`. |
| Promotion | `#promotion-dialog`; choices `[data-promotion="q"]`, `r`, `b`, `n`. |
| Weather / light / motion | `#weather`, `#atmosphere`, `#motion`; check the label/pressed state and saved preference. |
| Sound | `#sound`; visible Sound off/on text, accessible Turn sound on/off label, and `aria-pressed` must agree with the saved preference. |
| Character audition | In the character guide, `[data-voice="p"]`, `r`, `n`, `b`, `q`, `k`; visible text hear me and accessible Hear the acorn/stump/hare/moth/fox/badger. Activating a button explicitly enables sound and requests that role's greeting. |
| Scheduled character calls | `#sound[data-last-role]`, `[data-last-activity]`, `[data-voice-count]`, and `[data-voice-events]` are callback evidence. The count increments after a voice is scheduled; events retain only the last 12 `role:activity` entries, comma-separated. They do not prove speaker output, audible quality, or completion of a scheduled call. Read snapshots/deltas around the action; absent initial attributes mean no callback yet. |

Each story preselects its starting piece. Assert that state, then activate its destination directly. Clicking the selected source again deselects it. Use semantic button activation or keyboard Enter; character animation must not determine which square a test means to choose.

## Priority 0: chess integrity and illustrated roles

### MC-01 — Clean start, complete cast, and local opening

1. Clean storage, load, choose With a friend.
2. Assert all 64 square states match the standard position; White/Amber to move; empty history; zero captured characters; disabled undo/export.
3. Assert all six roles use the right Amber and Indigo images, with no failed image requests. Open Who’s who in the club? and confirm pawn/acorn, rook/stump, knight/hare, bishop/moth, queen/fox, king/badger mappings.
4. Select e2; verify e3/e4 are legal and e5 is not. Commit e4, then e5.
5. Assert source squares empty, correct pawns on e4/e5, exactly two history plies, White to move, and zero captures. Verify images settle on those same squares.

### MC-02 — Illegal and wrong-side moves are atomic

1. Snapshot all square values, history, captures, and turn.
2. Attempt e2–e5 and moving Black before White. Assert no changes to the snapshot and no sideline character appears.
3. Play e4; attempt another White move. Assert Black still has the turn and only one ply exists.

### MC-03 — Hare hop, capture departure, and undo

1. From a fresh local game play g1–f3. Assert the White knight/hare moves exactly once and g1 becomes empty. Manually inspect its hop and settled silhouette.
2. Open Tea on the sidelines. Verify selected White pawn e4, Black pawn d5, local mode, empty recorded history, zero captured characters.
3. Activate d5. Assert White pawn at d5, e4 empty, Black to move, `exd5`, capture count one, and one captured Black pawn/acorn image in the society.
4. Manually inspect the departure arc and margin reaction. The effect must not add chess pieces or duplicate the captured character.
5. Undo; assert both pawns restored, empty history, zero captured characters, and no stale departing image after settling.

### MC-04 — Queen promotion and image replacement

1. Open Room to become; verify selected White pawn a7. Activate a8.
2. Assert four promotion choices; pawn still on a7; a8 empty; no history committed yet.
3. Choose queen. Assert White queen/fox image on a8, no pawn there, promotion SAN, Black to move, dialog closed, and game unfinished.
4. Undo; verify the pawn/acorn returns to a7 and the fox disappears.

### MC-05 — Promotion cancellation and knight draw

1. Open the promotion dialog and choose Choose a different move. Compare the full position/history/capture snapshot with the pre-dialog state.
2. Promote to knight. Assert White knight/hare on a8, a7 empty, insufficient-material draw, no winner, and game-over true.
3. Dismiss the result and attempt a move; assert terminal state unchanged. Undo and verify the original pawn and unfinished game.
4. Run separate queen, rook, bishop, and knight choices; each must use the matching fox, stump, moth, or hare image.

### MC-06 — Checkmate, result, and terminal lock

1. Open One final move; verify selected queen g6 and king f6. Activate g7.
2. Assert queen/fox on g7, g6 empty, `Qg7#`, White winner, game-over true, and result dialog with one recorded ply/zero captures.
3. Dismiss and attempt another move; assert no mutation. Undo; verify queen g6, White turn, unfinished game, and no remaining result dialog.

### MC-07 — Castling moves king and rook together

1. In local mode play e4, e5, Nf3, Nc6, Bc4, Nf6, O-O.
2. Assert White king/badger g1 and rook/stump f1; e1/h1 empty; SAN O-O; correct turn; no capture.
3. Reload and reassert those contents and images. Undo; assert king e1 and rook h1 restored together.

### MC-08 — En passant removes the correct pawn

1. In local mode play e4, a6, e5, d5, exd6.
2. Assert White pawn/acorn d6; e5 and d5 empty; `exd6`; one captured Black pawn/acorn; correct turn.
3. Undo; assert White pawn e5 and Black pawn d5, with no captures. Reload and reassert the restored history.

### MC-09 — Computer response at every level

For Sleepy, Thoughtful, and Mischievous, use a fresh Against the club game:

1. Play e4; observe the movement busy state and pending Black turn. Attempt a premature White move and confirm it is rejected. Verify Black does not start moving before White's core movement/capture sequence settles.
2. Wait until movement busy and thinking are false and White is to move, using a 10-second timeout.
3. Assert exactly two legal plies, one Black reply, matching images, and no worker exception. Do not require a particular Black move.
4. Export/replay the PGN when supported; it must reach the displayed position.

### MC-10 — Undo, mode, restart, and obsolete computer work

1. Play e4 against the computer and immediately undo. Assert the exact initial state, then wait beyond the normal reply window; no late move may appear.
2. Play e4, wait for its reply, then undo. Assert both plies removed.
3. Play e4 and immediately switch to With a friend. Assert no automatic Black move; move Black manually. Switching back with White to move must not create a White computer move.
4. Start a game with history, choose A fresh page, then Keep playing. Assert preservation. Confirm a fresh page instead; assert standard position, no captures/story, retained mode/difficulty, and no stale reply.

## Priority 1: saves, access, and the living page

### MC-11 — Reload restores story, sidelines, and preferences

1. Make the Tea on the sidelines capture; select Moonlight, rain, and paused motion.
2. Reload. Assert pawn d5, `exd5`, one captured Black acorn, local Black turn, correct story banner, and all chosen preferences.
3. Undo after reload; assert both original pawns and empty captures/history. Restoration must not replay a capture burst as a new event.

### MC-12 — Pending reply, repetition, and invalid saves

1. Reload during a pending computer reply. Assert the restored White move gets exactly one legal Black reply. Reload again; no extra reply may be appended.
2. In local mode repeat Nf3, Nf6, Ng1, Ng8 twice; assert repetition draw survives reload. Undo must reopen play.
3. In isolated contexts, test malformed JSON, invalid FEN, illegal history, and mismatched story metadata. Assert recovery to a usable fresh game without a false story banner.
4. Simulate storage writes failing. Legal play must continue and the saved-note must report unavailable storage.

### MC-13 — PGN download is the game shown

1. Assert export disabled with empty history. Make a local opening and capture the download.
2. Assert filename `paperwild-game.pgn`, Event Paperwild, player headers, and exact moves. Replay to the displayed position.
3. Repeat with a promotion story; assert setup FEN and promotion SAN, then replay to the same final board.

### MC-14 — Keyboard, dialogs, and role-independent access

1. Focus e2, navigate with arrows, select with Enter, and commit a legal move with Enter. Assert exactly one ply and correct focus/selection state.
2. Escape clears selection without moving; U undoes exactly once. Focus remains visible against both paper treatments.
3. Verify every square announces coordinate, conventional role/side, and legal-destination state. A player must not need to recognize the illustrated species to know the chess role.
4. Open help/promotion/new-game dialogs by keyboard; check focus containment, close controls, and Escape. Modal input must not move the background board.

### MC-15 — World controls leave chess unchanged

1. Snapshot board/history/captures/turn. Cycle Say hello through four observations; assert each text changes and the snapshot remains identical. Manually inspect balloon, tortoise, moth, and tea-party greetings.
2. Toggle A little rain / Clear skies and Daydream / Moonlight. Assert accessible labels, weather pressed state, document treatment, saved preferences, and unchanged chess state.
3. Manually inspect cloud rain, tea umbrella, paper/ink contrast, stars, and warm fireflies. Decorations must not block text or square targets.
4. Confirm sound starts off in a clean context; the visible Sound off/on text and accessible name must agree. Sound acceptance is expanded in MC-19; assess audible output manually if the runner cannot inspect it.

### MC-16 — Reduced motion and hidden-page lifecycle

1. Start with system reduced motion; assert paused initial setting. Confirm consecutive settled frames have no ambient wandering, idle movement, or long move/capture arc.
2. Make a legal move/capture while paused; assert correct final board/sidelines, no long movement arc, usable keyboard input, and opted-in sound still available. Busy state must release even when animation is omitted.
3. Enable movement and manually inspect resumed life. Hide the page during an animation, then return; assert no duplicate pieces, moves, captured characters, or replayed stale sound.
4. Confirm reduced-motion preference survives reload. No ongoing JavaScript frame loop should be needed for the margin’s CSS decorations.

### MC-17 — Missing image and mobile integrity

1. Block one character PNG in a separate context. Assert its chess-symbol fallback appears; square role/side remains available; a legal move still works.
2. At 390×844 and 1440×1000, assert no horizontal overflow, usable board/control targets, reachable journal, and dialogs that fit.
3. Resize with a selection active, then move and capture. Assert visible cells and semantic targets agree. Check that mobile margin art stays clear of essential controls.

### MC-18 — Six gaits, landing order, and safe interruption

1. Use legal local sequences to move each role. Capture a mid-movement observation and a settled observation: acorn walk/alternating painted feet, hare crouch/leap/landing, moth flap, stump shuffle, fox double-pounce, and badger waddle. Inspect grounding shadows, contact dust, and footprints; a start/end screenshot pair alone is insufficient to establish a gait.
2. Assert busy state during each core sequence. Attempt another square move before it settles; assert no extra history entry or board mutation. After settlement, the next legal move must work.
3. In Against the club, verify the White move and captured character's departure settle before Black starts. Then wait for Black's settlement before White can commit again. There must be one Black reply, with no truncation caused by status rerenders.
4. Undo during a move and during a capture departure. Assert the correct board/history/captures immediately settle; no stale footstep, landing cue, departure element, or delayed result appears.
5. Repeat interruption with A fresh page, story replacement, and mode changes. The scene must release its settlement waiters; no canceled computer turn may arrive later.
6. Switch to reduced motion mid-move, then resize mid-move in a separate run. Assert canonical final positions, no orphaned effects, released busy state, and continued legal play. Distinguish intentional settling from a failed gait.

### MC-19 — Creature voices, activity expression, and gesture/mute lifecycle

1. With clean storage, assert Sound off, Turn sound on, and `aria-pressed=false`; no character-call callback should appear on load or from autonomous animation. Opt in through pointer input; repeat in a separate context using keyboard activation. Confirm Sound on and the saved preference.
2. Open the character guide. Activate each role's hear me button, including one audition starting from Sound off. Assert opt-in becomes on and a new scheduled `p:greet`, `r:greet`, `n:greet`, `b:greet`, `q:greet`, or `k:greet` matches the chosen role, without changing board/history/captures/turn. Manually listen for six distinct cartoon textures: acorn pip/chirrup, hollow stump chuckle, airy hare whuffle, fluttered moth hum, fox yip/trill, and warm badger grumble. These are synthesized character voices, not wildlife recordings.
3. Select and move each role through legal local sequences. Capture callback deltas for `select`, `move`, and settled `land`, and manually verify that the expression changes with the action. Hear paper/wood/paw/wing contacts alongside visible feet/wing beats. Save audible observations separately from DOM callback and mocked audio-node assertions; neither proves physical playback quality.
4. Exercise capture, castling, promotion, check, checkmate, draw, an illegal destination, and greeting. Assert the moving role's appropriate `capture`, `promotion`, `check`, `win`, `draw`, `blocked`, or `greet` event and the captured role's separate `captured` reaction where applicable. One landing chooses one expression, with ending before promotion before check before capture before ordinary land. Castling must retain both king and rook movement/contact plans. Repeated renders, a canceled promotion dialog, save restoration, and reopening the result must not duplicate arrival/promotion/ending callbacks. Undo and control toggles may have Foley without adding a character-call event.
5. After opted-in audio has been unlocked, leave the visible, settled, unfinished board untouched with movement enabled. Retain temporal callback observations for sparse `idle` reactions: at most one globally per seven seconds, with at least 25 seconds before the same role repeats. Foreground actions suppress immediate idle chatter. Verify no new idle callbacks while moving, thinking, paused, hidden, or game over; passive life must never create/resume an AudioContext or queue calls for a later unlock. Compare the complete chess snapshot before and after observation.
6. Mute during a moving gait and immediately before a scheduled contact. Current output and future scheduled voices must stop; Sound off and the saved preference must agree, and new requests must not increment the scheduled-call count. Undo/reset/story interruption must discard stale scheduled movement/arrival cues. Previously recorded callback history may remain after cancellation; it is not a playback log.
7. Reload with sound enabled in storage. Assert the page remains silent with no scheduled character calls until fresh trusted input; an automatically resumed computer turn or idle gesture must not unlock audio itself. After a gesture, new actions may sound, but old moves must not replay.
8. Hide the page during scheduled sounds, then return. Verify immediate silence while hidden and no stale replay on return; a fresh gesture re-enables new sounds when the preference is on. Separate manual listening from callback evidence, since a scheduled voice can later be canceled.
9. In an isolated context, reject AudioContext resume or remove audio support. Assert a graceful unavailable state, no uncaught rejection, and fully usable chess. Repeated input must not create unbounded voices or buffer growth; destruction must release resources. Local mocks verify bounded reuse of four deterministic vocal takes per role/activity; browser callbacks alone cannot establish memory cleanup.
10. Enable reduced motion while sound remains on. Assert the board stays static at final positions, no autonomous idle calls begin, and concise move/capture feedback still works; motion preference must not silently mute action feedback. Manually assess volume, comfort, species distinction, and timing through actual speakers or headphones; do not mark these passed from event attributes or PCM bounds.

### MC-20 — Fitted blinking, idle articulation, and artwork handoff

1. In a fresh, settled local game with movement enabled, wait for character images to decode. Assert 32 active `.sketch-piece` elements, each with exactly one `.character-face`, covering all 12 side/role combinations through `data-character`. Assert 32 ready `.character-idle` groups and 32 `.character-life` wrappers. Every role has independent painted appendages in addition to breathing and a distinct autonomous gesture; verify acorn hands/leaves, stump branches/leaves, hare ears, moth wings, fox tails, and badger paws. No pointer interaction is required to start this life. Manually inspect open and closed eyes for all 12 illustrations at desktop and mobile sizes; lids must fit the painted eyes, and articulated cutouts must meet their original artwork without duplicate parts or conspicuous holes.
2. Keep the page visible and the board settled. Sample computed opacity of each `.character-blink` over at least 9.2 seconds, frequently enough to observe the brief closure, and assert both an open state below .05 and a closed state above .9. Retain intermediate evidence of ordinary and double blinks. Separately observe ear, wing, and tail transforms across a complete idle cycle, allowing up to 13 seconds for the longest part cycle. A declared animation name, initial screenshot, or start/end screenshot pair alone does not prove temporal movement. Compare the complete board/history/capture/turn snapshot before and after idle observation; animation must not mutate chess.
3. Pause with `#motion`. Assert `aria-pressed=true`, `.sketch-scene[data-motion="still"]`, open painted eyes with every blink overlay at zero opacity, and neutral idle-part transforms. Repeat while a blink or idle twitch is in progress; characters must not freeze with eyelids shut or parts displaced. Resume and verify temporal blinking and articulation return. Repeat with system reduced motion and with the page hidden, then visible again; no duplicate faces, parts, or chess moves may appear.
4. Move a hare, moth, and fox through legal local play. During `.is-moving`, assert resting CSS loops are disabled, blink overlays are transparent, and the shared painted appendages are controlled by locomotion without duplicate cutouts. Infinite ambient loops must not hold `aria-busy` or delay a computer reply. After `aria-busy=false`, assert the moved sprite has one fitted face of the same side/role and its decoded idle group returns. Exercise promotion and undo: the arriving promoted role must acquire the matching face and appropriate idle parts, while undo restores the pawn face without promoted-role remnants. Resizing, resetting, and replacing a story must leave only the faces/parts belonging to the current position.
5. In a separate context, block a character PNG before loading. Assert that sprite's visible chess-symbol fallback, hidden facial overlay, and hidden idle group; its semantic square must retain the conventional chess role and side. Complete a legal move using that piece and assert the final board/history/turn. A loading or failed image must never display floating eyelids, ears, wings, or tail fragments without the base artwork.
6. Make the Tea on the sidelines capture and wait for departure settlement. Assert exactly one `.sketch-sideline-piece` with the captured Black pawn's decoded artwork and `.character-face[data-character="bp"]`; sample its blink opacity through an open/closed cycle. Pause and verify that captured face also stays open. The separate `#bloom-display` journal portrait must also keep its fitted face, breathing, and appendages. Record both independently; unrelated status renders must preserve the same journal portrait node rather than restarting its life cycle. Undo and reload in separate runs; capture count, sideline elements, and face count must match the restored game without ghost faces or duplicate captured characters.

## Release evidence

Before calling the illustrated UI cloud-validated, run these cases with their substantive assertions against the exact current build. For each failure, retain reproduction, failing assertion, evidence, root cause, fix commit, and affected-case rerun. Distinguish confirmed product defects from test-generation, connectivity, and runner failures.

Public source, a public app, an initial Portal suite execution, and the two corrected-case service passes are recorded. An actual TestSprite GitHub App pull-request check and final submission remain pending; see the [Portal evidence record](TESTSPRITE_PORTAL.md). Do not mark these complete based on a planned scenario, ordinary CI, or a historical prototype run.
