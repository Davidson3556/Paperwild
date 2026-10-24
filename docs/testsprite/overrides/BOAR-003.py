"""Strict stored-code repair for legacy Board Play tests.

Uses only real UI actions and read-only DOM observations. Waits for notebook,
pencil entry and locomotion before chess input. No app, timer or storage injection.
Original generated exports remain in the external legacy failure evidence folder.
"""
import asyncio
import json
import os
from urllib.parse import urlsplit
from playwright import async_api
from playwright.async_api import expect

TARGET = os.environ.get('TEST_TARGET_URL', 'https://paperwild-git-feat-convex-multiplayer-davidson3556s-projects.vercel.app/')
ORIGIN = '{0.scheme}://{0.netloc}'.format(urlsplit(TARGET))
BROWSER_ARGS = ['--window-size=1280,720', '--disable-dev-shm-usage', '--ipc=host', '--single-process']
RUN_PHASE = 'module-loaded'

SNAPSHOT = r"""() => {
 const many = selector => [...document.querySelectorAll(selector)];
 const status = document.querySelector('#game-status');
 const cast = many('.sketch-cast > .sketch-piece');
 const ready = p => {const i=p.querySelector('.sketch-piece-art');return !!i && i.complete && i.naturalWidth>0 && !i.hidden;};
 const historyRows = many('#move-history li:not(.history-empty)');
 return {
   board: Object.fromEntries(many('#board-access [data-testid^="square-"]').map(p=>[p.dataset.testid.slice(7),p.dataset.piece||''])),
   history: historyRows.flatMap(row=>[...row.querySelectorAll('span')].slice(1).map(s=>s.textContent.trim())).filter(s=>s && s!=='…' && s!=='—'),
   historyRows: historyRows.length,
   captures: document.querySelector('#bloom-count')?.textContent.trim(),
   fieldCaptures: document.querySelector('#field-capture-count')?.textContent.trim(),
   turn: status?.dataset.turn, over: status?.dataset.gameOver,
   entering: status?.dataset.entering, moving: status?.dataset.moving, thinking: status?.dataset.thinking,
   busy: document.querySelector('#board-access')?.getAttribute('aria-busy'),
   mode: document.querySelector('[data-mode][aria-pressed=true]')?.dataset.mode,
   undoDisabled: document.querySelector('#undo')?.disabled,
   exportDisabled: document.querySelector('#export')?.disabled,
   residents: cast.length, readyArtwork: cast.filter(ready).length,
   decodedKinds: [...new Set(cast.filter(ready).map(p=>p.querySelector('.character-face')?.dataset.character))].sort(),
   selected: Object.fromEntries(many('#board-access [data-testid^="square-"]').map(p=>[p.dataset.testid.slice(7),p.getAttribute('aria-pressed')])),
   capturedPortraits: many('#bloom-display .character-portrait').map(p=>({color:p.dataset.color,character:p.querySelector('.character-face')?.dataset.character,ready:ready(p)})),
   sidelines: many('.sketch-sideline-piece').map(p=>({color:p.dataset.color,src:p.querySelector('img')?.getAttribute('src')})),
   departures: many('.sketch-departures > *').length,
   movingSprites: many('.sketch-cast > .is-moving').length,
   loader: !!document.querySelector('#paperwild-loading'), appInert: !!document.querySelector('#app')?.inert,
   folded: !!document.querySelector('.sketch-scene.is-folded'), intro: document.querySelector('.sketch-scene')?.dataset.intro,
   result: !!document.querySelector('#result-dialog[open]'),
   fallback: !document.querySelector('#scene-fallback')?.hidden,
   scripts: many('script[src]').map(s=>s.src)
 };
}"""


def check(condition, message):
    if not condition:
        raise AssertionError(message)


def standard_board():
    board = {file+str(rank): '' for rank in range(1,9) for file in 'abcdefgh'}
    for file,role in zip('abcdefgh','rnbqkbnr'):
        board[file+'1'],board[file+'2'],board[file+'7'],board[file+'8']='w'+role,'wp','bp','b'+role
    return board


def chess_state(snapshot):
    # Selection/focus/hover intentionally do not belong to game-state equality.
    return {key:snapshot[key] for key in ('board','history','captures','fieldCaptures','turn','over')}


