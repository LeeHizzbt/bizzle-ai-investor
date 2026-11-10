// Runs the Worker's fetch handler in Node (same Fetch API) against real public endpoints. No deploy.
import w from '../worker/proxy.js';
let pass = 0, fail = 0; const ok = (c, n, d = '') => { c ? pass++ : fail++; console.log(c ? 'PASS' : 'FAIL', n, d); };
const O = { headers: { Origin: 'https://leehizzbt.github.io' } };
let r = await w.fetch(new Request('https://p.dev/?url=' + encodeURIComponent('https://data.sec.gov/submissions/CIK0000320193.json'), O), { CONTACT: 'test@example.com' });
const j = r.status === 200 ? await r.json() : {}; ok(r.status === 200 && j.name && r.headers.get('access-control-allow-origin') === 'https://leehizzbt.github.io', 'SEC EDGAR via proxy + CORS', r.status + ' ' + (j.name || ''));
r = await w.fetch(new Request('https://p.dev/?url=' + encodeURIComponent('https://api.stlouisfed.org/fred/series/observations?series_id=DGS10&file_type=json'), O), {});
ok(r.status === 400 && r.headers.get('access-control-allow-origin'), 'FRED reached (400 = no key, as expected) with CORS', String(r.status));
r = await w.fetch(new Request('https://p.dev/?url=' + encodeURIComponent('https://evil.example.com/'), O), {}); ok(r.status === 403, 'non-allow-listed host blocked');
r = await w.fetch(new Request('https://p.dev/?url=' + encodeURIComponent('https://data.sec.gov/x'), { headers: { Origin: 'https://evil.example' } }), {}); ok(r.status === 403, 'foreign origin blocked');
r = await w.fetch(new Request('https://p.dev/', { method: 'POST', headers: O.headers }), {}); ok(r.status === 405, 'POST refused');
console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
