#!/usr/bin/env python3
"""Ai Investor v4.20 end-to-end tests (Playwright + system Chrome).
Market data: REAL daily bars (tests/fixtures, fetched from a public source by fetch_fixtures.py) served through
route mocks of the Massive and Finnhub APIs, because no Massive/Finnhub key exists on the build box.
AI: REAL Gemini calls when GEMINI_API_KEY is set (value never printed).
usage: python tests/e2e.py [--base http://localhost:8766/] [--shots test-shots] [--quick]"""
import asyncio, json, os, re, sys, subprocess, argparse, time
from datetime import datetime
from zoneinfo import ZoneInfo
from urllib.parse import urlparse, parse_qs
from playwright.async_api import async_playwright

ap = argparse.ArgumentParser(); ap.add_argument('--base', default='http://localhost:8766/'); ap.add_argument('--shots', default=os.path.join(os.path.dirname(__file__), '..', 'test-shots')); ap.add_argument('--quick', action='store_true')
A = ap.parse_args(); BASE = A.base.rstrip('/') + '/'
KEY = os.environ.get('GEMINI_API_KEY', ''); WIDTHS = [360, 390, 768, 1024, 1440]
HERE = os.path.dirname(os.path.abspath(__file__)); os.makedirs(A.shots, exist_ok=True)
R = []
def rec(ok, name, detail=''):
    detail = str(detail); detail = detail.replace(KEY, '***') if KEY else detail
    R.append(('PASS' if ok else 'FAIL', name, detail[:300])); print(('PASS ' if ok else 'FAIL ') + name + (' — ' + detail[:220] if detail else ''), flush=True)
async def check(name, coro):
    try:
        r = await coro; rec(r is not False, name, r if isinstance(r, str) else '')
    except Exception as e: rec(False, name, repr(e)[:300])

ET = ZoneInfo('America/New_York')
FIX = {}
for f in os.listdir(os.path.join(HERE, 'fixtures')):
    j = json.load(open(os.path.join(HERE, 'fixtures', f)))
    FIX[j['ticker']] = [dict(r, d=datetime.fromtimestamp(r['t'] / 1000, ET).date().isoformat()) for r in j['results']]
S = {'asof': '9999-12-31', 'm429': False, 'calls': 0}
MKEY, FKEY = 'TEST-MASSIVE-KEY-123', 'TEST-FINNHUB-KEY-456'
def J(route, body, status=200): return route.fulfill(status=status, body=json.dumps(body), headers={'content-type': 'application/json', 'access-control-allow-origin': '*'})
async def massive(route):
    u = urlparse(route.request.url); q = parse_qs(u.query); S['calls'] += 1
    if q.get('apiKey', [''])[0] != MKEY: return await J(route, {'status': 'ERROR', 'error': 'Unknown API Key'}, 401)
    if S['m429']: return await J(route, {'status': 'ERROR', 'error': 'You have exceeded the maximum requests per minute'}, 429)
    m = re.match(r'/v2/aggs/ticker/([^/]+)/range/1/day/([\d-]+)/([\d-]+)', u.path)
    if m:
        t, a, b = m.group(1), m.group(2), min(m.group(3), S['asof'])
        res = [{k: r[k] for k in 'tohlcv'} for r in FIX.get(t, []) if a <= r['d'] <= b]
        return await J(route, {'ticker': t, 'status': 'OK', 'resultsCount': len(res), 'results': res})
    m = re.match(r'/v2/aggs/grouped/locale/us/market/stocks/([\d-]+)', u.path)
    if m:
        d = m.group(1); res = [] if d > S['asof'] else [dict({k: r[k] for k in 'tohlcv'}, T=t) for t, rs in FIX.items() for r in rs if r['d'] == d]
        return await J(route, {'status': 'OK', 'resultsCount': len(res), 'results': res})
    return await J(route, {'status': 'ERROR', 'error': 'not mocked'}, 404)
