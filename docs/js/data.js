/* Ai Investor v4.20 — real market data only.
   Massive (Polygon) free Stocks Basic: daily bars (≈2 years, end of day, 5 calls/min) for charts, the engine and test runs.
   Finnhub free: live quotes, symbol search, company profile, news, SEC filings list.
   FRED: macro series (needs the optional proxy because FRED blocks browser CORS).
   No key or a failed call → a clear "Unavailable" state. Never invented numbers. */
(function () {
  'use strict';
  var ET = 'America/New_York';
  function etDate(ms) { return new Intl.DateTimeFormat('en-CA', { timeZone: ET }).format(new Date(ms)); }
  function etParts(ms) {
    var p = {}; new Intl.DateTimeFormat('en-US', { timeZone: ET, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short' })
      .formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
    return { date: p.year + '-' + p.month + '-' + p.day, h: +p.hour % 24, m: +p.minute, dow: p.weekday };
  }
  function addDays(d, n) { var x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function isWeekend(d) { var w = new Date(d + 'T12:00:00Z').getUTCDay(); return w === 0 || w === 6; }
  /* Latest session whose end-of-day bar should exist (weekday, after ~5:15 PM ET). Holidays just look "missing" and are tolerated. */
  function expectedLatest(now) {
    var p = etParts(now || Date.now()), d = p.date;
    if (isWeekend(d) || p.h * 60 + p.m < 17 * 60 + 15) d = addDays(d, -1);
    while (isWeekend(d)) d = addDays(d, -1);
    return d;
  }
  function weekdaysBetween(a, b) { var out = []; for (var d = addDays(a, 1); d <= b; d = addDays(d, 1)) if (!isWeekend(d)) out.push(d); return out; }

  function settings() { try { return JSON.parse(localStorage.getItem('aii.dataSettings') || '{}'); } catch (e) { return {}; } }
  function setSettings(s) { localStorage.setItem('aii.dataSettings', JSON.stringify(s)); }

  /* Rate limiter: one call at a time with a minimum gap. */
  function Limiter(gapFn) { this.gapFn = gapFn; this.last = 0; this.q = Promise.resolve(); this.waiting = 0; }
  Limiter.prototype.run = function (fn) {
    var self = this; self.waiting++;
    var p = self.q.then(function () {
      var wait = Math.max(0, self.last + self.gapFn() - Date.now());
      if (wait && Data.onWait) Data.onWait(wait, self.waiting);
      return new Promise(function (r) { setTimeout(r, wait); }).then(function () { self.last = Date.now(); return fn(); });
    });
    self.q = p.then(function () { self.waiting--; }, function () { self.waiting--; });
    return p;
  };
  var massiveLim = new Limiter(function () { var n = +settings().massivePerMin || 5; return Math.ceil(60000 / n) + 150; });
  var finnLim = new Limiter(function () { return 1050; });

  function DataError(msg, code) { var e = new Error(msg); e.code = code; return e; }
  function viaProxy(url) {
    var px = (settings().proxy || '').trim().replace(/\/+$/, '');
    return px ? px + '/?url=' + encodeURIComponent(url) : url;
  }
  function getJSON(url, label, useProxy) {
    return fetch(useProxy ? viaProxy(url) : url).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = JSON.parse(t); } catch (e) {}
        if (r.status === 401 || r.status === 403) throw DataError(label + ' rejected the key or this data is not in your free plan (' + r.status + ')' + (j && (j.error || j.message) ? ': ' + String(j.error || j.message).slice(0, 140) : '') + '.', 'auth');
        if (r.status === 429) throw DataError(label + ' rate limit hit (429). Wait a minute and try again.', 'rate');
        if (!r.ok) throw DataError(label + ' error ' + r.status + (j && (j.error || j.message) ? ': ' + String(j.error || j.message).slice(0, 140) : ''), 'http');
        if (j == null) throw DataError(label + ' returned something that is not JSON.', 'parse');
        return j;
      });
    }, function (e) { throw DataError('Could not reach ' + label + ' (offline, blocked, or CORS). ' + (useProxy ? '' : 'You can set up the optional free proxy in Settings.'), 'network'); });
  }

  /* ---------- Massive daily bars ---------- */
  var MASSIVE = ['https://api.massive.com', 'https://api.polygon.io'];
  function massive(path) {
    var key = Secure.get('data.massive');
    if (!key) return Promise.reject(DataError('Add your free Massive (Polygon) key in Settings to load real daily prices.', 'nokey'));
    var url = MASSIVE[0] + path + (path.indexOf('?') >= 0 ? '&' : '?') + 'apiKey=' + encodeURIComponent(key);
    return massiveLim.run(function () {
      return getJSON(url, 'Massive', !!settings().proxyAll).catch(function (e) {
        if (e.code !== 'network') throw e;
        return getJSON(url.replace(MASSIVE[0], MASSIVE[1]), 'Massive', !!settings().proxyAll);
      });
    });
  }
  function toBars(results) {
    return (results || []).map(function (r) { return { d: etDate(r.t), o: r.o, h: r.h, l: r.l, c: r.c, v: r.v || 0 }; })
      .filter(function (b, i, a) { return b.c != null && (i === 0 || b.d !== a[i - 1].d); });
  }
  function merge(a, b) { var m = {}; (a || []).concat(b || []).forEach(function (x) { m[x.d] = x; }); return Object.keys(m).sort().map(function (k) { return m[k]; }); }
  var mem = {};
  function cached(t) { return mem[t] ? Promise.resolve(mem[t]) : KV.get('bars:' + t).then(function (r) { if (r) mem[t] = r; return r || null; }); }
  function save(t, rec) { mem[t] = rec; return KV.set('bars:' + t, rec); }
  function fresh(rec) { return rec && (rec.through >= expectedLatest() || Date.now() - (rec.checkedAt || 0) < 2 * 3600e3); }

  function fetchFull(t) {
    var to = etDate(Date.now()), from = addDays(to, -729);
    return massive('/v2/aggs/ticker/' + encodeURIComponent(t) + '/range/1/day/' + from + '/' + to + '?adjusted=true&sort=asc&limit=50000').then(function (j) {
      var b = toBars(j.results);
      if (!b.length) throw DataError('No price data for ' + t + '. Check the symbol (US stocks and ETFs only).', 'empty');
      var rec = { t: t, bars: b, through: b[b.length - 1].d, checkedAt: Date.now(), source: 'Massive (Polygon) daily, split-adjusted' };
      return save(t, rec).then(function () { return rec; });
    });
  }
  function topUp(t, rec) {
    var to = etDate(Date.now()), from = addDays(rec.through, 1);
    if (from > to) { rec.checkedAt = Date.now(); return save(t, rec).then(function () { return rec; }); }
    return massive('/v2/aggs/ticker/' + encodeURIComponent(t) + '/range/1/day/' + from + '/' + to + '?adjusted=true&sort=asc&limit=50000').then(function (j) {
      rec.bars = merge(rec.bars, toBars(j.results)); rec.through = rec.bars[rec.bars.length - 1].d; rec.checkedAt = Date.now();
      return save(t, rec).then(function () { return rec; });
    });
  }
  /* One grouped call returns every US ticker for one day: cheaper than N per-ticker calls when many tickers are 1–2 days behind. */
  function topUpGrouped(tickers, recs) {
    var minThrough = tickers.map(function (t) { return recs[t].through; }).sort()[0];
    var days = weekdaysBetween(minThrough, expectedLatest());
    return days.reduce(function (p, d) {
      return p.then(function () {
        return massive('/v2/aggs/grouped/locale/us/market/stocks/' + d + '?adjusted=true').then(function (j) {
          var by = {}; (j.results || []).forEach(function (r) { by[r.T] = r; });
          tickers.forEach(function (t) {
            var r = by[t], rec = recs[t];
            if (r && d > rec.through) { rec.bars = merge(rec.bars, [{ d: d, o: r.o, h: r.h, l: r.l, c: r.c, v: r.v || 0 }]); rec.through = d; }
          });
        });
      });
    }, Promise.resolve()).then(function () {
      return Promise.all(tickers.map(function (t) { recs[t].checkedAt = Date.now(); return save(t, recs[t]); }));
    });
  }

  /* Ensure fresh bars for tickers. onProgress(done, total, ticker). Resolves {bars:{T:[...]}, errors:{T:msg}, sources} */
  function ensure(tickers, onProgress) {
    tickers = tickers.filter(function (t, i, a) { return t && a.indexOf(t) === i; });
    var out = { bars: {}, errors: {}, through: {} }, recs = {}, done = 0;
    function tick(t) { done++; if (onProgress) onProgress(done, tickers.length, t); }
    return Promise.all(tickers.map(function (t) { return cached(t).then(function (r) { recs[t] = r; }); })).then(function () {
      var missing = tickers.filter(function (t) { return !recs[t]; });
      var stale = tickers.filter(function (t) { return recs[t] && !fresh(recs[t]); });
      var fr = tickers.filter(function (t) { return recs[t] && fresh(recs[t]); });
      fr.forEach(function (t) { tick(t); });
      var chain = Promise.resolve();
      if (stale.length) {
        var minThrough = stale.map(function (t) { return recs[t].through; }).sort()[0];
        var nDays = weekdaysBetween(minThrough, expectedLatest()).length;
        if (stale.length > 1 && nDays > 0 && nDays < stale.length && nDays <= 5)
          chain = chain.then(function () { return topUpGrouped(stale, recs).then(function () { stale.forEach(tick); }, function () { return perTicker(stale); }); });
        else chain = chain.then(function () { return perTicker(stale); });
      }
      function perTicker(list) {
        return list.reduce(function (p, t) {
          return p.then(function () { return topUp(t, recs[t]).then(function (r) { recs[t] = r; }, function (e) { if (e.code === 'nokey') throw e; out.errors[t] = 'Using cached prices through ' + recs[t].through + ' (' + e.message + ')'; }).then(function () { tick(t); }); });
        }, Promise.resolve());
      }
      chain = chain.then(function () {
        return missing.reduce(function (p, t) {
          return p.then(function () { return fetchFull(t).then(function (r) { recs[t] = r; }, function (e) { if (e.code === 'nokey') throw e; out.errors[t] = e.message; }).then(function () { tick(t); }); });
        }, Promise.resolve());
      });
      return chain;
    }).then(function () {
      tickers.forEach(function (t) { if (recs[t]) { out.bars[t] = recs[t].bars; out.through[t] = recs[t].through; } });
      return out;
    });
  }
  function cachedOnly(tickers) {
    var out = { bars: {}, through: {} };
    return Promise.all(tickers.map(function (t) { return cached(t).then(function (r) { if (r) { out.bars[t] = r.bars; out.through[t] = r.through; } }); })).then(function () { return out; });
  }

  /* ---------- Finnhub ---------- */
  function finnhub(path) {
    var key = Secure.get('data.finnhub');
    if (!key) return Promise.reject(DataError('Add your free Finnhub key in Settings for live quotes, news and filings.', 'nokey'));
    var url = 'https://finnhub.io/api/v1' + path + (path.indexOf('?') >= 0 ? '&' : '?') + 'token=' + encodeURIComponent(key);
    return finnLim.run(function () { return getJSON(url, 'Finnhub', !!settings().proxyAll); });
  }
  function quote(t) {
    return finnhub('/quote?symbol=' + encodeURIComponent(t)).then(function (q) {
      if (!q || (!q.c && !q.t)) throw DataError('Finnhub has no quote for ' + t + '.', 'empty');
      return { price: q.c, change: q.d, changePct: q.dp, high: q.h, low: q.l, open: q.o, prevClose: q.pc, time: q.t * 1000, source: 'Finnhub' };
    });
  }
  function search(q) { return finnhub('/search?q=' + encodeURIComponent(q) + '&exchange=US').then(function (j) { return (j.result || []).filter(function (r) { return /Common Stock|ETP|ETF|ADR/i.test(r.type || '') || !r.type; }).slice(0, 12); }); }
  function profile(t) { return finnhub('/stock/profile2?symbol=' + encodeURIComponent(t)); }
  function news(t) { var to = etDate(Date.now()), from = addDays(to, -10); return finnhub('/company-news?symbol=' + encodeURIComponent(t) + '&from=' + from + '&to=' + to).then(function (a) { return (a || []).slice(0, 12); }); }
  function filings(t) { return finnhub('/stock/filings?symbol=' + encodeURIComponent(t)).then(function (a) { return (a || []).filter(function (f) { return /10-K|10-Q|8-K|S-1|DEF 14A|20-F|6-K/.test(f.form); }).slice(0, 15); }); }
  function marketStatus() { return finnhub('/stock/market-status?exchange=US'); }

  /* ---------- FRED (needs the user's proxy; FRED sends no CORS headers) ---------- */
  function fred(series) {
    var key = Secure.get('data.fred');
    if (!key) return Promise.reject(DataError('Add a free FRED key in Settings for macro data.', 'nokey'));
    if (!settings().proxy) return Promise.reject(DataError('FRED blocks direct browser calls. Add your free Cloudflare Worker proxy URL in Settings (see worker/README.md).', 'proxy'));
    var start = addDays(etDate(Date.now()), -800);
    return getJSON('https://api.stlouisfed.org/fred/series/observations?series_id=' + series + '&api_key=' + encodeURIComponent(key) + '&file_type=json&observation_start=' + start, 'FRED', true)
      .then(function (j) { return (j.observations || []).filter(function (o) { return o.value !== '.'; }).map(function (o) { return { d: o.date, v: +o.value }; }); });
  }

  window.Data = { ensure: ensure, cachedOnly: cachedOnly, quote: quote, search: search, profile: profile, news: news, filings: filings, marketStatus: marketStatus, fred: fred,
    settings: settings, setSettings: setSettings, expectedLatest: expectedLatest, etDate: etDate, etParts: etParts, addDays: addDays, onWait: null,
    clearCache: function () { mem = {}; return KV.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return /^bars:/.test(k); }).map(KV.del)); }); } };
})();
