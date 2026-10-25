"""Strict TestSprite replay of the exact PR build through its owned tunnel.

Repairs test selectors and stage placement only. Uses actual controls, semantic
board attributes and read-only DOM snapshots; no game/storage/timer injection.
"""
import asyncio
import json
import os
import re
from urllib.parse import urlsplit
from playwright import async_api
from playwright.async_api import expect

TARGET = os.environ.get('TEST_TARGET_URL', 'http://127.0.0.1:4173/')
_target = urlsplit(TARGET)
if (_target.scheme != 'http' or _target.netloc != '127.0.0.1:4173'
        or _target.path not in ('', '/') or _target.query or _target.fragment):
    raise RuntimeError('This CI replay requires the owned 127.0.0.1:4173 PR-build tunnel.')
ORIGIN = '{0.scheme}://{0.netloc}'.format(urlsplit(TARGET))
EXPECTED_BUNDLE = os.environ.get('TEST_EXPECTED_BUNDLE')
LOADED_BUNDLES = []
BROWSER_ARGS = ['--window-size=1280,720', '--disable-dev-shm-usage', '--ipc=host', '--single-process']
PHASE = 'module-loaded'

SNAPSHOT = r"""() => {
 const all=s=>[...document.querySelectorAll(s)], one=s=>document.querySelector(s);
 const status=one('#game-status'), cast=all('.sketch-cast > .sketch-piece');
 return {
  board:Object.fromEntries(all('#board-access [data-testid^="square-"]').map(p=>[p.dataset.testid.slice(7),p.dataset.piece||''])),
  history:all('#move-history li:not(.history-empty)').flatMap(row=>[...row.querySelectorAll('span')].slice(1).map(p=>p.textContent.trim())).filter(p=>p&&p!=='…'&&p!=='—'),
  captures:one('#field-capture-count')?.textContent.trim(),
  turn:status?.dataset.turn,over:status?.dataset.gameOver,
  entering:status?.dataset.entering,moving:status?.dataset.moving,thinking:status?.dataset.thinking,
  busy:one('#board-access')?.getAttribute('aria-busy'),
  mode:one('[data-mode][aria-pressed=true]')?.dataset.mode,difficulty:one('#difficulty')?.value,
  atmosphere:document.documentElement.dataset.atmosphere,weather:document.documentElement.dataset.weather,
  rain:one('#weather')?.getAttribute('aria-pressed'),motion:one('#motion')?.getAttribute('aria-pressed'),
  motionLabel:one('#motion')?.getAttribute('aria-label'),
  studyVisible:!!one('#study-banner')&&!one('#study-banner').hidden,study:one('#study-name')?.textContent.trim(),
  portraits:all('#bloom-display .character-portrait').map(p=>p.getAttribute('aria-label')),
  sidelines:all('.sketch-sideline-piece').length,
  residents:cast.length,decoded:cast.filter(p=>{const i=p.querySelector('.sketch-piece-art');return i?.complete&&i.naturalWidth>0&&!i.hidden;}).length,
  residue:all('.sketch-cast>.is-moving,.sketch-departures>*').length,
  result:!!one('#result-dialog[open]'),promotion:!!one('#promotion-dialog[open]'),
  loader:!!one('#paperwild-loading'),inert:!!one('#app')?.inert,
  scripts:all('script[src]').map(s=>s.src)
 };
}"""


def check(condition, message):
    if not condition:
        raise AssertionError(message)


def mark(phase):
    global PHASE
    PHASE = phase


def standard_board():
    board={file+str(rank):'' for rank in range(1,9) for file in 'abcdefgh'}
    for file,role in zip('abcdefgh','rnbqkbnr'):
        board[file+'1']='w'+role
        board[file+'2']='wp'
        board[file+'7']='bp'
        board[file+'8']='b'+role
    return board


def chess_state(snapshot):
    return {key:snapshot[key] for key in ('board','history','captures','turn','over')}


def assert_chess(snapshot, board, history, turn, captures, over='false'):
    check(len(snapshot['board'])==64 and snapshot['board']==board, 'Complete 64-square position mismatch')
    check(snapshot['history']==history, 'Ordered SAN history mismatch: '+str(snapshot['history']))
    check(snapshot['turn']==turn and snapshot['captures']==captures and snapshot['over']==over, 'Turn/capture/terminal state mismatch')
    check(snapshot['residents']==sum(bool(piece) for piece in board.values()), 'Active resident count disagrees with board')
    check(snapshot['decoded']==snapshot['residents'], 'Active resident artwork has not decoded')
    check(snapshot['residue']==0, 'Moving/departing residue remains after settlement')


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


async def settled(page, timeout=25000, startup_mode='computer'):
    await complete_first_entry(page, mode=startup_mode)
    await page.wait_for_function("""() => {
      const s=document.querySelector('#game-status'),b=document.querySelector('#board-access');
      const images=[...document.querySelectorAll('.sketch-cast > .sketch-piece .sketch-piece-art')];
      return s?.dataset.entering==='false'&&s.dataset.moving==='false'&&s.dataset.thinking==='false'
        && b?.getAttribute('aria-busy')==='false'&&!document.querySelector('#paperwild-loading')
        && !document.querySelector('#app')?.inert&&images.length>0&&images.every(i=>i.complete&&i.naturalWidth>0&&!i.hidden);
    }""", timeout=timeout)


