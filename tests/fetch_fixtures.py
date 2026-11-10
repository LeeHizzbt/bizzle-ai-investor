"""Fetch REAL daily bars (2y) from Yahoo's public chart endpoint for TESTS ONLY and save them in the
Massive/Polygon aggregates JSON shape, so the e2e test can serve real prices without a Massive key.
The app itself never calls Yahoo."""
import json, time, urllib.request, os
T = "SPY QQQ IWM DIA XLK XLF XLE XLV XLY XLP AAPL MSFT NVDA AMZN GOOGL META JPM XOM UNH COST AVGO TSLA".split()
out = os.path.join(os.path.dirname(__file__), 'fixtures')
for t in T:
    u = f"https://query1.finance.yahoo.com/v8/finance/chart/{t}?range=2y&interval=1d"
    for i in range(3):
        try:
            d = json.load(urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'}), timeout=30)); break
        except Exception as e:
            print('retry', t, e); time.sleep(3)
    r = d['chart']['result'][0]; q = r['indicators']['quote'][0]; adj = r['indicators'].get('adjclose', [{}])[0].get('adjclose')
    res = []
    for i, ts in enumerate(r['timestamp']):
        if q['close'][i] is None: continue
        res.append({'t': ts * 1000, 'o': round(q['open'][i], 4), 'h': round(q['high'][i], 4), 'l': round(q['low'][i], 4), 'c': round(q['close'][i], 4), 'v': q['volume'][i] or 0})
    json.dump({'ticker': t, 'status': 'OK', 'adjusted': True, 'resultsCount': len(res), 'results': res, 'meta': r['meta'].get('regularMarketPrice')}, open(f"{out}/{t}.json", 'w'))
    print(t, len(res), res[-1]); time.sleep(0.7)