def assert_ready(snapshot):
    check(not snapshot['loader'] and not snapshot['appInert'] and not snapshot['folded'], 'Loading/inert/folded residue remains')
    check(snapshot['entering']=='false' and snapshot['intro']=='ready' and snapshot['busy']=='false', 'Board entry/busy state is not ready')
    check(snapshot['moving']=='false' and snapshot['thinking']=='false', 'Chess movement or computer thinking is still active')
    check(len(snapshot['board'])==64 and not snapshot['fallback'], 'Expected 64 illustrated semantic squares')
    check(snapshot['residents']==snapshot['readyArtwork'], 'Some current watercolor residents have not decoded')
    check(snapshot['movingSprites']==0 and snapshot['departures']==0, 'Movement/departure residue remains')


def assert_position(snapshot, board, history, turn, captures='00'):
    assert_ready(snapshot)
    check(snapshot['board']==board, 'Exact 64-square position does not match expected position')
    check(snapshot['history']==history, 'Ordered SAN history does not match expected plies')
    check(snapshot['turn']==turn and snapshot['over']=='false', 'Turn/terminal status mismatch')
    check(snapshot['captures']==captures and snapshot['fieldCaptures']==captures, 'Capture counts disagree with expected state')
    check(snapshot['residents']==sum(bool(value) for value in board.values()), 'Active resident count does not match occupied squares')
    check(not snapshot['result'], 'Unexpected result dialog')


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


async def settled(page):
    await complete_first_entry(page)
    global RUN_PHASE
    RUN_PHASE = 'wait-entry-and-chess-settlement'
    await page.wait_for_function("""() => {
      const s=document.querySelector('#game-status'),b=document.querySelector('#board-access');
      return s?.dataset.entering==='false' && s.dataset.moving==='false' && s.dataset.thinking==='false'
        && b?.getAttribute('aria-busy')==='false' && !document.querySelector('#paperwild-loading')
        && !document.querySelector('#app')?.inert && !document.querySelector('.sketch-scene.is-folded');
    }""", timeout=30000)
    check('{0.scheme}://{0.netloc}'.format(urlsplit(page.url))==ORIGIN, 'Execution changed the configured target origin')


async def snapshot(page, log, label):
    await settled(page)
    # A restored resident can be created in the same render that clears busy.
    # Wait for real image readiness instead of sampling that decode boundary.
    await page.wait_for_function("""() => {
      const images=[...document.querySelectorAll('.sketch-cast > .sketch-piece .sketch-piece-art, #bloom-display .character-portrait .sketch-piece-art, .sketch-sideline-piece .sketch-piece-art')];
      return images.length>0 && images.every(i=>i.complete && i.naturalWidth>0 && !i.hidden);
    }""",timeout=15000)
    state=await page.evaluate(SNAPSHOT)
    log.append({'checkpoint':label,'state':state})
    return state


async def local_mode(page):
    global RUN_PHASE
    RUN_PHASE = 'select-local-mode'
    control=page.locator('[data-mode="local"]')
    opened=False
    if not await control.is_visible():
        await page.locator('#field-options').click()
        opened=True
    await control.click()
    if opened:
        await page.get_by_role('button',name='Close field kit',exact=True).click()
    await expect(control).to_have_attribute('aria-pressed','true')
    await settled(page)


async def move(page, source, destination):
    global RUN_PHASE
    await settled(page)
    RUN_PHASE = 'select-'+source
    await page.get_by_test_id('square-'+source).click()
    await expect(page.get_by_test_id('square-'+source)).to_have_attribute('aria-pressed','true')
    RUN_PHASE = 'move-'+source+'-'+destination
    await page.get_by_test_id('square-'+destination).click()
    await settled(page)


