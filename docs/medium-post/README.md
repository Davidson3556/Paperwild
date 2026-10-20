# Paperwild: Medium image kit

Prepared October 20, 2026. Six main visuals and two optional development-build screenshots are saved here. They are unchanged copies of the original captures or exported artwork. Originals remain in `docs/media`; `manifest.json` records their source paths and SHA-256 hashes.

Suggested title: **Building Paperwild: A Chess Game With a Life Beyond the Board**

Use [CAPTIONS.md](CAPTIONS.md) for copy-ready captions and alt text.

## Main images, in article order

| File | Suggested placement | Context |
| --- | --- | --- |
| [01 — Cover](images/01-paperwild-cover.jpg) | Opening image: introduce the game and its capture drama | October 18 published application checkpoint |
| [02 — Character guide](images/02-character-guide.png) | Introduce the woodland cast and voice controls | Earlier October 17 guide layout |
| [03 — Remembrance keepsake](images/03-remembrance-keepsake.png) | Show how a captured resident becomes a story | Actual exported PNG from October 19 local additions; unpublished |
| [04 — Startup blocker](images/04-testsprite-startup-blocker.jpg) | Explain what initially stopped PR testing | Historical October 19 state, before recovery |
| [05 — Preview access](images/05-vercel-preview-access.jpg) | Explain the confirmed Vercel access barrier | October 20, domain-specific exception |
| [06 — Ten tests passed](images/06-testsprite-10-passed.jpg) | Close the testing section with the result | October 20 manual GitHub-integration run on published PR head `869a1f9` |

For a shorter post, use images 01, 03, 05 and 06. Image 03 must retain its local-development label.

## Optional development images

- [07 — Latest local board](extras/07-latest-local-board.jpg): the October 19 local notebook build. Use when discussing work in progress, or as the cover if the article clearly introduces an unpublished development build.
- [08 — Local checkmate finale](extras/08-local-checkmate-finale.jpg): a frame from the new finale while it is running. A still image does not demonstrate the complete animation.

## Facts to preserve in the post

- The final PR suite reported **10 passed, 0 failed, 0 blocked** against published head `869a1f95ded63469033abd9b5f1e64f377540883`. [Public GitHub report](https://github.com/Davidson3556/Paperwild/pull/3#issuecomment-6301978202).
- The first recovered PR execution reported **9 passed and 1 blocked**, even though GitHub showed success. Direct keyboard reproduction reached the hare control and scheduled its greeting. Only the test's focus instruction was clarified; the assertions remained. The next full PR run passed all ten.
- These were manually dispatched test events through the GitHub integration. A future deployment automatically firing the saved trigger was not demonstrated, despite the Portal screenshot's generic automatic-run message.
- Only the `living` preview exception was added during recovery. The screenshot also shows an older `ci` exception. Project-wide Require Log In remained enabled. The preview then returned HTTP 200 without authentication.
- Old-delivery retries continued to say **Failed to start tests** after preview access was fixed. A fresh test event started successfully. The old retry failure's internal cause remains unknown; do not describe Vercel protection as its proven sole cause.
- The **78 local tests** and October 19 additions are separate from the published PR application's **64 tests** and October 20 Portal suite. New local features were not pushed or deployed during recovery.
- The character guide supports voice controls; these captures do not establish physical audio quality. “With a friend” currently means taking turns on the same device; online multiplayer/Convex was postponed.

## A possible article sequence

1. The idea: familiar chess, with characters and a world outside the board.
2. The visual language: pencil-style squares, watercolor-style residents and a notebook layout.
3. Giving a capture consequences: a tussle, a stretcher departure and a woodland send-off.
4. The latest local addition: remembering a named resident with an exported keepsake.
5. Testing the actual deployed build: blocked startup, preview access, a fresh PR dispatch and a misleading green status with one blocked case.
6. Verifying the keyboard behavior, clarifying the test and reaching ten passing PR tests.
7. What comes next: publish the held additions, validate that build, then revisit online play.

## Source records and links

- Published release record in the repository: `docs/LIVING_RELEASE_VERIFICATION_2026-10-18.md`
- Local additions record: `docs/ADDITIONS_VERIFICATION_2026-10-19.md`
- PR testing recovery and limits: `docs/TESTSPRITE_PR_RECOVERY_2026-10-20.md`
- [Tested PR preview](https://paperwild-git-living-davidson3556s-projects.vercel.app/)
- [Repository](https://github.com/Davidson3556/Paperwild)

Nothing in this kit has been published to Medium. No repository push or merge was performed to prepare it.
