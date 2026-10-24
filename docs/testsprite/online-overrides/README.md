# Hosted multiplayer scripts — uploaded, not executed

These four standalone Python Playwright scripts exercise the actual Paperwild invitation and board controls. Each script creates fresh independent browser contexts with separate cookies, `localStorage`, and `sessionStorage`; no saved browser identity is shared. They do not seed storage, call backend functions directly, intercept responses, alter application flags, or manufacture a connection state. The default target is PR #5's public preview:

`https://paperwild-git-feat-convex-multiplayer-davidson3556s-projects.vercel.app/`

The scripts passed offline Python syntax checks and an independent static review. All four are uploaded to the dedicated **Paperwild multiplayer preview** frontend project (`5ac48e78-b1a2-4509-ad73-0b3efe0c3343`), with exact Python bodies and concrete versions read back successfully. The [stored-code manifest](../online-stored-code-manifest.json) records those project, target, hosted test IDs, versions and source hashes. They have **not been run in TestSprite**; upload verification is not evidence of a cloud release or passing multiplayer tests. These suite-local identifiers consolidate several scenarios from the ten-case [online proposal](../online-plan.yaml) rather than reusing that proposal's one-to-one case mapping.

| Script | Assertions |
| --- | --- |
| `ONLN-001.py` | Required first choice, invitation prefill after the guide, no automatic join, White waiting before a second seat, two distinct server-assigned seats, wrong-turn and illegal attempts without board/revision changes, `e4 d5 exd5` in both full boards/histories, one captured Black pawn and one memorial in each context, third-seat rejection, and continued play by the original Black seat. |
| `ONLN-002.py` | Shared Undo decline and accept, sender cancellation, sender cannot accept its own request, exactly one ply removed, rematch decline and accept, unchanged colors, one round increment, no early reset, and a legal move in the new round. |
| `ONLN-003.py` | A chosen local `d4 d5` game survives creating a different shared game, capture and reload; the reloaded tab resumes the same White seat; read-only sampling checks that old captures do not replay a fight/stretcher/burial; leaving restores the exact local position and save; reloading after leave stays local; saved-seat return requires the explicit control and still preserves the local game. |
| `ONLN-004.py` | Real `BrowserContext.set_offline(True)` disconnects only Black; a disconnected move and the real Undo shortcut cannot change either game or queue later work; Black returns in its original seat with the same history/revision; a new explicit move then converges. The connection label describes the local browser and the friend's occupied seat. |

Every synchronized checkpoint checks all 64 semantic square values, ordered SAN history, exact turn, captures and captured role, revision, round, own seat, decoded resident count, and absence of a stale move effect. A connected badge or screenshot alone cannot pass a case. Each case creates one fresh room; normal room expiry is 24 hours.

## Execution prerequisites

1. Deploy the matching backend and rebuild the intended preview with that deployment's public `VITE_CONVEX_URL`. Record frontend and backend source revision, backend deployment, and target origin together. An unconfigured online option produces an explicit blocked-environment report and a nonzero result.
2. Use a runner with Python, Playwright Chromium, and genuine independent browser contexts. The offline case additionally requires working context-level network control. Its pass requires observing the actual `reconnecting` application state; it does not treat calling `set_offline` alone as proof of disconnection.
3. Allow at least 300 seconds for each case's application actions, plus runner/browser cleanup overhead. Notebook opening, character movement, and the complete real capture ceremony are awaited rather than skipped.
4. Keep each complete `.py` body matched to its reviewed stored-code manifest. The files are standalone and require no neighboring Python module in the hosted runner. Dispatch strict replay with auto-heal disabled; verify the hosted source hashes/versions before and after execution and inspect the actual results. The initial upload used deterministic idempotency keys, exact project/name guards, byte-for-byte code readback, and a final whole-project/version check; no tests were dispatched by that upload.
5. Keep this multiplayer suite in its own TestSprite project unless the regression gate is deliberately expanded. The existing PR regression gate verifies **exactly 16 cases** before invoking `--all`; uploading these four cases into that project would correctly fail its membership check. The existing three regression bundle assertions and the CI/Vercel build environments also need to match a newly configured cloud build.

`TEST_TARGET_URL` overrides the fallback only if the hosted runner actually supplies that variable. A local environment variable is not automatically transmitted to TestSprite. The scripts have no fixed JS filename; exact frontend build/deployment proof must be recorded by the surrounding release gate rather than inferred from a functional pass.

Only execute against the intended test deployment. The scripts create and change room data; they are not read-only probes. A production run requires explicit authorization. They do not require a Convex administrative or deployment key.

## Evidence and limits

Reports contain allowlisted DOM observations and public room codes. No online credential storage keys, cookies, WebSocket frames, private backend keys, or network request bodies are read or exported. The offline save comparison reads only `queens-conservatory.game.v1`; its contents stay in process memory and the report records its SHA-256 hash. Browser cleanup failures fail the test rather than silently counting as success.

The suite does not establish physical sound quality, presence tracking, expiry/cleanup execution, a complete keyboard-accessibility audit, or mobile layout acceptance. Keyboard use is limited to the explicit Escape/Undo controls exercised here; no broader accessibility claim follows. Reload sampling observes the DOM every 100 ms and can detect visible replay during those samples, rather than proving that no sub-frame effect ever occurred. Backend authorization, race, rules and expiry tests remain a separate layer.

If the runner cannot provide an independent context or genuinely interrupt the tested WebSocket, retain the failure/blocker evidence and report that coverage as incomplete. Do not replace it with copied credentials, changed DOM attributes, a fake offline flag, skipped assertions, or a pass inferred from screenshots.

Offline syntax check (does not launch a browser or create rooms):

```sh
python3 - <<'PY'
from pathlib import Path
for path in sorted(Path('docs/testsprite/online-overrides').glob('ONLN-*.py')):
    compile(path.read_text(), str(path), 'exec')
    print(path.name, 'syntax valid')
PY
```
