# Ai Investor <sub>v4.20</sub>

**Describe an investing idea in plain English. An AI drafts explicit rules. You approve them. A deterministic paper agent then trades fake money against real US stock and ETF prices.**

Live: https://leehizzbt.github.io/bizzle-ai-investor/ · Android APK: https://leehizzbt.github.io/bizzle-ai-investor/download/ai-investor-v4.20.apk

> ⚠ **Not financial advice. Paper trading only:** fake money, real prices. Past and simulated results do not predict future results. There is no real-money trading, broker login, deposit or withdrawal anywhere in this app.

This is an original, free app. It copies the *flow* of AI paper-trading strategy labs (idea → rules → approve → paper agent), but none of their branding, logos, copy or code.

## Features
- **Plain-English idea → rules → approve.** The AI (your own key) writes a JSON rule file. Code turns that file into a plain-English rule sheet (Watches / Buys when / Ranks / Sizes / Sells when / Checks). You approve exactly what will run. You can also edit the JSON, ask the AI for changes, or attach a screenshot of a strategy note or chart.
- **Deterministic engine, not an LLM trader** (`docs/js/engine.js`). It checks once per session after the close and fills paper orders at the **next session's open** ± slippage. It supports SMA, EMA, RSI, % return, highest/lowest-N breakouts, average volume, drawdown, MACD, Bollinger bands, ATR, crosses, ranking, stop loss, trailing stop, take profit, max hold days, and %-of-equity / equal-weight / fixed-dollar sizing. Starting cash is **$100,000** by default (you can change it).
- **A reason on every trade:** the exact rule that fired, plus the numbers behind it (e.g. `close (512.30) > 200-day SMA (480.10); ranked #2 by 126-day % return (14.2)`).
- **Append-only, versioned record.** Editing rules creates v2, v3 and so on, and old trades keep their version. Every launch, trade, version, pause and journal entry is SHA-256 hash-chained, and the Strategy tab verifies the chain.
- **Forward paper record:** it catches up on every session that closed since you last opened the app (or tapped ⟳).
- **Historical test run / replay** on ~2 years of real daily bars, clearly labeled and kept separate from the forward record. It shows equity vs SPY, a replay speed control and its trade list.
- **Journal** written from the record, with AI or without it. **Grounded chat** answers only from the record, cites trade ids and runs an automatic *grounding check* that flags numbers not found in the record. Chat cannot change the agent.
- **Standings vs SPY** for your own agents, with period chips (1D…All). **Watchlist** with Finnhub quotes and symbol search. **Ticker page** with line/candle chart, SMA 50/200, RSI, 52-week stats, company profile, news and SEC filings. **Trade log** with filter and CSV export. **Macro** page (FRED, optional). **Example strategies** (4 originals, labeled EXAMPLE). **Fork / export / import** strategy files. **Backup / restore** (backups never contain keys).
- House must-haves: a themed **Back** button on every page (Android back key works too), a **copy button on every AI reply**, **screenshot upload** (idea wizard, agent chat, Bizzy), **Advanced AI Settings** (Gemini default, Groq, OpenRouter free; tier/model picker with live list, temperature, max tokens, extra instructions, key test), **AI themes** (7 presets plus "describe a vibe" AI-generated themes), the **Bizzy pop-up** with on-device memory ("remember …"), and **neon green v4.20** branding.

## Data: real numbers only
| What | Source | Free plan |
|---|---|---|
| Daily bars (charts, engine, test runs) | [Massive (Polygon) Stocks Basic](https://massive.com/pricing) | EOD, ~2 years, 5 calls/min |
| Quotes, search, profile, news, SEC filings list | [Finnhub](https://finnhub.io/pricing) | 60 calls/min, personal use |
| Macro (optional) | [FRED](https://fred.stlouisfed.org/docs/api/api_key.html) | free key, needs proxy |

With no key, or when a call fails, the app shows a clear **Unavailable / add key / error** state. It never shows invented or simulated prices. Bars are cached in IndexedDB. Daily top-ups use the grouped-daily endpoint, so a day's update costs one call for all tickers. Free data is for personal use: do not redistribute it.

**Optional proxy:** `worker/` holds a tiny Cloudflare Worker that only proxies an allow-list of hosts (see `worker/README.md`). It is **not deployed**. FRED needs it because FRED sends no CORS headers. Finnhub and Massive work directly.

## Privacy and security
- No backend and no account. Agents, records, price cache and Bizzy memory stay in the browser/app.
- API keys are **AES-GCM encrypted at rest** with a **non-extractable WebCrypto device key** (IndexedDB). Each key is sent only to its own provider. No keys live in this repo.
- A strict CSP limits network calls to the data/AI providers and `*.workers.dev`.

## Assumptions and limits
- Decisions use end-of-day bars after the close; fills happen at the next open ± slippage (5 bps default). No commissions, dividends, taxes, shorting or leverage. Prices are split-adjusted.
- No unattended nightly run in v4.20. Agents update when you open the app. Max 15 tickers per agent.
- On the free Massive plan, the first load of many tickers takes a few minutes (5 calls/min). After that, prices come from the cache.

## Build and test
```bash
python3 -m http.server -d docs 8766         # web (GitHub Pages serves main:/docs)
scripts/bump-version.sh                     # new build id → SW cache + ?v= busting
node tests/engine.test.js                   # engine unit tests on real bars (tests/fixtures)
node tests/proxy.test.mjs                   # Worker proxy handler tests (no deploy)
python3 tests/e2e.py --base http://localhost:8766/   # Playwright e2e, 5 widths; GEMINI_API_KEY enables real-AI tests
# Android (Capacitor 7): signing reads keystore/keystore.properties (gitignored)
npm install && npx cap sync android && rm -rf android/app/src/main/assets/public/download && (cd android && ./gradlew assembleRelease)
```
The e2e and engine tests use **real** daily bars saved in `tests/fixtures` (fetched by `tests/fetch_fixtures.py`). They are served through mocks of the Massive/Finnhub APIs because the build machine has no market-data keys. The app itself never uses those fixtures.

The APK is also released in the private `LeeHizzbt/kief-releases` repo (tag `ai-investor-v4.20`).

MIT licensed.
