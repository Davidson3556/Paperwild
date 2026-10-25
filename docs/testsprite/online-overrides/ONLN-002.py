"""Strict hosted multiplayer acceptance through actual Paperwild controls.

Standalone TestSprite source: no local imports, seeded storage, API shortcuts,
application hooks, intercepted requests or synthetic server snapshots.
"""
import asyncio
import hashlib
import json
import os
import re
from urllib.parse import parse_qs, urlsplit
from playwright import async_api
from playwright.async_api import expect

TARGET = "https://paperwild.vercel.app/"
ORIGIN = '{0.scheme}://{0.netloc}'.format(urlsplit(TARGET))
BROWSER_ARGS = ['--window-size=1280,720', '--disable-dev-shm-usage', '--ipc=host', '--single-process']
PHASE = 'module-loaded'
PAGES = []
CONTEXTS = []
BROWSERS = []
LOG = []


class EnvironmentBlocked(RuntimeError):
    pass


SNAPSHOT = r"""() => {
 const many = selector => [...document.querySelectorAll(selector)];
 const s=document.querySelector('#game-status'), g=document.querySelector('.game-space');
 const p=document.querySelector('.capture-pageant'), r=document.querySelector('.online-request');
 const cast=many('.sketch-cast > .sketch-piece');
 const ready=e=>{const i=e.querySelector('.sketch-piece-art');return !!i && i.complete && i.naturalWidth>0 && !i.hidden;};
 return {
  board:Object.fromEntries(many('#board-access [data-testid^="square-"]').map(e=>[e.dataset.testid.slice(7),e.dataset.piece||''])),
  history:many('#move-history li:not(.history-empty)').flatMap(e=>[...e.querySelectorAll('span')].slice(1).map(n=>n.textContent.trim())).filter(n=>n && n!=='…' && n!=='—'),
  captures:document.querySelector('#bloom-count')?.textContent.trim(),
  fieldCaptures:document.querySelector('#field-capture-count')?.textContent.trim(),
  captureLabels:many('#bloom-display .bloom-token').map(e=>e.title),
  turn:s?.dataset.turn,over:s?.dataset.gameOver,moving:s?.dataset.moving,thinking:s?.dataset.thinking,
  entering:s?.dataset.entering,entryStage:s?.dataset.entryStage,opponentChosen:s?.dataset.opponentChosen,
  loader:!!document.querySelector('#paperwild-loading'),appInert:!!document.querySelector('#app')?.inert,
  boardInert:!!document.querySelector('#board-access')?.inert,busy:document.querySelector('#board-access')?.getAttribute('aria-busy'),
  folded:!!document.querySelector('.sketch-scene.is-folded'),fallback:!document.querySelector('#scene-fallback')?.hidden,
  online:g?.dataset.online,seat:g?.dataset.onlineSeat,revision:g?.dataset.onlineRevision,round:g?.dataset.onlineRound,
  connection:g?.dataset.onlineConnection,inSync:g?.dataset.onlineInSync,
  mode:document.querySelector('[data-mode][aria-pressed=true]')?.dataset.mode,
  residents:cast.length,readyArtwork:cast.filter(ready).length,
  skirmishes:many('[data-testid="capture-skirmish"]').length,
  departures:many('.sketch-departures > *').length,movingSprites:many('.sketch-cast > .is-moving').length,
  pageantPhase:p?.dataset.phase,pageantQueue:p?.dataset.queueCount,pageantTotal:p?.dataset.totalCount,memorials:p?.dataset.memorialCount,
  roomCode:document.querySelector('[data-testid="online-room-code"]')?.textContent.replace(/[\s·-]/g,''),
  friendSeatCopy:document.querySelectorAll('.online-seat')[1]?.textContent,
  request:r && !r.hidden ? r.dataset.kind : null,
  error:document.querySelector('.online-error')?.hidden ? '' : document.querySelector('.online-error')?.textContent,
  result:!!document.querySelector('#result-dialog[open]')
 };
}"""


def mark(value):
    global PHASE
    PHASE = value


def check(condition, message):
    if not condition:
        raise AssertionError(message)


def standard_board():
    board={file+str(rank):'' for rank in range(1,9) for file in 'abcdefgh'}
    for file,role in zip('abcdefgh','rnbqkbnr'):
        board[file+'1'],board[file+'2'],board[file+'7'],board[file+'8']='w'+role,'wp','bp','b'+role
    return board


