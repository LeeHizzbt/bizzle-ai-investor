// Unit tests for the deterministic engine on REAL bars (tests/fixtures, fetched by fetch_fixtures.py).
const E = require('../docs/js/engine.js'), S = require('../docs/js/samples.js'), fs = require('fs'), path = require('path');
let pass = 0, fail = 0; const ok = (c, n, d = '') => { if (c) { pass++; console.log('PASS', n, d); } else { fail++; console.log('FAIL', n, d); } };
const fmtD = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(ms));
const bars = {}; for (const f of fs.readdirSync(path.join(__dirname, 'fixtures'))) { const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', f))); bars[j.ticker] = j.results.map(r => ({ d: fmtD(r.t), o: r.o, h: r.h, l: r.l, c: r.c, v: r.v })); }
// indicator sanity vs hand calc
const c = [1, 2, 3, 4, 5, 6]; ok(JSON.stringify(E.smaArr(c, 3)) === JSON.stringify([null, null, 2, 3, 4, 5]), 'SMA(3)');
const rs = E.rsiArr([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], 14); ok(rs[14] === 100, 'RSI all-up = 100');
const em = E.emaArr([1, 2, 3, 4, 5], 3); ok(em[2] === 2 && Math.abs(em[3] - 3) < 1e-9, 'EMA(3) seed + step');
for (const s of S) { const r = E.normalize(s.rules); const errs = E.validate(r); ok(!errs.length, 'sample valid: ' + s.name, errs.join('; ')); }
ok(E.validate({ name: 'x', universe: ['aapl!'], entry: { all: [] }, exit: {}, sizing: {}, maxPositions: 0 }).length >= 4, 'validator rejects bad rules');
const cal = bars.SPY.map(b => b.d); const ctx = E.makeCtx(bars);
for (const s of S) {
  const r = E.normalize(s.rules); const from = cal[cal.length - 252];
  const st = E.newState(100000); E.run(st, ctx, cal, () => ({ rules: r, version: 1 }), { from, slippageBps: 5 });
  const st2 = E.newState(100000); E.run(st2, ctx, cal, () => ({ rules: r, version: 1 }), { from, slippageBps: 5 });
  const m = E.metrics(st, ctx, 'SPY');
  ok(JSON.stringify(st.trades) === JSON.stringify(st2.trades), 'deterministic: ' + s.name, `${st.trades.length} trades, total ${m.totalPct.toFixed(2)}% vs SPY ${m.benchPct.toFixed(2)}%, maxDD ${m.maxDD.toFixed(2)}%`);
  ok(st.equity.length === 252, 'equity points = sessions: ' + s.name);
  // every fill price is a real open +- slippage, and fills happen the session after the decision
  const bad = st.trades.filter(t => { const i = ctx.idx[t.ticker][t.filledOn]; const o = bars[t.ticker][i].o; const exp = t.side === 'buy' ? o * 1.0005 : o * 0.9995; return Math.abs(exp - t.price) > 0.011 || !(t.filledOn > t.decidedOn) || cal.indexOf(t.filledOn) !== cal.indexOf(t.decidedOn) + 1; });
  ok(bad.length === 0, 'fills at next real open: ' + s.name, bad.length ? JSON.stringify(bad[0]) : '');
  ok(st.trades.every(t => t.reason && t.reason.length > 10), 'every trade has a reason: ' + s.name);
  ok(st.cash >= -0.01, 'never negative cash: ' + s.name, st.cash.toFixed(2));
  // incremental forward run == one-shot run
  const st3 = E.newState(100000); const mid = cal[cal.length - 100];
  E.run(st3, ctx, cal, () => ({ rules: r, version: 1 }), { from, until: mid, slippageBps: 5 }); E.run(st3, ctx, cal, () => ({ rules: r, version: 1 }), { slippageBps: 5 });
  ok(JSON.stringify(st3.trades) === JSON.stringify(st.trades), 'incremental == one-shot: ' + s.name);
}
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