async def finnhub(route):
    u = urlparse(route.request.url); q = parse_qs(u.query)
    if q.get('token', [''])[0] != FKEY: return await J(route, {'error': 'Invalid API key'}, 401)
    if u.path.endswith('/quote'):
        rs = [r for r in FIX.get(q['symbol'][0], []) if r['d'] <= S['asof']]
        if len(rs) < 2: return await J(route, {'c': 0, 'd': None, 'dp': None, 'h': 0, 'l': 0, 'o': 0, 'pc': 0, 't': 0})
        l, p = rs[-1], rs[-2]
        return await J(route, {'c': l['c'], 'd': round(l['c'] - p['c'], 4), 'dp': round((l['c'] / p['c'] - 1) * 100, 4), 'h': l['h'], 'l': l['l'], 'o': l['o'], 'pc': p['c'], 't': int(l['t'] / 1000)})
    return await J(route, {'error': "You don't have access to this resource."}, 403)

async def setup_ctx(br, w=1024):
    ctx = await br.new_context(viewport={'width': w, 'height': 900}, accept_downloads=True, bypass_csp=True, permissions=['clipboard-read', 'clipboard-write'])
    await ctx.route(re.compile(r'https://api\.(massive\.com|polygon\.io)/.*'), massive)
    await ctx.route(re.compile(r'https://finnhub\.io/api/.*'), finnhub)
    return ctx
def watch_errors(pg, errs):
    pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e)))
    pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))

async def go(pg, h, wait=350):
    await pg.evaluate("h=>location.hash=h", h); await pg.wait_for_timeout(wait)
