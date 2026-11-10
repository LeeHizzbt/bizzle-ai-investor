# Optional proxy for Ai Investor (Cloudflare Worker, free)

You only need this for the **Macro (FRED)** page, or if your network blocks direct calls to Finnhub/Massive.
Finnhub and Massive already allow browser calls (CORS), so the main app works without it.

**Not deployed for you.** Deploy it to your own Cloudflare account only if you want it.

## What it does
- Forwards `GET /?url=<https URL>` only to: `api.stlouisfed.org`, `data.sec.gov`, `www.sec.gov`, `efts.sec.gov`, `finnhub.io`, `api.massive.com`, `api.polygon.io`.
- Adds CORS headers for the allowed origins in `ORIGINS` (GitHub Pages + the Android app by default).
- Stores nothing and holds no keys. Your key travels from the app to your Worker and on to the provider, over HTTPS.

## Deploy (about 3 minutes, free plan)
1. Make a free Cloudflare account, then install Wrangler: `npm i -g wrangler`, then run `wrangler login`.
2. Edit `wrangler.toml`: set `CONTACT` to an email you own. The SEC asks for a contact in the User-Agent.
3. In this folder, run `wrangler deploy`. Wrangler prints a URL like `https://ai-investor-proxy.<you>.workers.dev`.
4. In Ai Investor, go to **Settings → Optional proxy URL** and paste that URL. Add your FRED key and open **Macro**.

To use a custom domain instead of `*.workers.dev`, also add it to `connect-src` in `docs/index.html`, because the CSP only allows `*.workers.dev`.

Free plan: 100,000 requests/day (see https://developers.cloudflare.com/workers/platform/pricing/).
