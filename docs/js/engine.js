/* Ai Investor v4.20 — deterministic paper-trading engine.
   The AI only drafts rules. This code runs them: same rules + same real bars = same trades, every time.
   Decide at the close of a session, fill at the next session's open. Paper money only. */
(function (root) {
  'use strict';

  var IND = {
    close: { label: 'close price' }, open: { label: 'open price' }, high: { label: 'day high' }, low: { label: 'day low' },
    volume: { label: 'volume' },
    sma: { label: 'simple moving average', period: 50 }, ema: { label: 'exponential moving average', period: 20 },
    rsi: { label: 'RSI', period: 14 }, return: { label: '% return', period: 20 }, change: { label: '1-day % change' },
    highest: { label: 'highest close of the prior N days', period: 55 }, lowest: { label: 'lowest close of the prior N days', period: 20 },
    avg_volume: { label: 'average volume', period: 20 }, drawdown: { label: '% below the N-day high', period: 20 },
    macd: { label: 'MACD (12,26)' }, macd_signal: { label: 'MACD signal (9)' },
    bb_upper: { label: 'upper Bollinger band', period: 20 }, bb_lower: { label: 'lower Bollinger band', period: 20 },
    atr: { label: 'ATR', period: 14 }
  };
  var OPS = { '>': 'is above', '<': 'is below', '>=': 'is at or above', '<=': 'is at or below', crosses_above: 'crosses above', crosses_below: 'crosses below' };

  /* ---------- indicators (arrays aligned with bars; null until enough history) ---------- */
  function smaArr(a, p) {
    var out = new Array(a.length).fill(null), s = 0;
    for (var i = 0; i < a.length; i++) { s += a[i]; if (i >= p) s -= a[i - p]; if (i >= p - 1) out[i] = s / p; }
    return out;
  }
  function emaArr(a, p) {
    var out = new Array(a.length).fill(null), k = 2 / (p + 1), prev = null, run = 0, s = 0;
    for (var i = 0; i < a.length; i++) {
      var x = a[i];
      if (x == null) { if (prev == null) { run = 0; s = 0; } continue; }
      if (prev == null) { run++; s += x; if (run > p) { s -= a[i - p]; run = p; } if (run === p) { prev = s / p; out[i] = prev; } }
      else { prev = x * k + prev * (1 - k); out[i] = prev; }
    }
    return out;
  }
  function rsiArr(c, p) {
    var out = new Array(c.length).fill(null), g = 0, l = 0;
    for (var i = 1; i < c.length; i++) {
      var ch = c[i] - c[i - 1], up = ch > 0 ? ch : 0, dn = ch < 0 ? -ch : 0;
      if (i <= p) { g += up; l += dn; if (i === p) { g /= p; l /= p; out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); } }
      else { g = (g * (p - 1) + up) / p; l = (l * (p - 1) + dn) / p; out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); }
    }
    return out;
  }
  function series(ctx, t, spec) {
    var key = t + '|' + spec.ind + '|' + (spec.period || '') + '|' + (spec.k || '');
    if (ctx.cache[key]) return ctx.cache[key];
    var b = ctx.bars[t] || [], c = b.map(function (x) { return x.c; }), p = +spec.period || (IND[spec.ind] || {}).period || 14, out, i, j;
    switch (spec.ind) {
      case 'close': case 'open': case 'high': case 'low': out = b.map(function (x) { return x[spec.ind[0]]; }); break;
      case 'volume': out = b.map(function (x) { return x.v; }); break;
      case 'sma': out = smaArr(c, p); break;
      case 'ema': out = emaArr(c, p); break;
      case 'rsi': out = rsiArr(c, p); break;
      case 'return': out = c.map(function (x, i) { return i >= p ? (x / c[i - p] - 1) * 100 : null; }); break;
      case 'change': out = c.map(function (x, i) { return i >= 1 ? (x / c[i - 1] - 1) * 100 : null; }); break;
      case 'highest': case 'lowest':
        out = c.map(function (x, i) { if (i < p) return null; var m = c[i - p]; for (j = i - p; j < i; j++) m = spec.ind === 'highest' ? Math.max(m, c[j]) : Math.min(m, c[j]); return m; }); break;
      case 'avg_volume': out = smaArr(b.map(function (x) { return x.v; }), p); break;
      case 'drawdown': out = c.map(function (x, i) { if (i < p - 1) return null; var m = 0; for (j = i - p + 1; j <= i; j++) m = Math.max(m, c[j]); return (x / m - 1) * 100; }); break;
      case 'macd': case 'macd_signal':
        var e12 = emaArr(c, 12), e26 = emaArr(c, 26), m = c.map(function (x, i) { return e12[i] != null && e26[i] != null ? e12[i] - e26[i] : null; });
        out = spec.ind === 'macd' ? m : emaArr(m, 9); break;
      case 'bb_upper': case 'bb_lower':
        var mid = smaArr(c, p), k = +spec.k || 2;
        out = c.map(function (x, i) { if (mid[i] == null) return null; var s = 0; for (j = i - p + 1; j <= i; j++) s += Math.pow(c[j] - mid[i], 2); var sd = Math.sqrt(s / p); return spec.ind === 'bb_upper' ? mid[i] + k * sd : mid[i] - k * sd; }); break;
      case 'atr':
        var tr = b.map(function (x, i) { return i ? Math.max(x.h - x.l, Math.abs(x.h - b[i - 1].c), Math.abs(x.l - b[i - 1].c)) : x.h - x.l; });
        out = smaArr(tr, p); break;
      default: throw new Error('Unknown indicator: ' + spec.ind);
    }
    ctx.cache[key] = out; return out;
  }
  function val(ctx, t, spec, i) {
    if (!spec) return null;
    if (spec.value != null) return +spec.value;
    if (i < 0) return null;
    var v = series(ctx, t, spec)[i];
    return v == null || !isFinite(v) ? null : v * (spec.mult != null ? +spec.mult : 1);
  }
  function descSpec(s) {
    if (!s) return '?';
    if (s.value != null) return String(s.value);
    var d = IND[s.ind] ? IND[s.ind].label : s.ind, p = s.period || (IND[s.ind] || {}).period;
    var withP = { sma: p + '-day SMA', ema: p + '-day EMA', rsi: 'RSI(' + p + ')', return: p + '-day % return', highest: 'highest close of the prior ' + p + ' days',
      lowest: 'lowest close of the prior ' + p + ' days', avg_volume: p + '-day average volume', drawdown: '% below the ' + p + '-day high', bb_upper: 'upper Bollinger band (' + p + ', ' + (s.k || 2) + ')',
      bb_lower: 'lower Bollinger band (' + p + ', ' + (s.k || 2) + ')', atr: p + '-day ATR' }[s.ind] || d;
    return (s.mult != null && +s.mult !== 1 ? s.mult + ' × ' : '') + withP;
  }
  function descCond(c) { return descSpec(c.left) + ' ' + (OPS[c.op] || c.op) + ' ' + descSpec(c.right); }
  function evalCond(ctx, t, c, i) {
    var L = val(ctx, t, c.left, i), R = val(ctx, t, c.right, i);
    var rec = { text: descCond(c), left: L, right: R, ok: false };
    if (L == null || R == null) return rec;
    switch (c.op) {
      case '>': rec.ok = L > R; break; case '<': rec.ok = L < R; break; case '>=': rec.ok = L >= R; break; case '<=': rec.ok = L <= R; break;
      case 'crosses_above': case 'crosses_below':
        var Lp = val(ctx, t, c.left, i - 1), Rp = val(ctx, t, c.right, i - 1);
        if (Lp == null || Rp == null) return rec;
        rec.ok = c.op === 'crosses_above' ? (Lp <= Rp && L > R) : (Lp >= Rp && L < R); break;
    }
    return rec;
  }

  /* ---------- rules: validation and plain-English sheet ---------- */
  var TICK = /^[A-Z][A-Z0-9.\-]{0,9}$/;
  function validSpec(s, where, errs) {
    if (!s || typeof s !== 'object') { errs.push(where + ': missing'); return; }
    if (s.value != null) { if (!isFinite(+s.value)) errs.push(where + ': value must be a number'); return; }
    if (!IND[s.ind]) errs.push(where + ': unknown indicator "' + s.ind + '"');
    if (s.period != null && (!(+s.period >= 1) || +s.period > 400)) errs.push(where + ': period must be 1–400');
    if (s.mult != null && !isFinite(+s.mult)) errs.push(where + ': mult must be a number');
  }
  function validCond(c, where, errs) {
    if (!c || !OPS[c.op]) { errs.push(where + ': op must be one of ' + Object.keys(OPS).join(', ')); return; }
    validSpec(c.left, where + ' left', errs); validSpec(c.right, where + ' right', errs);
  }
  function validate(r) {
    var errs = [];
    if (!r || typeof r !== 'object') return ['Rules must be a JSON object'];
    if (!r.name || typeof r.name !== 'string') errs.push('name is required');
    if (!Array.isArray(r.universe) || !r.universe.length) errs.push('universe needs at least 1 ticker');
    else {
      if (r.universe.length > 15) errs.push('universe: max 15 tickers (free data limits)');
      r.universe.forEach(function (t) { if (!TICK.test(String(t))) errs.push('universe: "' + t + '" is not a US ticker symbol'); });
    }
    var en = r.entry && r.entry.all;
    if (!Array.isArray(en) || !en.length) errs.push('entry.all needs at least 1 condition');
    else en.forEach(function (c, i) { validCond(c, 'entry #' + (i + 1), errs); });
    var ex = r.exit || {};
    (ex.any || []).forEach(function (c, i) { validCond(c, 'exit #' + (i + 1), errs); });
    ['stopLossPct', 'trailingStopPct', 'takeProfitPct'].forEach(function (k) { if (ex[k] != null && !(+ex[k] > 0 && +ex[k] < 100)) errs.push('exit.' + k + ' must be between 0 and 100'); });
    if (ex.maxHoldDays != null && !(+ex.maxHoldDays >= 1)) errs.push('exit.maxHoldDays must be ≥ 1');
    if (!(ex.any || []).length && !ex.stopLossPct && !ex.trailingStopPct && !ex.takeProfitPct && !ex.maxHoldDays) errs.push('exit needs at least one sell rule (condition, stop, take-profit or max hold)');
    var sz = r.sizing || {};
    if (['percent_equity', 'equal_weight', 'fixed_dollar'].indexOf(sz.type) < 0) errs.push('sizing.type must be percent_equity, equal_weight or fixed_dollar');
    if (sz.type === 'percent_equity' && !(+sz.value > 0 && +sz.value <= 100)) errs.push('sizing.value must be 1–100 (% of equity)');
    if (sz.type === 'fixed_dollar' && !(+sz.value > 0)) errs.push('sizing.value must be a dollar amount');
    if (!(+r.maxPositions >= 1 && +r.maxPositions <= 15)) errs.push('maxPositions must be 1–15');
    if (r.rank) validSpec(r.rank.by, 'rank', errs);
    return errs;
  }
  function normalize(r) {
    r = JSON.parse(JSON.stringify(r));
    r.universe = (r.universe || []).map(function (t) { return String(t).trim().toUpperCase(); }).filter(function (t, i, a) { return t && a.indexOf(t) === i; });
    r.exit = r.exit || {}; r.exit.any = r.exit.any || [];
    r.schedule = 'daily_close';
    return r;
  }
  function sheet(r) {
    var L = [];
    L.push({ k: 'Watches', v: r.universe.join(', ') });
    L.push({ k: 'Buys when ALL are true', v: r.entry.all.map(descCond) });
    if (r.rank && r.rank.by) L.push({ k: 'Ranks buy candidates by', v: descSpec(r.rank.by) + (r.rank.order === 'asc' ? ' (lowest first)' : ' (highest first)') });
    var sz = r.sizing, szt = sz.type === 'percent_equity' ? sz.value + '% of account value per buy' : sz.type === 'equal_weight' ? 'equal slices (account value ÷ ' + r.maxPositions + ')' : '$' + (+sz.value).toLocaleString() + ' per buy';
    L.push({ k: 'Sizes each buy', v: szt + ', at most ' + r.maxPositions + ' holdings at once' });
    var s = (r.exit.any || []).map(descCond);
    if (r.exit.stopLossPct) s.push('close falls ' + r.exit.stopLossPct + '% below the buy price (stop loss)');
    if (r.exit.trailingStopPct) s.push('close falls ' + r.exit.trailingStopPct + '% from its highest close since buying (trailing stop)');
    if (r.exit.takeProfitPct) s.push('close rises ' + r.exit.takeProfitPct + '% above the buy price (take profit)');
    if (r.exit.maxHoldDays) s.push('it has been held ' + r.exit.maxHoldDays + ' trading days');
    L.push({ k: 'Sells the whole position when ANY is true', v: s });
    L.push({ k: 'Checks', v: 'once a day after the close; paper orders fill at the next session’s open' });
    return L;
  }

  /* ---------- context: bars by ticker, date → index ---------- */
  function makeCtx(barsBy) {
    var ctx = { bars: {}, idx: {}, cache: {} };
    Object.keys(barsBy).forEach(function (t) {
      var b = barsBy[t] || []; ctx.bars[t] = b; var m = {}; b.forEach(function (x, i) { m[x.d] = i; }); ctx.idx[t] = m;
    });
    return ctx;
  }
  function lastClose(ctx, t, d) {
    var i = ctx.idx[t] && ctx.idx[t][d];
    if (i != null) return ctx.bars[t][i].c;
    var b = ctx.bars[t] || [], lo = 0, hi = b.length - 1, ans = null;
    while (lo <= hi) { var mid = (lo + hi) >> 1; if (b[mid].d <= d) { ans = b[mid].c; lo = mid + 1; } else hi = mid - 1; }
    return ans;
  }

  /* ---------- state machine ---------- */
  function newState(cash) {
    return { cash: +cash, startCash: +cash, positions: {}, pending: [], equity: [], trades: [], log: [], lastDate: null, seq: 0 };
  }
  function r2(x) { return Math.round(x * 100) / 100; }
  function fmt(x) { return x == null ? '—' : Math.abs(x) >= 1e6 ? (x / 1e6).toFixed(2) + 'M' : Math.abs(x) >= 1000 ? x.toFixed(0) : Math.abs(x) >= 10 ? x.toFixed(2) : x.toFixed(3); }

  function equityAt(state, ctx, d) {
    var v = state.cash;
    Object.keys(state.positions).forEach(function (t) { var c = lastClose(ctx, t, d); v += state.positions[t].shares * (c == null ? state.positions[t].avg : c); });
    return v;
  }

  function fillPending(state, ctx, d, opts) {
    var slip = (opts.slippageBps || 0) / 10000, keep = [];
    var sells = state.pending.filter(function (o) { return o.side === 'sell'; }), buys = state.pending.filter(function (o) { return o.side === 'buy'; });
    sells.concat(buys).forEach(function (o) {
      var i = ctx.idx[o.ticker] && ctx.idx[o.ticker][d];
      if (i == null) { o.waited = (o.waited || 0) + 1; if (o.waited <= 5) keep.push(o); else state.log.push({ d: d, type: 'cancel', ticker: o.ticker, text: 'Cancelled ' + o.side + ' ' + o.ticker + ': no price for 5 sessions.' }); return; }
      var open = ctx.bars[o.ticker][i].o;
      if (o.side === 'sell') {
        var p = state.positions[o.ticker]; if (!p) return;
        var px = open * (1 - slip), value = p.shares * px;
        state.cash += value;
        state.trades.push({ id: 'T' + (++state.seq), side: 'sell', ticker: o.ticker, shares: p.shares, price: r2(px), value: r2(value), decidedOn: o.decidedOn, filledOn: d,
          version: o.version, reason: o.reason, values: o.values, entryPrice: r2(p.avg), boughtOn: p.entryDate, pnl: r2(value - p.shares * p.avg), pnlPct: r2((px / p.avg - 1) * 100) });
        delete state.positions[o.ticker];
      } else {
        if (state.positions[o.ticker]) return;
        var bp = open * (1 + slip), sh = opts.fractional ? Math.floor(o.target / bp * 1e4) / 1e4 : Math.floor(o.target / bp);
        if (sh * bp > state.cash) sh = opts.fractional ? Math.floor(state.cash / bp * 1e4) / 1e4 : Math.floor(state.cash / bp);
        if (!(sh > 0)) { state.log.push({ d: d, type: 'skip', ticker: o.ticker, text: 'Skipped buy ' + o.ticker + ': not enough paper cash at the open.' }); return; }
        state.cash -= sh * bp;
        state.positions[o.ticker] = { shares: sh, avg: bp, entryDate: d, peak: open, version: o.version };
        state.trades.push({ id: 'T' + (++state.seq), side: 'buy', ticker: o.ticker, shares: sh, price: r2(bp), value: r2(sh * bp), decidedOn: o.decidedOn, filledOn: d, version: o.version, reason: o.reason, values: o.values });
      }
    });
    state.pending = keep;
  }

  function sessionsBetween(cal, a, b) { var ia = cal.indexOf(a), ib = cal.indexOf(b); return ia < 0 || ib < 0 ? 0 : ib - ia; }

  function decide(state, ctx, d, rules, version, cal) {
    var orders = [], ex = rules.exit || {};
    // exits first
    Object.keys(state.positions).forEach(function (t) {
      var i = ctx.idx[t] && ctx.idx[t][d]; if (i == null) return;
      var p = state.positions[t], c = ctx.bars[t][i].c; p.peak = Math.max(p.peak || c, c);
      var why = null, vals = { close: r2(c), buyPrice: r2(p.avg) }, ch = (c / p.avg - 1) * 100;
      if (ex.stopLossPct && ch <= -ex.stopLossPct) why = 'Stop loss: close $' + fmt(c) + ' is ' + ch.toFixed(2) + '% from the buy price $' + fmt(p.avg) + ' (limit −' + ex.stopLossPct + '%)';
      if (!why && ex.trailingStopPct) { var dd = (c / p.peak - 1) * 100; vals.peakClose = r2(p.peak); if (dd <= -ex.trailingStopPct) why = 'Trailing stop: close $' + fmt(c) + ' is ' + dd.toFixed(2) + '% below the highest close since buying ($' + fmt(p.peak) + ', limit −' + ex.trailingStopPct + '%)'; }
      if (!why && ex.takeProfitPct && ch >= ex.takeProfitPct) why = 'Take profit: close $' + fmt(c) + ' is +' + ch.toFixed(2) + '% above the buy price $' + fmt(p.avg) + ' (target +' + ex.takeProfitPct + '%)';
      if (!why && ex.maxHoldDays) { var held = sessionsBetween(cal, p.entryDate, d); if (held >= ex.maxHoldDays) why = 'Time exit: held ' + held + ' trading days (max ' + ex.maxHoldDays + ')'; }
      if (!why) (ex.any || []).some(function (cond) {
        var r = evalCond(ctx, t, cond, i);
        if (r.ok) { why = 'Sell rule: ' + r.text + ' (' + fmt(r.left) + ' vs ' + fmt(r.right) + ')'; vals.left = r2(r.left); vals.right = r2(r.right); }
        return r.ok;
      });
      if (why) orders.push({ side: 'sell', ticker: t, decidedOn: d, version: version, reason: why, values: vals });
    });
    // entries
    var held = Object.keys(state.positions).length - orders.length;
    var slots = Math.max(0, (+rules.maxPositions || 1) - held), cands = [];
    if (slots > 0) rules.universe.forEach(function (t) {
      if (state.positions[t]) return;
      var i = ctx.idx[t] && ctx.idx[t][d]; if (i == null) return;
      var parts = [], vals = { close: r2(ctx.bars[t][i].c) }, ok = rules.entry.all.every(function (cond) {
        var r = evalCond(ctx, t, cond, i); parts.push(r.text + ' (' + fmt(r.left) + ' vs ' + fmt(r.right) + ')'); return r.ok;
      });
      if (!ok) return;
      var rv = rules.rank && rules.rank.by ? val(ctx, t, rules.rank.by, i) : 0;
      if (rules.rank && rules.rank.by && rv == null) return;
      cands.push({ t: t, parts: parts, vals: vals, rank: rv });
    });
    if (rules.rank && rules.rank.by) cands.sort(function (a, b) { return rules.rank.order === 'asc' ? a.rank - b.rank : b.rank - a.rank; });
    var eq = equityAt(state, ctx, d), avail = state.cash;
    orders.forEach(function (o) { if (o.side === 'sell') { var p = state.positions[o.ticker]; avail += p.shares * (lastClose(ctx, o.ticker, d) || p.avg); } });
    cands.slice(0, slots).forEach(function (c, k) {
      var sz = rules.sizing, target = sz.type === 'percent_equity' ? eq * sz.value / 100 : sz.type === 'equal_weight' ? eq / rules.maxPositions : +sz.value;
      target = Math.min(target, avail * 0.998);
      if (target < c.vals.close) return;
      avail -= target;
      var reason = 'Buy rule: ' + c.parts.join(' AND ') + (rules.rank && rules.rank.by ? '; ranked #' + (k + 1) + ' of ' + cands.length + ' by ' + descSpec(rules.rank.by) + ' (' + fmt(c.rank) + ')' : '');
      orders.push({ side: 'buy', ticker: c.t, decidedOn: d, version: version, target: r2(target), reason: reason, values: c.vals });
    });
    state.pending = state.pending.concat(orders);
    state.log.push({ d: d, type: 'check', text: 'Checked ' + rules.universe.length + ' tickers after the close: ' + orders.filter(function (o) { return o.side === 'buy'; }).length + ' buy and ' + orders.filter(function (o) { return o.side === 'sell'; }).length + ' sell order(s) queued for the next open.' });
    return orders;
  }

  /* Process every calendar session after state.lastDate (up to opts.until). rulesFor(d) → {rules, version}. */
  function run(state, ctx, cal, rulesFor, opts) {
    opts = opts || {};
    var dates = cal.filter(function (d) { return (!state.lastDate || d > state.lastDate) && (!opts.from || d >= opts.from) && (!opts.until || d <= opts.until); });
    dates.forEach(function (d) {
      if (state.pending.length) fillPending(state, ctx, d, opts);
      var rv = rulesFor(d);
      if (rv && !opts.paused) decide(state, ctx, d, rv.rules, rv.version, cal);
      state.equity.push({ d: d, v: r2(equityAt(state, ctx, d)), cash: r2(state.cash) });
      state.lastDate = d;
    });
    return dates.length;
  }

  function metrics(state, ctx, bench) {
    var e = state.equity, m = { value: e.length ? e[e.length - 1].v : state.startCash, start: state.startCash };
    m.totalPct = (m.value / m.start - 1) * 100;
    m.todayPct = e.length > 1 ? (e[e.length - 1].v / e[e.length - 2].v - 1) * 100 : 0;
    var peak = -Infinity, mdd = 0; e.forEach(function (x) { peak = Math.max(peak, x.v); mdd = Math.min(mdd, (x.v / peak - 1) * 100); }); m.maxDD = mdd;
    var sells = state.trades.filter(function (t) { return t.side === 'sell'; });
    m.trades = state.trades.length; m.closed = sells.length; m.wins = sells.filter(function (t) { return t.pnl > 0; }).length;
    m.winRate = sells.length ? m.wins / sells.length * 100 : null; m.holdings = Object.keys(state.positions).length;
    if (bench && e.length) {
      var b0 = lastClose(ctx, bench, e[0].d), b1 = lastClose(ctx, bench, e[e.length - 1].d);
      m.benchPct = b0 && b1 ? (b1 / b0 - 1) * 100 : null;
    }
    return m;
  }
  function periodStart(dates, period) {
    if (!dates.length) return null;
    var last = dates[dates.length - 1], dt = new Date(last + 'T12:00:00Z');
    var back = { '1D': 1, '1W': 7, '1M': 31, '3M': 92, '1Y': 366 }[period];
    if (period === 'All') return dates[0];
    var cut = period === 'YTD' ? last.slice(0, 4) + '-01-01' : new Date(dt - back * 864e5).toISOString().slice(0, 10);
    if (period === '1D') return dates.length > 1 ? dates[dates.length - 2] : dates[0];
    var s = dates[0]; for (var i = 0; i < dates.length; i++) { if (dates[i] <= cut) s = dates[i]; else break; }
    if (period === 'YTD') { for (i = dates.length - 1; i >= 0; i--) if (dates[i] < cut) return dates[i]; return dates[0]; }
    return s;
  }
  function periodReturn(points, period) {
    if (points.length < 2) return null;
    var ds = points.map(function (p) { return p.d; }), s = periodStart(ds, period), a = points[ds.indexOf(s)], b = points[points.length - 1];
    return a && a.v ? (b.v / a.v - 1) * 100 : null;
  }

  var api = { IND: IND, OPS: OPS, series: series, val: val, evalCond: evalCond, descSpec: descSpec, descCond: descCond, validate: validate, normalize: normalize, sheet: sheet,
    makeCtx: makeCtx, lastClose: lastClose, newState: newState, run: run, decide: decide, fillPending: fillPending, metrics: metrics, equityAt: equityAt, periodStart: periodStart, periodReturn: periodReturn, smaArr: smaArr, rsiArr: rsiArr, emaArr: emaArr };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Engine = api;
})(typeof window !== 'undefined' ? window : this);
