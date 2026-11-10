/* Ai Investor v4.20 — OPTIONAL user-owned CORS proxy (Cloudflare Workers free plan).
   Why: FRED (and sometimes SEC) do not send browser CORS headers. This Worker forwards GET requests ONLY to an
   allow-list of market-data hosts and adds CORS headers. It stores nothing and holds no keys: the app sends your own
   key in the query string to YOUR Worker, which forwards it to the data provider.
   Usage from the app: Settings → Proxy URL = https://<name>.<you>.workers.dev  (requests look like /?url=<encoded target>) */
const ALLOW = new Set(['api.stlouisfed.org', 'data.sec.gov', 'www.sec.gov', 'efts.sec.gov', 'finnhub.io', 'api.massive.com', 'api.polygon.io']);
// Optional: lock the proxy to your own app origins (recommended). Leave empty to allow any origin.
const ORIGINS = ['https://leehizzbt.github.io', 'https://localhost', 'http://localhost'];

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowOrigin = !ORIGINS.length || ORIGINS.some(o => origin === o || origin.startsWith(o + ':')) ? (origin || '*') : null;
    const cors = { 'Access-Control-Allow-Origin': allowOrigin || 'null', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Vary': 'Origin' };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'GET') return new Response('Only GET', { status: 405, headers: cors });
    if (!allowOrigin) return new Response('Origin not allowed', { status: 403, headers: cors });
    const target = new URL(request.url).searchParams.get('url');
    let u; try { u = new URL(target); } catch { return new Response('Missing or bad ?url=', { status: 400, headers: cors }); }
    if (u.protocol !== 'https:' || !ALLOW.has(u.hostname)) return new Response('Host not allowed', { status: 403, headers: cors });
    // SEC requires a declared User-Agent with contact info (https://www.sec.gov/os/accessing-edgar-data). Set CONTACT as a Worker variable.
    const headers = { 'Accept': 'application/json', 'User-Agent': 'AiInvestor/4.20 (personal paper-trading app; ' + (env && env.CONTACT || 'contact-not-set') + ')' };
    const r = await fetch(u.toString(), { headers, cf: { cacheTtl: u.hostname.endsWith('sec.gov') || u.hostname === 'api.stlouisfed.org' ? 3600 : 0 } });
    const out = new Response(r.body, { status: r.status, headers: r.headers });
    Object.entries(cors).forEach(([k, v]) => out.headers.set(k, v));
    out.headers.delete('set-cookie');
    return out;
  }
};
