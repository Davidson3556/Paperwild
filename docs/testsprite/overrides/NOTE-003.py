"""Stored-code TestSprite override. No app flags, timers, storage or game injection.

TEST_TARGET_URL overrides the public PR-preview fallback. Use strict stored-code
replay where supported. This file is self-contained for TestSprite's Python exec.
The observer reads real rendered styles; it does not slow or alter application
code. Missing temporal evidence raises an assertion rather than a fabricated pass.
"""
import asyncio
import json
import os
from urllib.parse import urlsplit
from playwright import async_api
from playwright.async_api import expect

TARGET = os.environ.get("TEST_TARGET_URL", "https://paperwild-git-feat-convex-multiplayer-davidson3556s-projects.vercel.app/")
ORIGIN = "{0.scheme}://{0.netloc}".format(urlsplit(TARGET))

BROWSER_ARGS = ['--window-size=1280,720', '--disable-dev-shm-usage', '--ipc=host', '--single-process']
RUN_CONTEXT = 0
RUN_PHASE = 'module-loaded'

RECORDER = r"""(() => {
  if (window !== window.top) return;
  const evidence = {started: performance.now(), frames: [], keys: [], errors: []};
  window.__pwObserved = evidence;
  const one = selector => document.querySelector(selector);
  const many = selector => [...document.querySelectorAll(selector)];
  const css = (element, property) => element ? getComputedStyle(element)[property] : null;
  const number = value => { const n=Number.parseFloat(value); return Number.isFinite(n) ? n : null; };
  const history = () => many('#move-history li:not(.history-empty)').flatMap(row =>
    [...row.querySelectorAll('span')].slice(1).map(span => span.textContent.trim())
  ).filter(san => san && san !== '…' && san !== '—');
  document.addEventListener('keydown', event => {
    if ((event.key === 'Tab' || event.key === 'Enter') && evidence.keys.length < 100) {
      const loader = one('#paperwild-loading');
      evidence.keys.push({t: performance.now(), key: event.key, target: event.target?.id || '',
        trusted: event.isTrusted, opening: !!loader?.classList.contains('is-opening'),
        ready: !!loader?.classList.contains('is-ready'), loader: !!loader});
    }
  }, true);
  let previous = -100;
  const observe = now => {
    if (now - evidence.started > 90000 || evidence.frames.length >= 3000) return;
    if (now - previous >= 25) {
      previous = now;
      try {
        const loader = one('#paperwild-loading'), app = one('#app');
        const scene = one('.sketch-scene'), status = one('#game-status');
        const cast = many('.sketch-cast > .sketch-piece');
        const samplePieces = cast.filter(p => ['b1', 'e1', 'a2', 'b8'].includes(p.dataset.square));
        const hare = one('.sketch-cast > .sketch-n');
        const blink = one('.sketch-cast > .sketch-piece .character-blink');
        const part = hare?.querySelector('.character-idle-part');
        const rect = scene?.getBoundingClientRect();
        evidence.frames.push({
          t: Math.round(now * 10) / 10, hidden: document.hidden, loader: !!loader,
          loaderOpacity: loader ? number(css(loader, 'opacity')) : null,
          loaderClass: loader?.className || '', appInert: app?.inert ?? null,
          title: loader ? many('.pw-loading-title span').map(p => number(css(p, 'opacity'))) : [],
          draws: loader ? many('.pw-draw').map(p => number(css(p, 'strokeDashoffset'))) : [],
          progress: loader ? number(getComputedStyle(loader).getPropertyValue('--progress')) : null,
          ribbon: loader ? number(css(one('.pw-ribbon'), 'height')) : null,
          cover: loader ? css(one('.pw-cover'), 'transform') : null,
          acorn: loader ? css(one('.pw-acorn'), 'transform') : null,
          flutter: loader ? many('.pw-flutter').map(p => css(p, 'display')) : [],
          intro: scene?.dataset.intro || null, entering: status?.dataset.entering ?? null,
          moving: status?.dataset.moving ?? null, thinking: status?.dataset.thinking ?? null,
          turn: status?.dataset.turn ?? null, over: status?.dataset.gameOver ?? null,
          busy: one('#board-access')?.getAttribute('aria-busy') ?? null,
          sceneVisible: !!rect && rect.width > 0 && rect.height > 0 && css(scene, 'visibility') !== 'hidden',
          strokes: many('.sketch-board-grid .graphite-0').slice(0, 3).map(p => number(css(p, 'strokeDashoffset'))),
          residents: cast.length,
          bodies: samplePieces.map(p => [p.dataset.square, css(p.querySelector('.sketch-piece-body'), 'transform')]),
          blink: number(css(blink, 'opacity')), part: css(part, 'transform'),
          history: history(),
          board: many('#board-access [data-testid^="square-"]').map(p => [p.dataset.testid.slice(7), p.dataset.piece || '']),
          captures: one('#field-capture-count')?.textContent.trim() ?? null
        });
      } catch (error) { if (evidence.errors.length < 5) evidence.errors.push(String(error)); }
    }
    requestAnimationFrame(observe);
  };
  requestAnimationFrame(observe);
})();"""

