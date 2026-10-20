# Additions verification — October 19, 2026

Scope: the uncommitted additions on `living`, based on Git HEAD `869a1f95ded63469033abd9b5f1e64f377540883`. The notebook opening, refusal moods, named capture histories, expanded ceremonies, remembrance export, radio and checkmate finale are local working-tree changes. This record does not claim they have been pushed, deployed, or accepted for the hackathon. Convex remains deferred.

The story checked was: open the illustrated notebook, make a legal or refused move, reconcile chess history and character stories, play or cancel the visual sequence, and render the correct board, memorial and result.

## Local checks

- `npm test`: **78 passed, 0 failed**, including three new audio regression tests.
- `npm run build`: strict TypeScript and Vite production build passed; 43 modules.
- Production assets: `index-J8UhEskH.js` 263.73 kB (90.90 kB gzip); CSS `index-B8LLeYdr.css` 132.67 kB (27.82 kB gzip); worker 37.30 kB.
- A separate production preview served `dist/` on port 4182. The existing user game on port 4180 was not reset.
- No lint command is configured. Whitespace and documentation links were checked separately.

## Corrections made during verification

1. New games and study replacements now explicitly reset the ceremony. Clearing capture history no longer triggers an Undo resurrection.
2. Revival animation handles, temporary nodes and effect notices now clear on reset, reduced motion, page hiding and destruction. Genuine Undo revival remains available.
3. Nested finale character calls preserve the radio's full ducking duration; cancelling the finisher releases the obsolete hold.
4. Long finale noise cues loop their reusable buffer until a finite stop. Attack and release now fit within the requested total duration.
5. Audio interruption retires a stalled radio schedule, so a fresh unlock restarts the tuned-in station.

The audio regressions use Web Audio mocks. They establish scheduling and cleanup behavior, not physical listening quality.

## Direct Chrome evidence

The fixed production bundle was reloaded before testing. Actions used the actual UI; game state was not injected.

| Flow | Observed result |
| --- | --- |
| Notebook → game | The notebook appeared on initial visits/reload, then revealed 64 board controls. One native TestSprite loading attempt was separately blocked; its cause remains unresolved. |
| Repeated illegal move | Select e2, attempt e5 three times: e2 remained wp, e5 empty, White turn, captures00 and empty history; the hurt-feelings hint appeared. |
| Legal move after refusal | e2–e4 left e2 empty/e4 wp, Black turn and exact SAN e4. Journal badge00 correctly remained the capture count. |
| Named capture | Standard-start e4, d5, exd5 produced a remembrance card for Rowan (original d7), taken by Tuck (original e2) on d5, move 2. |
| Remembrance export | The real download `paperwild-garden-of-remembrance.png` was created. Its PNG signature is valid, dimensions are 2264×1112 and size is 236,865 bytes. |
| Undo → pause motion | Undo restored e4 wp/d5 bp, captures00 and pageant count0. Immediately pausing removed revival nodes. |
| Captured game → fresh page | The captured position settled with pageant count 1. A new game restored exactly 32 occupied squares and 32 sprites among 64 controls, e2 wp/d7 bp, empty history and capture count 00. Memorials, revival nodes, effect notices and obsolete board overlays all cleared. |
| Checkmate finale | The preselected g6 queen moved to g7: one finale layer for White, game-over true, then White-wins result, one Qg7# SAN and no leftover finale layer. |
| Checkmate → Undo | g6 restored wq, g7 empty, White turn, game-over false, result closed and Undo disabled for the empty study history. |
| Radio → mute | Tuning in enabled sound and showed on-air; muting retained the tuned-in preference and changed the station label to sound-is-off. This is UI state evidence. |

Observed desktop viewport: **3384×1363**, with matching document scroll dimensions and 64 board controls. Attempts to set 1440×900 and 390×844 did not change the measured viewport; they are not fresh responsive passes. The temporary viewport setting was reset. Earlier phone evidence remains historical. The browser console's final warning/error log was empty.

![Current desktop build](media/paperwild-additions-desktop.jpg)

[Remembrance dialog](media/paperwild-remembrance-2026-10-19.jpg) · [Actual exported PNG](media/paperwild-remembrance-export.png) · [Finale in progress](media/paperwild-finale-2026-10-19.jpg)

## TestSprite and release boundaries

See the [current TestSprite audit](TESTSPRITE_ADDITIONS_RUN_2026-10-19.md). Native MCP executed against this local production build, with four latest service passes and one failed/unmeasured case across two runs. The generated exports contain partial assertions; this is not complete acceptance coverage.

The separate Portal/GitHub App remains on Free with billing-blocked PR activity. A Run Now retry did not start a run. PR #3 still points to 869a1f9, so its existing CI and deployment checks do not validate these local additions. No bypass secret, preview protection, billing setting, branch, PR state or deployment was changed.

Fresh phone layout, actual background-tab interruption behavior, physical sound quality, and a Portal suite against a public deployment of this exact build remain unverified.