def position(*moves):
    board=standard_board()
    for source,destination in moves:
        board[destination],board[source]=board[source],''
    return board


def chess_state(state):
    return {key:state[key] for key in ('board','history','captures','fieldCaptures','captureLabels','turn','over')}


def shared_state(state):
    return {**chess_state(state),**{key:state[key] for key in ('revision','round','roomCode')}}


def assert_position(state,board,history,turn,captures='00'):
    check(state['board']==board,'Complete 64-square board differs from expected position')
    check(state['history']==history,'Ordered SAN history differs from expected plies')
    check(state['turn']==turn and state['over']=='false','Turn or terminal state differs')
    check(state['captures']==captures and state['fieldCaptures']==captures,'Capture counts differ')
    check(state['residents']==sum(bool(p) for p in board.values()),'Illustrated resident count differs from occupied squares')
    check(state['readyArtwork']==state['residents'],'Some active watercolor characters are undecoded')
    check(not state['result'] and not state['fallback'],'Unexpected ending or fallback board')
    check(state['thinking']=='false','A computer is thinking during friend play')
    check(state['captureLabels']==(['Black pawn captured'] if captures=='01' else []),'Captured resident identity differs')


async def read(page,label=None):
    state=await page.evaluate(SNAPSHOT)
    if label:
        LOG.append({'checkpoint':label,'state':state})
    return state


async def new_player(browser_type,name):
    # Match the passing single-player runner bootstrap, but give each player
    # its own Chromium browser and exactly one fresh context/page. No browser
    # process, storage_state, cookies or seat credentials are shared.
    mark(name+'.chromium.launch')
    browser=await browser_type.launch(headless=True,args=BROWSER_ARGS)
    BROWSERS.append((name,browser))
    LOG.append({'checkpoint':'player-bootstrap','player':name,'stage':'browser-launched'})
    mark(name+'.browser.new_context')
    context=await browser.new_context(viewport={'width':1440,'height':1000},reduced_motion='no-preference')
    CONTEXTS.append((name,context))
    LOG.append({'checkpoint':'player-bootstrap','player':name,'stage':'fresh-context-created'})
    context.set_default_timeout(20000)
    mark(name+'.context.new_page')
    page=await context.new_page()
    PAGES.append((name,page))
    LOG.append({'checkpoint':'player-bootstrap','player':name,'stage':'page-created'})
    return context,page


async def notebook_ready(page):
    await page.wait_for_function("""() => {
      const s=document.querySelector('#game-status');
      return s?.dataset.entering==='false' && s.dataset.entryStage && s.dataset.entryStage!=='opening'
        && !document.querySelector('#paperwild-loading') && !document.querySelector('#app')?.inert;
    }""",timeout=40000)
    check('{0.scheme}://{0.netloc}'.format(urlsplit(page.url))==ORIGIN,'Navigation left the configured public frontend origin')


async def visit_fresh(page,url=None):
    mark('fresh-entry')
    await page.goto(url or TARGET,wait_until='commit',timeout=40000)
    await notebook_ready(page)
    await expect(page.locator('#onboarding-dialog')).to_be_visible()
    await expect(page.locator('#onboarding-dialog')).to_have_attribute('data-required','true')
    await page.locator('#onboarding-continue').click()


async def choose_first(page,mode):
    mark('explicit-first-choice-'+mode)
    await expect(page.locator('#new-game-dialog')).to_be_visible()
    await expect(page.locator('#new-game-dialog')).to_have_attribute('data-required','true')
    await expect(page.locator('input[name="new-opponent"]:checked')).to_have_count(0)
    await expect(page.locator('#confirm-new')).to_be_disabled()
    check((await read(page))['boardInert'],'Unconfirmed board is not inert')
    choice=page.locator('input[name="new-opponent"][value="'+mode+'"]')
    if mode=='online' and not await choice.is_enabled():
        raise EnvironmentBlocked('Hosted frontend has no configured online backend; multiplayer acceptance cannot run.')
    await choice.check()
    await page.locator('#confirm-new').click()
    if mode=='online':
        await expect(page.get_by_test_id('online-room-dialog')).to_be_visible()
    else:
        await settled(page,online=False)
        await expect(page.locator('[data-mode="'+mode+'"]')).to_have_attribute('aria-pressed','true')