SNAPSHOT = r"""() => {
 const many = selector => [...document.querySelectorAll(selector)];
 const status = document.querySelector('#game-status');
 const cast = many('.sketch-cast > .sketch-piece');
 return {
   board: Object.fromEntries(many('#board-access [data-testid^="square-"]').map(p => [p.dataset.testid.slice(7), p.dataset.piece || ''])),
   history: many('#move-history li:not(.history-empty)').flatMap(row => [...row.querySelectorAll('span')].slice(1).map(s => s.textContent.trim())).filter(s => s && s !== '…' && s !== '—'),
   captures: document.querySelector('#field-capture-count')?.textContent.trim(),
   turn: status?.dataset.turn, over: status?.dataset.gameOver,
   entering: status?.dataset.entering, moving: status?.dataset.moving, thinking: status?.dataset.thinking,
   mode: document.querySelector('[data-mode][aria-pressed=true]')?.dataset.mode,
   difficulty: document.querySelector('#difficulty')?.value,
   motion: document.querySelector('#motion')?.getAttribute('aria-pressed'),
   motionLabel: document.querySelector('#motion')?.getAttribute('aria-label'),
   sceneMotion: document.querySelector('.sketch-scene')?.dataset.motion,
   residents: cast.length,
   readyArtwork: cast.filter(p => {const i=p.querySelector('.sketch-piece-art'); return i?.complete && i.naturalWidth>0 && !i.hidden;}).length,
   blinks: cast.map(p => Number(getComputedStyle(p.querySelector('.character-blink')).opacity)),
   parts: cast.flatMap(p => [...p.querySelectorAll('.character-idle-part')].map(part => getComputedStyle(part).transform)),
   loader: !!document.querySelector('#paperwild-loading'), appInert: !!document.querySelector('#app')?.inert,
   folded: !!document.querySelector('.sketch-scene.is-folded'), intro: document.querySelector('.sketch-scene')?.dataset.intro,
   result: !!document.querySelector('#result-dialog[open]'),
   residue: many('.sketch-cast > .is-moving, .sketch-departures > *, .finale-layer').length,
   scripts: many('script[src]').map(s => s.src)
 };
}"""


def check(condition, message):
    if not condition:
        raise AssertionError(message)


def standard_board():
    board = {file + str(rank): '' for rank in range(1, 9) for file in 'abcdefgh'}
    for file, role in zip('abcdefgh', 'rnbqkbnr'):
        board[file + '1'] = 'w' + role
        board[file + '2'] = 'wp'
        board[file + '7'] = 'bp'
        board[file + '8'] = 'b' + role
    return board


def chess_state(snapshot):
    return {key: snapshot[key] for key in ('board', 'history', 'captures', 'turn', 'over')}


def assert_ready(snapshot):
    check(not snapshot['loader'] and not snapshot['appInert'] and not snapshot['folded'], 'Loader/inert/folded residue remains')
    check(snapshot['entering'] == 'false' and snapshot['intro'] == 'ready', 'Page entry did not settle')
    check(snapshot['residents'] == snapshot['readyArtwork'] and snapshot['residue'] == 0, 'Undecoded residents or movement/finale residue')
    check(len(snapshot['board']) == 64, 'Expected all 64 semantic squares')


