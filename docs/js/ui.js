/* Ai Investor v4.20 — UI helpers: DOM, formatting, toasts, copy buttons, screenshots, markdown, canvas charts. */
(function () {
  'use strict';
  function h(tag, attrs) {
    var el = document.createElement(tag), kids = Array.prototype.slice.call(arguments, 2);
    for (var k in (attrs || {})) {
      var v = attrs[k]; if (v == null || v === false) continue;
      if (k === 'class') el.className = v; else if (k === 'html') el.innerHTML = v; else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v); else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    kids.flat(9).forEach(function (c) { if (c == null || c === false) return; el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c); });
    return el;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(x, d) { if (x == null || !isFinite(x)) return 'Unavailable'; return (x < 0 ? '−$' : '$') + Math.abs(x).toLocaleString('en-US', { minimumFractionDigits: d == null ? 2 : d, maximumFractionDigits: d == null ? 2 : d }); }
  function pct(x, d) { if (x == null || !isFinite(x)) return '—'; return (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d == null ? 2 : d) + '%'; }
  function num(x, d) { if (x == null || !isFinite(x)) return '—'; return (+x).toLocaleString('en-US', { maximumFractionDigits: d == null ? 2 : d }); }
  function cls(x) { return x > 0 ? 'up' : x < 0 ? 'down' : ''; }
  function toast(msg, kind) {
    var t = h('div', { class: 'toast ' + (kind || ''), role: 'status' }, msg); document.body.appendChild(t);
    setTimeout(function () { t.classList.add('show'); }, 10); setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, 3200);
  }
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).catch(fallback);
    return Promise.resolve(fallback());
    function fallback() { var ta = h('textarea', { style: { position: 'fixed', opacity: 0 } }); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} ta.remove(); }
  }
  function copyBtn(getText, label) {
    var b = h('button', { class: 'copy-btn', type: 'button', title: 'Copy', 'aria-label': 'Copy reply', onclick: function () {
      copyText(typeof getText === 'function' ? getText() : getText).then(function () { b.textContent = '✓ Copied'; setTimeout(function () { b.textContent = label || '⧉ Copy'; }, 1400); });
    } }, label || '⧉ Copy');
    return b;
  }
  /* Screenshot / image upload → downscaled JPEG base64 for vision models. */
  function pickImage(cb) {
    var inp = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
    inp.onchange = function () { var f = inp.files[0]; if (f) readImage(f).then(cb, function (e) { toast(e.message, 'bad'); }); inp.remove(); };
    document.body.appendChild(inp); inp.click();
  }
  function readImage(file) {
    return new Promise(function (res, rej) {
      if (!/^image\//.test(file.type)) return rej(new Error('That file is not an image.'));
      var fr = new FileReader(); fr.onerror = function () { rej(new Error('Could not read the image.')); };
      fr.onload = function () {
        var img = new Image(); img.onerror = function () { rej(new Error('Could not decode the image.')); };
        img.onload = function () {
          var s = Math.min(1, 1280 / Math.max(img.width, img.height)), c = document.createElement('canvas');
          c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          var url = c.toDataURL('image/jpeg', 0.85); res({ mime: 'image/jpeg', base64: url.split(',')[1], url: url, name: file.name });
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  }
  function md(src) {
    var e = function (s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
    var lines = String(src || '').replace(/\r/g, '').split('\n'), out = [], inCode = false, code = [], list = null;
    function inline(s) {
      s = e(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
      return s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    }
    function closeList() { if (list) { out.push('</' + list + '>'); list = null; } }
    lines.forEach(function (l) {
      if (/^```/.test(l)) { if (inCode) { out.push('<pre><code>' + e(code.join('\n')) + '</code></pre>'); code = []; inCode = false; } else { closeList(); inCode = true; } return; }
      if (inCode) { code.push(l); return; }
      var m;
      if ((m = /^(#{1,4})\s+(.*)/.exec(l))) { closeList(); var lv = Math.min(5, m[1].length + 2); out.push('<h' + lv + '>' + inline(m[2]) + '</h' + lv + '>'); return; }
      if ((m = /^>\s?(.*)/.exec(l))) { closeList(); out.push('<blockquote>' + inline(m[1]) + '</blockquote>'); return; }
      if ((m = /^\s*[-*]\s+(.*)/.exec(l))) { if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; } out.push('<li>' + inline(m[1]) + '</li>'); return; }
      if ((m = /^\s*\d+[.)]\s+(.*)/.exec(l))) { if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; } out.push('<li>' + inline(m[1]) + '</li>'); return; }
      if (!l.trim()) { closeList(); return; }
      closeList(); out.push('<p>' + inline(l) + '</p>');
    });
    if (inCode) out.push('<pre><code>' + e(code.join('\n')) + '</code></pre>');
    closeList(); return out.join('\n');
  }
  function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }

  /* ---------- canvas charts ----------
     lines: [{points:[{d, v}], color, width, dash, label}] sharing one date axis (first series defines dates).
     opts: {height, candles:[{d,o,h,l,c}], baseline, sub:{points, min, max, levels}, readout:el, money:bool} */
  function chart(container, lines, opts) {
    opts = opts || {};
    container.innerHTML = '';
    var wrap = h('div', { class: 'chart' }), cv = h('canvas', { role: 'img', 'aria-label': opts.label || 'Price chart' }), ro = h('div', { class: 'chart-readout' });
    wrap.appendChild(ro); wrap.appendChild(cv); container.appendChild(wrap);
    var dates = opts.candles ? opts.candles.map(function (b) { return b.d; }) : (lines[0] ? lines[0].points.map(function (p) { return p.d; }) : []);
    if (!dates.length) { wrap.appendChild(h('div', { class: 'empty' }, opts.empty || 'No data to chart.')); return; }
    var ix = {}; dates.forEach(function (d, i) { ix[d] = i; });
    function draw(hover) {
      var W = wrap.clientWidth || 300, H = opts.height || 240, subH = opts.sub ? 70 : 0, dpr = window.devicePixelRatio || 1;
      cv.width = W * dpr; cv.height = (H + subH) * dpr; cv.style.width = W + 'px'; cv.style.height = (H + subH) + 'px';
      var g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H + subH);
      var padL = 6, padR = 58, padT = 10, padB = 20, lo = Infinity, hi = -Infinity;
      if (opts.candles) opts.candles.forEach(function (b) { lo = Math.min(lo, b.l); hi = Math.max(hi, b.h); });
      lines.forEach(function (s) { s.points.forEach(function (p) { if (p.v != null && ix[p.d] != null) { lo = Math.min(lo, p.v); hi = Math.max(hi, p.v); } }); });
      if (opts.baseline != null) { lo = Math.min(lo, opts.baseline); hi = Math.max(hi, opts.baseline); }
      if (!isFinite(lo)) return; if (hi === lo) { hi += 1; lo -= 1; } var padV = (hi - lo) * 0.06; hi += padV; lo -= padV;
      var n = dates.length, X = function (i) { return padL + (n === 1 ? (W - padL - padR) / 2 : i / (n - 1) * (W - padL - padR)); }, Y = function (v) { return padT + (hi - v) / (hi - lo) * (H - padT - padB); };
      var line = cssVar('--line') || '#1d2a20', muted = cssVar('--muted') || '#8a9a8e';
      g.strokeStyle = line; g.fillStyle = muted; g.font = '11px system-ui'; g.lineWidth = 1; g.textAlign = 'left';
      for (var k = 0; k <= 4; k++) { var v = lo + (hi - lo) * k / 4, y = Y(v); g.beginPath(); g.moveTo(padL, y); g.lineTo(W - padR, y); g.stroke(); g.fillText(opts.money === false ? num(v, 1) : (Math.abs(v) >= 1e4 ? '$' + (v / 1000).toFixed(1) + 'k' : '$' + v.toFixed(v < 10 ? 2 : 0)), W - padR + 4, y + 4); }
      g.textAlign = 'center'; [0, Math.floor(n / 2), n - 1].forEach(function (i) { if (dates[i]) g.fillText(dates[i].slice(2), Math.min(Math.max(X(i), 30), W - padR - 30), H - 4); });
      if (opts.baseline != null) { g.setLineDash([4, 4]); g.strokeStyle = muted; g.beginPath(); g.moveTo(padL, Y(opts.baseline)); g.lineTo(W - padR, Y(opts.baseline)); g.stroke(); g.setLineDash([]); }
      if (opts.candles) {
        var bw = Math.max(1, (W - padL - padR) / n * 0.6), good = cssVar('--good'), bad = cssVar('--bad');
        opts.candles.forEach(function (b, i) { var c = b.c >= b.o ? good : bad; g.strokeStyle = c; g.fillStyle = c; g.beginPath(); g.moveTo(X(i), Y(b.h)); g.lineTo(X(i), Y(b.l)); g.stroke(); var y1 = Y(Math.max(b.o, b.c)), y2 = Y(Math.min(b.o, b.c)); g.fillRect(X(i) - bw / 2, y1, bw, Math.max(1, y2 - y1)); });
      }
      lines.forEach(function (s) {
        g.strokeStyle = s.color || cssVar('--accent'); g.lineWidth = s.width || 2; g.setLineDash(s.dash || []); g.beginPath(); var started = false;
        s.points.forEach(function (p) { var i = ix[p.d]; if (i == null || p.v == null) { started = false; return; } if (!started) { g.moveTo(X(i), Y(p.v)); started = true; } else g.lineTo(X(i), Y(p.v)); });
        g.stroke(); g.setLineDash([]);
      });
      if (opts.sub) {
        var s0 = H + 6, s1 = H + subH - 4, sl = opts.sub.min, sh = opts.sub.max, SY = function (v) { return s0 + (sh - v) / (sh - sl) * (s1 - s0); };
        g.strokeStyle = line; (opts.sub.levels || []).forEach(function (l) { g.beginPath(); g.moveTo(padL, SY(l)); g.lineTo(W - padR, SY(l)); g.stroke(); g.fillStyle = muted; g.textAlign = 'left'; g.fillText(String(l), W - padR + 4, SY(l) + 4); });
        g.strokeStyle = cssVar('--accent2') || '#7c4dff'; g.lineWidth = 1.5; g.beginPath(); var st = false;
        opts.sub.points.forEach(function (p) { var i = ix[p.d]; if (i == null || p.v == null) return; if (!st) { g.moveTo(X(i), SY(p.v)); st = true; } else g.lineTo(X(i), SY(p.v)); }); g.stroke();
        g.fillStyle = muted; g.fillText(opts.sub.label || '', padL + 2, s0 + 10);
      }
      if (hover != null) {
        g.strokeStyle = muted; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(X(hover), padT); g.lineTo(X(hover), H - padB); g.stroke(); g.setLineDash([]);
        var d = dates[hover], parts = [d];
        if (opts.candles) { var b = opts.candles[hover]; parts.push('O ' + money(b.o), 'H ' + money(b.h), 'L ' + money(b.l), 'C ' + money(b.c)); }
        lines.forEach(function (s) { var p = s.points.filter(function (q) { return q.d === d; })[0]; if (p && p.v != null) parts.push((s.label || '') + ' ' + (opts.money === false ? num(p.v) : money(p.v))); });
        ro.textContent = parts.join(' · ');
      } else ro.textContent = opts.readout || '';
    }
    function at(ev) { var r = cv.getBoundingClientRect(), x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left, W = r.width; var i = Math.round((x - 6) / (W - 64) * (dates.length - 1)); return Math.max(0, Math.min(dates.length - 1, i)); }
    cv.addEventListener('mousemove', function (e) { draw(at(e)); }); cv.addEventListener('touchmove', function (e) { draw(at(e)); }, { passive: true });
    cv.addEventListener('mouseleave', function () { draw(null); });
    draw(null);
    var t; var onR = function () { clearTimeout(t); t = setTimeout(function () { if (document.body.contains(cv)) draw(null); else window.removeEventListener('resize', onR); }, 120); };
    window.addEventListener('resize', onR);
    return { redraw: draw };
  }
  function spark(points, w, hgt) {
    var c = h('canvas', { class: 'spark', width: (w || 110) * 2, height: (hgt || 32) * 2, style: { width: (w || 110) + 'px', height: (hgt || 32) + 'px' }, 'aria-hidden': 'true' });
    if (!points || points.length < 2) return c;
    var g = c.getContext('2d'), lo = Math.min.apply(null, points), hi = Math.max.apply(null, points); if (hi === lo) hi = lo + 1;
    g.lineWidth = 3; g.strokeStyle = points[points.length - 1] >= points[0] ? (cssVar('--good') || '#39ff14') : (cssVar('--bad') || '#ff4d6d'); g.beginPath();
    points.forEach(function (v, i) { var x = i / (points.length - 1) * c.width, y = 3 + (hi - v) / (hi - lo) * (c.height - 6); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    return c;
  }
  function download(name, text, type) {
    var a = h('a', { href: URL.createObjectURL(new Blob([text], { type: type || 'application/json' })), download: name }); document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  window.UI = { h: h, esc: esc, money: money, pct: pct, num: num, cls: cls, toast: toast, copyText: copyText, copyBtn: copyBtn, pickImage: pickImage, readImage: readImage, md: md, chart: chart, spark: spark, download: download, cssVar: cssVar };
})();
