"""Strict stored-code repair for legacy Board Play tests.

Uses only real UI actions and read-only DOM observations. Waits for notebook,
pencil entry and locomotion before chess input. No app, timer or storage injection.
Original generated exports remain in the external legacy failure evidence folder.
"""
import asyncio
import json
import os
import re
from urllib.parse import urlsplit
from playwright import async_api
from playwright.async_api import expect

TARGET = "__PAPERWILD_CI_TARGET_URL__"
_target = urlsplit(TARGET)
if (_target.scheme != 'https' or not re.fullmatch(
        r'paperwild(?:-ci)?-[a-z0-9]{9}-davidson3556s-projects\.vercel\.app', _target.netloc)
        or _target.path not in ('', '/') or _target.query or _target.fragment):
    raise RuntimeError('Bind this replay to a verified unique CI HTTPS deployment before execution.')
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
   boardInert: !!document.querySelector('#board-access')?.inert,
   entryStage: status?.dataset.entryStage, opponentChosen: status?.dataset.opponentChosen, guideSeen: status?.dataset.guideSeen,
   guide: !!document.querySelector('#onboarding-dialog[open]'),
   choice: !!document.querySelector('#new-game-dialog[open]'),
   required: document.querySelector('#new-game-dialog')?.dataset.required,
   checked: [...document.querySelectorAll('input[name="new-opponent"]:checked')].map(p=>p.value),
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


async def notebook_ready(page):
    await page.wait_for_function("""() => {
      const s=document.querySelector('#game-status');
      return s?.dataset.entering==='false' && s.dataset.entryStage && s.dataset.entryStage!=='opening'
        && !document.querySelector('#paperwild-loading') && !document.querySelector('#app')?.inert;
    }""", timeout=30000)
    check('{0.scheme}://{0.netloc}'.format(urlsplit(page.url))==ORIGIN, 'Navigation left the configured target origin')


async def required_choice(page):
    await expect(page.locator('#new-game-dialog')).to_be_visible()
    await expect(page.locator('#new-game-dialog')).to_have_attribute('data-required','true')
    await expect(page.locator('input[name="new-opponent"]:checked')).to_have_count(0)
    await expect(page.locator('#confirm-new')).to_be_disabled()
    await expect(page.locator('#new-game-close')).to_be_hidden()
    await expect(page.locator('#new-game-cancel')).to_be_hidden()
    await expect(page.locator('#game-status')).to_have_attribute('data-entry-stage','choice')
    await expect(page.locator('#game-status')).to_have_attribute('data-opponent-chosen','false')
    check(await page.locator('#board-access').evaluate('(el) => el.inert'), 'Unchosen board is not inert')
    state=await page.evaluate(SNAPSHOT)
    check(state['board']==standard_board() and state['history']==[] and state['turn']=='w' and state['captures']=='00' and state['over']=='false', 'Required choice changed the initial chess state')
    return state


async def choose_first_opponent(page, mode):
    await required_choice(page)
    await page.locator('input[name="new-opponent"][value="'+mode+'"]').check()
    await expect(page.locator('#confirm-new')).to_be_enabled()
    await page.locator('#confirm-new').click()
    await settled(page)
    await expect(page.locator('[data-mode="'+mode+'"]')).to_have_attribute('aria-pressed','true')


async def settled(page):
    await notebook_ready(page)
    global RUN_PHASE
    RUN_PHASE = 'wait-entry-and-chess-settlement'
    await page.wait_for_function("""() => {
      const s=document.querySelector('#game-status'),b=document.querySelector('#board-access');
      return s?.dataset.entryStage==='ready' && s.dataset.opponentChosen==='true' && !b?.inert
        && s.dataset.entering==='false' && s.dataset.moving==='false' && s.dataset.thinking==='false'
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
        await notebook_ready(page)
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


CASE_ID = 'ONBD-002'


async def exercise(page, log):
    await expect(page.locator('#onboarding-dialog')).to_be_visible()
    # The visible skip button, like Escape, advances to a required explicit choice.
    await page.locator('#onboarding-skip').click()
    await choose_first_opponent(page,'computer')
    initial=await snapshot(page,log,'explicit-club-choice')
    assert_position(initial,standard_board(),[],'w')
    await move(page,'e2','e4')
    await page.wait_for_function("""() => {
      const s=document.querySelector('#game-status');
      const plies=[...document.querySelectorAll('#move-history li:not(.history-empty)')].flatMap(row=>[...row.querySelectorAll('span')].slice(1).map(p=>p.textContent.trim())).filter(p=>p&&p!=='…'&&p!=='—');
      return s?.dataset.turn==='w' && s.dataset.moving==='false' && s.dataset.thinking==='false' && plies.length===2;
    }""",timeout=15000)
    before=await snapshot(page,log,'club-completed-one-reply')
    check(len(before['history'])==2 and before['history'][0]=='e4' and before['turn']=='w' and before['mode']=='computer', 'Club choice did not produce exactly one completed reply')
    pending=standard_board();pending['e2']='';pending['e4']='wp'
    legal_replies=[]
    for file in 'abcdefgh':
        for rank in ('6','5'):
            board=dict(pending);board[file+'7']='';board[file+rank]='bp'
            legal_replies.append((file+rank,board))
    for source,destination in [('b8','a6'),('b8','c6'),('g8','f6'),('g8','h6')]:
        board=dict(pending);board[source]='';board[destination]='bn'
        legal_replies.append(('N'+destination,board))
    check(any(before['history'][1]==san and before['board']==board for san,board in legal_replies),'Club SAN and complete board do not agree on a legal Black reply')
    check(before['captures']=='00' and before['over']=='false','Opening unexpectedly changed captures or ended the game')
    # The replay is a map, not a fresh game or an invitation to reset.
    await page.locator('#help').click()
    await page.locator('#replay-onboarding').click()
    await expect(page.locator('#onboarding-dialog')).to_be_visible()
    await expect(page.locator('#onboarding-dialog')).to_have_attribute('data-required','false')
    await expect(page.locator('#onboarding-continue')).to_have_text('Back to my game')
    during=await page.evaluate(SNAPSHOT)
    check(during['boardInert'] and chess_state(during)==chess_state(before), 'Replay guide changed the existing game or left input active')
    await page.keyboard.press('Escape')
    await settled(page)
    after=await snapshot(page,log,'replay-tour-returned')
    check(chess_state(after)==chess_state(before) and after['mode']=='computer', 'Returning from the guide reset or changed the game')
    await expect(page.locator('#new-game-dialog')).not_to_be_visible()

    control=page.locator('#new-game')
    if not await control.is_visible():
        await page.locator('#field-options').click()
    await control.click()
    await expect(page.locator('#new-game-dialog')).to_be_visible()
    await expect(page.locator('#new-game-dialog')).to_have_attribute('data-required','false')
    await expect(page.locator('input[name="new-opponent"][value="computer"]')).to_be_checked()
    await expect(page.locator('#confirm-new')).to_be_enabled()
    check(chess_state(await page.evaluate(SNAPSHOT))==chess_state(before), 'Opening optional new-game choices replaced the current game')
    await page.locator('#new-game-cancel').click()
    await settled(page)
    canceled=await snapshot(page,log,'optional-new-game-canceled')
    check(chess_state(canceled)==chess_state(before) and canceled['mode']=='computer','Keeping this page did not preserve the original game')
    await asyncio.sleep(2)
    check(chess_state(await page.evaluate(SNAPSHOT))==chess_state(before),'Tour/canceled chooser left a delayed computer reply')


asyncio.run(run_test())
