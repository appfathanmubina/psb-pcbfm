/**
 * PSB Bridge boundary.
 *
 * Static PWA transport uses a same-origin form POST to the Apps Script Web App.
 * The iframe never receives postMessage from the PWA: Apps Script Warden can
 * reject that direction. A short-lived, one-use token is issued by doGet and
 * returned only to the allowlisted PWA origin. The POST response posts back
 * to that origin and is correlated by an unpredictable per-request challenge.
 */

function psbPwaBridgeAllowedOrigins_() {
  let raw = '';
  try { raw = String(getConfig_('PWA_ALLOWED_ORIGINS') || '').trim(); } catch (e) {}
  const configured = raw.split(',').map(function (value) {
    return String(value || '').trim();
  }).filter(function (value) {
    return /^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(value);
  });
  return Array.from(new Set(['https://appfathanmubina.github.io'].concat(configured)));
}

const PSB_PWA_BRIDGE_TOKEN_TTL_SECONDS_ = 180;
const PSB_PWA_BRIDGE_TOKEN_MAX_USES_ = 20;

function psbIssuePwaBridgeToken_(origin) {
  const requestedOrigin = String(origin || '').trim();
  if (psbPwaBridgeAllowedOrigins_().indexOf(requestedOrigin) < 0) return '';
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  try {
    const expiresAt = Date.now() + PSB_PWA_BRIDGE_TOKEN_TTL_SECONDS_ * 1000;
    CacheService.getScriptCache().put('PSB_PWA_BRIDGE_TOKEN_' + token, JSON.stringify({
      origin: requestedOrigin,
      remaining: PSB_PWA_BRIDGE_TOKEN_MAX_USES_,
      expiresAt: expiresAt
    }), PSB_PWA_BRIDGE_TOKEN_TTL_SECONDS_);
    return token;
  } catch (e) {
    console.error('PWA bridge token issue failed: ' + String(e && e.message || e));
    return '';
  }
}

function psbConsumePwaBridgeToken_(token, origin) {
  const value = String(token || '');
  const requestedOrigin = String(origin || '');
  if (!/^[a-f0-9]{64}$/i.test(value)) return false;
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const cache = CacheService.getScriptCache();
    const key = 'PSB_PWA_BRIDGE_TOKEN_' + value;
    const raw = cache.get(key);
    if (!raw) return false;
    let record;
    try { record = JSON.parse(raw); } catch (e) { cache.remove(key); return false; }
    if (!record || record.origin !== requestedOrigin ||
        Number(record.expiresAt || 0) <= Date.now() ||
        !Number.isFinite(Number(record.remaining)) ||
        Number(record.remaining) < 1) {
      cache.remove(key);
      return false;
    }
    // Bounded-use token: serialize decrements so concurrent requests cannot
    // exceed the fixed request budget. Expiry is never extended on use.
    record.remaining = Math.floor(Number(record.remaining)) - 1;
    if (record.remaining > 0) {
      const ttl = Math.max(1, Math.ceil((Number(record.expiresAt) - Date.now()) / 1000));
      cache.put(key, JSON.stringify(record), ttl);
    } else {
      cache.remove(key);
    }
    return true;
  } catch (e) {
    console.warn('PWA bridge token validation deferred: ' + String(e && e.message || e));
    return { success: false, code: 'BRIDGE_TEMPORARILY_BUSY', message: 'Server sedang sibuk. Permintaan aman untuk dicoba kembali.' };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function psbBridgeJsonForHtml_(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function psbPwaBridgeHtmlResponse_(origin, challenge, requestId, response) {
  const message = Object.assign({
    source: 'psb-fm-api-bridge',
    type: 'response',
    challenge: challenge,
    id: requestId
  }, response || {});
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><script>(function(){var message=' +
    psbBridgeJsonForHtml_(message) + ';try{window.top.postMessage(message,' +
    JSON.stringify(origin) + ');}catch(e){}})();</script></body></html>';
  return HtmlService.createHtmlOutput(html)
    .setTitle('PSB API Bridge Response')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  const raw = String(e && e.parameter && e.parameter.psb_payload || '');
  if (!raw || raw.length > 20 * 1024 * 1024) {
    return HtmlService.createHtmlOutput('Permintaan bridge tidak valid.');
  }

  let payload;
  try { payload = JSON.parse(raw); } catch (error) {
    return HtmlService.createHtmlOutput('Format permintaan bridge tidak valid.');
  }

  const origin = String(payload.origin || '').trim();
  const challenge = String(payload.challenge || '');
  const requestId = String(payload.id || '');
  const allowedOrigins = psbPwaBridgeAllowedOrigins_();
  if (allowedOrigins.indexOf(origin) < 0 ||
      !/^[a-f0-9]{32}$/i.test(challenge) ||
      !/^rpc_[a-f0-9]{32}$/i.test(requestId)) {
    return HtmlService.createHtmlOutput('Identitas permintaan bridge tidak valid.');
  }

  const fail = function (code, message) {
    return psbPwaBridgeHtmlResponse_(origin, challenge, requestId, {
      ok: false,
      error: { code: code, message: message }
    });
  };

  const tokenResult = psbConsumePwaBridgeToken_(payload.token, origin);
  if (tokenResult !== true) {
    return fail(tokenResult && tokenResult.code || 'BRIDGE_TOKEN_INVALID',
      tokenResult && tokenResult.message || 'Sesi transport kedaluwarsa. Silakan ulangi permintaan.');
  }

  const functionName = String(payload.fn || '').trim();
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(functionName) ||
      PSB_PWA_BRIDGE_ALLOWED_FUNCTIONS.indexOf(functionName) < 0) {
    return fail('BRIDGE_FUNCTION_NOT_ALLOWED', 'Fungsi API bridge tidak diizinkan.');
  }
  if (!Array.isArray(payload.args)) {
    return fail('BRIDGE_ARGUMENTS_INVALID', 'Parameter permintaan tidak valid.');
  }

  const result = pwaBridgeCall(functionName, payload.args);
  return psbPwaBridgeHtmlResponse_(origin, challenge, requestId, {
    ok: true,
    result: result
  });
}

function psbBridgeHealth() {
  return { success: true, app: 'PSB Fathan Mubina', transport: 'form-post' };
}