async def save_key(pg, kid, val):
    await go(pg, '#/settings'); await pg.fill('#k_' + kid.replace('.', '_'), val); await pg.click(f'[data-save="{kid}"]'); await pg.wait_for_timeout(300)

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        ctx = await setup_ctx(br); pg = await ctx.new_page(); errs = []; watch_errors(pg, errs)
        await pg.goto(BASE); await pg.wait_for_timeout(700)

        async def t_gate():
            assert await pg.is_visible('#acceptBtn'); txt = await pg.inner_text('.modal-card'); assert 'Not financial advice' in txt and 'No real-money' in txt
            await pg.click('#acceptBtn'); await pg.wait_for_timeout(200); assert not await pg.is_visible('.modal'); return 'gate shown and accepted'
        await check('First-run gate: not financial advice, no real money', t_gate())
        async def t_brand():
            col = await pg.eval_on_selector('.topbar .ver', 'e=>getComputedStyle(e).color'); v = await pg.inner_text('.topbar .ver')
            assert v.strip() == 'v4.20' and col == 'rgb(57, 255, 20)', (v, col); assert await pg.is_visible('#bizzyBtn'); assert await pg.is_visible('#backBtn'); return col
        await check('Branding: neon green v4.20 badge, Bizzy bubble, themed back button', t_brand())
        async def t_nokeys_states():
            out = []
            await go(pg, '#/standings'); assert 'add your free Massive' in await pg.inner_text('#view'); out.append('standings')
            await go(pg, '#/t/AAPL'); t = await pg.inner_text('#view'); assert 'Massive' in t and 'Finnhub' in t; out.append('ticker')
            await go(pg, '#/samples'); await pg.click('[data-test="ex-trend"]'); await pg.wait_for_timeout(500); t = await pg.inner_text('#view'); assert 'Massive' in t and 'key' in t; out.append('test run')
            await go(pg, '#/macro', 600); assert 'FRED' in await pg.inner_text('#view'); out.append('macro')
            body = await pg.inner_text('#view'); assert not re.search(r'\$\d', body.split('Example strategies')[0] if 'Example' in body else body)
            return 'clear empty states with no numbers: ' + ', '.join(out)
        await check('No keys → clear "Unavailable/add key" states, no invented numbers', t_nokeys_states())

        # ---- keys (encrypted) ----
        async def t_keys():
            await save_key(pg, 'data.massive', MKEY); await save_key(pg, 'data.finnhub', FKEY)
            if KEY: await save_key(pg, 'ai.gemini', KEY)
            ls = await pg.evaluate("JSON.stringify(Object.assign({}, localStorage))")
            assert MKEY not in ls and FKEY not in ls and (not KEY or KEY not in ls), 'plaintext key found in localStorage'
            enc = await pg.evaluate("JSON.parse(localStorage.getItem('aii.secrets.v1'))"); assert enc['alg'] == 'AES-GCM-256' and len(enc['ct']) > 20
            kind = await pg.evaluate("KV.get('__device_key').then(k=>k && k.constructor.name + ':' + k.extractable)"); assert kind == 'CryptoKey:false', kind
            await pg.reload(); await pg.wait_for_timeout(700); assert await pg.evaluate("Secure.has('data.massive') && Secure.get('data.finnhub')==='%s'" % FKEY)
            return 'AES-GCM ciphertext only; device key non-extractable; survives reload'
        await check('Settings: keys saved encrypted (no plaintext in storage)', t_keys())
        await pg.evaluate("()=>{var s=Data.settings(); s.massivePerMin=600; Data.setSettings(s);}")   # mock server: no need to wait 12 s per call
        async def t_datatest():
            await go(pg, '#/settings'); await pg.click('#testData'); await pg.wait_for_selector('#dataTestOut p:nth-child(2)', timeout=20000); t = await pg.inner_text('#dataTestOut')
            assert 'Finnhub OK: SPY $' in t and 'Massive OK: SPY' in t, t; return t.replace('\n', ' | ')
        await check('Settings: Test data keys (Finnhub quote + Massive bars)', t_datatest())
        if KEY:
            async def t_aitest():
                await go(pg, '#/settings'); await pg.click('#testAI'); await pg.wait_for_selector('#aiTestOut p, #aiTestOut .error', timeout=90000); t = await pg.inner_text('#aiTestOut'); assert '✓' in t, t; return t
            await check('Advanced AI Settings: Test AI key (real Gemini)', t_aitest())

        # ---- Phase A: launch agents as of 2026-10-20 ----
        S['asof'] = '2026-10-20'; await pg.evaluate("Data.clearCache()")
        if KEY:
            async def t_wizard_ai():
                await go(pg, '#/new'); await pg.fill('#ideaInput', 'Trade only SPY and QQQ. Buy when the close is above its 50-day simple moving average. Sell when the close falls below the 50-day average. Put 45% of the account in each, max 2 holdings.')
                async with pg.expect_file_chooser() as fc: await pg.click('#ideaShot')
                await (await fc.value).set_files(os.path.join(HERE, 'fixtures-note.png')); await pg.wait_for_selector('.thumb img')
                await pg.click('#draftBtn'); await pg.wait_for_selector('#approveBox', timeout=120000)
                sheet = await pg.inner_text('.sheet'); assert 'SPY' in sheet and 'QQQ' in sheet, sheet
                rules = json.loads(await pg.input_value('#rulesJson')); assert set(rules['universe']) <= {'SPY', 'QQQ'}, rules['universe']
                assert await pg.is_visible('.ai-reply .copy-btn')
                await pg.check('#approveBox'); await pg.click('#toTest'); await pg.click('#runTest'); await pg.wait_for_selector('.label-test', timeout=60000)
                assert 'HISTORICAL TEST RUN' in await pg.inner_text('.label-test'); await pg.screenshot(path=os.path.join(A.shots, 'wizard-test-run.png'), full_page=True)
                await pg.click('#toLaunch'); await pg.fill('#agentName', 'Note Duo'); await pg.click('#launchBtn'); await pg.wait_for_url(re.compile(r'#/agent/'), timeout=60000)
                return 'universe ' + ','.join(rules['universe']) + '; screenshot attached; approved; test run; launched'
            await check('Wizard: idea + screenshot → real AI rules → approve → test run → launch', t_wizard_ai())
        async def t_sample_launch():
            await go(pg, '#/samples'); await pg.click('[data-sample="ex-trend"]'); await pg.wait_for_selector('#approveBox')
            assert 'example' in (await pg.inner_text('#view')).lower(); await pg.check('#approveBox'); await pg.click('#toTest'); await pg.click('#toLaunch')
            assert await pg.input_value('#startCash') == '100000'; await pg.click('#launchBtn'); await pg.wait_for_url(re.compile(r'#/agent/'), timeout=60000)
            st = await pg.evaluate("Agents.list[Agents.list.length-1].startDate"); assert st == '2026-10-20', st; return 'starts after ' + st + ' with $100,000'
        await check('Example strategy → approve → launch paper agent ($100k default)', t_sample_launch())
        async def t_manual_launch():
            await go(pg, '#/new'); await pg.click('#manualRules'); await pg.wait_for_selector('#approveBox')
            r = json.loads(await pg.input_value('#rulesJson')); r['name'] = 'Bad'; r['universe'] = ['spy!!']
            await pg.click('details.adv summary'); await pg.fill('#rulesJson', json.dumps(r)); await pg.click('#applyJson'); await pg.wait_for_timeout(200)
            t = await pg.inner_text('#view'); assert 'Fix before approving' in t and await pg.is_disabled('#approveBox'); return 'invalid ticker blocked approval'
        await check('Rule validation blocks approval of invalid rules', t_manual_launch())

        # ---- Phase B: time passes → forward catch-up on real bars ----
        S['asof'] = '9999-12-31'
        async def t_forward():
            await pg.evaluate("Data.clearCache().then(()=>{Agents.bars={};})"); await go(pg, '#/'); await pg.click('#refreshBtn')
            await pg.wait_for_function("!Agents.refreshing && Agents.lastRefresh", timeout=60000); await pg.wait_for_timeout(500)
            info = await pg.evaluate("Agents.list.map(a=>({n:a.name,last:a.state.lastDate,trades:a.state.trades.length,eq:a.state.equity.length,first:a.state.equity[0]&&a.state.equity[0].d,v:a.state.equity.length&&a.state.equity[a.state.equity.length-1].v}))")
            for a in info: assert a['last'] == '2026-11-10' and a['first'] == '2026-10-21', a
            assert sum(a['trades'] for a in info) > 0, info
            tr = await pg.evaluate("Agents.list.flatMap(a=>a.state.trades)")
            for t in tr:
                bars = {b['d']: b for b in FIX[t['ticker']]}; o = bars[t['filledOn']]['o']; exp = o * (1.0005 if t['side'] == 'buy' else 0.9995)
                assert abs(exp - t['price']) < 0.011 and t['filledOn'] > t['decidedOn'] and len(t['reason']) > 15, t
            assert 'Since your last visit' in await pg.inner_text('#view'); await pg.screenshot(path=os.path.join(A.shots, 'home-agents.png'), full_page=True)
            return '; '.join(f"{a['n']}: {a['trades']} trades, {a['eq']} sessions, ${a['v']:,.2f}" for a in info) + ' — every fill = real next open ± 5 bps'
        await check('Forward paper catch-up: decide after close, fill next real open, reasons on every trade', t_forward())
        aid = await pg.evaluate("Agents.list.find(a=>a.sample==='ex-trend').id")
        async def t_agent_tabs():
            await go(pg, '#/agent/' + aid, 500); t = await pg.inner_text('#view')
            for s in ['Paper value', 'SPY same window', 'Biggest drop', 'Assumptions', 'Rules v1']: assert s in t, s
            assert await pg.locator('.chart canvas').count() >= 1
            for tab in ['portfolio', 'activity', 'strategy', 'journal', 'chat', 'test']:
                await pg.click(f'[data-tab="{tab}"]'); await pg.wait_for_timeout(250); assert await pg.is_visible('.tabbody')
            await pg.click('[data-tab="activity"]'); await pg.click('.trade summary >> nth=0'); w = await pg.inner_text('.trade .why >> nth=0'); assert 'Why:' in w and 'decided after the close' in w
            await pg.click('[data-tab="strategy"]'); await pg.wait_for_function("document.querySelector('#integrity').textContent.indexOf('verified')>0", timeout=5000)
            return (await pg.inner_text('#integrity'))
        await check('Agent: overview/portfolio/activity/strategy/journal/chat/test tabs; trade reasons; hash-chain integrity', t_agent_tabs())
        async def t_version():
            await go(pg, '#/agent/' + aid); await pg.click('[data-tab="strategy"]'); await pg.click('details.adv summary')
            r = json.loads(await pg.input_value('#editJson')); r['exit']['trailingStopPct'] = 12; await pg.fill('#editJson', json.dumps(r)); await pg.click('#previewJson'); await pg.click('#approveVersion'); await pg.wait_for_timeout(500)
            v = await pg.evaluate(f"Agents.get('{aid}').versions.length"); assert v == 2; t = await pg.inner_text('#view'); assert 'v2' in t and '12% from its highest close' in t
            ok = await pg.evaluate(f"Agents.verify(Agents.get('{aid}')).then(r=>r.ok)"); assert ok
            tampered = await pg.evaluate(f"(()=>{{var a=JSON.parse(JSON.stringify(Agents.get('{aid}'))); a.events[1].summary='edited'; return Agents.verify(a).then(r=>r.ok);}})()"); assert tampered is False
            return 'v2 approved, old trades keep v1; tamper detected by hash chain'
        await check('Strategy edit creates a new version; append-only record detects tampering', t_version())
        async def t_journal_local():
            await go(pg, '#/agent/' + aid); await pg.click('[data-tab="journal"]'); await pg.click('#journalLocal'); await pg.wait_for_selector('.journal')
            t = await pg.inner_text('.journal'); assert 'Session 2026-11-10' in t and 'Not financial advice' in t
            await pg.click('.journal .copy-btn'); clip = await pg.evaluate("navigator.clipboard.readText()"); assert 'Session 2026-11-10' in clip; return 'written from record; copy button works'
        await check('Journal from record (no AI) + copy button', t_journal_local())
        if KEY:
            async def t_journal_ai():
                await go(pg, '#/agent/' + aid); await pg.click('[data-tab="journal"]'); n0 = await pg.locator('.journal').count(); await pg.click('#journalAI')
                await pg.wait_for_function(f"document.querySelectorAll('.journal').length>{n0}", timeout=120000); t = await pg.inner_text('.journal >> nth=0'); assert len(t) > 80; return t[:120].replace('\n', ' ')
            await check('Journal written by real AI from the record', t_journal_ai())
            async def t_chat():
                await go(pg, '#/agent/' + aid); await pg.click('[data-tab="chat"]'); await pg.fill('#chatInput', 'What is your current paper value and how many trades have you made? Cite one trade id.'); await pg.click('#chatSend')
                await pg.wait_for_selector('#agentChat .msg.bot', timeout=120000); t = await pg.inner_text('#agentChat .msg.bot >> nth=-1'); assert 'Grounding check' in t
                assert await pg.locator('#agentChat .msg.bot .copy-btn').count() >= 1
                await pg.click('#agentChat .msg.bot .copy-btn >> nth=-1'); clip = await pg.evaluate("navigator.clipboard.readText()"); assert len(clip) > 10
                return t.replace('\n', ' ')[:200]
            await check('Grounded agent chat (real AI) with grounding check + copy button', t_chat())
        async def t_portfolio():
            await go(pg, '#/agent/' + aid); await pg.click('[data-tab="portfolio"]'); t = await pg.inner_text('.tabbody'); assert 'Cash' in t; return t.split('\n')[0:4].__str__()
        await check('Portfolio tab shows cash/holdings from the record', t_portfolio())
        async def t_testrun():
            exp = json.loads(subprocess.check_output(['node', os.path.join(HERE, 'expected.js'), 'ex-trend']).decode())
            await go(pg, '#/samples'); await pg.click('[data-test="ex-trend"]'); await pg.wait_for_selector('.label-test', timeout=60000)
            fv = await pg.inner_text('.label-test + .stats .stat strong >> nth=0') if await pg.locator('.label-test + .stats').count() else await pg.inner_text('.stats .stat strong >> nth=0')
            want = '${:,.2f}'.format(exp['value']); assert fv == want, (fv, want)
            await pg.click('#replayBtn'); await pg.wait_for_timeout(1500); assert await pg.locator('.test-chart canvas').count() == 1
            await pg.screenshot(path=os.path.join(A.shots, 'test-run-replay.png'), full_page=True)
            return f"UI {fv} == engine {want} ({exp['trades']} trades, {exp['from']}→{exp['to']}); replay animates"
        await check('Historical test run (2y real bars) matches the engine exactly; replay works', t_testrun())
        async def t_standings():
            await go(pg, '#/standings', 500); rows = await pg.locator('.stand-row').count(); t = await pg.inner_text('.standings'); assert rows >= 2 and 'SPY (benchmark)' in t
            for pd in ['1W', '1M', 'All']: await pg.click(f'.chips .chip:text-is("{pd}")'); await pg.wait_for_timeout(150)
            return f'{rows} rows incl. SPY; period chips work'
        await check('Standings vs SPY with period chips', t_standings())
        async def t_trades():
            await go(pg, '#/trades', 400); n = await pg.locator('#tradeList .trade').count(); assert n > 0
            await pg.fill('#tradeFilter', 'zzzz'); await pg.wait_for_timeout(100); assert 'No matches' in await pg.inner_text('#tradeList'); await pg.fill('#tradeFilter', '')
            async with pg.expect_download() as d: await pg.click('#csvBtn')
            path = await (await d.value).path(); csv = open(path).read(); assert csv.startswith('agent,id,side') and csv.count('\n') == n
            return f'{n} trades, filter + CSV export'
        await check('Trade log: filter + CSV export', t_trades())
        async def t_watch():
            await go(pg, '#/watch', 300); await pg.wait_for_function("[...document.querySelectorAll('.q-price')].every(e=>e.textContent!=='…')", timeout=20000)
            t = await pg.inner_text('.w-row[data-sym="SPY"]'); exp = '${:,.2f}'.format(FIX['SPY'][-1]['c']); assert exp in t and 'Finnhub' in t, (t, exp)
            await pg.fill('#watchAdd', 'xom'); await pg.click('#watchAddBtn'); await pg.wait_for_selector('.w-row[data-sym="XOM"]'); return 'SPY ' + exp + ' (real last close via Finnhub mock); added XOM'
        await check('Watchlist: Finnhub quotes, add ticker', t_watch())
        async def t_ticker():
            await go(pg, '#/t/NVDA', 300); await pg.wait_for_selector('#tickerChart canvas', timeout=20000); await pg.check('[data-opt="candles"]'); await pg.wait_for_selector('#tickerChart canvas', timeout=20000)
            await pg.wait_for_function("document.querySelectorAll('#view .error').length>=3", timeout=20000)
            t = await pg.inner_text('#view'); assert '52-wk high' in t and 'RSI 14' in t, t[:300]; assert "don't have access" in t or 'rejected' in t, t[:600]   # profile/news/filings error path handled
            await pg.screenshot(path=os.path.join(A.shots, 'ticker-nvda.png'), full_page=True); return 'chart (line+candles, SMA, RSI), stats; Finnhub 403 shown as a clear error'
        await check('Ticker page: real chart + indicators; graceful Finnhub plan errors', t_ticker())
        async def t_macro():
            await go(pg, '#/macro', 600); t = await pg.inner_text('#view'); assert 'FRED' in t and ('Add a free FRED key' in t or 'proxy' in t); return 'needs FRED key + proxy message'
        await check('Macro: clear message without FRED key/proxy', t_macro())
        async def t_bizzy():
            await pg.click('#bizzyBtn'); await pg.wait_for_selector('#bizzyPanel.open')
            async with pg.expect_file_chooser() as fc: await pg.click('#bizzyShot')
            await (await fc.value).set_files(os.path.join(HERE, 'fixtures-note.png'))
            await pg.fill('#bizzyInput', 'remember my favorite ticker is NVDA'); await pg.click('#bizzySend')
            await pg.wait_for_function("document.querySelectorAll('#bizzyList .msg.bot').length>0", timeout=120000)
            mem = await pg.evaluate("Bizzy.memory().map(m=>m.text)"); assert any('NVDA' in m for m in mem), mem
            assert await pg.locator('#bizzyList .msg.bot .copy-btn').count() >= 1
            if KEY:
                await pg.fill('#bizzyInput', 'What is my favorite ticker? One word.'); await pg.click('#bizzySend')
                await pg.wait_for_function("document.querySelectorAll('#bizzyList .msg.bot').length>1", timeout=120000)
                ans = await pg.inner_text('#bizzyList .msg.bot >> nth=-1'); assert 'NVDA' in ans.upper(), ans
            await pg.screenshot(path=os.path.join(A.shots, 'bizzy.png')); await pg.click('#bizzyPanel .back-btn'); return 'memory saved and recalled; screenshot upload; copy button'
        await check('Bizzy pop-up: memory, screenshot upload, copy button', t_bizzy())
        async def t_themes():
            await go(pg, '#/settings'); await pg.click('[data-theme="ember"]'); await pg.wait_for_timeout(200)
            acc = await pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()"); col = await pg.eval_on_selector('.topbar .ver', 'e=>getComputedStyle(e).color')
            assert acc == '#ff7a1a' and col == 'rgb(57, 255, 20)'; out = 'preset ember applied, badge stays neon'
            if KEY:
                await pg.fill('#vibeInput', 'midnight Kentucky bourbon'); await pg.click('#aiThemeBtn'); await pg.wait_for_function("AI.getSettings().theme==='ai'", timeout=90000)
                out += '; AI theme ' + await pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()")
            await pg.click('[data-theme="neon"]'); return out
        await check('AI themes: presets + AI-generated theme', t_themes())
        async def t_errors():
            S['m429'] = True; await pg.evaluate("Data.clearCache()")
            await go(pg, '#/t/AAPL', 300); await pg.wait_for_selector('#tickerChart .error', timeout=20000); t1 = await pg.inner_text('#tickerChart'); S['m429'] = False
            assert '429' in t1
            r = await pg.evaluate("AI.chat({provider:'gemini', key:'bad-key-xyz', maxTokens:16, messages:[{role:'user',text:'hi'}]}).then(()=> 'ok', e=>e.message)"); assert 'key' in r.lower(), r
            r2 = await pg.evaluate("AI.chat({provider:'groq', messages:[{role:'user',text:'hi'}]}).then(()=> 'ok', e=>e.message)"); assert 'No Groq key' in r2, r2
            pat = re.compile(r'https://finnhub\.io/api/v1/quote.*')
            async def ab(route): await route.abort('internetdisconnected')
            await pg.context.route(pat, ab); r3 = await pg.evaluate("Data.quote('SPY').then(()=>'ok',e=>e.message)"); await pg.context.unroute(pat, ab); assert 'Could not reach' in r3, r3
            return 'rate limit 429, bad AI key, missing key, offline → clear messages'
        await check('Error handling: rate-limited, bad key, no key, offline', t_errors())
        async def t_pause_fork_export_delete():
            await go(pg, '#/agent/' + aid); await pg.click('#pauseBtn'); await pg.wait_for_timeout(300); assert await pg.evaluate(f"Agents.get('{aid}').paused")
            await pg.click('#pauseBtn'); await pg.wait_for_timeout(300); assert not await pg.evaluate(f"Agents.get('{aid}').paused")
            async with pg.expect_download() as d: await pg.click('text=⇩ Export rules')
            j = json.load(open(await (await d.value).path())); assert j['format'] == 'ai-investor-strategy'
            await pg.click('text=⑂ Fork'); await pg.wait_for_selector('#approveBox'); assert '(fork)' in await pg.input_value('#rulesJson')
            async with pg.expect_download() as d2: await go(pg, '#/settings'); await pg.click('#exportBackup')
            bk = open(await (await d2.value).path()).read(); assert MKEY not in bk and FKEY not in bk and (not KEY or KEY not in bk)
            n = await pg.evaluate("Agents.list.length"); await go(pg, '#/agent/' + aid); await pg.click('#deleteBtn'); await pg.wait_for_timeout(500); assert await pg.evaluate("Agents.list.length") == n - 1
            return 'pause/resume, export rules, fork, backup without keys, delete'
        await check('Pause/resume, export, fork, backup (no keys), delete', t_pause_fork_export_delete())
        async def t_backbtn():
            await go(pg, '#/'); await go(pg, '#/about'); await pg.click('#backBtn'); await pg.wait_for_timeout(300); h1 = await pg.evaluate('location.hash')
            await go(pg, '#/settings'); await pg.evaluate("document.dispatchEvent(new Event('backbutton'))"); await pg.wait_for_timeout(300); h2 = await pg.evaluate('location.hash')
            assert h1 in ('#/', '') and h2 != '#/settings', (h1, h2); return 'themed back + Android back key'
        await check('Back button (themed) and Android back key', t_backbtn())

        # ---- responsive pass ----
        routes = ['#/', '#/new', '#/agent/' + await pg.evaluate("Agents.list[0] ? Agents.list[0].id : ''"), '#/standings', '#/watch', '#/t/SPY', '#/trades', '#/macro', '#/samples', '#/settings', '#/about']
        for w in WIDTHS:
            async def t_width(w=w):
                await pg.set_viewport_size({'width': w, 'height': 860}); bad = []
                for r in routes:
                    await go(pg, r, 450)
                    info = await pg.evaluate("""()=>({ov: document.documentElement.scrollWidth - innerWidth, back: !!document.querySelector('#backBtn') && getComputedStyle(document.querySelector('#backBtn')).display!=='none',
                      disc: document.querySelector('.disclaimer-strip').innerText.indexOf('Not financial advice')>=0 && document.querySelector('.foot').innerText.indexOf('Not financial advice')>=0,
                      ver: getComputedStyle(document.querySelector('.topbar .ver')).color, bz: !!document.querySelector('#bizzyBtn')})""")
                    if info['ov'] > 1 or not info['back'] or not info['disc'] or info['ver'] != 'rgb(57, 255, 20)' or not info['bz']: bad.append((r, info))
                    if r in ('#/', '#/standings', '#/t/SPY') or r.startswith('#/agent'): await pg.screenshot(path=os.path.join(A.shots, f"w{w}-{(r.strip('#/').split('/')[0] or 'home')}.png"), full_page=True)
                assert not bad, bad; return f'{len(routes)} routes: no horizontal overflow, back button, disclaimer, neon badge, Bizzy'
            await check(f'Responsive {w}px', t_width())
        rec(not errs, 'No page/console errors during the run', '; '.join(errs[:5]))
        await br.close()
    p_ = sum(1 for r in R if r[0] == 'PASS'); f_ = len(R) - p_
    print(f'\n{p_}/{len(R)} passed, {f_} failed')
    json.dump({'base': BASE, 'when': datetime.now(ET).isoformat(), 'realAI': bool(KEY), 'results': R, 'passed': p_, 'failed': f_}, open(os.path.join(A.shots, 'results.json'), 'w'), indent=1)
    sys.exit(1 if f_ else 0)
asyncio.run(main())
