/* Ai Investor v4.20 — agents: storage, append-only record (hash-chained), forward paper catch-up, test runs, AI prompts. */
(function () {
  'use strict';
  var E = window.Engine, BENCH = 'SPY';
  var Agents = { list: [], bars: {}, lastRefresh: null, refreshing: null };

  function uid() { return 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function load() { return KV.get('agents').then(function (a) { Agents.list = a || []; return Agents.list; }); }
  function save() { return KV.set('agents', Agents.list); }
  function get(id) { return Agents.list.filter(function (a) { return a.id === id; })[0]; }
  function current(a) { return a.versions[a.versions.length - 1]; }

  /* Append-only event chain: each event stores the SHA-256 of (prev hash + event). Nothing in the UI edits or removes events. */
  function append(a, type, summary, data) {
    a.events = a.events || [];
    var prev = a.events.length ? a.events[a.events.length - 1].hash : 'genesis';
    var ev = { seq: a.events.length + 1, at: new Date().toISOString(), type: type, summary: summary, data: data || null, prev: prev };
    return sha256(prev + JSON.stringify({ seq: ev.seq, at: ev.at, type: type, summary: summary, data: ev.data })).then(function (hsh) { ev.hash = hsh; a.events.push(ev); return ev; });
  }
  function verify(a) {
    var evs = a.events || [], prev = 'genesis';
    return evs.reduce(function (p, ev) {
      return p.then(function (ok) {
        if (!ok) return false;
        return sha256(prev + JSON.stringify({ seq: ev.seq, at: ev.at, type: ev.type, summary: ev.summary, data: ev.data })).then(function (hsh) { var good = hsh === ev.hash && ev.prev === prev; prev = ev.hash; return good; });
      });
    }, Promise.resolve(true)).then(function (ok) { return { ok: ok, count: evs.length }; });
  }

  function tickersFor(list) {
    var s = {}; s[BENCH] = 1;
    (list || Agents.list).forEach(function (a) { a.versions.forEach(function (v) { v.rules.universe.forEach(function (t) { s[t] = 1; }); }); Object.keys((a.state || {}).positions || {}).forEach(function (t) { s[t] = 1; }); });
    return Object.keys(s);
  }

  function create(o) {
    var rules = E.normalize(o.rules), errs = E.validate(rules);
    if (errs.length) return Promise.reject(new Error(errs.join('; ')));
    var a = { id: uid(), name: o.name || rules.name, description: o.description || rules.description || '', createdAt: new Date().toISOString(), paused: false,
      startCash: +o.startCash || 100000, slippageBps: o.slippageBps == null ? 5 : +o.slippageBps, fractional: !!o.fractional, forkOf: o.forkOf || null, sample: o.sample || null,
      versions: [{ v: 1, rules: rules, idea: o.idea || '', notes: o.notes || '', approvedAt: new Date().toISOString() }], state: null, startDate: null, journal: [], chat: [], testRuns: [], events: [] };
    return Data.ensure([BENCH].concat(rules.universe)).then(function (res) {
      var spy = res.bars[BENCH];
      if (!spy || !spy.length) throw new Error('Could not load SPY to set the start date: ' + (res.errors[BENCH] || 'no data'));
      var latest = spy[spy.length - 1].d, p = Data.etParts(Date.now()), cal = spy.map(function (b) { return b.d; });
      a.state = E.newState(a.startCash);
      // Decide on the latest close only if it closed today and the market has closed; otherwise wait for the next close (no peeking at known prices).
      a.state.lastDate = (latest === p.date && p.h >= 16) ? cal[cal.length - 2] : latest;
      a.startDate = a.state.lastDate;
      Agents.list.push(a);
      return append(a, 'launch', 'Launched paper agent v1 with ' + UI.money(a.startCash, 0) + ' paper cash', { rules: rules, startCash: a.startCash, slippageBps: a.slippageBps });
    }).then(function () { return save(); }).then(function () { return refreshAgent(a, true); }).then(function () { return a; });
  }

  function newVersion(a, rules, idea, notes) {
    rules = E.normalize(rules); var errs = E.validate(rules); if (errs.length) return Promise.reject(new Error(errs.join('; ')));
    var v = { v: current(a).v + 1, rules: rules, idea: idea || '', notes: notes || '', approvedAt: new Date().toISOString(), effectiveAfter: a.state && a.state.lastDate };
    a.versions.push(v);
    return append(a, 'version', 'Approved rules v' + v.v + ' (applies from the next close; earlier trades stay with their version)', { rules: rules }).then(save).then(function () { return v; });
  }
  function setPaused(a, p) { a.paused = p; return append(a, p ? 'pause' : 'resume', p ? 'Paused: no new decisions (pending orders still fill)' : 'Resumed').then(save); }
  function remove(a) { Agents.list = Agents.list.filter(function (x) { return x !== a; }); return save(); }

  /* Forward paper catch-up for every session that closed since the last run. */
  function refreshAgent(a, skipEnsure) {
    var p = skipEnsure ? Data.cachedOnly(tickersFor([a])) : Data.ensure(tickersFor([a]));
    return p.then(function (res) { Object.assign(Agents.bars, res.bars); return step(a); });
  }
  function step(a) {
    var spy = Agents.bars[BENCH]; if (!spy || !a.state) return Promise.resolve(0);
    var ctx = E.makeCtx(Agents.bars), cal = spy.map(function (b) { return b.d; }), before = a.state.trades.length, cv = current(a);
    var n = E.run(a.state, ctx, cal, function () { return { rules: cv.rules, version: cv.v }; }, { paused: a.paused, slippageBps: a.slippageBps, fractional: a.fractional });
    var fresh = a.state.trades.slice(before);
    var chain = Promise.resolve();
    fresh.forEach(function (t) { chain = chain.then(function () { return append(a, 'trade', t.side.toUpperCase() + ' ' + t.shares + ' ' + t.ticker + ' @ ' + UI.money(t.price) + ' (filled ' + t.filledOn + ', v' + t.version + ')', { id: t.id, reason: t.reason }); }); });
    if (n) chain = chain.then(function () { return append(a, 'sessions', 'Processed ' + n + ' session(s) through ' + a.state.lastDate + '; value ' + UI.money(a.state.equity.length ? a.state.equity[a.state.equity.length - 1].v : a.startCash)); });
    return chain.then(function () { a.newTrades = (a.newTrades || 0) + fresh.length; return n; });
  }
  function refreshAll(onProgress) {
    if (Agents.refreshing) return Agents.refreshing;
    var tick = tickersFor();
    Agents.refreshing = Data.ensure(tick, onProgress).then(function (res) {
      Object.assign(Agents.bars, res.bars);
      return Agents.list.reduce(function (p, a) { return p.then(function () { return step(a); }); }, Promise.resolve()).then(function () { Agents.lastRefresh = Date.now(); return save(); }).then(function () { return res; });
    }).finally(function () { Agents.refreshing = null; });
    return Agents.refreshing;
  }
  function loadCached() { return Data.cachedOnly(tickersFor()).then(function (res) { Object.assign(Agents.bars, res.bars); return res; }); }

  /* Historical test run on real bars (separate from the forward record). */
  function testRun(rules, opts) {
    opts = opts || {}; rules = E.normalize(rules);
    return Data.ensure([BENCH].concat(rules.universe), opts.onProgress).then(function (res) {
      var spy = res.bars[BENCH]; if (!spy || spy.length < 230) throw new Error('Not enough SPY history for a test run: ' + (res.errors[BENCH] || 'add your Massive key in Settings'));
      var missing = rules.universe.filter(function (t) { return !res.bars[t]; });
      var ctx = E.makeCtx(res.bars), cal = spy.map(function (b) { return b.d; });
      var from = opts.from && cal.indexOf(opts.from) >= 0 ? opts.from : cal[Math.max(210, cal.length - (opts.sessions || 252))];
      if (cal.indexOf(from) < 200) from = cal[200];
      var st = E.newState(opts.startCash || 100000);
      st.lastDate = cal[cal.indexOf(from) - 1];
      E.run(st, ctx, cal, function () { return { rules: rules, version: 'test' }; }, { slippageBps: opts.slippageBps == null ? 5 : opts.slippageBps, fractional: opts.fractional });
      var m = E.metrics(st, ctx, BENCH), b0 = E.lastClose(ctx, BENCH, st.equity[0].d);
      var bench = st.equity.map(function (e) { return { d: e.d, v: Math.round(E.lastClose(ctx, BENCH, e.d) / b0 * st.startCash * 100) / 100 }; });
      return { state: st, metrics: m, bench: bench, from: st.equity[0].d, to: st.lastDate, missing: missing, errors: res.errors };
    });
  }

  function benchSeries(points) {
    var spy = Agents.bars[BENCH]; if (!spy || !points.length) return [];
    var ctx = E.makeCtx({ SPY: spy }), b0 = E.lastClose(ctx, BENCH, points[0].d), v0 = points[0].v;
    return points.map(function (p) { var c = E.lastClose(ctx, BENCH, p.d); return { d: p.d, v: c && b0 ? Math.round(c / b0 * v0 * 100) / 100 : null }; });
  }
  function metrics(a) { return E.metrics(a.state || E.newState(a.startCash), E.makeCtx(Agents.bars), BENCH); }
  function spyPoints() { return (Agents.bars[BENCH] || []).map(function (b) { return { d: b.d, v: b.c }; }); }

  /* Compact record for AI (journal + chat). Only real stored numbers. */
  function record(a, opts) {
    opts = opts || {}; var st = a.state || E.newState(a.startCash), m = metrics(a), ctx = E.makeCtx(Agents.bars), last = st.lastDate;
    return {
      agent: a.name, status: a.paused ? 'paused' : 'running', paperOnly: true, startedAfter: a.startDate, lastSessionProcessed: last,
      rulesVersion: current(a).v, rules: E.sheet(current(a).rules),
      account: { startCash: a.startCash, value: m.value, cash: Math.round(st.cash * 100) / 100, totalReturnPct: +m.totalPct.toFixed(2), lastSessionReturnPct: +m.todayPct.toFixed(2), spyReturnSameWindowPct: m.benchPct == null ? null : +m.benchPct.toFixed(2), maxDrawdownPct: +m.maxDD.toFixed(2), closedTrades: m.closed, winRatePct: m.winRate == null ? null : +m.winRate.toFixed(1) },
      holdings: Object.keys(st.positions).map(function (t) { var p = st.positions[t], c = E.lastClose(ctx, t, last); return { ticker: t, shares: p.shares, buyPrice: +p.avg.toFixed(2), boughtOn: p.entryDate, lastClose: c, unrealizedPct: c ? +((c / p.avg - 1) * 100).toFixed(2) : null }; }),
      pendingOrdersForNextOpen: st.pending.map(function (o) { return { side: o.side, ticker: o.ticker, decidedOn: o.decidedOn, reason: o.reason }; }),
      recentTrades: st.trades.slice(-(opts.trades || 30)).map(function (t) { return { id: t.id, side: t.side, ticker: t.ticker, shares: t.shares, price: t.price, decidedOn: t.decidedOn, filledOn: t.filledOn, version: t.version, reason: t.reason, pnl: t.pnl, pnlPct: t.pnlPct }; }),
      recentChecks: st.log.slice(-8).map(function (l) { return l.d + ': ' + l.text; }),
      equityLast10: st.equity.slice(-10),
      journalLast: (a.journal || []).slice(-2).map(function (j) { return { date: j.d, text: j.text.slice(0, 600) }; })
    };
  }

  var SCHEMA = 'JSON schema:\n{"name": string, "description": string (one line), "universe": [1-15 US stock/ETF tickers],\n "entry": {"all": [condition, ...]},\n "rank": {"by": spec, "order": "desc"|"asc"} (optional; orders buy candidates when there are more than free slots),\n "sizing": {"type":"percent_equity","value":1-100} | {"type":"equal_weight"} | {"type":"fixed_dollar","value":dollars},\n "maxPositions": 1-15,\n "exit": {"any": [condition, ...], "stopLossPct"?: n, "trailingStopPct"?: n, "takeProfitPct"?: n, "maxHoldDays"?: n}}\ncondition = {"left": spec, "op": ">"|"<"|">="|"<="|"crosses_above"|"crosses_below", "right": spec}\nspec = {"ind": name, "period"?: days, "mult"?: number, "k"?: number} or {"value": number}\nIndicators (daily bars): close, open, high, low, volume, sma(period), ema(period), rsi(period, 0-100), return(period = % change over N days), change (1-day %), highest(period = highest close of the PRIOR N days, for breakouts), lowest(period), avg_volume(period), drawdown(period = % below the N-day high, negative), macd, macd_signal, bb_upper(period,k), bb_lower(period,k), atr(period).';
  var RULES_SYS = 'You turn a plain-English investing idea into explicit rules for a deterministic PAPER-trading engine in the Ai Investor app. The engine (not you) runs the rules on real daily prices: it checks once per day after the close and paper orders fill at the next open. Long-only US stocks and ETFs. No options, crypto, shorting, leverage, margin or real money: if the idea asks for those, approximate long-only and say so. If the idea names a broad universe (e.g. "all S&P 500"), pick up to 15 liquid, representative tickers and say so. Never promise returns.\n' + SCHEMA + '\nReply with exactly one ```json code block containing the rules, then a line starting with "Notes:" that lists your assumptions in plain English (max 5 short bullets).';
  var JOURNAL_SYS = 'You are the journal writer for a PAPER-trading agent in Ai Investor. Write a short session journal (110-180 words, first person as the agent, plain English) using ONLY facts and numbers in the RECORD JSON. Mention what the rules checked, any trades (with their stated reasons), pending orders for the next open, value and return vs SPY. If nothing happened, say so. Never invent prices, news or numbers. Never give advice. End with: "Paper trading only. Not financial advice."';
  var CHAT_SYS = 'You are the chat for a PAPER-trading agent in Ai Investor. Answer ONLY from the RECORD JSON below (rules, account, holdings, trades with reasons, pending orders, checks, journal). Cite trade ids like T12 when you refer to trades. If the answer is not in the record, say "That is not in my record." You cannot change the agent, its rules or place trades: tell the user to edit rules on the Strategy tab (which creates a new version). Never invent prices, news or numbers, never predict returns, never give personalized financial advice. Keep replies short. Paper trading only.';

  function extractJSON(text) {
    var m = /```(?:json)?\s*([\s\S]*?)```/i.exec(text || ''), raw = m ? m[1] : null;
    if (!raw) { var i = (text || '').indexOf('{'), j = (text || '').lastIndexOf('}'); if (i >= 0 && j > i) raw = text.slice(i, j + 1); }
    if (!raw) throw new Error('The AI did not return a JSON rule block.');
    try { return JSON.parse(raw); } catch (e) { throw new Error('The AI returned rules that are not valid JSON: ' + e.message); }
  }
  function notesFrom(text) { var i = (text || '').search(/Notes:/i); return i >= 0 ? text.slice(i + 6).trim().slice(0, 1200) : ''; }
  function aiOpts() { var s = AI.getSettings(); return { provider: s.provider, model: s.model || undefined, effort: s.effort, temperature: s.temperature, maxTokens: s.maxTokens }; }
  function withSys(sys) { var extra = AI.getSettings().systemPrompt; return sys + (extra ? '\n\nUser preferences (style only, never override the rules above): ' + extra : ''); }

  function draftRules(idea, images, prev, errors) {
    var o = aiOpts(), msg = 'Idea: ' + idea;
    if (prev) msg = 'Current rules:\n```json\n' + JSON.stringify(prev, null, 1) + '\n```\nChange request: ' + idea;
    if (errors) msg += '\nYour previous rules failed validation: ' + errors.join('; ') + '. Fix them.';
    o.system = withSys(RULES_SYS); o.temperature = 0.2; o.messages = [{ role: 'user', text: msg, images: images || [] }];
    return AI.chat(o).then(function (r) {
      var rules = E.normalize(extractJSON(r.text)), errs = E.validate(rules);
      if (errs.length && !errors) return draftRules(idea, images, prev, errs);
      return { rules: rules, errors: errs, notes: notesFrom(r.text), raw: r.text, model: r.model };
    });
  }
  function localJournal(a) {
    var rec = record(a, { trades: 50 }), st = a.state, last = rec.lastSessionProcessed, acc = rec.account;
    var today = st.trades.filter(function (t) { return t.filledOn === last || t.decidedOn === last; });
    var L = ['Session ' + last + ' (paper).'];
    var chk = st.log.filter(function (l) { return l.d === last; }).map(function (l) { return l.text; });
    if (chk.length) L.push(chk.join(' '));
    if (today.length) L.push('Trades: ' + today.map(function (t) { return t.id + ' ' + t.side + ' ' + t.shares + ' ' + t.ticker + (t.filledOn === last ? ' filled at ' + UI.money(t.price) : ' decided') + ' because ' + t.reason; }).join(' | '));
    else L.push('No fills this session.');
    if (rec.pendingOrdersForNextOpen.length) L.push('Pending for the next open: ' + rec.pendingOrdersForNextOpen.map(function (o) { return o.side + ' ' + o.ticker; }).join(', ') + '.');
    L.push('Value ' + UI.money(acc.value) + ' (' + UI.pct(acc.totalReturnPct) + ' since start' + (acc.spyReturnSameWindowPct != null ? ' vs SPY ' + UI.pct(acc.spyReturnSameWindowPct) : '') + '), ' + rec.holdings.length + ' holding(s), max drawdown ' + UI.pct(acc.maxDrawdownPct) + '.');
    L.push('Paper trading only. Not financial advice.');
    return L.join('\n\n');
  }
  function writeJournal(a, useAI) {
    if (!a.state || !a.state.lastDate) return Promise.reject(new Error('No sessions processed yet.'));
    var p = useAI ? AI.chat(Object.assign(aiOpts(), { system: withSys(JOURNAL_SYS), temperature: 0.4, messages: [{ role: 'user', text: 'RECORD JSON:\n' + JSON.stringify(record(a)) }] })).then(function (r) { return { text: r.text, ai: true, model: r.model }; })
      : Promise.resolve({ text: localJournal(a), ai: false, model: 'from record (no AI)' });
    return p.then(function (j) {
      var entry = { d: a.state.lastDate, at: new Date().toISOString(), text: j.text, ai: j.ai, model: j.model };
      a.journal.push(entry);
      return append(a, 'journal', 'Journal for ' + entry.d + ' (' + entry.model + ')', { text: j.text }).then(save).then(function () { return entry; });
    });
  }
  /* Grounding check: decimal numbers in a reply that do not appear anywhere in the record. */
  function grounding(reply, recJson) {
    var nums = (reply.match(/-?\$?\d[\d,]*\.\d+%?|\$\d[\d,]+/g) || []).map(function (s) { return s.replace(/[$,%]/g, ''); });
    var hay = recJson.replace(/,(?=\d{3})/g, '');
    var missing = nums.filter(function (n) {
      var v = Math.abs(parseFloat(n)); if (!isFinite(v)) return false;
      return [v.toFixed(2), v.toFixed(1), String(v), v.toFixed(0)].every(function (f) { return hay.indexOf(f) < 0; });
    });
    return { checked: nums.length, missing: missing.filter(function (x, i, a) { return a.indexOf(x) === i; }) };
  }
  function chat(a, text, images) {
    var rec = JSON.stringify(record(a)), hist = (a.chat || []).slice(-10).map(function (m) { return { role: m.role, text: m.text }; });
    a.chat.push({ role: 'user', text: text, at: new Date().toISOString(), hasImage: !!(images && images.length) });
    return AI.chat(Object.assign(aiOpts(), { system: withSys(CHAT_SYS) + '\n\nRECORD JSON:\n' + rec, messages: hist.concat([{ role: 'user', text: text, images: images || [] }]) })).then(function (r) {
      var g = grounding(r.text, rec), m = { role: 'assistant', text: r.text, at: new Date().toISOString(), model: r.model, grounding: g };
      a.chat.push(m); return save().then(function () { return m; });
    }, function (e) { a.chat.pop(); throw e; });
  }

  Object.assign(Agents, { load: load, save: save, get: get, current: current, create: create, newVersion: newVersion, setPaused: setPaused, remove: remove, refreshAll: refreshAll, refreshAgent: refreshAgent, loadCached: loadCached,
    testRun: testRun, benchSeries: benchSeries, metrics: metrics, spyPoints: spyPoints, record: record, draftRules: draftRules, writeJournal: writeJournal, localJournal: localJournal, chat: chat, grounding: grounding, verify: verify, append: append,
    tickersFor: tickersFor, RULES_SYS: RULES_SYS, BENCH: BENCH, extractJSON: extractJSON });
  window.Agents = Agents;
})();
