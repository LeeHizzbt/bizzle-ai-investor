/* Ai Investor v4.20 — views and router. Paper trading only. Not financial advice. */
(function () {
  'use strict';
  var h = UI.h, E = Engine, $ = function (s, r) { return (r || document).querySelector(s); };
  var DISCLAIMER = 'Not financial advice. Paper trading only (fake money, real prices). Past and simulated results do not predict future results.';
  var THEMES = {
    neon: { label: 'Neon v4.20', bg: '#050806', panel: '#0b120d', panel2: '#101a13', line: '#1d2e22', text: '#e9f5ec', muted: '#8fa897', accent: '#39ff14', accent2: '#00e5ff', good: '#39ff14', bad: '#ff4d6d' },
    matrix: { label: 'Matrix', bg: '#000400', panel: '#031006', panel2: '#06180a', line: '#0e3316', text: '#c8ffd0', muted: '#5fae6c', accent: '#00ff41', accent2: '#9dff00', good: '#00ff41', bad: '#ff3b3b' },
    violet: { label: 'Violet', bg: '#08050f', panel: '#120c1f', panel2: '#191129', line: '#2c2147', text: '#efe9ff', muted: '#a597c9', accent: '#a970ff', accent2: '#39ff14', good: '#39ff14', bad: '#ff5c8a' },
    ice: { label: 'Ice', bg: '#03080d', panel: '#0a1520', panel2: '#0f1d2b', line: '#1c3247', text: '#e6f4ff', muted: '#8aa6bf', accent: '#3cd2ff', accent2: '#39ff14', good: '#39ff14', bad: '#ff6b6b' },
    ember: { label: 'Ember', bg: '#0d0603', panel: '#1a0e08', panel2: '#22130b', line: '#3a2214', text: '#fff1e8', muted: '#c79f86', accent: '#ff7a1a', accent2: '#ffd60a', good: '#39ff14', bad: '#ff4040' },
    rose: { label: 'Rose', bg: '#0d0408', panel: '#1a0a12', panel2: '#220e18', line: '#3d1a2b', text: '#ffe9f2', muted: '#c995ab', accent: '#ff4fa3', accent2: '#39ff14', good: '#39ff14', bad: '#ff5c5c' },
    daylight: { label: 'Daylight', bg: '#f4f8f3', panel: '#ffffff', panel2: '#eef4ec', line: '#d3e0d0', text: '#0d1a10', muted: '#55705b', accent: '#1f9e0a', accent2: '#0077cc', good: '#14870a', bad: '#d62246' }
  };
  function applyTheme(name, custom) {
    var t = custom || THEMES[name] || THEMES.neon, r = document.documentElement.style;
    Object.keys(t).forEach(function (k) { if (k !== 'label') r.setProperty('--' + k, t[k]); });
    var m = $('meta[name=theme-color]'); if (m) m.setAttribute('content', t.bg);
  }
  function themeNow() { var s = AI.getSettings(); applyTheme(s.theme, s.theme === 'ai' ? s.customTheme : null); }

  /* ---------- shell ---------- */
  var routeName = '', lastAgentId = null;
  var NAV = [['#/', '⌂', 'Home'], ['#/new', '＋', 'New agent'], ['#/standings', '🏁', 'Standings'], ['#/watch', '👁', 'Watchlist'], ['#/trades', '≡', 'Trade log'], ['#/macro', '🏛', 'Macro'], ['#/samples', '★', 'Examples'], ['#/settings', '⚙', 'Settings'], ['#/about', 'ⓘ', 'How it works']];
  function shell() {
    var app = $('#app'); app.innerHTML = '';
    app.appendChild(h('header', { class: 'topbar' },
      h('button', { class: 'back-btn', id: 'backBtn', type: 'button', 'aria-label': 'Back', onclick: goBack }, h('span', { 'aria-hidden': 'true' }, '‹'), h('span', { class: 'back-label' }, 'Back')),
      h('a', { class: 'brand', href: '#/' }, h('img', { src: 'icons/icon-192.png', alt: '', width: 28, height: 28 }), h('span', { class: 'name' }, 'Ai Investor'), h('span', { class: 'ver' }, window.AII_VERSION)),
      h('div', { class: 'top-actions' },
        h('span', { class: 'paper-pill', title: DISCLAIMER }, 'PAPER'),
        h('button', { class: 'icon-btn', id: 'refreshBtn', type: 'button', title: 'Refresh real prices and run agents', 'aria-label': 'Refresh data', onclick: function () { refreshAll(true); } }, '⟳'),
        h('a', { class: 'icon-btn', href: '#/settings', title: 'Settings', 'aria-label': 'Settings' }, '⚙'))));
    app.appendChild(h('div', { class: 'disclaimer-strip', role: 'note' }, '⚠ ' + DISCLAIMER));
    app.appendChild(h('div', { class: 'layout' },
      h('nav', { class: 'sidenav', 'aria-label': 'Main' }, NAV.map(function (n) { return h('a', { href: n[0], 'data-r': n[0] }, h('span', { class: 'ni' }, n[1]), n[2]); })),
      h('main', { id: 'view', tabindex: '-1' })));
    app.appendChild(h('div', { id: 'progress', class: 'progress hidden', role: 'status' }));
    app.appendChild(h('nav', { class: 'bottomnav', 'aria-label': 'Quick' }, [NAV[0], NAV[1], NAV[2], NAV[3], NAV[4]].map(function (n) { return h('a', { href: n[0], 'data-r': n[0] }, h('span', { class: 'ni' }, n[1]), h('small', {}, n[2].split(' ')[0])); })));
  }
  var navCount = 0;
  function goBack() {
    if (routeName === 'home') { UI.toast('You are on the home screen.'); return; }
    if (navCount > 0) history.back(); else location.hash = '#/';
  }
  function page(title, sub) {
    var v = $('#view'); v.innerHTML = '';
    var head = h('div', { class: 'page-head' }, h('div', {}, h('h1', {}, title), sub ? h('p', { class: 'sub' }, sub) : null));
    v.appendChild(head); var body = h('div', { class: 'page-body' }); v.appendChild(body);
    v.appendChild(h('footer', { class: 'foot' }, h('p', {}, DISCLAIMER), h('p', { class: 'muted' }, 'Ai Investor ' + window.AII_VERSION + ' · build ' + window.AII_BUILD + ' · your data stays on this device · ', h('a', { href: '#/about' }, 'How it works'), window.Capacitor ? null : [' · ', h('a', { href: 'download/ai-investor-v4.20.apk', class: 'apk-link' }, 'Android APK')])));
    return { body: body, head: head };
  }
  function card(title, kids, extra) { return h('section', Object.assign({ class: 'card' }, extra || {}), title ? h('h2', {}, title) : null, kids); }
  function empty(msg, action) { return h('div', { class: 'empty' }, h('p', {}, msg), action || null); }
  function keyNeeded(which) {
    return empty(which === 'massive' ? 'Real prices are unavailable: add your free Massive (Polygon) key in Settings. Nothing here is ever simulated.' : which === 'finnhub' ? 'Unavailable: add your free Finnhub key in Settings (quotes, news, filings).' : 'Add an AI key (Gemini free works) in Settings → Advanced AI Settings.',
      h('a', { class: 'btn', href: '#/settings' }, 'Open Settings'));
  }
  function errBox(e) { return h('div', { class: 'error', role: 'alert' }, '⚠ ' + (e && e.message || e)); }
  function progress(msg) { var p = $('#progress'); if (!p) return; if (!msg) { p.classList.add('hidden'); return; } p.textContent = msg; p.classList.remove('hidden'); }
  var waitTimer = null;
  Data.onWait = function (ms, n) {
    if (ms < 1500) return;   // only surface real free-plan waits
    progress('Free data limit (5 calls/min): next Massive call in ' + Math.ceil(ms / 1000) + 's · ' + n + ' queued…');
    clearTimeout(waitTimer); waitTimer = setTimeout(function () { progress(''); }, ms + 400);
  };

  function refreshAll(manual) {
    if (!Secure.has('data.massive')) { if (manual) UI.toast('Add your Massive key in Settings to load real prices.', 'bad'); return Promise.resolve(); }
    var btn = $('#refreshBtn'); if (btn) btn.classList.add('spin');
    return Agents.refreshAll(function (d, n, t) { progress('Loading real daily prices ' + d + '/' + n + ' (' + t + ')…'); }).then(function (res) {
      var errs = Object.keys(res.errors || {});
      progress(''); if (manual) UI.toast(errs.length ? 'Updated with ' + errs.length + ' data issue(s): ' + res.errors[errs[0]] : 'Prices and agents up to date.', errs.length ? 'bad' : '');
      if (['home', 'agent', 'standings', 'trades'].indexOf(routeName) >= 0) route();
    }, function (e) { progress(''); UI.toast(e.message, 'bad'); }).finally(function () { if (btn) btn.classList.remove('spin'); });
  }

  /* ---------- HOME ---------- */
  function vHome() {
    var p = page('Your paper agents', 'Describe an idea → AI writes rules → you approve → code runs them on real prices with fake money.');
    var b = p.body, setup = [];
    if (!Secure.has('data.massive')) setup.push(['Massive (Polygon) key', 'daily prices, charts, agents and test runs', 'https://massive.com/dashboard/signup']);
    if (!Secure.has('data.finnhub')) setup.push(['Finnhub key', 'live quotes, news, filings', 'https://finnhub.io/register']);
    if (!AI.getKeys()[AI.getSettings().provider]) setup.push(['AI key (Gemini free)', 'writing rules, journals and chat', 'https://aistudio.google.com/app/apikey']);
    if (setup.length) b.appendChild(card('Finish setup (free keys, stored encrypted on this device)', [h('ul', { class: 'setup' }, setup.map(function (s) { return h('li', {}, h('strong', {}, s[0]), ' — ' + s[1] + ' · ', h('a', { href: s[2], target: '_blank', rel: 'noopener' }, 'get one')); })), h('a', { class: 'btn', href: '#/settings' }, 'Add keys in Settings')], { class: 'card setup-card' }));
    var news = Agents.list.filter(function (a) { return a.newTrades; });
    if (news.length) b.appendChild(h('div', { class: 'notice' }, '🔔 Since your last visit: ' + news.map(function (a) { return a.name + ' made ' + a.newTrades + ' paper trade(s)'; }).join(' · ')));
    var grid = h('div', { class: 'grid agents' });
    if (!Agents.list.length) grid.appendChild(empty('No agents yet. Start from your own idea or a labeled example strategy.', h('div', { class: 'row' }, h('a', { class: 'btn', href: '#/new' }, '＋ New agent'), h('a', { class: 'btn ghost', href: '#/samples' }, 'Browse examples'))));
    Agents.list.forEach(function (a) {
      var m = Agents.metrics(a), pts = (a.state ? a.state.equity : []).map(function (e) { return e.v; });
      grid.appendChild(h('a', { class: 'card agent-card', href: '#/agent/' + a.id },
        h('div', { class: 'ac-top' }, h('strong', {}, a.name), a.paused ? h('span', { class: 'tag' }, 'paused') : h('span', { class: 'tag live' }, 'paper')),
        h('div', { class: 'ac-val' }, UI.money(m.value)), h('div', { class: 'ac-row' }, h('span', { class: UI.cls(m.totalPct) }, UI.pct(m.totalPct) + ' total'), h('span', { class: UI.cls(m.todayPct) }, UI.pct(m.todayPct) + ' last session')),
        pts.length > 1 ? UI.spark(pts, 220, 40) : h('small', { class: 'muted' }, a.state && a.state.pending.length ? a.state.pending.length + ' order(s) fill at the next open' : 'Waiting for the next close (decides after 4 PM ET)'),
        h('small', { class: 'muted' }, 'v' + Agents.current(a).v + ' · ' + m.holdings + ' holdings · ' + m.trades + ' trades' + (m.benchPct != null ? ' · SPY ' + UI.pct(m.benchPct) : ''))));
    });
    b.appendChild(grid);
    b.appendChild(h('div', { class: 'row' }, h('a', { class: 'btn', href: '#/new' }, '＋ New agent'), h('a', { class: 'btn ghost', href: '#/standings' }, '🏁 Standings vs SPY'), h('a', { class: 'btn ghost', href: '#/watch' }, '👁 Watchlist')));
    var last = Agents.lastRefresh ? 'Last refreshed ' + new Date(Agents.lastRefresh).toLocaleTimeString('en-US', { timeZone: 'America/New_York' }) + ' ET.' : 'Agents catch up on real end-of-day prices when you open the app or tap ⟳.';
    b.appendChild(h('p', { class: 'muted small' }, last + ' Rules are checked once per session after the close; paper orders fill at the next open. No scheduled nightly run in this version.'));
  }

  /* ---------- NEW AGENT WIZARD ---------- */
  var STARTERS = ['Buy the 3 strongest tech stocks over 3 months while above their 50-day average; 8% trailing stop.', 'Buy SPY or QQQ after a 5% pullback from the 20-day high; sell after a 6% gain or 20 days.', 'Buy large banks when RSI(14) is under 35; sell when RSI goes over 60.', 'Buy energy ETFs breaking out to a 50-day high on 1.5x average volume.'];
  function vNew(params) {
    var w = { step: 1, idea: '', images: [], rules: null, notes: '', errors: [], approved: false };
    var sample = params.sample && SAMPLES.filter(function (s) { return s.id === params.sample; })[0];
    if (sample) { w.idea = sample.idea; w.rules = E.normalize(sample.rules); w.notes = sample.id === '__import' ? 'Imported strategy file — review every rule before approving.' : 'Labeled example strategy written for this app (not a recommendation).'; w.step = 2; w.sample = sample.id === '__import' ? null : sample.id; }
    if (params.fork) { var src = Agents.get(params.fork); if (src) { w.rules = JSON.parse(JSON.stringify(Agents.current(src).rules)); w.rules.name = src.name + ' (fork)'; w.idea = Agents.current(src).idea; w.step = 2; w.forkOf = src.id; } }
    if (params.ticker) w.idea = 'Trade ' + params.ticker.toUpperCase() + ': ';
    var p = page('New paper agent', 'Idea → Rules → Test run → Launch. The AI only drafts rules; code runs them.');
    var steps = h('ol', { class: 'steps' }), body = h('div', {}); p.body.appendChild(steps); p.body.appendChild(body);
    function render() {
      steps.innerHTML = ''; ['Idea', 'Rules', 'Test run', 'Launch'].forEach(function (s, i) { steps.appendChild(h('li', { class: i + 1 === w.step ? 'on' : i + 1 < w.step ? 'done' : '' }, (i + 1) + '. ' + s)); });
      body.innerHTML = ''; [null, stepIdea, stepRules, stepTest, stepLaunch][w.step]();
    }
    function stepIdea() {
      var ta = h('textarea', { id: 'ideaInput', rows: 5, placeholder: 'e.g. Buy the 5 strongest large-cap stocks over 6 months while above their 200-day average, 20% each. Sell if one falls 8% from its peak.' }); ta.value = w.idea;
      var shots = h('div', { class: 'thumbs' });
      function drawShots() { shots.innerHTML = ''; w.images.forEach(function (im, i) { shots.appendChild(h('span', { class: 'thumb' }, h('img', { src: im.url, alt: 'screenshot ' + (i + 1) }), h('button', { type: 'button', 'aria-label': 'Remove screenshot', onclick: function () { w.images.splice(i, 1); drawShots(); } }, '×'))); }); }
      drawShots();
      var out = h('div', {});
      body.appendChild(card('1. Describe your idea in plain English', [ta,
        h('div', { class: 'chips' }, STARTERS.map(function (s) { return h('button', { class: 'chip', type: 'button', onclick: function () { ta.value = s; } }, s); })),
        h('div', { class: 'row' }, h('button', { class: 'btn ghost', type: 'button', id: 'ideaShot', onclick: function () { UI.pickImage(function (im) { w.images.push(im); drawShots(); }); } }, '📷 Add screenshot'), shots),
        h('p', { class: 'muted small' }, 'Screenshots (a chart, a note, a strategy you saw) go only to your AI provider to help draft rules.'),
        h('div', { class: 'row' },
          h('button', { class: 'btn', type: 'button', id: 'draftBtn', onclick: function () {
            w.idea = ta.value.trim(); if (!w.idea && !w.images.length) return UI.toast('Type an idea first.', 'bad');
            var bt = this; bt.disabled = true; bt.textContent = 'Drafting rules…'; out.innerHTML = '';
            Agents.draftRules(w.idea || 'See the screenshot.', w.images).then(function (r) { w.rules = r.rules; w.notes = r.notes; w.errors = r.errors; w.model = r.model; w.step = 2; render(); },
              function (e) { out.appendChild(errBox(e)); if (/No .* key/.test(e.message)) out.appendChild(keyNeeded('ai')); }).finally(function () { bt.disabled = false; bt.textContent = '✨ Draft rules with AI'; });
          } }, '✨ Draft rules with AI'),
          h('a', { class: 'btn ghost', href: '#/samples' }, 'Start from an example'),
          h('button', { class: 'btn ghost', type: 'button', id: 'manualRules', onclick: function () { w.idea = ta.value.trim(); w.rules = E.normalize({ name: 'My agent', description: '', universe: ['SPY'], entry: { all: [{ left: { ind: 'close' }, op: '>', right: { ind: 'sma', period: 200 } }] }, sizing: { type: 'equal_weight' }, maxPositions: 1, exit: { any: [{ left: { ind: 'close' }, op: '<', right: { ind: 'sma', period: 200 } }] } }); w.step = 2; render(); } }, 'Write rules myself')),
        out]));
    }
    function stepRules() {
      var errs = w.rules ? E.validate(w.rules) : ['No rules yet'];
      var jt = h('textarea', { class: 'mono', rows: 14, id: 'rulesJson', spellcheck: 'false' }); jt.value = JSON.stringify(w.rules, null, 2);
      var msg = h('div', {}), ch = h('input', { id: 'changeInput', placeholder: 'Ask AI to change something (e.g. "use a 10% stop and max 3 holdings")' });
      body.appendChild(card('2. Review the rules the code will run', [
        errs.length ? h('div', { class: 'error' }, h('strong', {}, 'Fix before approving: '), h('ul', {}, errs.map(function (e) { return h('li', {}, e); }))) : sheetEl(w.rules),
        w.notes ? h('div', { class: 'ai-reply' }, h('div', { class: 'ai-head' }, h('span', {}, w.model ? 'AI notes · ' + w.model : 'Notes'), UI.copyBtn(function () { return w.notes; })), h('div', { class: 'md', html: UI.md(w.notes) })) : null,
        h('details', { class: 'adv' }, h('summary', {}, 'Edit the rule file (JSON)'), jt, h('div', { class: 'row' }, h('button', { class: 'btn ghost', type: 'button', id: 'applyJson', onclick: function () {
          try { w.rules = E.normalize(JSON.parse(jt.value)); w.approved = false; render(); } catch (e) { msg.innerHTML = ''; msg.appendChild(errBox('JSON error: ' + e.message)); }
        } }, 'Apply JSON'))),
        h('div', { class: 'row' }, ch, h('button', { class: 'btn ghost', type: 'button', onclick: function () {
          if (!ch.value.trim()) return; var bt = this; bt.disabled = true; bt.textContent = 'Updating…';
          Agents.draftRules(ch.value.trim(), [], w.rules).then(function (r) { w.rules = r.rules; w.notes = r.notes; w.model = r.model; w.approved = false; render(); }, function (e) { msg.innerHTML = ''; msg.appendChild(errBox(e)); }).finally(function () { bt.disabled = false; bt.textContent = 'Change with AI'; });
        } }, 'Change with AI')), msg,
        h('label', { class: 'check' }, h('input', { type: 'checkbox', id: 'approveBox', disabled: errs.length ? true : null, checked: w.approved || null, onchange: function () { w.approved = this.checked; $('#toTest').disabled = !w.approved; } }), ' I reviewed these rules. The engine will run exactly this sheet on paper; the AI cannot change it later.'),
        h('div', { class: 'row' }, h('button', { class: 'btn ghost', type: 'button', onclick: function () { w.step = 1; render(); } }, '‹ Idea'), h('button', { class: 'btn', type: 'button', id: 'toTest', disabled: !w.approved || errs.length ? true : null, onclick: function () { w.step = 3; render(); } }, 'Approve → Test run'))]));
    }
    function stepTest() {
      var out = h('div', {});
      body.appendChild(card('3. Historical test run (optional, separate from the paper record)', [
        h('p', { class: 'muted' }, 'Replays the approved rules on about the last year of real daily prices (the Massive free plan keeps ~2 years; ~200 days warm up the indicators). It is a look back, not a forecast, and it is never part of the forward paper record.'),
        h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', id: 'runTest', onclick: function () { runTestInto(out, w.rules); } }, '▶ Run test'), h('button', { class: 'btn ghost', type: 'button', onclick: function () { w.step = 2; render(); } }, '‹ Rules'), h('button', { class: 'btn ghost', type: 'button', id: 'toLaunch', onclick: function () { w.step = 4; render(); } }, 'Next: Launch ›')), out]));
      if (!Secure.has('data.massive')) out.appendChild(keyNeeded('massive'));
    }
    function stepLaunch() {
      var name = h('input', { id: 'agentName', value: w.rules.name }), cash = h('input', { id: 'startCash', type: 'number', min: 1000, step: 1000, value: +(localStorage.getItem('aii.defCash') || 100000) });
      var slip = h('input', { id: 'slip', type: 'number', min: 0, max: 100, step: 1, value: +(localStorage.getItem('aii.defSlip') || 5) }), frac = h('input', { type: 'checkbox', id: 'frac' }), out = h('div', {});
      body.appendChild(card('4. Launch the paper agent', [
        h('label', {}, 'Name', name), h('label', {}, 'Starting paper cash ($)', cash), h('label', {}, 'Slippage per fill (basis points, 5 = 0.05%)', slip), h('label', { class: 'check' }, frac, ' Allow fractional shares'),
        h('div', { class: 'assume' }, h('strong', {}, 'Assumptions (shown on every agent): '), 'decides once per session after the close using end-of-day bars; paper orders fill at the next session’s open ± slippage; no commissions, dividends or taxes; split-adjusted prices; long-only; private on this device.'),
        h('div', { class: 'row' }, h('button', { class: 'btn ghost', type: 'button', onclick: function () { w.step = 3; render(); } }, '‹ Test run'), h('button', { class: 'btn', type: 'button', id: 'launchBtn', onclick: function () {
          if (!Secure.has('data.massive')) { out.innerHTML = ''; out.appendChild(keyNeeded('massive')); return; }
          var r = JSON.parse(JSON.stringify(w.rules)); r.name = name.value.trim() || r.name; var bt = this; bt.disabled = true; bt.textContent = 'Launching…';
          Agents.create({ rules: r, name: r.name, description: r.description, startCash: +cash.value, slippageBps: +slip.value, fractional: frac.checked, idea: w.idea, notes: w.notes, forkOf: w.forkOf, sample: w.sample }).then(function (a) {
            progress(''); UI.toast('Paper agent launched.'); location.hash = '#/agent/' + a.id;
          }, function (e) { progress(''); out.innerHTML = ''; out.appendChild(errBox(e)); bt.disabled = false; bt.textContent = '🚀 Launch paper agent'; });
        } }, '🚀 Launch paper agent')), out]));
    }
    render();
  }
  function sheetEl(rules) {
    return h('dl', { class: 'sheet' }, E.sheet(rules).map(function (l) { return [h('dt', {}, l.k), h('dd', {}, Array.isArray(l.v) ? h('ul', {}, l.v.map(function (x) { return h('li', {}, x); })) : l.v)]; }));
  }
  function statGrid(items) { return h('div', { class: 'stats' }, items.map(function (s) { return h('div', { class: 'stat' }, h('small', {}, s[0]), h('strong', { class: s[2] || '' }, String(s[1]))); })); }
  function runTestInto(out, rules, done, opts) {
    out.innerHTML = ''; var st = h('p', { class: 'muted' }, 'Loading real history…'); out.appendChild(st);
    Agents.testRun(rules, Object.assign({ onProgress: function (d, n, t) { st.textContent = 'Loading real daily prices ' + d + '/' + n + ' (' + t + ')…'; } }, opts || {})).then(function (r) {
      progress(''); out.innerHTML = ''; if (done) done(r);
      var m = r.metrics;
      out.appendChild(h('div', { class: 'label-test' }, '🧪 HISTORICAL TEST RUN · ' + r.from + ' → ' + r.to + ' · not the forward paper record'));
      if (r.missing.length) out.appendChild(h('div', { class: 'error' }, 'No data for: ' + r.missing.join(', ') + ' — skipped.'));
      out.appendChild(statGrid([['Final value', UI.money(m.value)], ['Return', UI.pct(m.totalPct), UI.cls(m.totalPct)], ['SPY same window', UI.pct(m.benchPct), UI.cls(m.benchPct)], ['Max drawdown', UI.pct(m.maxDD), 'down'], ['Trades', m.trades], ['Win rate', m.winRate == null ? '—' : m.winRate.toFixed(0) + '%']]));
      var cbox = h('div', { class: 'test-chart' }), speed = h('input', { type: 'range', min: 1, max: 60, value: 20, 'aria-label': 'Replay speed', id: 'replaySpeed' }), list = h('div', { class: 'trades' });
      out.appendChild(h('div', { class: 'row' }, h('button', { class: 'btn ghost', type: 'button', id: 'replayBtn', onclick: function () { replay(); } }, '⏵ Replay'), h('label', { class: 'inline' }, 'Speed ', speed)));
      out.appendChild(cbox); out.appendChild(h('h3', {}, 'Test-run trades (' + r.state.trades.length + ')')); out.appendChild(list);
      function drawUpto(k) { UI.chart(cbox, [{ points: r.state.equity.slice(0, k), label: 'Agent' }, { points: r.bench.slice(0, k), color: UI.cssVar('--muted'), width: 1.5, dash: [5, 4], label: 'SPY' }], { baseline: r.state.startCash, readout: 'Agent (solid) vs SPY (dashed), same starting cash' }); }
      function drawTrades(upTo) { list.innerHTML = ''; r.state.trades.filter(function (t) { return !upTo || t.filledOn <= upTo; }).slice().reverse().slice(0, 60).forEach(function (t) { list.appendChild(tradeRow(t)); }); }
      var timer = null;
      function replay() {
        clearInterval(timer); var k = 2, n = r.state.equity.length;
        timer = setInterval(function () { if (!document.body.contains(cbox)) return clearInterval(timer); k += Math.max(1, Math.round(+speed.value / 6)); var kk = Math.min(k, n); drawUpto(kk); drawTrades(r.state.equity[kk - 1].d); if (k >= n) clearInterval(timer); }, 60);
      }
      drawUpto(r.state.equity.length); drawTrades();
    }, function (e) { progress(''); out.innerHTML = ''; out.appendChild(errBox(e)); if (/key/i.test(e.message)) out.appendChild(keyNeeded('massive')); });
  }
  function tradeRow(t, agentName) {
    return h('details', { class: 'trade ' + t.side },
      h('summary', {}, h('span', { class: 'side' }, t.side.toUpperCase()), h('strong', {}, t.ticker), h('span', {}, UI.num(t.shares, 4) + ' @ ' + UI.money(t.price)), h('span', { class: 'muted' }, t.filledOn), t.pnl != null ? h('span', { class: UI.cls(t.pnl) }, UI.money(t.pnl) + ' (' + UI.pct(t.pnlPct) + ')') : h('span', {}, UI.money(t.value)), agentName ? h('span', { class: 'tag' }, agentName) : null),
      h('div', { class: 'why' }, h('p', {}, h('strong', {}, 'Why: '), t.reason), h('p', { class: 'muted small' }, t.id + ' · rules v' + t.version + ' · decided after the close on ' + t.decidedOn + ' · filled at the open on ' + t.filledOn + (t.boughtOn ? ' · bought ' + t.boughtOn + ' @ ' + UI.money(t.entryPrice) : '') + ' · numbers: ' + JSON.stringify(t.values || {}))));
  }

  /* ---------- AGENT ---------- */
  var agentTab = 'overview', period = 'All';
  function vAgent(params) {
    var a = Agents.get(params.id); if (!a) { var p0 = page('Agent not found'); p0.body.appendChild(empty('This agent does not exist on this device.', h('a', { class: 'btn', href: '#/' }, 'Home'))); return; }
    if (a.newTrades) { a.newTrades = 0; Agents.save(); }
    if (params.tab) agentTab = params.tab;
    var m = Agents.metrics(a), st = a.state;
    var p = page(a.name, (a.description ? a.description + ' · ' : '') + 'paper agent · rules v' + Agents.current(a).v + (a.paused ? ' · PAUSED' : ''));
    p.head.appendChild(h('div', { class: 'row' },
      h('button', { class: 'btn ghost', type: 'button', id: 'pauseBtn', onclick: function () { Agents.setPaused(a, !a.paused).then(route); } }, a.paused ? '▶ Resume' : '⏸ Pause'),
      h('a', { class: 'btn ghost', href: '#/new?fork=' + a.id }, '⑂ Fork'),
      h('button', { class: 'btn ghost', type: 'button', onclick: function () { UI.download(a.name.replace(/\W+/g, '-') + '.aiinvestor.json', JSON.stringify({ format: 'ai-investor-strategy', v: 1, name: a.name, idea: Agents.current(a).idea, rules: Agents.current(a).rules }, null, 2)); } }, '⇩ Export rules'),
      h('button', { class: 'btn danger', type: 'button', id: 'deleteBtn', onclick: function () { if (confirm('Delete "' + a.name + '" and its whole record from this device? (Records cannot be edited, only deleted as a whole.)')) Agents.remove(a).then(function () { location.hash = '#/'; }); } }, '🗑 Delete')));
    var tabs = [['overview', 'Overview'], ['portfolio', 'Portfolio'], ['activity', 'Activity'], ['strategy', 'Strategy'], ['journal', 'Journal'], ['chat', 'Chat'], ['test', 'Test run']];
    p.body.appendChild(h('div', { class: 'tabs', role: 'tablist' }, tabs.map(function (t) { return h('button', { type: 'button', role: 'tab', 'aria-selected': agentTab === t[0] ? 'true' : 'false', class: agentTab === t[0] ? 'on' : '', 'data-tab': t[0], onclick: function () { agentTab = t[0]; route(); } }, t[1]); })));
    var box = h('div', { class: 'tabbody' }); p.body.appendChild(box);
    if (!Agents.bars.SPY && Secure.has('data.massive')) box.appendChild(h('p', { class: 'muted' }, 'Prices not loaded yet — tap ⟳ to load real data.'));
    ({ overview: tOverview, portfolio: tPortfolio, activity: tActivity, strategy: tStrategy, journal: tJournal, chat: tChat, test: tTest })[agentTab](a, box, m, st);
  }
  function periodChips(list) { return h('div', { class: 'chips' }, list.map(function (pd) { return h('button', { type: 'button', class: 'chip' + (period === pd ? ' on' : ''), onclick: function () { period = pd; route(); } }, pd); })); }
  function tOverview(a, box, m, st) {
    box.appendChild(statGrid([['Paper value', UI.money(m.value)], ['Total return', UI.pct(m.totalPct), UI.cls(m.totalPct)], ['Last session', UI.pct(m.todayPct), UI.cls(m.todayPct)], ['SPY same window', UI.pct(m.benchPct), UI.cls(m.benchPct)], ['Biggest drop', UI.pct(m.maxDD), 'down'], ['Trades / holdings', m.trades + ' / ' + m.holdings]]));
    var eq = st ? st.equity : [], cbox = h('div', {});
    box.appendChild(card('Equity vs SPY', [periodChips(['1W', '1M', '3M', 'YTD', '1Y', 'All']), cbox]));
    if (eq.length > 1) {
      var s = E.periodStart(eq.map(function (e) { return e.d; }), period), pts = eq.filter(function (e) { return e.d >= s; });
      UI.chart(cbox, [{ points: pts, label: 'Agent' }, { points: Agents.benchSeries(pts), color: UI.cssVar('--muted'), width: 1.5, dash: [5, 4], label: 'SPY' }], { baseline: pts[0].v, readout: 'Agent (solid) vs SPY (dashed) · ' + UI.pct(E.periodReturn(pts, 'All')) + ' this period' });
    } else cbox.appendChild(empty(st ? (eq.length ? 'One session recorded so far (' + eq[0].d + '). The chart appears after the next close.' : 'The record starts at the next close after ' + a.startDate + '. Come back after 5:15 PM ET on a trading day and tap ⟳.') : 'No record yet.'));
    if (st && st.pending.length) box.appendChild(card('Orders that fill at the next open', h('div', { class: 'trades' }, st.pending.map(function (o) { return h('div', { class: 'pending' }, h('span', { class: 'side ' + o.side }, o.side.toUpperCase()), ' ', h('strong', {}, o.ticker), ' ', h('span', { class: 'muted' }, 'decided after the close on ' + o.decidedOn), h('p', { class: 'small' }, o.reason)); }))));
    box.appendChild(card('Recent paper trades', st && st.trades.length ? h('div', { class: 'trades' }, st.trades.slice(-8).reverse().map(function (t) { return tradeRow(t); })) : empty('No trades yet.')));
    box.appendChild(card('Rules v' + Agents.current(a).v, sheetEl(Agents.current(a).rules)));
    box.appendChild(h('div', { class: 'assume' }, 'Assumptions: decides after the close on end-of-day bars; fills at the next open ± ' + a.slippageBps + ' bps slippage; no fees, dividends or taxes; ' + (a.fractional ? 'fractional' : 'whole') + ' shares; started with ' + UI.money(a.startCash, 0) + ' paper cash after ' + a.startDate + '.'));
  }
  function tPortfolio(a, box, m, st) {
    if (!st) return box.appendChild(empty('No record yet.'));
    var ctx = E.makeCtx(Agents.bars), last = st.lastDate, rows = Object.keys(st.positions).map(function (t) { var p = st.positions[t], c = E.lastClose(ctx, t, last); return { t: t, p: p, c: c, v: (c || p.avg) * p.shares }; });
    box.appendChild(statGrid([['Cash', UI.money(st.cash)], ['Invested', UI.money(m.value - st.cash)], ['Holdings', rows.length]]));
    if (!rows.length) return box.appendChild(empty('No holdings right now — 100% paper cash.'));
    box.appendChild(h('div', { class: 'table-wrap' }, h('table', {}, h('thead', {}, h('tr', {}, ['Ticker', 'Shares', 'Buy price', 'Last close', 'Value', 'P&L', 'Weight', 'Since'].map(function (x) { return h('th', {}, x); }))),
      h('tbody', {}, rows.map(function (r) { var pl = r.c ? (r.c / r.p.avg - 1) * 100 : null; return h('tr', {}, h('td', {}, h('a', { href: '#/t/' + r.t }, r.t)), h('td', {}, UI.num(r.p.shares, 4)), h('td', {}, UI.money(r.p.avg)), h('td', {}, UI.money(r.c)), h('td', {}, UI.money(r.v)), h('td', { class: UI.cls(pl) }, UI.pct(pl)), h('td', {}, h('span', { class: 'bar' }, h('i', { style: { width: Math.min(100, r.v / m.value * 100) + '%' } })), ' ' + (r.v / m.value * 100).toFixed(1) + '%'), h('td', {}, r.p.entryDate)); })))));
  }
  function tActivity(a, box, m, st) {
    if (!st) return box.appendChild(empty('No record yet.'));
    box.appendChild(card('All paper trades (' + st.trades.length + ')', st.trades.length ? h('div', { class: 'trades' }, st.trades.slice().reverse().map(function (t) { return tradeRow(t); })) : empty('No trades yet.')));
    box.appendChild(card('Daily checks', st.log.length ? h('ul', { class: 'log' }, st.log.slice(-40).reverse().map(function (l) { return h('li', {}, h('span', { class: 'muted' }, l.d), ' ', l.text); })) : empty('No sessions processed yet.')));
  }
  function tStrategy(a, box) {
    var cur = Agents.current(a), integ = h('span', { class: 'muted', id: 'integrity' }, 'checking record…');
    Agents.verify(a).then(function (r) { integ.textContent = r.ok ? '✓ ' + r.count + ' record events verified (hash chain intact)' : '✗ Record chain broken — data was altered outside the app'; integ.className = r.ok ? 'up' : 'down'; });
    box.appendChild(card('Current rules (v' + cur.v + ')', [sheetEl(cur.rules), cur.idea ? h('p', { class: 'muted small' }, 'Idea: ' + cur.idea) : null, h('p', { class: 'small' }, integ)]));
    var ch = h('input', { id: 'editInput', placeholder: 'Describe a change (AI drafts a new version for you to approve)' }), out = h('div', {}), jt = h('textarea', { class: 'mono', rows: 12, spellcheck: 'false', id: 'editJson' }); jt.value = JSON.stringify(cur.rules, null, 2);
    function proposal(rules, notes) {
      out.innerHTML = ''; var errs = E.validate(rules);
      out.appendChild(h('div', { class: 'card inset' }, h('h3', {}, 'Proposed v' + (cur.v + 1)), errs.length ? h('div', { class: 'error' }, errs.join('; ')) : sheetEl(rules), notes ? h('div', { class: 'ai-reply' }, h('div', { class: 'ai-head' }, h('span', {}, 'AI notes'), UI.copyBtn(notes)), h('div', { class: 'md', html: UI.md(notes) })) : null,
        h('button', { class: 'btn', type: 'button', id: 'approveVersion', disabled: errs.length ? true : null, onclick: function () { Agents.newVersion(a, rules, ch.value, notes).then(function () { UI.toast('v' + (cur.v + 1) + ' approved. It applies from the next close.'); route(); }, function (e) { out.appendChild(errBox(e)); }); } }, 'Approve as v' + (cur.v + 1))));
    }
    box.appendChild(card('Change the rules (creates a new version)', [h('div', { class: 'row' }, ch, h('button', { class: 'btn ghost', type: 'button', id: 'draftEdit', onclick: function () {
      if (!ch.value.trim()) return; var bt = this; bt.disabled = true; Agents.draftRules(ch.value.trim(), [], cur.rules).then(function (r) { proposal(r.rules, r.notes); }, function (e) { out.innerHTML = ''; out.appendChild(errBox(e)); }).finally(function () { bt.disabled = false; });
    } }, 'Draft with AI')), h('details', { class: 'adv' }, h('summary', {}, 'Edit JSON directly'), jt, h('button', { class: 'btn ghost', type: 'button', id: 'previewJson', onclick: function () { try { proposal(E.normalize(JSON.parse(jt.value)), ''); } catch (e) { out.innerHTML = ''; out.appendChild(errBox('JSON error: ' + e.message)); } } }, 'Preview as new version')), out]));
    box.appendChild(card('All versions', h('ol', { class: 'versions' }, a.versions.map(function (v) { return h('li', {}, h('details', {}, h('summary', {}, 'v' + v.v + ' · approved ' + new Date(v.approvedAt).toLocaleString('en-US', { timeZone: 'America/New_York' }) + ' ET' + (v.effectiveAfter ? ' · applies after ' + v.effectiveAfter : '')), sheetEl(v.rules))); }))));
    box.appendChild(card('Record (append-only)', h('ul', { class: 'log' }, (a.events || []).slice().reverse().slice(0, 60).map(function (e) { return h('li', {}, h('span', { class: 'muted' }, '#' + e.seq + ' ' + new Date(e.at).toLocaleString('en-US', { timeZone: 'America/New_York' }) + ' ET'), ' ', e.summary); }))));
  }
  function tJournal(a, box) {
    var out = h('div', {});
    box.appendChild(card('Session journal', [h('p', { class: 'muted' }, 'Written only from this agent’s stored record (no invented prices or news).'),
      h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', id: 'journalAI', onclick: function () { var bt = this; bt.disabled = true; bt.textContent = 'Writing…'; out.innerHTML = ''; Agents.writeJournal(a, true).then(function () { route(); }, function (e) { out.appendChild(errBox(e)); bt.disabled = false; bt.textContent = '✍ Write with AI'; }); } }, '✍ Write with AI'),
        h('button', { class: 'btn ghost', type: 'button', id: 'journalLocal', onclick: function () { Agents.writeJournal(a, false).then(function () { route(); }, function (e) { out.innerHTML = ''; out.appendChild(errBox(e)); }); } }, 'Write from record (no AI)')), out]));
    (a.journal || []).slice().reverse().forEach(function (j) { box.appendChild(h('article', { class: 'card ai-reply journal' }, h('div', { class: 'ai-head' }, h('span', {}, j.d + ' · ' + j.model), UI.copyBtn(j.text)), h('div', { class: 'md', html: UI.md(j.text) }))); });
    if (!(a.journal || []).length) box.appendChild(empty('No journal entries yet.'));
  }
  function msgEl(m) {
    if (m.role === 'user') return h('div', { class: 'msg user' }, h('div', { class: 'bubble' }, m.text, m.hasImage ? h('small', { class: 'muted' }, ' 📷') : null));
    var g = m.grounding;
    return h('div', { class: 'msg bot ai-reply' }, h('div', { class: 'ai-head' }, h('span', {}, m.model || 'AI'), UI.copyBtn(m.text)), h('div', { class: 'md', html: UI.md(m.text) }),
      g ? h('small', { class: g.missing.length ? 'warn' : 'muted' }, g.missing.length ? '⚠ Grounding check: ' + g.missing.join(', ') + ' not found in the record — double-check.' : '✓ Grounding check: ' + g.checked + ' number(s) matched the record.') : null);
  }
  function tChat(a, box) {
    var log = h('div', { class: 'chatlog', id: 'agentChat' }), imgs = [], inp = h('textarea', { id: 'chatInput', rows: 2, placeholder: 'Ask about this agent’s trades, holdings or rules…' }), err = h('div', {}), thumbs = h('div', { class: 'thumbs' });
    (a.chat || []).forEach(function (m) { log.appendChild(msgEl(m)); });
    if (!(a.chat || []).length) log.appendChild(h('p', { class: 'muted' }, 'Try: “Why did you buy your last position?”, “What would make you sell?”, “How are you doing vs SPY?”. Chat answers from the record only and cannot change the agent.'));
    function send() {
      var t = inp.value.trim(); if (!t) return; inp.value = ''; err.innerHTML = '';
      log.appendChild(msgEl({ role: 'user', text: t, hasImage: imgs.length > 0 })); var wait = h('p', { class: 'muted' }, 'Thinking…'); log.appendChild(wait); log.scrollTop = log.scrollHeight;
      Agents.chat(a, t, imgs.splice(0)).then(function (m) { wait.remove(); log.appendChild(msgEl(m)); thumbs.innerHTML = ''; log.scrollTop = log.scrollHeight; }, function (e) { wait.remove(); err.appendChild(errBox(e)); });
    }
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    box.appendChild(card('Chat with ' + a.name, [log, thumbs, h('div', { class: 'composer' }, h('button', { class: 'icon-btn', type: 'button', title: 'Attach screenshot', 'aria-label': 'Attach screenshot', id: 'chatShot', onclick: function () { UI.pickImage(function (im) { imgs.push(im); thumbs.appendChild(h('span', { class: 'thumb' }, h('img', { src: im.url, alt: 'attachment' }))); }); } }, '📷'), inp, h('button', { class: 'btn', type: 'button', id: 'chatSend', onclick: send }, 'Send')), err]));
  }
  function tTest(a, box) {
    var out = h('div', {}), sel = h('select', { id: 'testLen', 'aria-label': 'Test length' }, [['126', '6 months'], ['252', '1 year'], ['290', 'Max (~14 months after warm-up)']].map(function (o) { return h('option', { value: o[0], selected: o[0] === '252' ? true : null }, o[1]); }));
    box.appendChild(card('Historical test run (separate from the forward record)', [h('p', { class: 'muted' }, 'Runs the current rules (v' + Agents.current(a).v + ') on real past daily prices with ' + UI.money(a.startCash, 0) + ' and the same fill model.'), h('div', { class: 'row' }, sel, h('button', { class: 'btn', type: 'button', id: 'agentRunTest', onclick: function () {
      runTestInto(out, Agents.current(a).rules, function (r) { a.testRuns.push({ at: new Date().toISOString(), version: Agents.current(a).v, from: r.from, to: r.to, totalPct: +r.metrics.totalPct.toFixed(2), benchPct: r.metrics.benchPct == null ? null : +r.metrics.benchPct.toFixed(2), trades: r.metrics.trades }); Agents.save(); }, { sessions: +sel.value, startCash: a.startCash, slippageBps: a.slippageBps, fractional: a.fractional });
    } }, '▶ Run test')), out]));
    if ((a.testRuns || []).length) box.appendChild(card('Past test runs', h('ul', { class: 'log' }, a.testRuns.slice().reverse().map(function (t) { return h('li', {}, 'v' + t.version + ' · ' + t.from + ' → ' + t.to + ' · ', h('span', { class: UI.cls(t.totalPct) }, UI.pct(t.totalPct)), ' vs SPY ' + UI.pct(t.benchPct) + ' · ' + t.trades + ' trades'); }))));
  }

  /* ---------- STANDINGS ---------- */
  function vStandings() {
    var p = page('Standings', 'Your forward paper agents ranked against SPY. Private to this device — not a public board, and never a fitted backtest.');
    p.body.appendChild(periodChips(['1D', '1W', '1M', '3M', 'YTD', '1Y', 'All']));
    var spy = Agents.spyPoints(), rows = [];
    Agents.list.forEach(function (a) { var eq = a.state ? a.state.equity : []; rows.push({ name: a.name, href: '#/agent/' + a.id, desc: a.description, pts: eq, ret: E.periodReturn(eq, period), today: E.periodReturn(eq, '1D') }); });
    var first = Agents.list.reduce(function (d, a) { var e = a.state && a.state.equity[0]; return e && (!d || e.d < d) ? e.d : d; }, null);
    var spyWin = first ? spy.filter(function (x) { return x.d >= first; }) : spy.slice(-30);
    rows.push({ name: 'SPY (benchmark)', href: '#/t/SPY', desc: 'S&P 500 ETF, daily closes' + (first ? ' since ' + first : ', last 30 sessions'), pts: spyWin, ret: E.periodReturn(spyWin, period), today: E.periodReturn(spy, '1D'), bench: true });
    rows.sort(function (x, y) { return (y.ret == null ? -1e9 : y.ret) - (x.ret == null ? -1e9 : x.ret); });
    if (!spy.length) p.body.appendChild(keyNeeded('massive'));
    p.body.appendChild(h('div', { class: 'standings' }, rows.map(function (r, i) {
      return h('a', { class: 'stand-row' + (r.bench ? ' bench' : ''), href: r.href }, h('span', { class: 'rank' }, '#' + (i + 1)), h('div', { class: 'who' }, h('strong', {}, r.name), h('small', { class: 'muted' }, r.desc || '')),
        UI.spark(r.pts.slice(-90).map(function (x) { return x.v; }), 100, 30), h('div', { class: 'nums' }, h('strong', { class: UI.cls(r.ret) }, r.ret == null ? 'n/a' : UI.pct(r.ret)), h('small', { class: UI.cls(r.today) }, 'last ' + (r.today == null ? '—' : UI.pct(r.today)))));
    })));
    p.body.appendChild(h('p', { class: 'muted small' }, 'Paper results of each agent’s forward record since its start, on real end-of-day prices. "n/a" = fewer than 2 sessions in that period.'));
  }

  /* ---------- WATCHLIST + TICKER ---------- */
  function watchlist() { try { return JSON.parse(localStorage.getItem('aii.watch')) || ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA']; } catch (e) { return ['SPY']; } }
  function setWatch(w) { localStorage.setItem('aii.watch', JSON.stringify(w)); }
  function vWatch() {
    var p = page('Watchlist', 'US stocks and ETFs. Live quotes from Finnhub; end-of-day closes from Massive when Finnhub is not set.');
    var inp = h('input', { id: 'watchAdd', placeholder: 'Add ticker or search (e.g. AMD, Costco)', autocomplete: 'off' }), sug = h('div', { class: 'suggest' }), list = h('div', { class: 'watch' });
    var t; inp.addEventListener('input', function () { clearTimeout(t); var q = inp.value.trim(); sug.innerHTML = ''; if (q.length < 2 || !Secure.has('data.finnhub')) return; t = setTimeout(function () { Data.search(q).then(function (rs) { sug.innerHTML = ''; rs.forEach(function (r) { sug.appendChild(h('button', { type: 'button', class: 'chip', onclick: function () { add(r.symbol); } }, r.symbol + ' · ' + r.description)); }); }, function () {}); }, 400); });
    function add(sym) { sym = String(sym || inp.value).trim().toUpperCase(); if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(sym)) return UI.toast('Enter a US ticker symbol.', 'bad'); var w = watchlist(); if (w.indexOf(sym) < 0) w.push(sym); setWatch(w); route(); }
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') add(); });
    p.body.appendChild(card(null, [h('div', { class: 'row' }, inp, h('button', { class: 'btn', type: 'button', id: 'watchAddBtn', onclick: function () { add(); } }, 'Add')), sug]));
    var w = watchlist(), hasF = Secure.has('data.finnhub');
    if (!hasF && !Secure.has('data.massive')) p.body.appendChild(keyNeeded('finnhub'));
    p.body.appendChild(list);
    w.forEach(function (sym) {
      var price = h('strong', { class: 'q-price' }, '…'), ch = h('span', { class: 'q-ch' }), src = h('small', { class: 'muted q-src' });
      list.appendChild(h('div', { class: 'w-row', 'data-sym': sym }, h('a', { href: '#/t/' + sym, class: 'w-sym' }, sym), price, ch, src, h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Remove ' + sym, onclick: function () { setWatch(watchlist().filter(function (x) { return x !== sym; })); route(); } }, '×')));
      var fallback = function (why) {
        return Data.cachedOnly([sym]).then(function (r) { var b = r.bars[sym]; if (b && b.length > 1) { var l = b[b.length - 1], pv = b[b.length - 2]; price.textContent = UI.money(l.c); ch.textContent = UI.pct((l.c / pv.c - 1) * 100); ch.className = 'q-ch ' + UI.cls(l.c - pv.c); src.textContent = 'EOD close ' + l.d + ' · Massive'; } else { price.textContent = 'Unavailable'; src.textContent = why; } });
      };
      if (hasF) Data.quote(sym).then(function (q) { price.textContent = UI.money(q.price); ch.textContent = UI.money(q.change) + ' (' + UI.pct(q.changePct) + ')'; ch.className = 'q-ch ' + UI.cls(q.change); src.textContent = 'Finnhub · ' + new Date(q.time).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' ET'; }, function (e) { fallback(e.message); });
      else fallback('Add a Finnhub key for live quotes');
    });
  }
  var tPeriod = '1Y', tOpts = { candles: false, sma50: true, sma200: true, rsi: true };
  function vTicker(params) {
    var sym = params.sym.toUpperCase(), p = page(sym, 'Real daily prices (Massive) · quote, profile, news and SEC filings (Finnhub)');
    p.head.appendChild(h('div', { class: 'row' }, h('button', { class: 'btn ghost', type: 'button', onclick: function () { var w = watchlist(); if (w.indexOf(sym) < 0) { w.push(sym); setWatch(w); UI.toast(sym + ' added to watchlist'); } } }, '＋ Watch'), h('a', { class: 'btn', href: '#/new?ticker=' + sym }, 'Build an agent')));
    var qbox = h('div', {}), cbox = h('div', { id: 'tickerChart' }), stats = h('div', {}), prof = h('div', {}), news = h('div', {}), fil = h('div', {});
    p.body.appendChild(qbox);
    var ctl = h('div', { class: 'row wrap' }, h('div', { class: 'chips' }, ['1M', '3M', '6M', '1Y', '2Y'].map(function (pd) { return h('button', { type: 'button', class: 'chip' + (tPeriod === pd ? ' on' : ''), onclick: function () { tPeriod = pd; route(); } }, pd); })),
      ['candles', 'sma50', 'sma200', 'rsi'].map(function (k) { return h('label', { class: 'check inline' }, h('input', { type: 'checkbox', 'data-opt': k, checked: tOpts[k] || null, onchange: function () { tOpts[k] = this.checked; route(); } }), ' ' + { candles: 'Candles', sma50: 'SMA 50', sma200: 'SMA 200', rsi: 'RSI' }[k]); }));
    p.body.appendChild(card('Chart', [ctl, cbox, stats]));
    p.body.appendChild(h('div', { class: 'grid two' }, card('Company', prof), card('News (last 10 days)', news)));
    p.body.appendChild(card('SEC filings', fil));
    if (Secure.has('data.finnhub')) Data.quote(sym).then(function (q) { qbox.innerHTML = ''; qbox.appendChild(statGrid([['Price', UI.money(q.price)], ['Change', UI.money(q.change) + ' (' + UI.pct(q.changePct) + ')', UI.cls(q.change)], ['Open', UI.money(q.open)], ['High / Low', UI.money(q.high) + ' / ' + UI.money(q.low)], ['Prev close', UI.money(q.prevClose)], ['As of', new Date(q.time).toLocaleString('en-US', { timeZone: 'America/New_York' }) + ' ET']])); }, function (e) { qbox.appendChild(errBox(e)); });
    if (!Secure.has('data.massive')) cbox.appendChild(keyNeeded('massive'));
    else {
      cbox.appendChild(h('p', { class: 'muted' }, 'Loading real daily bars…'));
      Data.ensure([sym]).then(function (r) {
        progress(''); var b = r.bars[sym]; if (!b) { cbox.innerHTML = ''; cbox.appendChild(errBox(r.errors[sym] || 'No data')); return; }
        var n = { '1M': 22, '3M': 64, '6M': 127, '1Y': 252, '2Y': 9999 }[tPeriod], ctx = E.makeCtx({ X: b }), vb = b.slice(-n), first = b.length - vb.length;
        var mk = function (spec) { var s = E.series(ctx, 'X', spec); return vb.map(function (x, i) { return { d: x.d, v: s[first + i] }; }); };
        var lines = []; if (!tOpts.candles) lines.push({ points: vb.map(function (x) { return { d: x.d, v: x.c }; }), label: 'Close' });
        if (tOpts.sma50) lines.push({ points: mk({ ind: 'sma', period: 50 }), color: UI.cssVar('--accent2'), width: 1.2, label: 'SMA50' });
        if (tOpts.sma200) lines.push({ points: mk({ ind: 'sma', period: 200 }), color: '#ffb020', width: 1.2, label: 'SMA200' });
        UI.chart(cbox, lines, { candles: tOpts.candles ? vb : null, sub: tOpts.rsi ? { points: mk({ ind: 'rsi', period: 14 }), min: 0, max: 100, levels: [30, 70], label: 'RSI 14' } : null, readout: sym + ' daily · ' + vb[0].d + ' → ' + vb[vb.length - 1].d + ' · source: Massive (split-adjusted)', height: 260 });
        var c = b.map(function (x) { return x.c; }), y = c.slice(-252), last = c[c.length - 1], s200 = E.series(ctx, 'X', { ind: 'sma', period: 200 })[b.length - 1];
        stats.innerHTML = ''; stats.appendChild(statGrid([['Last close', UI.money(last) + ' (' + b[b.length - 1].d + ')'], ['52-wk high', UI.money(Math.max.apply(null, y))], ['52-wk low', UI.money(Math.min.apply(null, y))], ['1-yr return', UI.pct((last / y[0] - 1) * 100), UI.cls(last - y[0])], ['RSI 14', UI.num(E.series(ctx, 'X', { ind: 'rsi', period: 14 })[b.length - 1], 1)], ['vs SMA 200', s200 ? UI.pct((last / s200 - 1) * 100) : '—']]));
      }, function (e) { progress(''); cbox.innerHTML = ''; cbox.appendChild(errBox(e)); });
    }
    if (!Secure.has('data.finnhub')) [prof, news, fil].forEach(function (x) { x.appendChild(keyNeeded('finnhub')); });
    else {
      Data.profile(sym).then(function (pr) { if (!pr || !pr.name) { prof.appendChild(empty('No profile (ETFs often have none on the free plan).')); return; } prof.appendChild(h('div', { class: 'profile' }, pr.logo ? h('img', { src: pr.logo, alt: '', width: 40, height: 40, referrerpolicy: 'no-referrer' }) : null, h('div', {}, h('strong', {}, pr.name), h('p', { class: 'muted small' }, [pr.finnhubIndustry, pr.exchange, pr.country, pr.ipo ? 'IPO ' + pr.ipo : ''].filter(Boolean).join(' · ')), pr.marketCapitalization ? h('p', { class: 'small' }, 'Market cap ≈ ' + UI.money(pr.marketCapitalization * 1e6, 0)) : null, pr.weburl ? h('a', { href: pr.weburl, target: '_blank', rel: 'noopener' }, pr.weburl) : null))); }, function (e) { prof.appendChild(errBox(e)); });
      Data.news(sym).then(function (ns) { if (!ns.length) return news.appendChild(empty('No news in the last 10 days.')); news.appendChild(h('ul', { class: 'news' }, ns.map(function (n) { return h('li', {}, h('a', { href: n.url, target: '_blank', rel: 'noopener' }, n.headline), h('small', { class: 'muted' }, ' — ' + n.source + ', ' + new Date(n.datetime * 1000).toLocaleDateString('en-US', { timeZone: 'America/New_York' }))); }))); }, function (e) { news.appendChild(errBox(e)); });
      Data.filings(sym).then(function (fs) { if (!fs.length) return fil.appendChild(empty('No recent 10-K/10-Q/8-K filings found.')); fil.appendChild(h('ul', { class: 'news' }, fs.map(function (f) { return h('li', {}, h('a', { href: f.reportUrl || f.filingUrl, target: '_blank', rel: 'noopener' }, f.form + ' · filed ' + String(f.filedDate).slice(0, 10))); }))); fil.appendChild(h('p', { class: 'muted small' }, 'Source: SEC EDGAR via Finnhub.')); }, function (e) { fil.appendChild(errBox(e)); });
    }
  }

  /* ---------- TRADE LOG ---------- */
  function vTrades() {
    var p = page('Trade log', 'Every forward paper trade from every agent, with the rule and numbers that fired it.');
    var all = []; Agents.list.forEach(function (a) { (a.state ? a.state.trades : []).forEach(function (t) { all.push({ t: t, a: a }); }); });
    all.sort(function (x, y) { return x.t.filledOn < y.t.filledOn ? 1 : x.t.filledOn > y.t.filledOn ? -1 : 0; });
    var f = h('input', { id: 'tradeFilter', placeholder: 'Filter by ticker, agent or side' }), list = h('div', { class: 'trades', id: 'tradeList' });
    function draw() { var q = f.value.trim().toLowerCase(); list.innerHTML = ''; var rows = all.filter(function (r) { return !q || (r.t.ticker + ' ' + r.a.name + ' ' + r.t.side).toLowerCase().indexOf(q) >= 0; }); rows.forEach(function (r) { list.appendChild(tradeRow(r.t, r.a.name)); }); if (!rows.length) list.appendChild(empty(all.length ? 'No matches.' : 'No paper trades yet.')); }
    f.addEventListener('input', draw);
    p.body.appendChild(card(null, h('div', { class: 'row' }, f, h('button', { class: 'btn ghost', type: 'button', id: 'csvBtn', onclick: function () {
      var lines = [['agent', 'id', 'side', 'ticker', 'shares', 'price', 'value', 'decided_on', 'filled_on', 'version', 'pnl', 'pnl_pct', 'reason'].join(',')].concat(all.map(function (r) { var t = r.t; return [r.a.name, t.id, t.side, t.ticker, t.shares, t.price, t.value, t.decidedOn, t.filledOn, t.version, t.pnl == null ? '' : t.pnl, t.pnlPct == null ? '' : t.pnlPct, t.reason].map(function (x) { return '"' + String(x).replace(/"/g, '""') + '"'; }).join(','); }));
      UI.download('ai-investor-paper-trades.csv', lines.join('\n'), 'text/csv');
    } }, '⇩ CSV'))));
    p.body.appendChild(list); draw();
  }

  /* ---------- MACRO ---------- */
  function vMacro() {
    var p = page('Macro', 'US economic series from FRED (St. Louis Fed). Optional: needs a free FRED key and your own proxy, because FRED blocks direct browser calls.');
    [['DGS10', '10-year Treasury yield (%)'], ['FEDFUNDS', 'Fed funds rate (%)'], ['UNRATE', 'Unemployment rate (%)'], ['CPIAUCSL', 'CPI, all items (index)']].forEach(function (s) {
      var box = h('div', {}); p.body.appendChild(card(s[1], box));
      Data.fred(s[0]).then(function (pts) { if (!pts.length) return box.appendChild(empty('No observations.')); UI.chart(box, [{ points: pts, label: s[0] }], { money: false, height: 160, readout: s[0] + ' · latest ' + pts[pts.length - 1].v + ' (' + pts[pts.length - 1].d + ') · source FRED' }); },
        function (e) { box.appendChild(errBox(e)); if (e.code === 'proxy' || e.code === 'nokey') box.appendChild(h('a', { class: 'btn ghost', href: '#/settings' }, 'Settings')); });
    });
  }

  /* ---------- EXAMPLES ---------- */
  function vSamples() {
    var p = page('Example strategies', 'Original examples written for this app to show how rules work. Labeled EXAMPLE — not recommendations.');
    SAMPLES.filter(function (s) { return !s.hidden; }).forEach(function (s) {
      var out = h('div', {});
      p.body.appendChild(card(s.name, [h('span', { class: 'tag example' }, 'EXAMPLE'), h('p', {}, s.description), h('p', { class: 'muted small' }, '“' + s.idea + '”'), sheetEl(E.normalize(s.rules)),
        h('div', { class: 'row' }, h('a', { class: 'btn', href: '#/new?sample=' + s.id, 'data-sample': s.id }, 'Use this example'), h('button', { class: 'btn ghost', type: 'button', 'data-test': s.id, onclick: function () { runTestInto(out, s.rules); } }, '🧪 Test run')), out]));
    });
    var imp = h('input', { type: 'file', accept: '.json,application/json', id: 'importRules' });
    imp.onchange = function () { var f = imp.files[0]; if (!f) return; f.text().then(function (t) { var j = JSON.parse(t); if (j.format !== 'ai-investor-strategy' || !j.rules) throw new Error('Not an Ai Investor strategy file.'); var e = E.validate(E.normalize(j.rules)); if (e.length) throw new Error(e.join('; ')); sessionStorage.setItem('aii.import', JSON.stringify(j)); location.hash = '#/new?import=1'; }).catch(function (e) { UI.toast(e.message, 'bad'); }); };
    p.body.appendChild(card('Import a strategy file', [h('p', { class: 'muted' }, 'Load a .aiinvestor.json exported from an agent (yours or a friend’s). You still review and approve it.'), imp]));
  }

  /* ---------- SETTINGS ---------- */
  function keyField(id, label, help, link) {
    var inp = h('input', { type: 'password', id: 'k_' + id.replace('.', '_'), autocomplete: 'off', spellcheck: 'false', placeholder: Secure.has(id) ? '•••••••• saved (encrypted)' : 'paste key' });
    var st = h('small', { class: Secure.has(id) ? 'up' : 'muted' }, Secure.has(id) ? '✓ saved, encrypted on this device' : 'not set');
    return h('div', { class: 'keyrow' }, h('label', { for: inp.id }, label), h('div', { class: 'row' }, inp,
      h('button', { class: 'btn ghost', type: 'button', 'aria-label': 'Show or hide key', onclick: function () { inp.type = inp.type === 'password' ? 'text' : 'password'; } }, '👁'),
      h('button', { class: 'btn', type: 'button', 'data-save': id, onclick: function () { if (!inp.value.trim()) return UI.toast('Paste a key first.', 'bad'); Secure.set(id, inp.value).then(function () { inp.value = ''; inp.type = 'password'; inp.placeholder = '•••••••• saved (encrypted)'; st.textContent = '✓ saved, encrypted on this device'; st.className = 'up'; UI.toast('Saved (encrypted).'); }, function (e) { UI.toast(e.message, 'bad'); }); } }, 'Save'),
      h('button', { class: 'btn ghost', type: 'button', onclick: function () { Secure.set(id, '').then(function () { st.textContent = 'not set'; st.className = 'muted'; inp.placeholder = 'paste key'; UI.toast('Removed.'); }); } }, 'Remove')),
      h('small', { class: 'muted' }, help, link ? [' · ', h('a', { href: link, target: '_blank', rel: 'noopener' }, 'get a free key')] : null), st);
  }
  function vSettings() {
    var p = page('Settings', 'Keys are encrypted (AES-GCM with a non-extractable device key) and stored only on this device. Each key is sent only to its own service.');
    var b = p.body, ds = Data.settings(), s = AI.getSettings(), tout = h('div', { id: 'dataTestOut' });
    b.appendChild(card('Market data keys', [
      keyField('data.massive', 'Massive (Polygon) — daily prices', 'Free Stocks Basic: end-of-day, ~2 years, 5 calls/min. Powers charts, agents and test runs.', 'https://massive.com/dashboard/signup'),
      keyField('data.finnhub', 'Finnhub — quotes, news, filings', 'Free personal key: 60 calls/min. Personal use; do not redistribute data.', 'https://finnhub.io/register'),
      keyField('data.fred', 'FRED — macro (optional)', 'Free key from the St. Louis Fed. Needs the proxy below.', 'https://fred.stlouisfed.org/docs/api/api_key.html'),
      h('div', { class: 'row' }, h('button', { class: 'btn ghost', type: 'button', id: 'testData', onclick: function () {
        tout.innerHTML = ''; var add = function (t, ok) { tout.appendChild(h('p', { class: ok ? 'up' : 'down' }, (ok ? '✓ ' : '✗ ') + t)); };
        if (Secure.has('data.finnhub')) Data.quote('SPY').then(function (q) { add('Finnhub OK: SPY ' + UI.money(q.price), true); }, function (e) { add(e.message); }); else add('Finnhub: no key');
        if (Secure.has('data.massive')) Data.ensure(['SPY']).then(function (r) { progress(''); var bb = r.bars.SPY; if (bb) add('Massive OK: SPY ' + bb.length + ' daily bars through ' + bb[bb.length - 1].d, true); else add(r.errors.SPY); }, function (e) { progress(''); add(e.message); }); else add('Massive: no key');
      } }, 'Test data keys')), tout,
      h('label', {}, 'Massive calls per minute (5 on the free plan)', h('input', { type: 'number', id: 'massivePerMin', min: 1, max: 1000, value: ds.massivePerMin || 5, onchange: function () { ds.massivePerMin = +this.value || 5; Data.setSettings(ds); } })),
      h('label', {}, 'Optional proxy URL (your own free Cloudflare Worker — see worker/README.md in the repo)', h('input', { id: 'proxyUrl', placeholder: 'https://ai-investor-proxy.<you>.workers.dev', value: ds.proxy || '', onchange: function () { ds.proxy = this.value.trim(); Data.setSettings(ds); UI.toast('Proxy saved'); } })),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: ds.proxyAll || null, onchange: function () { ds.proxyAll = this.checked; Data.setSettings(ds); } }), ' Route Finnhub and Massive through the proxy too (only if direct calls are blocked)')]));
    var aiOut = h('div', { id: 'aiTestOut' }), modelSel = h('select', { id: 'modelSel', 'aria-label': 'Model' }), tierSel = h('select', { id: 'tierSel', 'aria-label': 'Effort tier' }, ['Fast', 'Pro', 'Max'].map(function (t) { return h('option', { value: t, selected: s.effort === t || null }, t + ' — ' + AI.TIER_INFO[t]); }));
    var provSel = h('select', { id: 'provSel', 'aria-label': 'Provider' }, Object.keys(AI.PROVIDERS).map(function (k) { return h('option', { value: k, selected: s.provider === k || null }, AI.PROVIDERS[k].label); }));
    function fillModels() { var pv = provSel.value; modelSel.innerHTML = ''; modelSel.appendChild(h('option', { value: '' }, 'Auto (by tier, with fallback)')); AI.PROVIDERS[pv].models.forEach(function (m) { modelSel.appendChild(h('option', { value: m, selected: s.model === m || null }, m)); }); }
    fillModels();
    provSel.onchange = function () { s.provider = provSel.value; s.model = ''; AI.setSettings(s); fillModels(); };
    tierSel.onchange = function () { s.effort = tierSel.value; AI.setSettings(s); };
    modelSel.onchange = function () { s.model = modelSel.value; AI.setSettings(s); };
    b.appendChild(card('Advanced AI Settings (bring your own key, free first)', [
      keyField('ai.gemini', 'Google Gemini key (default, free tier)', 'Drafts rules, journals and chat — never makes up prices.', 'https://aistudio.google.com/app/apikey'),
      keyField('ai.groq', 'Groq key (free)', 'Fast open models.', 'https://console.groq.com/keys'),
      keyField('ai.openrouter', 'OpenRouter key (free models)', ':free models by default.', 'https://openrouter.ai/keys'),
      h('label', {}, 'Provider', provSel), h('label', {}, 'Effort tier', tierSel),
      h('label', {}, 'Model', h('div', { class: 'row' }, modelSel, h('button', { class: 'btn ghost', type: 'button', onclick: function () { AI.listModels(provSel.value).then(function (ms) { modelSel.innerHTML = ''; modelSel.appendChild(h('option', { value: '' }, 'Auto (by tier, with fallback)')); ms.forEach(function (m) { modelSel.appendChild(h('option', { value: m.id, selected: s.model === m.id || null }, m.id + (m.vision ? ' 👁' : ''))); }); UI.toast(ms.length + ' models loaded'); }, function (e) { UI.toast('Could not list models: ' + e.message, 'bad'); }); } }, 'Load live list'))),
      h('label', {}, 'Temperature ', h('input', { type: 'range', min: 0, max: 1.2, step: 0.1, value: s.temperature, id: 'tempRange', onchange: function () { s.temperature = +this.value; AI.setSettings(s); } })),
      h('label', {}, 'Max output tokens', h('input', { type: 'number', min: 256, max: 32768, value: s.maxTokens, onchange: function () { s.maxTokens = +this.value; AI.setSettings(s); } })),
      h('label', {}, 'Extra instructions (style only)', h('textarea', { rows: 2, id: 'sysPrompt', placeholder: 'e.g. keep replies very short', onchange: function () { s.systemPrompt = this.value; AI.setSettings(s); } }, s.systemPrompt || '')),
      h('button', { class: 'btn ghost', type: 'button', id: 'testAI', onclick: function () { aiOut.innerHTML = 'Testing…'; AI.chat({ provider: provSel.value, effort: tierSel.value, model: modelSel.value || undefined, maxTokens: 64, messages: [{ role: 'user', text: 'Reply with exactly: OK' }] }).then(function (r) { aiOut.innerHTML = ''; aiOut.appendChild(h('p', { class: 'up' }, '✓ ' + r.provider + ' / ' + r.model + ' replied: ' + r.text.slice(0, 40))); }, function (e) { aiOut.innerHTML = ''; aiOut.appendChild(errBox(e)); }); } }, 'Test AI key'), aiOut]));
    var themeRow = h('div', { class: 'chips' }, Object.keys(THEMES).map(function (k) { return h('button', { type: 'button', class: 'chip theme-chip' + (s.theme === k ? ' on' : ''), 'data-theme': k, onclick: function () { s.theme = k; AI.setSettings(s); themeNow(); route(); } }, h('i', { style: { background: THEMES[k].accent } }), THEMES[k].label); }));
    var vibe = h('input', { id: 'vibeInput', placeholder: 'Describe a vibe: "midnight Kentucky bourbon", "arcade sunset"…' }), vout = h('div', {});
    b.appendChild(card('AI themes', [themeRow, h('div', { class: 'row' }, vibe, h('button', { class: 'btn ghost', type: 'button', id: 'aiThemeBtn', onclick: function () {
      if (!vibe.value.trim()) return; var bt = this; bt.disabled = true; vout.innerHTML = '';
      AI.chat({ provider: s.provider, effort: 'Fast', temperature: 0.8, maxTokens: 600, system: 'Return ONLY a JSON object with hex colors for a dark, readable trading-app theme: {"bg","panel","panel2","line","text","muted","accent","accent2","good","bad"}. Text must have strong contrast on bg. "good" green-ish, "bad" red-ish.', messages: [{ role: 'user', text: vibe.value }] }).then(function (r) {
        var j = Agents.extractJSON(r.text), ok = ['bg', 'panel', 'panel2', 'line', 'text', 'muted', 'accent', 'accent2', 'good', 'bad'].every(function (k) { return /^#[0-9a-f]{6}$/i.test(j[k] || ''); });
        if (!ok) throw new Error('The AI theme was missing colors. Try again.');
        j.label = 'AI: ' + vibe.value.slice(0, 24); s.theme = 'ai'; s.customTheme = j; AI.setSettings(s); themeNow(); UI.toast('AI theme applied');
      }).catch(function (e) { vout.appendChild(errBox(e)); }).finally(function () { bt.disabled = false; });
    } }, '✨ AI theme')), vout, h('p', { class: 'muted small' }, 'The v4.20 badge stays neon green on every theme.')]));
    b.appendChild(card('Paper defaults', [h('label', {}, 'Default starting paper cash ($)', h('input', { type: 'number', id: 'defCash', value: localStorage.getItem('aii.defCash') || 100000, onchange: function () { localStorage.setItem('aii.defCash', this.value); } })), h('label', {}, 'Default slippage (bps)', h('input', { type: 'number', value: localStorage.getItem('aii.defSlip') || 5, onchange: function () { localStorage.setItem('aii.defSlip', this.value); } })), h('p', { class: 'muted small' }, 'There is no real-money mode, broker connection, deposit or withdrawal in this app.')]));
    var mem = Bizzy.memory(), ml = h('ul', { class: 'log', id: 'memList' });
    mem.forEach(function (m, i) { ml.appendChild(h('li', {}, m.text, ' ', h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Forget', onclick: function () { Bizzy.forget(i); route(); } }, '×'))); });
    b.appendChild(card('Bizzy memory', [mem.length ? ml : empty('Bizzy has not saved anything yet. Say "remember …" in the Bizzy pop-up.')]));
    var imp = h('input', { type: 'file', accept: '.json', id: 'importBackup' });
    imp.onchange = function () { var f = imp.files[0]; if (!f) return; f.text().then(function (t) { var j = JSON.parse(t); if (j.format !== 'ai-investor-backup') throw new Error('Not an Ai Investor backup.'); Agents.list = j.agents || []; return Agents.save().then(function () { if (j.watch) setWatch(j.watch); UI.toast('Backup restored (' + Agents.list.length + ' agents).'); location.hash = '#/'; }); }).catch(function (e) { UI.toast(e.message, 'bad'); }); };
    b.appendChild(card('Backup and data', [h('div', { class: 'row' }, h('button', { class: 'btn ghost', type: 'button', id: 'exportBackup', onclick: function () { UI.download('ai-investor-backup-' + Data.etDate(Date.now()) + '.json', JSON.stringify({ format: 'ai-investor-backup', v: 1, at: new Date().toISOString(), agents: Agents.list, watch: watchlist(), note: 'No API keys are included.' })); } }, '⇩ Export backup (no keys)'), h('label', { class: 'btn ghost file' }, '⇧ Restore backup', imp)),
      h('div', { class: 'row' }, h('button', { class: 'btn ghost', type: 'button', onclick: function () { Data.clearCache().then(function () { Agents.bars = {}; UI.toast('Price cache cleared.'); }); } }, 'Clear price cache'),
        h('button', { class: 'btn danger', type: 'button', id: 'wipeAll', onclick: function () { if (!confirm('Erase ALL agents, keys, memory and cached prices from this device?')) return; Secure.wipe(); KV.clear().then(function () { localStorage.clear(); location.hash = '#/'; location.reload(); }); } }, 'Erase everything'))]));
  }

  /* ---------- ABOUT ---------- */
  function vAbout() {
    var p = page('How it works', 'Ai Investor ' + window.AII_VERSION + ' — an original, free, paper-only strategy lab.');
    var li = function (arr) { return h('ul', {}, arr.map(function (x) { return h('li', {}, x); })); };
    p.body.appendChild(card('The loop', h('ol', {}, ['You describe an idea in plain English (optionally with a screenshot).', 'Your AI key drafts explicit rules: which tickers, when to buy, how much, when to sell.', 'You review the plain-English rule sheet (generated by code from the rules) and approve it.', 'Optionally replay it on ~1 year of real past prices (test run, clearly separate).', 'A deterministic engine runs the approved rules on paper: it checks once per session after the close and paper orders fill at the next open.', 'Every trade stores the rule and numbers that fired it. Changing rules creates a new version. The record is append-only and hash-chained.', 'The journal and chat read only that record. Chat cannot change the agent.'].map(function (x) { return h('li', {}, x); }))));
    p.body.appendChild(card('Assumptions', li(['End-of-day, split-adjusted daily bars from Massive (Polygon) free; ~2 years of history.', 'Fills at the next session open ± your slippage; no commissions, dividends, borrow or taxes; long-only, no leverage.', 'Agents catch up when you open the app or tap ⟳ (no unattended nightly run in this version).', 'The SPY trading calendar handles holidays; orders without a price for 5 sessions are cancelled.'])));
    p.body.appendChild(card('Data sources', h('ul', {}, [['Massive (Polygon) Stocks Basic — daily bars', 'https://massive.com/pricing'], ['Finnhub — quotes, profiles, news, SEC filings list', 'https://finnhub.io/pricing'], ['FRED, Federal Reserve Bank of St. Louis — macro (optional)', 'https://fred.stlouisfed.org/'], ['SEC EDGAR — filings (linked)', 'https://www.sec.gov/edgar/search/']].map(function (x) { return h('li', {}, h('a', { href: x[1], target: '_blank', rel: 'noopener' }, x[0])); }))));
    p.body.appendChild(card('Limits', li(['Paper and education only. Not a broker, not an adviser. No real-money trading, broker logins, deposits or withdrawals.', 'Free APIs rate-limit (Massive: 5 calls/min, so the first load of many tickers takes a few minutes; prices are cached).', 'Free data is for personal use; do not redistribute it or share derived results publicly.', 'Universes are capped at 15 tickers per agent.', 'If data is missing the app says “Unavailable” — it never invents numbers.'])));
    p.body.appendChild(card('Privacy', h('p', {}, 'No account and no backend. Agents, records, cached prices and Bizzy memory live in this browser/app. Keys are encrypted at rest with a non-extractable WebCrypto key. Data goes only to the providers you configure (Massive, Finnhub, FRED via your proxy, and your AI provider).')));
    p.body.appendChild(card('Get the Android app', h('p', {}, h('a', { class: 'btn', href: 'download/ai-investor-v4.20.apk', id: 'apkLink' }, '⇩ Android APK (v4.20)'), ' ', h('span', { class: 'muted small' }, 'Or install this site as an app from your browser menu.'))));
  }

  /* ---------- router ---------- */
  var ROUTES = [[/^#?\/?$/, 'home', vHome], [/^#\/new/, 'new', vNew], [/^#\/agent\/([^/?]+)/, 'agent', vAgent], [/^#\/standings/, 'standings', vStandings], [/^#\/watch/, 'watch', vWatch], [/^#\/t\/([^/?]+)/, 'ticker', vTicker], [/^#\/trades/, 'trades', vTrades], [/^#\/macro/, 'macro', vMacro], [/^#\/samples/, 'samples', vSamples], [/^#\/settings/, 'settings', vSettings], [/^#\/about/, 'about', vAbout]];
  function route() {
    var hash = location.hash || '#/', q = {}, qi = hash.indexOf('?');
    if (qi >= 0) hash.slice(qi + 1).split('&').forEach(function (kv) { var p = kv.split('='); q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); });
    var path = qi >= 0 ? hash.slice(0, qi) : hash;
    for (var i = 0; i < ROUTES.length; i++) {
      var m = ROUTES[i][0].exec(path);
      if (!m) continue;
      var name = ROUTES[i][1];
      if (name === 'agent' && (routeName !== 'agent' || lastAgentId !== m[1]) && !q.tab) agentTab = 'overview';
      if (name === 'agent') lastAgentId = m[1];
      routeName = name;
      if (name === 'agent') q.id = m[1];
      if (name === 'ticker') q.sym = decodeURIComponent(m[1]);
      if (name === 'new' && q.import) { try { importSample(JSON.parse(sessionStorage.getItem('aii.import'))); q.sample = '__import'; } catch (e) {} }
      var seg = '#/' + (path.split('/')[1] || '');
      document.querySelectorAll('[data-r]').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-r') === seg || (a.getAttribute('data-r') === '#/' && name === 'home')); });
      $('#backBtn').classList.toggle('at-home', name === 'home');
      try { ROUTES[i][2](q); } catch (e) { console.error(e); $('#view').appendChild(errBox('Something went wrong: ' + e.message)); }
      $('#view').focus({ preventScroll: true }); window.scrollTo(0, 0);
      return;
    }
    location.hash = '#/';
  }
  function importSample(j) { window.SAMPLES = SAMPLES.filter(function (s) { return s.id !== '__import'; }); SAMPLES.push({ id: '__import', name: j.name, idea: j.idea || '', description: 'Imported strategy file', rules: j.rules, hidden: true }); }

  function gate() {
    if (localStorage.getItem('aii.accepted') === '1') return Promise.resolve();
    return new Promise(function (res) {
      var d = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'gateT' }, h('div', { class: 'modal-card' }, h('h2', { id: 'gateT' }, 'Before you start'), h('p', {}, 'Ai Investor is a free paper-trading lab for learning. Agents trade fake money against real market prices.'),
        h('ul', {}, h('li', {}, 'Not financial advice. Not a broker or adviser.'), h('li', {}, 'No real-money trading, no broker logins, no deposits or withdrawals.'), h('li', {}, 'Past and simulated results do not predict future results.')),
        h('button', { class: 'btn', type: 'button', id: 'acceptBtn', onclick: function () { localStorage.setItem('aii.accepted', '1'); d.remove(); res(); } }, 'I understand — paper only')));
      document.body.appendChild(d);
    });
  }

  function boot() {
    themeNow(); shell();
    window.addEventListener('hashchange', function () { navCount++; route(); });
    var CapApp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
    if (!(CapApp && CapApp.addListener)) document.addEventListener('backbutton', goBack);
    else CapApp.addListener('backButton', function () {
      var bp = document.querySelector('.bizzy-panel.open'); if (bp) { bp.classList.remove('open'); return; }
      if (document.querySelector('.modal')) return;
      if (routeName === 'home') CapApp.exitApp(); else goBack();
    });
    Promise.all([Secure.load(), Agents.load()]).then(function () { return Agents.loadCached(); }).then(function () {
      route(); Bizzy.init(); return gate();
    }).then(function () { if (Secure.has('data.massive') && Agents.list.length) refreshAll(false); })
      .catch(function (e) { console.error(e); $('#view').appendChild(errBox('Startup error: ' + e.message)); });
    if ('serviceWorker' in navigator && location.protocol === 'https:' && !window.Capacitor) navigator.serviceWorker.register('sw.js?v=' + window.AII_BUILD).catch(function () {});
  }
  window.App = { route: route, refreshAll: refreshAll, THEMES: THEMES, applyTheme: applyTheme, goBack: goBack, get routeName() { return routeName; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