def assert_standard(snapshot):
    assert_ready(snapshot)
    check(snapshot['board'] == standard_board(), 'Board is not the exact standard starting position')
    check(snapshot['residents'] == 32 and snapshot['readyArtwork'] == 32, 'Expected 32 ready residents')
    check(snapshot['turn'] == 'w' and snapshot['over'] == 'false' and snapshot['history'] == [] and snapshot['captures'] == '00', 'Starting game/history/turn/captures mismatch')
    check(not snapshot['result'], 'Unexpected result on the starting board')


async def complete_first_entry(page):
    # Entry is a real user flow, distinct from notebook/pencil animation. These
    # legacy chess cases explicitly choose before playing, without storage tricks.
    await page.wait_for_function("""() => {
      const s=document.querySelector('#game-status');
      return s?.dataset.entering==='false' && s.dataset.entryStage && s.dataset.entryStage!=='opening'
        && !document.querySelector('#paperwild-loading') && !document.querySelector('#app')?.inert;
    }""", timeout=30000)
    guide=page.locator('#onboarding-dialog[open]')
    if await guide.count():
        await expect(guide).to_have_attribute('data-required','true')
        await expect(page.locator('#onboarding-title')).to_have_text('Welcome to Paperwild')
        await page.locator('#onboarding-continue').click()
    choice=page.locator('#new-game-dialog[open][data-required="true"]')
    if await choice.count():
        await expect(page.locator('input[name="new-opponent"]:checked')).to_have_count(0)
        await expect(page.locator('#confirm-new')).to_be_disabled()
        check(await page.locator('#board-access').evaluate('(el) => el.inert'), 'Board must stay inert until an explicit opponent choice')
        preferred=await page.locator('[data-mode][aria-pressed="true"]').get_attribute('data-mode')
        check(preferred in ('computer','local'), 'Unknown retained local mode')
        await choice.locator('input[name="new-opponent"][value="'+preferred+'"]').check()
        await expect(page.locator('#confirm-new')).to_be_enabled()
        await page.locator('#confirm-new').click()
    await expect(page.locator('#game-status')).to_have_attribute('data-entry-stage','ready')
    await expect(page.locator('#game-status')).to_have_attribute('data-opponent-chosen','true')
    check(not await page.locator('#board-access').evaluate('(el) => el.inert'), 'Confirmed local game must release the board')


async def observed(page):
    evidence = await page.evaluate('() => window.__pwObserved || null')
    check(evidence is not None and evidence['frames'], 'UNMEASURED: pre-navigation observer produced no frames')
    check(not evidence['errors'], 'Observer error: ' + str(evidence['errors']))
    return evidence