async def settled(page,online=True):
    await notebook_ready(page)
    await page.wait_for_function("""online => {
      const s=document.querySelector('#game-status'),g=document.querySelector('.game-space'),b=document.querySelector('#board-access');
      const images=[...document.querySelectorAll('.sketch-cast > .sketch-piece .sketch-piece-art')];
      return s?.dataset.entryStage==='ready' && s.dataset.opponentChosen==='true' && !b?.inert
       && s.dataset.entering==='false' && s.dataset.moving==='false' && s.dataset.thinking==='false'
       && b?.getAttribute('aria-busy')==='false' && !document.querySelector('.sketch-scene.is-folded')
       && images.length>0 && images.every(i=>i.complete && i.naturalWidth>0 && !i.hidden)
       && (online ? g?.dataset.online==='true' && g.dataset.onlineConnection==='connected' && g.dataset.onlineInSync==='true' : g?.dataset.online==='false');
    }""",arg=online,timeout=35000)


async def close_room(page):
    if await page.get_by_test_id('online-room-dialog').is_visible():
        await page.get_by_role('button',name='Close online room',exact=True).click()
    if await page.locator('#field-options-dialog').is_visible():
        await page.get_by_role('button',name='Close field kit',exact=True).click()


async def open_room(page):
    if await page.get_by_test_id('online-room-dialog').is_visible():
        return
    if not await page.get_by_test_id('online-open').is_visible():
        await page.locator('#field-options').click()
    await page.get_by_test_id('online-open').click()
    await expect(page.get_by_test_id('online-room-dialog')).to_be_visible()


async def invite_from(page,from_local=False):
    mark('create-through-postcard')
    if from_local:
        await open_room(page)
    else:
        await choose_first(page,'online')
    await expect(page.get_by_test_id('online-create')).to_be_enabled()
    await page.get_by_test_id('online-create').click()
    await settled(page)
    state=await read(page,'host-created-waiting-room')
    assert_position(state,standard_board(),[],'w')
    check(state['seat']=='w' and state['revision']=='0' and state['round']=='0','Creator did not receive the first fresh White seat')
    await expect(page.locator('.online-permission')).to_contain_text('first move waits until both seats are taken')
    invite=await page.get_by_test_id('online-invitation-link').input_value()
    parsed=urlsplit(invite)
    params=parse_qs(parsed.query,keep_blank_values=True)
    check('{0.scheme}://{0.netloc}'.format(parsed)==ORIGIN and not parsed.fragment,'Invitation has another origin or a fragment')
    check(set(params)=={'room'} and len(params['room'])==1 and re.fullmatch(r'[A-HJ-NP-Z2-9]{12}',params['room'][0]),'Invitation must contain only one public room code')
    check(params['room'][0]==state['roomCode'],'Displayed room code and invitation differ')
    await close_room(page)
    return invite


async def pending_invite(page,invite):
    mark('fresh-invite-before-explicit-join')
    await visit_fresh(page,invite)
    await expect(page.get_by_test_id('online-room-dialog')).to_be_visible()
    code=await page.get_by_test_id('online-code-input').input_value()
    check(re.sub(r'[\s·-]','',code)==parse_qs(urlsplit(invite).query)['room'][0],'Invitation code did not survive first-visit onboarding')
    # Observe a real quiet interval: navigating an invitation must not claim a seat.
    for _ in range(5):
        state=await read(page)
        check(state['seat']=='' and state['online']=='false' and state['entryStage']=='invitation','Invitation automatically claimed or resumed a seat')
        check(state['boardInert'] and state['history']==[],'Invitation enabled chess before explicit Take a seat')
        await asyncio.sleep(.2)
    LOG.append({'checkpoint':'invite-prefilled-without-autojoin','state':state})


async def join_explicit(page):
    await expect(page.get_by_test_id('online-join')).to_be_enabled()
    await page.get_by_test_id('online-join').click()
    await settled(page)
    await close_room(page)