async def navigate(page, reload=False):
    mark('reload-target' if reload else 'navigate-target')
    if reload:
        await page.reload(wait_until='domcontentloaded',timeout=30000)
    else:
        await page.goto(TARGET,wait_until='domcontentloaded',timeout=30000)
    check('{0.scheme}://{0.netloc}'.format(urlsplit(page.url))==ORIGIN,'Navigation left the configured target origin')
    await settled(page)
    snapshot=await page.evaluate(SNAPSHOT)
    # The CI gate hashes every served build file before and after replay.
    # Bind this browser to that origin and one hashed application module too.
    application_scripts = [urlsplit(url) for url in snapshot['scripts']
                           if '{0.scheme}://{0.netloc}'.format(urlsplit(url)) == ORIGIN
                           and re.fullmatch(r'/assets/index-[A-Za-z0-9_-]+\.js', urlsplit(url).path)]
    check(len(application_scripts) == 1, 'Expected one same-origin hashed application module from the verified PR build')
    loaded_bundle = application_scripts[0].path.rsplit('/', 1)[-1]
    LOADED_BUNDLES.append(loaded_bundle)
    check(EXPECTED_BUNDLE is None or loaded_bundle == EXPECTED_BUNDLE, 'Application bundle differs from the explicitly requested bundle')
    return snapshot


async def choose_mode(page, mode, difficulty=None):
    mark('choose-mode-'+mode)
    control=page.locator('[data-mode="'+mode+'"]')
    opened=False
    if not await control.is_visible():
        await page.locator('#field-options').click()
        opened=True
    await control.click()
    if difficulty:
        field=page.locator('#difficulty')
        if not await field.is_visible() and not opened:
            await page.locator('#field-options').click()
            opened=True
        await expect(field).to_be_enabled()
        await field.select_option(value=difficulty)
        await expect(field).to_have_value(difficulty)
    if opened:
        await page.get_by_role('button',name='Close field kit',exact=True).click()
    await expect(control).to_have_attribute('aria-pressed','true')
    await settled(page)


async def open_study(page, study):
    mark('open-study-'+study)
    control=page.get_by_role('button',name='Explore the chess studies',exact=True)
    if not await control.is_visible():
        await page.locator('#field-options').click()
    await control.click()
    await page.locator('[data-study="'+study+'"]').click()
    await settled(page)


async def unchanged_for(page, expected, seconds):
    # This deliberate temporal assertion detects stale work after settled Undo;
    # it is not an arbitrary sleep used to synchronize an unfinished move.
    start=asyncio.get_running_loop().time()
    samples=0
    while True:
        check(chess_state(await page.evaluate(SNAPSHOT))==expected,'Delayed work changed a restored game')
        samples+=1
        elapsed=asyncio.get_running_loop().time()-start
        if elapsed>=seconds:
            return {'seconds':elapsed,'samples':samples}
        await asyncio.sleep(min(.05,seconds-elapsed))


async def run_test():
    pw=browser=context=page=None
    original=None
    failure_phase=None
    cleanup_errors=[]
    log=[]
    try:
        mark('playwright-start')
        pw=await async_api.async_playwright().start()
        mark('chromium-launch')
        browser=await pw.chromium.launch(headless=True,args=BROWSER_ARGS)
        mark('new-context')
        context=await browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='no-preference')
        context.set_default_timeout(20000)
        page=await context.new_page()
        await asyncio.wait_for(exercise(page,log),timeout=150)
    except BaseException as error:
        original=error
        failure_phase=PHASE
    finally:
        if page is not None and not page.is_closed():
            try:
                log.append({'checkpoint':'final-dom','url':page.url,'state':await asyncio.wait_for(page.evaluate(SNAPSHOT),timeout=3)})
            except Exception as error:
                cleanup_errors.append({'operation':'final-evidence','type':type(error).__name__,'message':str(error)[:1200]})
        for name,resource in [('context',context),('browser',browser),('playwright',pw)]:
            if resource is not None:
                try:
                    await asyncio.wait_for(resource.stop() if name=='playwright' else resource.close(),timeout=5)
                except Exception as error:
                    cleanup_errors.append({'operation':name+'.close','type':type(error).__name__,'message':str(error)[:1200]})
        report={'case':CASE_ID,'target':TARGET,'bundle':LOADED_BUNDLES[-1] if LOADED_BUNDLES else None,'expectedBundle':EXPECTED_BUNDLE,'status':'passed' if original is None and not cleanup_errors else 'failed',
                'originalException':None if original is None else {'phase':failure_phase,'type':type(original).__name__,'message':str(original)},
                'cleanupErrors':cleanup_errors,'evidence':log}
        try:
            print(json.dumps(report,separators=(',',':'),allow_nan=False))
        except Exception as error:
            cleanup_errors.append({'operation':'print-evidence','type':type(error).__name__,'message':str(error)[:1200]})
    if original is not None:
        if isinstance(original,(KeyboardInterrupt,SystemExit,asyncio.CancelledError)):
            raise original
        raise RuntimeError(f'{CASE_ID} phase={failure_phase}; original {type(original).__name__}: {str(original)[:2500]}') from original
    if cleanup_errors:
        raise RuntimeError(CASE_ID+' cleanup failed: '+str(cleanup_errors[0]))