async def run_test():
    global RUN_PHASE
    pw=browser=context=page=None
    log=[]
    primary=failure_phase=None
    cleanup_errors=[]
    try:
        RUN_PHASE='playwright.start'
        pw=await async_api.async_playwright().start()
        RUN_PHASE='chromium.launch'
        browser=await pw.chromium.launch(headless=True,args=BROWSER_ARGS)
        RUN_PHASE='browser.new_context'
        context=await browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='no-preference')
        context.set_default_timeout(20000)
        RUN_PHASE='context.new_page'
        page=await context.new_page()
        RUN_PHASE='page.goto'
        await page.goto(TARGET,wait_until='commit',timeout=30000)
        await settled(page)
        await asyncio.wait_for(exercise(page,log),timeout=150)
    except BaseException as error:
        primary=error
        failure_phase=RUN_PHASE
    finally:
        if page is not None and not page.is_closed():
            try:
                state=await asyncio.wait_for(page.evaluate(SNAPSHOT),timeout=2)
                log.append({'checkpoint':'final-evidence','url':page.url,'state':state})
            except Exception as error:
                cleanup_errors.append({'operation':'capture-evidence','type':type(error).__name__,'message':str(error)[:1200]})
        for name,resource in [('context.close',context),('browser.close',browser)]:
            if resource is not None:
                try:
                    await asyncio.wait_for(resource.close(),timeout=5)
                except Exception as error:
                    cleanup_errors.append({'operation':name,'type':type(error).__name__,'message':str(error)[:1200]})
        if pw is not None:
            try:
                await asyncio.wait_for(pw.stop(),timeout=5)
            except Exception as error:
                cleanup_errors.append({'operation':'playwright.stop','type':type(error).__name__,'message':str(error)[:1200]})
        report={'case':CASE_ID,'status':'passed' if primary is None and not cleanup_errors else 'failed','target':TARGET,
                'originalException':None if primary is None else {'phase':failure_phase,'type':type(primary).__name__,'message':str(primary)},
                'cleanupErrors':cleanup_errors,'evidence':log}
        try:
            print(json.dumps(report,separators=(',',':'),allow_nan=False))
        except Exception as error:
            cleanup_errors.append({'operation':'print-evidence','type':type(error).__name__,'message':str(error)[:1200]})
    if primary is not None:
        if isinstance(primary,(KeyboardInterrupt,SystemExit,asyncio.CancelledError)):
            raise primary
        raise RuntimeError(f'{CASE_ID} phase={failure_phase}; original {type(primary).__name__}: {str(primary)[:2500]}') from primary
    if cleanup_errors:
        first=cleanup_errors[0]
        raise RuntimeError(f'{CASE_ID} assertions completed but runner/evidence cleanup failed: {first["operation"]}: {first["type"]}: {first["message"]}')


CASE_ID = 'BOAR-003'


async def exercise(page,log):
    global RUN_PHASE
    # At desktop the study control is already visible outside the Field kit.
    studies=page.locator('#studies')
    if not await studies.is_visible():
        await page.locator('#field-options').click()
    RUN_PHASE='open-capture-study'
    await studies.click()
    await page.locator('[data-study="bloom"]').click()
    initial=await snapshot(page,log,'capture-study-preselected')
    expected=standard_board()
    expected['e2'],expected['e4'],expected['d7'],expected['d5']='','wp','','bp'
    assert_position(initial,expected,[],'w')
    check(initial['selected']['e4']=='true','Capture study must initially preselect its White e4 pawn')
    check(initial['undoDisabled'] and initial['exportDisabled'],'Study with no recorded plies should disable Undo/PGN export')
    before=chess_state(initial)

    # The study preselects e4; clicking it again would deselect it.
    RUN_PHASE='capture-preselected-e4-d5'
    await page.get_by_test_id('square-d5').click()
    captured=await snapshot(page,log,'settled-capture')
    expected['e4'],expected['d5']='','wp'
    assert_position(captured,expected,['exd5'],'b','01')
    check(len(captured['capturedPortraits'])==1 and captured['capturedPortraits'][0]=={'color':'b','character':'bp','ready':True},'Expected exactly one decoded captured Black pawn portrait')
    check(len(captured['sidelines'])==1 and captured['sidelines'][0]['color']=='b' and captured['sidelines'][0]['src'].endswith('/bp.png'),'Expected exactly one corresponding Black pawn sideline')
    check(not captured['undoDisabled'] and not captured['exportDisabled'],'Captured move should enable Undo and PGN export')
    check(await page.locator('.sketch-cast > .sketch-piece[data-square="d5"]').count()==1,'A duplicate active resident remains at d5')

    RUN_PHASE='undo-settled-capture'
    await page.get_by_role('button',name='Undo last turn',exact=True).click()
    restored=await snapshot(page,log,'capture-undo-restored')
    check(chess_state(restored)==before,'Undo did not atomically restore all64 squares, SAN history, captures, turn and terminal status')
    check(restored['selected']['e4']=='false' and all(value=='false' for value in restored['selected'].values()),'Undo must clear selection rather than restore study preselection')
    check(not restored['capturedPortraits'] and not restored['sidelines'] and restored['departures']==0,'Undo left captured portraits, sidelines or departing flights')
    check(restored['residents']==32 and restored['undoDisabled'] and restored['exportDisabled'],'Undo did not restore resident/control counts')
    await asyncio.sleep(2)
    stable=await snapshot(page,log,'undo-remains-restored')
    check(chess_state(stable)==before and not stable['capturedPortraits'] and not stable['sidelines'],'Delayed capture feedback changed the restored position')


asyncio.run(run_test())