async def fresh_pair(browser):
    ca,a=await new_player(browser,'White')
    cb,b=await new_player(browser,'Black')
    await visit_fresh(a)
    invite=await invite_from(a)
    await pending_invite(b,invite)
    check((await read(a))['revision']=='0','Opening the invitation changed the host room before a join')
    await join_explicit(b)
    await agree(a,b,standard_board(),[],'w',1)
    return ca,a,cb,b,invite


async def agree(a,b,board,history,turn,revision,round_number=0,captures='00'):
    for page in (a,b):
        await page.wait_for_function("""expected => {
         const g=document.querySelector('.game-space');
         return g?.dataset.onlineRevision===String(expected.revision) && g.dataset.onlineRound===String(expected.round);
        }""",arg={'revision':revision,'round':round_number},timeout=35000)
        await settled(page)
    first,second=await asyncio.gather(read(a),read(b))
    for state in (first,second):
        assert_position(state,board,history,turn,captures)
        check(state['revision']==str(revision) and state['round']==str(round_number),'Shared revision/round differs')
        check(state['skirmishes']==0 and state['departures']==0 and state['movingSprites']==0,'Move left transient character residue')
    check(first['seat']=='w' and second['seat']=='b','Independent players did not keep distinct server-assigned seats')
    check(shared_state(first)==shared_state(second),'Two independent browsers did not converge to the identical shared game')
    LOG.append({'checkpoint':'both-snapshots-agree','history':history,'revision':revision,'round':round_number,'white':first,'black':second})
    return first,second


async def move(page,source,destination,online=True):
    mark('real-board-move-'+source+'-'+destination)
    await close_room(page)
    await settled(page,online=online)
    await page.get_by_test_id('square-'+source).click()
    await expect(page.get_by_test_id('square-'+source)).to_have_attribute('aria-pressed','true')
    await page.get_by_test_id('square-'+destination).click()


async def attempt(page,source,destination):
    mark('rejected-attempt-'+source+'-'+destination)
    await close_room(page)
    await page.get_by_test_id('square-'+source).click()
    await page.get_by_test_id('square-'+destination).click()
    await page.keyboard.press('Escape')


async def unchanged(a,b,before,seconds=1):
    deadline=asyncio.get_running_loop().time()+seconds
    while True:
        for page,expected in zip((a,b),before):
            state=await read(page)
            check(shared_state(state)==shared_state(expected),'A rejected or unconfirmed action changed the shared game/revision')
            check(state['seat']==expected['seat'],'A rejected action changed the player seat')
        if asyncio.get_running_loop().time()>=deadline:
            return
        await asyncio.sleep(.2)


async def ceremonies_finished(page):
    await page.wait_for_function("""() => {
      const p=document.querySelector('.capture-pageant');
      return p?.dataset.phase==='idle' && p.dataset.queueCount==='0' && p.dataset.totalCount==='1' && p.dataset.memorialCount==='1'
       && !document.querySelector('[data-testid="capture-skirmish"]') && !document.querySelector('.sketch-departures > *');
    }""",timeout=30000)


async def assert_request(page,kind,own):
    await open_room(page)
    await expect(page.locator('.online-request')).to_be_visible()
    await expect(page.locator('.online-request')).to_have_attribute('data-kind',kind)
    if own:
        await expect(page.get_by_test_id('online-request-cancel')).to_be_visible()
        await expect(page.get_by_test_id('online-request-accept')).not_to_be_visible()
        await expect(page.get_by_test_id('online-request-decline')).not_to_be_visible()
    else:
        await expect(page.get_by_test_id('online-request-cancel')).not_to_be_visible()
        await expect(page.get_by_test_id('online-request-accept')).to_be_enabled()
        await expect(page.get_by_test_id('online-request-decline')).to_be_enabled()


async def request(sender,receiver,kind):
    mark('request-'+kind)
    await open_room(sender)
    await sender.get_by_test_id('online-'+kind).click()
    await assert_request(sender,kind,True)
    await assert_request(receiver,kind,False)


async def respond(page,accept):
    await page.get_by_test_id('online-request-accept' if accept else 'online-request-decline').click()


async def no_requests(a,b):
    for page in (a,b):
        await expect(page.locator('.online-request')).not_to_be_visible()
        check((await read(page))['request'] is None,'An answered/cancelled request remained active')