CASE_ID='PREF-001'


async def exercise(page,log):
    await navigate(page)
    await open_study(page,'bloom')
    initial_board=standard_board()
    initial_board.update({'e2':'','e4':'wp','d7':'','d5':'bp'})
    initial=await page.evaluate(SNAPSHOT)
    assert_chess(initial,initial_board,[],'w','00')
    check(initial['studyVisible'] and initial['study']=='Tea on the sidelines','Capture study context missing')
    await expect(page.get_by_test_id('square-e4')).to_have_attribute('aria-pressed','true')
    await expect(page.get_by_test_id('square-e4')).to_have_attribute('aria-label','e4, White pawn')
    log.append({'checkpoint':'initial-capture-study','state':initial})
    mark('capture-preselected-e4-to-d5')
    await page.get_by_test_id('square-d5').click()
    await settled(page)
    captured_board=dict(initial_board)
    captured_board.update({'e4':'','d5':'wp'})
    captured=await page.evaluate(SNAPSHOT)
    assert_chess(captured,captured_board,['exd5'],'b','01')
    check(captured['portraits']==['Black pawn captured'] and captured['sidelines']==1,'Captured Black pawn is missing or duplicated')
    await expect(page.get_by_test_id('square-d5')).to_have_attribute('aria-label','d5, White pawn')
    log.append({'checkpoint':'committed-capture-before-reload','state':captured})
    mark('set-moonlight-rain-and-pause-through-controls')
    await page.get_by_role('button',name='Switch to evening light',exact=True).click()
    await page.get_by_role('button',name='Let it rain',exact=True).click()
    await page.get_by_role('button',name='Pause animations',exact=True).click()
    before_reload=await page.evaluate(SNAPSHOT)
    check(chess_state(before_reload)==chess_state(captured),'Preferences changed the capture state')
    check(before_reload['atmosphere']=='dusk' and before_reload['weather']=='rain' and before_reload['rain']=='true' and before_reload['motion']=='true','Requested preferences did not take effect before reload')
    await expect(page.locator('#motion')).to_have_accessible_name('Resume animations')
    log.append({'checkpoint':'preferences-before-reload','state':before_reload})
    restored=await navigate(page,reload=True)
    assert_chess(restored,captured_board,['exd5'],'b','01')
    check(chess_state(restored)==chess_state(captured),'Reload failed to restore the saved capture snapshot')
    check(restored['studyVisible'] and restored['study']=='Tea on the sidelines','Reload lost the unfinished study')
    check(restored['portraits']==['Black pawn captured'] and restored['sidelines']==1,'Reload lost or duplicated the captured portrait')
    check(restored['atmosphere']=='dusk' and restored['weather']=='rain' and restored['rain']=='true' and restored['motion']=='true','Reload lost Moonlight, rain or paused animation preferences')
    await expect(page.get_by_role('button',name='Switch to morning light',exact=True)).to_contain_text('Moonlight')
    # Clear skies / Let it clear names the next action; pressed=true means rain is ON.
    await expect(page.get_by_role('button',name='Let it clear',exact=True)).to_have_attribute('aria-pressed','true')
    await expect(page.locator('#motion')).to_have_accessible_name('Resume animations')
    log.append({'checkpoint':'same-origin-reload-preserved-capture-and-preferences','state':restored})
    mark('undo-restored-capture')
    await page.get_by_role('button',name='Undo last turn',exact=True).click()
    await settled(page)
    undone=await page.evaluate(SNAPSHOT)
    assert_chess(undone,initial_board,[],'w','00')
    check(chess_state(undone)==chess_state(initial),'Undo did not restore the exact initial study chess state')
    check(undone['portraits']==[] and undone['sidelines']==0,'Undo left an obsolete captured portrait')
    check(undone['studyVisible'] and undone['study']=='Tea on the sidelines','Undo lost the study context')
    check(undone['atmosphere']=='dusk' and undone['weather']=='rain' and undone['rain']=='true' and undone['motion']=='true','Undo changed saved preferences')
    await expect(page.get_by_test_id('square-e4')).to_have_attribute('aria-label','e4, White pawn')
    await expect(page.get_by_test_id('square-e4')).to_have_attribute('aria-pressed','false')
    await expect(page.get_by_test_id('square-d5')).to_have_attribute('aria-label','d5, Black pawn')
    await expect(page.get_by_role('button',name='Undo last turn',exact=True)).to_be_disabled()
    await expect(page.locator('#capture-pageant .capture-pageant')).to_have_attribute('data-total-count','0')
    log.append({'checkpoint':'undo-after-reload-restored-both-pawns','state':undone})


asyncio.run(run_test())
