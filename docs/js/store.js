/* Ai Investor v4.20 — on-device storage.
   Secure: API keys are AES-GCM encrypted at rest with a NON-EXTRACTABLE device key kept in IndexedDB (WebCrypto).
   KV: agents, records, bar cache in IndexedDB. Nothing leaves the device except calls to the services you configure. */
(function () {
  'use strict';
  function open(name) {
    return new Promise(function (res, rej) {
      var r = indexedDB.open(name, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
    });
  }
  function tx(db, mode, fn) {
    return new Promise(function (res, rej) {
      var t = db.transaction('kv', mode), s = t.objectStore('kv'), out = fn(s);
      t.oncomplete = function () { res(out && out.result !== undefined ? out.result : undefined); };
      t.onerror = function () { rej(t.error); }; t.onabort = function () { rej(t.error || new Error('IndexedDB aborted')); };
    });
  }
  var dbp = null;
  function db() { return dbp || (dbp = open('aii-db')); }
  var KV = {
    get: function (k) { return db().then(function (d) { return tx(d, 'readonly', function (s) { return s.get(k); }); }); },
    set: function (k, v) { return db().then(function (d) { return tx(d, 'readwrite', function (s) { s.put(v, k); }); }); },
    del: function (k) { return db().then(function (d) { return tx(d, 'readwrite', function (s) { s.delete(k); }); }); },
    keys: function () { return db().then(function (d) { return tx(d, 'readonly', function (s) { return s.getAllKeys(); }); }); },
    clear: function () { return db().then(function (d) { return tx(d, 'readwrite', function (s) { s.clear(); }); }); }
  };

  var LS = 'aii.secrets.v1', cache = {}, devKey = null;
  function b64(buf) { var s = '', a = new Uint8Array(buf); for (var i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); }
  function unb64(s) { var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  function deviceKey() {
    if (devKey) return Promise.resolve(devKey);
    return KV.get('__device_key').then(function (k) {
      if (k) return (devKey = k);
      return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']).then(function (nk) {
        return KV.set('__device_key', nk).then(function () { return (devKey = nk); });
      });
    });
  }
  var Secure = {
    ready: false, encrypted: !!(window.crypto && crypto.subtle),
    load: function () {
      var raw = localStorage.getItem(LS);
      if (!raw || !Secure.encrypted) { Secure.ready = true; return Promise.resolve(); }
      return deviceKey().then(function (k) {
        var o = JSON.parse(raw);
        return crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(o.iv) }, k, unb64(o.ct));
      }).then(function (pt) { cache = JSON.parse(new TextDecoder().decode(pt)) || {}; Secure.ready = true; })
        .catch(function () { cache = {}; Secure.ready = true; Secure.lost = true; });
    },
    get: function (name) { return cache[name] || ''; },
    has: function (name) { return !!cache[name]; },
    set: function (name, value) {
      if (value) cache[name] = String(value).trim(); else delete cache[name];
      return Secure.persist();
    },
    persist: function () {
      if (!Secure.encrypted) return Promise.reject(new Error('This browser has no WebCrypto, so keys cannot be stored encrypted.'));
      var iv = crypto.getRandomValues(new Uint8Array(12));
      return deviceKey().then(function (k) {
        return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, k, new TextEncoder().encode(JSON.stringify(cache)));
      }).then(function (ct) { localStorage.setItem(LS, JSON.stringify({ v: 1, alg: 'AES-GCM-256', iv: b64(iv), ct: b64(ct) })); });
    },
    names: function () { return Object.keys(cache); },
    wipe: function () { cache = {}; localStorage.removeItem(LS); }
  };

  function sha256(str) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function (h) {
      return Array.prototype.map.call(new Uint8Array(h), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    });
  }
  window.KV = KV; window.Secure = Secure; window.sha256 = sha256;
})();
