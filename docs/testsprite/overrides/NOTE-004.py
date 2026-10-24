"""Stored-code TestSprite override. No app flags, timers, storage or game injection.

TEST_TARGET_URL overrides the public PR-preview fallback. Use strict stored-code
replay where supported. This file is self-contained for TestSprite's Python exec.
All state changes use real controls. Assertions only read the DOM; there is no
application-state, storage or audio injection. Cleanup preserves original errors.
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
   atmosphere: document.documentElement.dataset.atmosphere,
   weather: document.documentElement.dataset.weather,
   weatherPressed: document.querySelector('#weather')?.getAttribute('aria-pressed'),
   sound: document.querySelector('#sound')?.getAttribute('aria-pressed'),
   study: document.querySelector('#study-banner')?.hidden ? null : document.querySelector('#study-name')?.textContent.trim(),
   undoDisabled: document.querySelector('#undo')?.disabled,
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


async def complete_first_entry(page, mode='computer'):
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
        # Mode buttons are intentionally all unpressed before a first choice.
        # The scenario supplies its deliberate opponent; never infer a default
        # from the gated board or accept the disabled confirmation implicitly.
        check(mode in ('computer','local'), 'Unknown requested local mode')
        await choice.locator('input[name="new-opponent"][value="'+mode+'"]').check()
        await expect(page.locator('#confirm-new')).to_be_enabled()
        await page.locator('#confirm-new').click()
    await expect(page.locator('#game-status')).to_have_attribute('data-entry-stage','ready')
    await expect(page.locator('#game-status')).to_have_attribute('data-opponent-chosen','true')
    check(not await page.locator('#board-access').evaluate('(el) => el.inert'), 'Confirmed local game must release the board')


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
                    raw = await asyncio.wait_for(page.evaluate(SNAPSHOT), timeout=2)
                    if raw:
                        resources['evidence'].append({'checkpoint': f'context[{ordinal}].before-close', 'page': index, 'url': page.url, 'snapshot': raw})
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


async def entry_ready(page, startup_mode='computer'):
    await complete_first_entry(page, mode=startup_mode)
    await page.wait_for_function("""() => {
      const s=document.querySelector('#game-status'), b=document.querySelector('#board-access');
      return s?.dataset.entering==='false' && b?.getAttribute('aria-busy')==='false'
        && !document.querySelector('#paperwild-loading') && !document.querySelector('#app')?.inert;
    }""", timeout=25000)


async def settled(page, startup_mode='computer'):
    await complete_first_entry(page, mode=startup_mode)
    await entry_ready(page, startup_mode=startup_mode)
    await page.wait_for_function("""() => {
      const s=document.querySelector('#game-status');
      const images=[...document.querySelectorAll('.sketch-cast > .sketch-piece .sketch-piece-art')];
      return s?.dataset.moving==='false' && s?.dataset.thinking==='false'
        && images.length>0 && images.every(image=>image.complete && image.naturalWidth>0 && !image.hidden);
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



def preferences(snapshot):
    return {key:snapshot[key] for key in ('mode','difficulty','atmosphere','weather','weatherPressed','sound','motion')}


async def open_study(page, study):
    control=page.locator('#studies')
    if not await control.is_visible():
        await page.locator('#field-options').click()
    await control.click()
    await page.locator('[data-study="'+study+'"]').click()
    await settled(page)


async def fresh_game(page):
    control=page.locator('#new-game')
    if not await control.is_visible():
        await page.locator('#field-options').click()
    await control.click()
    if await page.locator('#new-game-dialog').get_attribute('open') is not None:
        await page.locator('#confirm-new').click()
    await settled(page)
    assert_standard(await page.evaluate(SNAPSHOT))


async def remembrance(page):
    await page.locator('#field-notes').click()
    await page.locator('#journal-remembrance').click()
    await expect(page.locator('#remembrance-dialog')).to_be_visible()
    return await page.evaluate("""() => [...document.querySelectorAll('#remembrance-list .remembrance-card')].map(c=>({
      team:c.dataset.team,name:c.querySelector('h3')?.textContent.trim(),
      epitaph:c.querySelector('.remembrance-epitaph')?.textContent.trim(),
      detail:c.querySelector('.remembrance-detail')?.textContent.trim(),
      face:c.querySelector('.character-face')?.dataset.character
    }))""")


async def close_remembrance(page):
    await page.get_by_role('button',name='Close the garden of remembrance',exact=True).click()


CASE_ID='NOTE-004'


async def exercise(browser,resources,log):
    page=await new_page(browser,resources)
    await navigate(page)
    await settled(page)
    assert_standard(await page.evaluate(SNAPSHOT))
    await select_mode(page,'computer',difficulty='garden')
    await page.locator('#atmosphere').click()
    await page.locator('#weather').click()
    await open_study(page,'mate')
    starting=await page.evaluate(SNAPSHOT)
    expected={square:'' for square in standard_board()}
    expected.update({'g6':'wq','f6':'wk','h8':'bk'})
    check(starting['board']==expected and starting['history']==[] and starting['turn']=='w' and starting['captures']=='00' and starting['study']=='One final move','Mate study did not start at its exact selected position')
    await expect(page.get_by_test_id('square-g6')).to_have_attribute('aria-pressed','true')
    await page.get_by_test_id('square-g7').click()
    await settled(page)
    await expect(page.locator('#result-dialog')).to_be_visible()
    terminal=await page.evaluate(SNAPSHOT)
    expected['g6'],expected['g7']='','wq'
    check(terminal['board']==expected and terminal['history']==['Qg7#'] and terminal['over']=='true' and terminal['captures']=='00','Actual mate move/result state mismatch')
    result=(await page.locator('#result-description').inner_text()).lower()
    check('checkmate' in result and 'white wins' in result,'Result does not declare the actual White checkmate')
    retained=preferences(terminal)
    log.append({'actualCompletedMate':terminal,'result':result})

    await navigate(page,reload=True)
    # Studies explicitly run in local mode; choose that same opponent on the
    # fresh board before checking retained mode/difficulty/preferences.
    await settled(page, startup_mode='local')
    fresh=await page.evaluate(SNAPSHOT)
    assert_standard(fresh)
    check(fresh['study'] is None and fresh['undoDisabled'] and preferences(fresh)==retained,'Completed reload did not clear study/Undo or retain settings')
    await page.locator('#field-options').click()
    await expect(page.locator('#revisit-finished')).to_be_visible()
    await page.locator('#revisit-finished').click()
    await settled(page)
    revisited=await page.evaluate(SNAPSHOT)
    check(chess_state(revisited)==chess_state(terminal) and revisited['study']=='One final move' and not revisited['undoDisabled'],'Explicit revisit did not restore the exact terminal history/study')
    check(not revisited['result'],'Revisit replayed a result dialog')
    await expect(page.locator('.finale-layer,.sketch-skirmish,.sketch-stretcher,.is-awaiting-stretcher,.sketch-departures > *')).to_have_count(0)
    log.append({'freshAfterMateReload':fresh,'explicitRevisit':revisited})

    await fresh_game(page)
    await navigate(page,reload=True)
    await settled(page)
    assert_standard(await page.evaluate(SNAPSHOT))
    opening=await local_e4(page)
    await page.locator('#field-options').click()
    await expect(page.locator('#revisit-finished')).not_to_be_visible()
    await page.get_by_role('button',name='Close field kit',exact=True).click()
    log.append({'newOpeningPreservedFromRevisit':opening})

    await open_study(page,'promotion')
    await expect(page.get_by_test_id('square-a7')).to_have_attribute('aria-pressed','true')
    await page.get_by_test_id('square-a8').click()
    await expect(page.locator('#promotion-dialog')).to_be_visible()
    await page.get_by_role('button',name='Promote to knight',exact=True).click()
    await settled(page)
    await expect(page.locator('#result-dialog')).to_be_visible()
    drawn=await page.evaluate(SNAPSHOT)
    check(drawn['board']['a8']=='wn' and drawn['board']['a7']=='' and drawn['history']==['a8=N'] and drawn['over']=='true','Knight study did not produce the actual terminal promotion')
    check('insufficient' in (await page.locator('#result-description').inner_text()).lower(),'Promotion result does not describe insufficient material')
    await navigate(page,reload=True)
    await settled(page, startup_mode='local')
    after_draw=await page.evaluate(SNAPSHOT)
    assert_standard(after_draw)
    check(after_draw['study'] is None and after_draw['undoDisabled'] and preferences(after_draw)==retained,'Draw reload left terminal residue or changed saved settings')
    log.append({'terminalDraw':drawn,'freshAfterDraw':after_draw})

    await open_study(page,'bloom')
    initial=await page.evaluate(SNAPSHOT)
    check(initial['board']['e4']=='wp' and initial['board']['d5']=='bp' and initial['history']==[] and initial['captures']=='00' and initial['turn']=='w','Capture study starting state mismatch')
    await expect(page.get_by_test_id('square-e4')).to_have_attribute('aria-pressed','true')
    await page.get_by_test_id('square-d5').click()
    await settled(page)
    captured=await page.evaluate(SNAPSHOT)
    expected_capture=dict(initial['board']);expected_capture['e4']='';expected_capture['d5']='wp'
    check(captured['board']==expected_capture and captured['history']==['exd5'] and captured['captures']=='01' and captured['turn']=='b' and captured['over']=='false','Actual capture is not the expected unfinished position')
    await expect(page.locator('.sketch-sideline-piece')).to_have_count(1)
    cards=await remembrance(page)
    check(len(cards)==1 and cards[0]['team']=='b' and cards[0]['face']=='bp' and cards[0]['name'] and cards[0]['epitaph'] and 'Indigo' in cards[0]['detail'] and 'd5' in cards[0]['detail'],'Remembrance did not match the captured Black pawn')
    await close_remembrance(page)
    await navigate(page,reload=True)
    await settled(page)
    restored=await page.evaluate(SNAPSHOT)
    check(chess_state(restored)==chess_state(captured) and restored['study']==captured['study'] and preferences(restored)==preferences(captured),'Unfinished capture/history/study/preferences did not restore exactly')
    check(await remembrance(page)==cards,'Restored remembrance names/epitaphs changed or vanished')
    await close_remembrance(page)
    await page.get_by_role('button',name='Undo last turn',exact=True).click()
    await settled(page)
    undone=await page.evaluate(SNAPSHOT)
    check(chess_state(undone)==chess_state(initial),'Undo after restored capture did not restore the exact initial chess state')
    await expect(page.locator('.sketch-sideline-piece,#bloom-display .bloom-token,.pageant-grave,.pageant-reviver')).to_have_count(0,timeout=10000)
    check(await remembrance(page)==[],'Obsolete remembrance cards survived capture undo')
    await expect(page.locator('#remembrance-save')).to_be_disabled()
    await close_remembrance(page)
    log.append({'captureBeforeReload':captured,'sameCaptureAfterReload':restored,'rememberedCards':cards,'undoAfterReload':undone})


asyncio.run(run_test())
