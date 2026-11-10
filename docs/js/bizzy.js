/* Ai Investor v4.20 — Bizzy pop-up helper with on-device memory, screenshot upload and copy buttons. */
(function () {
  'use strict';
  var h = UI.h, MEM = 'aii.bizzy.mem', LOG = 'aii.bizzy.chat';
  function memory() { try { return JSON.parse(localStorage.getItem(MEM)) || []; } catch (e) { return []; } }
  function setMem(m) { localStorage.setItem(MEM, JSON.stringify(m.slice(-50))); }
  function remember(text) { var m = memory(); m.push({ text: text, at: new Date().toISOString() }); setMem(m); }
  function forget(i) { var m = memory(); m.splice(i, 1); setMem(m); }
  function log() { try { return JSON.parse(localStorage.getItem(LOG)) || []; } catch (e) { return []; } }
  function setLog(l) { localStorage.setItem(LOG, JSON.stringify(l.slice(-40))); }
  var SYS = 'You are Bizzy, the friendly helper inside Ai Investor v4.20 (a free, paper-trading-only strategy lab for US stocks and ETFs). ' +
    'You explain how the app works (idea → AI drafts rules → user approves → deterministic engine runs them on paper, decides after the close, fills at next open; test runs are separate; journal and chat read the record; keys encrypted on device; Massive for daily bars, Finnhub for quotes/news, FRED optional via proxy). ' +
    'You can explain indicators (SMA, EMA, RSI, MACD, Bollinger, ATR, drawdown) and help phrase strategy ideas. Never give personalized financial advice, never predict prices, never invent numbers; only quote numbers from the APP STATE below. ' +
    'There is no real-money trading, broker login, deposit or withdrawal — say so if asked. Keep answers short and practical. If the user says "remember …", confirm briefly.';
  var panel, list, input, imgs = [], thumbs;
  function state() {
    return { route: location.hash, agents: (Agents.list || []).map(function (a) { var m = Agents.metrics(a); return { name: a.name, value: m.value, totalPct: +m.totalPct.toFixed(2), holdings: m.holdings, trades: m.trades, paused: a.paused, rulesVersion: Agents.current(a).v }; }),
      keys: { massive: Secure.has('data.massive'), finnhub: Secure.has('data.finnhub'), ai: !!AI.getKeys()[AI.getSettings().provider] } };
  }
  function bubble(m) {
    if (m.role === 'user') return h('div', { class: 'msg user' }, h('div', { class: 'bubble' }, m.text, m.img ? ' 📷' : ''));
    return h('div', { class: 'msg bot ai-reply' }, h('div', { class: 'ai-head' }, h('span', {}, 'Bizzy' + (m.model ? ' · ' + m.model : '')), UI.copyBtn(m.text)), h('div', { class: 'md', html: UI.md(m.text) }));
  }
  function send() {
    var text = input.value.trim(); if (!text && !imgs.length) return; input.value = '';
    var l = log(), userMsg = { role: 'user', text: text || '(screenshot)', img: imgs.length > 0 }; l.push(userMsg); setLog(l); list.appendChild(bubble(userMsg));
    var rm = /^\s*remember( that)?\s+(.+)/i.exec(text); if (rm) remember(rm[2].trim());
    var wait = h('p', { class: 'muted' }, 'Bizzy is thinking…'); list.appendChild(wait); list.scrollTop = list.scrollHeight;
    var s = AI.getSettings(), mem = memory().map(function (m) { return '- ' + m.text; }).join('\n');
    var sys = SYS + '\n\nMEMORY (things the user asked you to remember):\n' + (mem || '(none)') + '\n\nAPP STATE:\n' + JSON.stringify(state());
    var hist = l.slice(-12, -1).map(function (m) { return { role: m.role, text: m.text }; });
    AI.chat({ provider: s.provider, model: s.model || undefined, effort: s.effort, temperature: s.temperature, maxTokens: 1200, system: sys, messages: hist.concat([{ role: 'user', text: text || 'What is in this screenshot? Relate it to Ai Investor.', images: imgs.splice(0) }]) }).then(function (r) {
      var bm = { role: 'assistant', text: r.text, model: r.model }; var l2 = log(); l2.push(bm); setLog(l2); wait.remove(); list.appendChild(bubble(bm)); thumbs.innerHTML = ''; list.scrollTop = list.scrollHeight;
    }, function (e) {
      wait.remove(); var t = rm ? 'Saved to memory: “' + rm[2].trim() + '”. ' : ''; t += /No .* key/.test(e.message) ? 'Add an AI key in Settings → Advanced AI Settings so I can answer.' : e.message;
      var bm = { role: 'assistant', text: t, model: 'app' }; var l3 = log(); l3.push(bm); setLog(l3); list.appendChild(bubble(bm)); thumbs.innerHTML = '';
    });
  }
  function init() {
    if (document.getElementById('bizzyBtn')) return;
    var btn = h('button', { id: 'bizzyBtn', class: 'bizzy-btn', type: 'button', 'aria-label': 'Open Bizzy helper', onclick: function () { panel.classList.toggle('open'); if (panel.classList.contains('open')) input.focus(); } }, h('span', {}, 'B'));
    list = h('div', { class: 'bz-list', id: 'bizzyList' }); thumbs = h('div', { class: 'thumbs' });
    input = h('textarea', { id: 'bizzyInput', rows: 2, placeholder: 'Ask Bizzy… (say "remember …" to save a note)' });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    panel = h('div', { class: 'bizzy-panel', id: 'bizzyPanel', role: 'dialog', 'aria-label': 'Bizzy helper' },
      h('div', { class: 'bz-head' }, h('button', { class: 'back-btn small', type: 'button', 'aria-label': 'Close Bizzy', onclick: function () { panel.classList.remove('open'); } }, '‹ Back'), h('strong', {}, 'Bizzy'), h('span', { class: 'ver' }, 'v4.20'),
        h('button', { class: 'icon-btn', type: 'button', title: 'Clear chat (keeps memory)', 'aria-label': 'Clear chat', onclick: function () { setLog([]); list.innerHTML = ''; } }, '🧹')),
      list, thumbs,
      h('div', { class: 'composer' }, h('button', { class: 'icon-btn', type: 'button', id: 'bizzyShot', title: 'Upload screenshot', 'aria-label': 'Upload screenshot', onclick: function () { UI.pickImage(function (im) { imgs.push(im); thumbs.appendChild(h('span', { class: 'thumb' }, h('img', { src: im.url, alt: 'screenshot' }))); }); } }, '📷'), input, h('button', { class: 'btn', type: 'button', id: 'bizzySend', onclick: send }, 'Send')),
      h('small', { class: 'muted bz-foot' }, 'Not financial advice · memory stays on this device'));
    var l = log(); if (!l.length) list.appendChild(h('p', { class: 'muted' }, 'Hi, I’m Bizzy. Ask how rules work, what RSI means, or why an agent did something. I remember things you tell me to.'));
    l.forEach(function (m) { list.appendChild(bubble(m)); });
    document.body.appendChild(btn); document.body.appendChild(panel);
  }
  window.Bizzy = { init: init, memory: memory, remember: remember, forget: forget };
})();