async def run_test():
    pw=None
    original=None
    cleanup_errors=[]
    try:
        mark('playwright-start')
        pw=await async_api.async_playwright().start()
        LOG.append({'checkpoint':'playwright-started'})
        await asyncio.wait_for(exercise(pw.chromium),timeout=300)
    except BaseException as error:
        original=error
        failure_phase=PHASE
    finally:
        for name,page in PAGES:
            if not page.is_closed():
                try:
                    LOG.append({'checkpoint':'final-'+name,'state':await asyncio.wait_for(read(page),timeout=3)})
                except Exception as error:
                    cleanup_errors.append({'operation':'final-'+name,'type':type(error).__name__})
        # Close every context before any browser, including partially bootstrapped
        # players. Keep trying the remaining resources if one cleanup fails.
        for name,context in reversed(CONTEXTS):
            try:
                await asyncio.wait_for(context.close(),timeout=5)
                LOG.append({'checkpoint':'player-cleanup','player':name,'stage':'context-closed'})
            except Exception as error:
                cleanup_errors.append({'operation':name+'.context.close','type':type(error).__name__})
        for name,browser in reversed(BROWSERS):
            try:
                await asyncio.wait_for(browser.close(),timeout=5)
                LOG.append({'checkpoint':'player-cleanup','player':name,'stage':'browser-closed'})
            except Exception as error:
                cleanup_errors.append({'operation':name+'.browser.close','type':type(error).__name__})
        if pw is not None:
            try:
                await asyncio.wait_for(pw.stop(),timeout=5)
            except Exception as error:
                cleanup_errors.append({'operation':'playwright.stop','type':type(error).__name__})
        # No cookies, storage dumps, network traces, seat tokens or backend keys.
        report={'case':CASE_ID,'target':TARGET,'status':'blocked' if isinstance(original,EnvironmentBlocked) else 'passed' if original is None and not cleanup_errors else 'failed',
                'originalException':None if original is None else {'phase':failure_phase,'type':type(original).__name__,'message':str(original)[:2500]},
                'cleanupErrors':cleanup_errors,'evidence':LOG}
        print(json.dumps(report,separators=(',',':'),allow_nan=False))
    if original is not None:
        if isinstance(original,(KeyboardInterrupt,SystemExit,asyncio.CancelledError)):
            raise original
        raise RuntimeError(f'{CASE_ID} phase={failure_phase}; {type(original).__name__}: {str(original)[:2000]}') from original
    if cleanup_errors:
        raise RuntimeError(CASE_ID+' runner cleanup failed: '+str(cleanup_errors[0]))


CASE_ID='ONLN-002'


async def exercise(browser):
    _,a,_,b,_=await fresh_pair(browser)
    await move(a,'e2','e4')
    one=position(('e2','e4'))
    await agree(a,b,one,['e4'],'b',2)
    await move(b,'e7','e5')
    two=position(('e2','e4'),('e7','e5'))
    await agree(a,b,two,['e4','e5'],'w',3)

    await request(a,b,'undo')
    before=await agree(a,b,two,['e4','e5'],'w',4)
    await unchanged(a,b,before)
    await respond(b,False)
    await agree(a,b,two,['e4','e5'],'w',5)
    await no_requests(a,b)
    await request(a,b,'undo')
    before=await agree(a,b,two,['e4','e5'],'w',6)
    await unchanged(a,b,before,.5)
    await respond(b,True)
    await agree(a,b,one,['e4'],'b',7)
    await no_requests(a,b)

    await request(b,a,'undo')
    await agree(a,b,one,['e4'],'b',8)
    await b.get_by_test_id('online-request-cancel').click()
    before=await agree(a,b,one,['e4'],'b',9)
    await no_requests(a,b)
    await unchanged(a,b,before)

    await request(b,a,'rematch')
    before=await agree(a,b,one,['e4'],'b',10)
    await unchanged(a,b,before,.5)
    await respond(a,False)
    await agree(a,b,one,['e4'],'b',11)
    await no_requests(a,b)
    await request(b,a,'rematch')
    await agree(a,b,one,['e4'],'b',12)
    await respond(a,True)
    await agree(a,b,standard_board(),[],'w',13,round_number=1)
    await no_requests(a,b)
    await move(a,'d2','d4')
    before=await agree(a,b,position(('d2','d4')),['d4'],'b',14,round_number=1)
    await unchanged(a,b,before)


asyncio.run(run_test())
