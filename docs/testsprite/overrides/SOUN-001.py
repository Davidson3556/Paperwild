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

TARGET = os.environ.get("TEST_TARGET_URL", "https://paperwild-git-living-davidson3556s-projects.vercel.app/")
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


async def entry_ready(page):
    await page.wait_for_function("""() => {
      const s=document.querySelector('#game-status'), b=document.querySelector('#board-access');
      return s?.dataset.entering==='false' && b?.getAttribute('aria-busy')==='false'
        && !document.querySelector('#paperwild-loading') && !document.querySelector('#app')?.inert;
    }""", timeout=25000)


async def settled(page):
    await entry_ready(page)
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


CASE_ID='SOUN-001'

AUDIO=r"""() => {
 const s=document.querySelector('#sound');
 return {pressed:s.getAttribute('aria-pressed'),label:s.getAttribute('aria-label'),text:s.textContent.trim(),
 count:Number(s.dataset.voiceCount||0),events:(s.dataset.voiceEvents||'').split(',').filter(Boolean),
 role:s.dataset.lastRole||null,activity:s.dataset.lastActivity||null};
}"""


async def await_greeting(page,role,before):
    await page.wait_for_function("""({role,before})=>{
      const s=document.querySelector('#sound');
      return s?.getAttribute('aria-pressed')==='true' && Number(s.dataset.voiceCount||0)>before
        && s.dataset.lastRole===role && s.dataset.lastActivity==='greet'
        && (s.dataset.voiceEvents||'').split(',').includes(role+':greet');
    }""",arg={'role':role,'before':before},timeout=10000)
    state=await page.evaluate(AUDIO)
    check(state['pressed']=='true' and state['label']=='Turn sound off' and 'Sound on' in state['text'],'Sound UI did not reflect real guide opt-in')
    return state


async def exercise(browser,resources,log):
    page=await new_page(browser,resources)
    await navigate(page)
    await settled(page)
    await select_mode(page,'local')
    before=await page.evaluate(SNAPSHOT)
    assert_standard(before)
    quiet=await page.evaluate(AUDIO)
    check(quiet['pressed']=='false' and quiet['label']=='Turn sound on' and 'Sound off' in quiet['text'] and quiet['count']==0 and quiet['events']==[],'Fresh page is not silent Sound off with no scheduled character calls')
    await page.get_by_role('button',name='How to play',exact=True).click()
    for role,name in [('p','acorn'),('k','badger'),('q','fox'),('r','stump'),('b','moth'),('n','hare')]:
        previous=await page.evaluate(AUDIO)
        await page.get_by_role('button',name='Hear the '+name,exact=True).click()
        state=await await_greeting(page,role,previous['count'])
        check(chess_state(await page.evaluate(SNAPSHOT))==chess_state(before),'Guide voice audition changed chess')
        log.append({'audition':role,'beforeCount':previous['count'],'scheduled':state})
    await page.get_by_role('button',name='Close instructions',exact=True).click()
    await page.get_by_role('button',name='Turn sound off',exact=True).click()
    muted=await page.evaluate(AUDIO)
    check(muted['pressed']=='false' and muted['label']=='Turn sound on' and 'Sound off' in muted['text'],'Mute did not update actual sound preference/UI')
    await page.get_by_role('button',name='Say hello',exact=True).click()
    await asyncio.sleep(.25)
    after_hello=await page.evaluate(AUDIO)
    check(after_hello['pressed']=='false' and after_hello['count']==muted['count'],'Muted Say hello scheduled a new character call')
    check(chess_state(await page.evaluate(SNAPSHOT))==chess_state(before),'Muted greeting changed chess')
    await navigate(page,reload=True)
    await settled(page)
    reloaded=await page.evaluate(AUDIO)
    check(reloaded['pressed']=='false' and reloaded['label']=='Turn sound on' and 'Sound off' in reloaded['text'] and reloaded['count']==0 and reloaded['events']==[],'Saved mute/reload scheduled a call or reset sound preference')
    check(chess_state(await page.evaluate(SNAPSHOT))==chess_state(before),'Reload changed the unmoved local board')
    await page.get_by_role('button',name='How to play',exact=True).click()
    focused=[]
    for _ in range(16):
        current=await page.evaluate("""() => {const e=document.activeElement;return {id:e?.id||'',role:e?.dataset.voice||null,name:e?.getAttribute('aria-label')||e?.textContent?.trim()||''};}""")
        focused.append(current)
        if current['role']=='n' and current['name']=='Hear the hare':
            break
        await page.keyboard.press('Tab')
    else:
        raise AssertionError('Real Tab traversal did not reach the actual Hear the hare button: '+json.dumps(focused))
    await expect(page.get_by_role('button',name='Hear the hare',exact=True)).to_be_focused()
    immediately_before=await page.evaluate(AUDIO)
    await page.keyboard.press('Enter')
    keyboard=await await_greeting(page,'n',immediately_before['count'])
    check(chess_state(await page.evaluate(SNAPSHOT))==chess_state(before),'Keyboard voice opt-in changed board/history/turn/captures')
    log.append({'mutedGreeting':after_hello,'savedMuteReload':reloaded,'actualTabFocusPath':focused,'countImmediatelyBeforeEnter':immediately_before['count'],'keyboardHareScheduled':keyboard,'scope':'DOM scheduling callbacks, not physical playback or perceived sound quality'})


asyncio.run(run_test())
