// Prints the expected Trend Rider (example) test-run result on the real fixture bars, mirroring Agents.testRun defaults.
const E = require('../docs/js/engine.js'), S = require('../docs/js/samples.js'), fs = require('fs'), path = require('path');
const fmtD = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(ms));
const bars = {}; for (const f of fs.readdirSync(path.join(__dirname, 'fixtures'))) { const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', f))); bars[j.ticker] = j.results.map(r => ({ d: fmtD(r.t), o: r.o, h: r.h, l: r.l, c: r.c, v: r.v })); }
const id = process.argv[2] || 'ex-trend', s = S.find(x => x.id === id), r = E.normalize(s.rules), sub = {}; ['SPY', ...r.universe].forEach(t => sub[t] = bars[t]);
const cal = bars.SPY.map(b => b.d), ctx = E.makeCtx(sub); let from = cal[Math.max(210, cal.length - 252)];
const st = E.newState(100000); st.lastDate = cal[cal.indexOf(from) - 1];
E.run(st, ctx, cal, () => ({ rules: r, version: 'test' }), { slippageBps: 5 });
const m = E.metrics(st, ctx, 'SPY'); console.log(JSON.stringify({ value: m.value, trades: m.trades, from: st.equity[0].d, to: st.lastDate }));