def compact(evidence):
    # Preserve representative real samples plus counts; assertions use all frames.
    groups = {}
    for frame in evidence['frames']:
        key = frame['loaderClass'] if frame['loader'] else str(frame['intro'])
        groups.setdefault(key, []).append(frame)
    selected = []
    for frames in groups.values():
        indices = sorted(set([0, len(frames)//4, len(frames)//2, 3*len(frames)//4, len(frames)-1]))
        selected.extend(frames[index] for index in indices)
    return {'frameCount': len(evidence['frames']), 'keys': evidence['keys'], 'errors': evidence['errors'], 'sampledFrames': selected}


async def close_session(session, resources):
    """Retain actual observations before retiring this isolated runner session."""
    if session['closed']:
        return
    ordinal, context, browser = session['ordinal'], session['context'], session['browser']
    if context is not None:
        try:
            pages = list(context.pages)
        except Exception as error:
            resources['cleanupErrors'].append({'operation': 'context.pages', 'context': ordinal, 'type': type(error).__name__, 'message': str(error)[:1200]})
            pages = []
        for index, page in enumerate(pages):
            try:
                if not page.is_closed():
                    raw = await asyncio.wait_for(page.evaluate('() => window.__pwObserved || null'), timeout=2)
                    if raw:
                        resources['evidence'].append({'checkpoint': f'context[{ordinal}].before-close', 'page': index, 'url': page.url, 'observations': compact(raw)})
            except Exception as error:
                resources['cleanupErrors'].append({'operation': 'capture-evidence', 'context': ordinal, 'type': type(error).__name__, 'message': str(error)[:1200]})
        try:
            await asyncio.wait_for(context.close(), timeout=5)
        except Exception as error:
            resources['cleanupErrors'].append({'operation': 'context.close', 'context': ordinal, 'type': type(error).__name__, 'message': str(error)[:1200]})
    if browser is not None:
        try:
            await asyncio.wait_for(browser.close(), timeout=5)
        except Exception as error:
            resources['cleanupErrors'].append({'operation': 'browser.close', 'context': ordinal, 'type': type(error).__name__, 'message': str(error)[:1200]})
    session['closed'] = True


async def new_page(browser, resources, reduced='no-preference'):
    global RUN_PHASE, RUN_CONTEXT
    ordinal = len(resources['sessions']) + 1
    RUN_CONTEXT = ordinal
    if resources['sessions']:
        previous = resources['sessions'][-1]
        RUN_PHASE = f'context[{previous["ordinal"]}].retire-before-next'
        await close_session(previous, resources)
        if resources['cleanupErrors']:
            first = resources['cleanupErrors'][0]
            raise RuntimeError(f'Prior runner session cleanup failed: {first["operation"]}: {first["type"]}: {first["message"]}')
        RUN_PHASE = f'context[{ordinal}].chromium.launch'
        browser = await resources['browser_type'].launch(headless=True, args=BROWSER_ARGS)
    session = {'ordinal': ordinal, 'browser': browser, 'context': None, 'closed': False}
    resources['sessions'].append(session)
    RUN_PHASE = f'context[{ordinal}].browser.new_context'
    context = await browser.new_context(viewport={'width': 1440, 'height': 1000}, reduced_motion=reduced)
    session['context'] = context
    context.set_default_timeout(20000)
    RUN_PHASE = f'context[{ordinal}].add_init_script'
    await context.add_init_script(script=RECORDER)
    RUN_PHASE = f'context[{ordinal}].new_page'
    page = await context.new_page()
    return page


async def navigate(page, reload=False):
    global RUN_PHASE
    RUN_PHASE = f'context[{RUN_CONTEXT}].page.reload' if reload else f'context[{RUN_CONTEXT}].page.goto'
    if reload:
        await page.reload(wait_until='commit', timeout=30000)
    else:
        await page.goto(TARGET, wait_until='commit', timeout=30000)
    RUN_PHASE = f'context[{RUN_CONTEXT}].exercise-after-navigation'
    check('{0.scheme}://{0.netloc}'.format(urlsplit(page.url)) == ORIGIN, 'Execution changed the configured target origin')


async def entry_ready(page):
    await complete_first_entry(page)
    await page.wait_for_function("""() => {
      const s=document.querySelector('#game-status'), b=document.querySelector('#board-access');
      return s?.dataset.entering==='false' && b?.getAttribute('aria-busy')==='false'
        && !document.querySelector('#paperwild-loading') && !document.querySelector('#app')?.inert;
    }""", timeout=25000)


async def settled(page):
    await complete_first_entry(page)
    await entry_ready(page)
    await page.wait_for_function("""() => {
      const s=document.querySelector('#game-status');
      return s?.dataset.moving==='false' && s?.dataset.thinking==='false';
    }""", timeout=20000)


async def select_mode(page, mode, difficulty=None):
    # Desktop controls can already be visible. Do not create a modal overlay
    # over them; open Field kit only when the actual target needs that route.
    control = page.locator('[data-mode="' + mode + '"]')
    opened = False
    if not await control.is_visible():
        await page.locator('#field-options').click()
        opened = True
    await control.click()
    if difficulty:
        difficulty_control = page.locator('#difficulty')
        if not await difficulty_control.is_visible() and not opened:
            await page.locator('#field-options').click()
            opened = True
        await difficulty_control.select_option(difficulty)
    if opened:
        await page.get_by_role('button', name='Close field kit', exact=True).click()
    await expect(control).to_have_attribute('aria-pressed', 'true')


async def local_e4(page):
    await select_mode(page, 'local')
    await page.get_by_test_id('square-e2').click()
    await page.get_by_test_id('square-e4').click()
    await settled(page)
    snapshot = await page.evaluate(SNAPSHOT)
    expected = standard_board()
    expected['e2'] = ''
    expected['e4'] = 'wp'
    check(snapshot['board'] == expected and snapshot['history'] == ['e4'] and snapshot['turn'] == 'b' and snapshot['captures'] == '00', 'Actual local e2-e4 outcome mismatch')
    return snapshot


async def keyboard_skip(page, during_opening=False):
    await page.locator('#pw-loading-skip').wait_for(state='visible')
    await page.wait_for_function("() => document.querySelector('#app')?.inert && document.querySelector('#app')?.getAttribute('aria-busy')==='true'", timeout=10000)
    control = page.locator('#pw-loading-skip')
    await expect(control).to_have_attribute('aria-label', 'Skip introduction')
    await page.wait_for_function("() => { const b=document.querySelector('#pw-loading-skip'); return b && Number(getComputedStyle(b).opacity)>.9; }", timeout=10000)
    if during_opening:
        await page.wait_for_function("""() => {
          const l=document.querySelector('#paperwild-loading'), c=document.querySelector('.pw-cover');
          return l?.classList.contains('is-opening') && c
            && Math.abs(new DOMMatrixReadOnly(getComputedStyle(c).transform).m11 - 1) > .03;
        }""", timeout=15000)
    # The underlying app is inert: Skip introduction is the page's tab target.
    await page.keyboard.press('Tab')
    await expect(control).to_be_focused(timeout=1500)
    await page.keyboard.press('Enter')
    await entry_ready(page)
    evidence = await observed(page)
    matches = [key for key in evidence['keys'] if key['key']=='Enter' and key['target']=='pw-loading-skip' and key['trusted'] and key['loader']]
    check(matches, 'No real keyboard Enter reached the actual skip control')
    if during_opening:
        check(any(key['opening'] for key in matches), 'UNMEASURED: skip was not activated during actual opening')
    else:
        check(any(not key['ready'] and not key['opening'] for key in matches), 'UNMEASURED: early skip missed the loading phase')
    return evidence


async def run_test():
    global RUN_PHASE
    pw = browser = None
    resources = {'sessions': [], 'browser_type': None, 'evidence': [], 'cleanupErrors': []}
    evidence_log = []
    primary = None
    failure_phase = None
    try:
        RUN_PHASE = 'playwright.start'
        pw = await async_api.async_playwright().start()
        resources['browser_type'] = pw.chromium
        RUN_PHASE = 'context[1].chromium.launch'
        browser = await pw.chromium.launch(headless=True, args=BROWSER_ARGS)
        RUN_PHASE = 'exercise'
        await asyncio.wait_for(exercise(browser, resources, evidence_log), timeout=180)
    except BaseException as error:
        primary = error
        failure_phase = RUN_PHASE
    finally:
        # Retire the last live browser, preserving the first substantive error.
        for session in reversed(resources['sessions']):
            await close_session(session, resources)
        if browser is not None and not resources['sessions']:
            try:
                await asyncio.wait_for(browser.close(), timeout=5)
            except Exception as error:
                resources['cleanupErrors'].append({'operation': 'initial-browser.close', 'type': type(error).__name__, 'message': str(error)[:1200]})
        if pw:
            try:
                await asyncio.wait_for(pw.stop(), timeout=5)
            except Exception as error:
                resources['cleanupErrors'].append({'operation': 'playwright.stop', 'type': type(error).__name__, 'message': str(error)[:1200]})
        original = None if primary is None else {'phase': failure_phase, 'type': type(primary).__name__, 'message': str(primary)}
        report = {'case': CASE_ID, 'status': 'passed' if primary is None and not resources['cleanupErrors'] else 'failed',
                  'target': TARGET, 'originalException': original, 'cleanupErrors': resources['cleanupErrors'],
                  'evidence': evidence_log + resources['evidence']}
        try:
            print(json.dumps(report, separators=(',', ':'), allow_nan=False))
        except Exception as error:
            resources['cleanupErrors'].append({'operation': 'print-evidence', 'type': type(error).__name__, 'message': str(error)[:1200]})
    if primary is not None:
        if isinstance(primary, (KeyboardInterrupt, SystemExit, asyncio.CancelledError)):
            raise primary
        raise RuntimeError(f'{CASE_ID} phase={failure_phase}; original {type(primary).__name__}: {str(primary)[:2500]}') from primary
    if resources['cleanupErrors']:
        first = resources['cleanupErrors'][0]
        raise RuntimeError(f'{CASE_ID} assertions completed but runner/evidence cleanup failed: {first["operation"]}: {first["type"]}: {first["message"]}')


CASE_ID = 'NOTE-003'


async def exercise(browser, resources, log):
    for during_opening in (False, True):
        page = await new_page(browser, resources)
        await navigate(page)
        raw = await keyboard_skip(page, during_opening=during_opening)
        snapshot = await page.evaluate(SNAPSHOT)
        assert_standard(snapshot)
        drawing = [f for f in raw['frames'] if not f['loader'] and f['intro']=='drawing']
        rising = [f for f in raw['frames'] if not f['loader'] and f['intro']=='rising']
        check(drawing and rising, 'UNMEASURED: keyboard skip bypassed visible board entry or it was not captured')
        # Observe beyond the original opening duration to catch canceled late work.
        before = chess_state(snapshot)
        await asyncio.sleep(2.0)
        check(chess_state(await page.evaluate(SNAPSHOT))==before, 'Late introduction work changed the game')
        assert_ready(await page.evaluate(SNAPSHOT))
        log.append({'keyboardSkip': 'during-opening' if during_opening else 'early-loading', 'entry': compact(raw), 'snapshot': snapshot})
        log.append({'legalMoveAfterSkip': await local_e4(page)})

    page = await new_page(browser, resources)
    await navigate(page)
    await settled(page)
    await select_mode(page, 'computer', difficulty='seedling')
    await page.get_by_test_id('square-e2').click()
    await page.get_by_test_id('square-e4').click()
    # Reload in the same uninterrupted script while the committed White gait is
    # still running. No saved pending position is manufactured by this test.
    pending = await page.evaluate(SNAPSHOT)
    check(pending['turn']=='b' and pending['history']==['e4'], 'UNMEASURED: did not reach the real pending Black turn before reload')
    expected_pending_board = standard_board()
    expected_pending_board['e2'], expected_pending_board['e4'] = '', 'wp'
    check(pending['board']==expected_pending_board, 'White move was not committed exactly once')
    await navigate(page, reload=True)
    await entry_ready(page)
    await settled(page)
    await page.wait_for_function("() => {const s=document.querySelector('#game-status'); return s?.dataset.turn==='w' && s.dataset.moving==='false' && s.dataset.thinking==='false';}", timeout=15000)
    raw = await observed(page)
    active = [f for f in raw['frames'] if f['entering']=='true' and len(f['board'])==64]
    check(active, 'UNMEASURED: pending computer entry was not observed')
    check(any(f['loader'] for f in active) and any(not f['loader'] for f in active), 'UNMEASURED: missing covered or visible entry stage for computer deferral')
    check(all(f['history']==['e4'] and dict(f['board'])==expected_pending_board and f['turn']=='b' for f in active), 'Computer committed before notebook and board entry settled')
    final = await page.evaluate(SNAPSHOT)
    assert_ready(final)
    check(final['turn']=='w' and len(final['history'])==2 and final['history'][0]=='e4' and final['captures']=='00', 'Expected one White move and exactly one settled Black reply')
    check(final['board']['e2']=='' and final['board']['e4']=='wp' and final['board']!=expected_pending_board, 'Reply did not produce a consistent changed Black position')
    legal_replies = []
    for file in 'abcdefgh':
        for rank in ('6', '5'):
            board = dict(expected_pending_board)
            board[file+'7'], board[file+rank] = '', 'bp'
            legal_replies.append((file+rank, board))
    for source, destination in [('b8','a6'),('b8','c6'),('g8','f6'),('g8','h6')]:
        board = dict(expected_pending_board)
        board[source], board[destination] = '', 'bn'
        legal_replies.append(('N'+destination, board))
    check(any(final['history'][1]==san and final['board']==board for san,board in legal_replies), 'Recorded SAN/board is not one of the 20 legal Black replies to e4')
    await asyncio.sleep(2.0)
    check(chess_state(await page.evaluate(SNAPSHOT))==chess_state(final), 'Duplicate delayed computer reply changed the settled position')
    log.append({'realPendingReload': pending, 'entry': compact(raw), 'singleReply': final})


asyncio.run(run_test())
