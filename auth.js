/* 簡易ログイン（お試し・デモ用）
 * ブラウザだけで動く仕組みなので、強固なセキュリティではありません。
 * 本番運用では、サーバー側の認証（Cloudflare など）に置き換えます。 */
(function () {
  var KEY = 'daisha-session';
  var FAIL_KEY = 'daisha-login-fail';
  var DAY = 864e5;

  function accounts() { return window.ACCOUNTS || []; }

  function read() {
    var stores = [window.sessionStorage, window.localStorage];
    for (var i = 0; i < stores.length; i++) {
      try {
        var s = JSON.parse(stores[i].getItem(KEY));
        if (s && s.shop && (!s.exp || s.exp > Date.now())) {
          var acc = accounts().find(function (a) { return a.shop === s.shop; });
          if (acc) return { shop: acc.shop, name: acc.name, sample: !!acc.sample };
        }
      } catch (e) { /* 無視 */ }
    }
    return null;
  }

  function sha256(text) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    });
  }

  // 連続して間違えたときの待ち時間（画面上の簡易な抑止）
  function lockedMs() {
    try { var f = JSON.parse(localStorage.getItem(FAIL_KEY)); return f && f.until > Date.now() ? f.until - Date.now() : 0; } catch (e) { return 0; }
  }
  function noteFail() {
    try {
      var f = JSON.parse(localStorage.getItem(FAIL_KEY)) || { n: 0 };
      f.n = (f.until && f.until < Date.now() ? 0 : f.n) + 1;
      if (f.n >= 5) { f.until = Date.now() + 60000; f.n = 0; }
      localStorage.setItem(FAIL_KEY, JSON.stringify(f));
    } catch (e) { /* 無視 */ }
  }

  // 戻り値: Promise<'ok' | 'bad' | 'locked' | 'unsupported'>
  function login(shop, password, keep) {
    if (!window.crypto || !crypto.subtle) return Promise.resolve('unsupported');
    if (lockedMs() > 0) return Promise.resolve('locked');
    var id = String(shop || '').trim().toLowerCase();
    return sha256('daisha|' + id + '|' + password).then(function (h) {
      var acc = accounts().find(function (a) { return a.shop === id; });
      if (!acc || acc.hash !== h) { noteFail(); return 'bad'; }
      try { localStorage.removeItem(FAIL_KEY); } catch (e) { /* 無視 */ }
      var rec = JSON.stringify({ shop: acc.shop, exp: keep ? Date.now() + 30 * DAY : 0 });
      try {
        (keep ? localStorage : sessionStorage).setItem(KEY, rec);
        (keep ? sessionStorage : localStorage).removeItem(KEY);
      } catch (e) { return 'unsupported'; }
      return 'ok';
    });
  }

  function logout() {
    try { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); } catch (e) { /* 無視 */ }
    location.replace('login.html');
  }

  window.Auth = { read: read, login: login, logout: logout, lockedMs: lockedMs };
})();
