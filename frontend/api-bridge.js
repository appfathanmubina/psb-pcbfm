// PSB Fathan Mubina — reusable Apps Script form-POST transport.
// A short-lived origin-bound token is reused for a bounded number of RPCs.
// Each RPC still gets its own response iframe and unpredictable challenge.
(function () {
  'use strict';

  const BRIDGE_URL = "https://script.google.com/macros/s/AKfycbxs1zVZdEFwbhHFVO5nGHHhEqHQDdjVOVjfnWc1Kc6mhD5t_n8VgrdUTKhAvg8JGiau/exec";
  const BRIDGE_CLIENT_VERSION = '32.19.0';
  const BRIDGE_ORIGIN = new URL(BRIDGE_URL).origin;
  const BRIDGE_SOURCE = 'psb-fm-api-bridge';
  const TIMEOUT_MS = 30000;
  // Allow one-time PBKDF2 verification and conversion for the remaining legacy accounts.
  const LOGIN_TIMEOUT_MS = 60000;
  const UPLOAD_TIMEOUT_MS = 120000;
  const TOKEN_TTL_MS = 150000;
  const TOKEN_MAX_USES = 20;
  const MAX_PAYLOAD_CHARS = 20 * 1024 * 1024;
  const pending = new Map();
  let tokenSession = null;
  let tokenPromise = null;
  let tokenHandshake = null;

  function isTrustedBridgeOrigin(origin) {
    try {
      const url = new URL(origin);
      const host = url.hostname.toLowerCase();
      return url.protocol === 'https:' && (
        host === 'script.google.com' ||
        host === 'script.googleusercontent.com' ||
        host.endsWith('.script.googleusercontent.com') ||
        host.endsWith('-script.googleusercontent.com')
      );
    } catch (error) {
      return false;
    }
  }

  function randomHex(bytes) {
    if (!window.crypto || typeof window.crypto.getRandomValues !== 'function') {
      throw new Error('Browser tidak menyediakan generator acak yang aman untuk koneksi server.');
    }
    const values = new Uint8Array(bytes);
    window.crypto.getRandomValues(values);
    return Array.from(values, value => value.toString(16).padStart(2, '0')).join('');
  }

  function removeFrame(frame) {
    if (frame && frame.parentNode) frame.parentNode.removeChild(frame);
  }

  function handleMessage(event) {
    const data = event.data || {};
    if (data.source !== BRIDGE_SOURCE) return;
    if (!isTrustedBridgeOrigin(event.origin)) {
      console.warn('[PSB Bridge] Pesan bridge diabaikan: origin tidak dikenal.', {
        origin: event.origin,
        type: data.type || 'unknown'
      });
      return;
    }

    // Apps Script HTML Service may wrap/redirect the document through a
    // Google-controlled frame. In that case event.source can be a wrapper
    // WindowProxy rather than the iframe element we created. The trusted
    // Google origin plus our 128-bit one-time challenge authenticates this
    // handshake without depending on WindowProxy identity.
    if ((data.type === 'ready' || data.type === 'error') && tokenHandshake &&
        String(data.challenge || '') === tokenHandshake.challenge) {
      if (data.type === 'error') {
        const fail = tokenHandshake.reject;
        removeFrame(tokenHandshake.iframe);
        tokenHandshake = null;
        if (fail) {
          const error = new Error(String(data.message || 'Apps Script gagal menyiapkan API Bridge.'));
          error.code = String(data.code || 'BRIDGE_HANDSHAKE_FAILED');
          fail(error);
        }
        return;
      }
      const token = String(data.token || '');
      if (!/^[a-f0-9]{64}$/i.test(token)) {
        const fail = tokenHandshake.reject;
        removeFrame(tokenHandshake.iframe);
        tokenHandshake = null;
        if (fail) fail(new Error('Token koneksi server tidak valid.'));
        return;
      }
      const session = {
        token: token,
        remaining: TOKEN_MAX_USES,
        expiresAt: Date.now() + TOKEN_TTL_MS
      };
      tokenSession = session;
      const finish = tokenHandshake.resolve;
      removeFrame(tokenHandshake.iframe);
      tokenHandshake = null;
      if (finish) finish(session);
      return;
    }

    if (data.type !== 'response') return;
    const challenge = String(data.challenge || '');
    const item = pending.get(challenge);
    if (!item) {
      console.warn('[PSB Bridge] Respons diterima tetapi challenge tidak lagi terdaftar.', {
        challenge: challenge.slice(0, 8),
        origin: event.origin
      });
      return;
    }
    // RPC response is authenticated by trusted origin, unpredictable
    // per-request challenge and exact request ID. Do not rely on
    // event.source because Apps Script may deliver through a wrapper frame.
    if (String(data.id || '') !== item.requestId) {
      console.warn('[PSB Bridge] Respons diabaikan: request ID tidak cocok.', {
        challenge: challenge.slice(0, 8),
        origin: event.origin
      });
      return;
    }
    pending.delete(challenge);
    clearTimeout(item.timer);
    removeFrame(item.iframe);

    if (data.ok) {
      item.resolve(data.result);
    } else {
      const errorData = data.error || {};
      item.reject(Object.assign(
        new Error(String(errorData.message || 'Terjadi kesalahan komunikasi dengan backend.')),
        errorData
      ));
    }
  }

  window.addEventListener('message', handleMessage);

  function openTokenSession() {
    return new Promise((resolve, reject) => {
      let settled = false;
      let attempt = 0;

      function startAttempt() {
        attempt += 1;
        let challenge;
        try {
          challenge = randomHex(16);
        } catch (error) {
          settled = true;
          reject(error);
          return;
        }

        const iframe = document.createElement('iframe');
        iframe.name = 'psb_bridge_bootstrap_' + challenge;
        iframe.title = 'PSB API Bridge bootstrap';
        iframe.setAttribute('aria-hidden', 'true');
        iframe.tabIndex = -1;
        iframe.style.cssText = 'position:fixed;left:-10000px;top:-10000px;width:1px;height:1px;border:0;opacity:0;pointer-events:none;';
        const handshake = {
          challenge: challenge,
          iframe: iframe,
          resolve: session => {
            if (settled) return;
            settled = true;
            clearTimeout(handshake.timer);
            removeFrame(iframe);
            if (tokenHandshake === handshake) tokenHandshake = null;
            resolve(session);
          },
          reject: error => {
            if (settled) return;
            clearTimeout(handshake.timer);
            removeFrame(iframe);
            if (tokenHandshake === handshake) tokenHandshake = null;
            if (attempt < 2 && (!error || error.code === 'BRIDGE_HANDSHAKE_TIMEOUT')) {
              // Retry the bootstrap GET once with a fresh challenge. This helps
              // recover from transient Apps Script redirects/edge-cache misses.
              setTimeout(startAttempt, 500);
              return;
            }
            settled = true;
            reject(error);
          },
          timer: null,
          loaded: false
        };
        tokenHandshake = handshake;
        iframe.onload = () => { handshake.loaded = true; };
        iframe.onerror = () => {
          const error = new Error('Browser gagal memuat iframe API Bridge Apps Script.');
          error.code = 'BRIDGE_IFRAME_LOAD_FAILED';
          handshake.reject(error);
        };
        handshake.timer = setTimeout(() => {
          const error = new Error(
            handshake.loaded
              ? 'Iframe API Bridge termuat, tetapi tidak mengirim pesan token. Periksa doGet, Bridge.html, dan izin deployment Apps Script.'
              : 'Iframe API Bridge tidak selesai dimuat. Periksa URL deployment, akses Web App, dan koneksi ke Apps Script.'
          );
          error.code = 'BRIDGE_HANDSHAKE_TIMEOUT';
          error.iframeLoaded = handshake.loaded;
          handshake.reject(error);
        }, TIMEOUT_MS);

        iframe.src = BRIDGE_URL + '?bridge=1&origin=' +
          encodeURIComponent(location.origin) + '&challenge=' +
          encodeURIComponent(challenge) + '&v=' + BRIDGE_CLIENT_VERSION + '&cb=' + Date.now();
        document.body.appendChild(iframe);
      }

      startAttempt();
    });
  }

  async function acquireToken() {
    while (true) {
      if (tokenSession && tokenSession.remaining > 0 && tokenSession.expiresAt > Date.now()) {
        tokenSession.remaining -= 1;
        return tokenSession.token;
      }
      tokenSession = null;
      if (!tokenPromise) {
        tokenPromise = openTokenSession().finally(() => { tokenPromise = null; });
      }
      await tokenPromise;
    }
  }

  function submitBridgeRequest(token, functionName, args) {
    return new Promise((resolve, reject) => {
      let challenge;
      try {
        challenge = randomHex(16);
      } catch (error) {
        reject(error);
        return;
      }

      const requestId = 'rpc_' + challenge;
      const iframe = document.createElement('iframe');
      const frameName = 'psb_bridge_response_' + challenge;
      iframe.name = frameName;
      iframe.title = 'PSB API Bridge response';
      iframe.setAttribute('aria-hidden', 'true');
      iframe.tabIndex = -1;
      iframe.style.cssText = 'position:fixed;left:-10000px;top:-10000px;width:1px;height:1px;border:0;opacity:0;pointer-events:none;';
      const item = { iframe: iframe, requestId: requestId, functionName: String(functionName || ''), startedAt: Date.now(), resolve: resolve, reject: reject, timer: null };
      pending.set(challenge, item);
      const requestTimeoutMs = item.functionName === 'login' ? LOGIN_TIMEOUT_MS :
        (item.functionName === 'uploadDocument' || item.functionName === 'submitPayment') ? UPLOAD_TIMEOUT_MS : TIMEOUT_MS;
      item.timer = setTimeout(() => {
        console.error('[PSB Bridge] Timeout menunggu respons Apps Script.', {
          functionName: item.functionName,
          challenge: challenge.slice(0, 8),
          elapsedMs: Date.now() - item.startedAt,
          pendingCount: pending.size
        });
        pending.delete(challenge);
        removeFrame(iframe);
        reject(new Error('Koneksi ke server timeout saat menunggu hasil permintaan.'));
      }, requestTimeoutMs);

      const payload = JSON.stringify({
        origin: location.origin,
        challenge: challenge,
        id: requestId,
        token: token,
        fn: String(functionName || ''),
        args: Array.isArray(args) ? args : []
      });
      if (payload.length > MAX_PAYLOAD_CHARS) {
        clearTimeout(item.timer);
        pending.delete(challenge);
        reject(new Error('Data permintaan terlalu besar untuk dikirim ke server.'));
        return;
      }

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = BRIDGE_URL;
      form.target = frameName;
      form.acceptCharset = 'UTF-8';
      form.style.cssText = 'position:absolute;width:1px;height:1px;left:-10000px;top:-10000px;';
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'psb_payload';
      input.value = payload;
      form.appendChild(input);
      document.body.appendChild(iframe);
      document.body.appendChild(form);

      try {
        form.submit();
      } catch (error) {
        clearTimeout(item.timer);
        pending.delete(challenge);
        removeFrame(iframe);
        reject(error);
      } finally {
        removeFrame(form);
      }
    });
  }

  async function callWithToken(fn, args, retry) {
    const token = await acquireToken();
    try {
      return await submitBridgeRequest(token, fn, args);
    } catch (error) {
      const safeToRetry = error && (error.code === 'BRIDGE_TOKEN_INVALID' || error.code === 'BRIDGE_TEMPORARILY_BUSY');
      if (retry && safeToRetry) {
        if (tokenSession && tokenSession.token === token) tokenSession = null;
        if (error.code === 'BRIDGE_TEMPORARILY_BUSY') {
          await new Promise(resolve => setTimeout(resolve, 250));
        }
        // The backend is never invoked when token consumption fails, so this
        // bounded retry cannot duplicate login or another business operation.
        return callWithToken(fn, args, false);
      }
      throw error;
    }
  }

  window.PSBBridge = {
    url: BRIDGE_URL,
    origin: BRIDGE_ORIGIN,
    ready: function () {
      return !!(tokenSession && tokenSession.remaining > 0 && tokenSession.expiresAt > Date.now());
    },
    // Warm the short-lived bridge token while the user is entering credentials.
    // This avoids putting the cross-origin iframe handshake on the login critical path.
    prepare: function () {
      if (tokenSession && tokenSession.remaining > 0 && tokenSession.expiresAt > Date.now()) {
        return Promise.resolve(true);
      }
      if (!tokenPromise) {
        tokenPromise = openTokenSession().finally(() => { tokenPromise = null; });
      }
      return tokenPromise.then(() => true);
    },
    call: function (fn, args) {
      return callWithToken(fn, args, true);
    }
  };
})();
