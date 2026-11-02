// PSB Fathan Mubina — Apps Script form-POST transport bridge.
// Apps Script Warden can drop parent -> HTML Service iframe postMessage calls.
// This transport uses an outbound one-time token handshake, then a native
// form POST targeted at the iframe. The response posts back to the PWA.
(function () {
  'use strict';

  const BRIDGE_URL = "https://script.google.com/macros/s/AKfycbxs1zVZdEFwbhHFVO5nGHHhEqHQDdjVOVjfnWc1Kc6mhD5t_n8VgrdUTKhAvg8JGiau/exec";
  const BRIDGE_ORIGIN = new URL(BRIDGE_URL).origin;
  const BRIDGE_SOURCE = 'psb-fm-api-bridge';
  const TIMEOUT_MS = 30000;
  const MAX_PAYLOAD_CHARS = 20 * 1024 * 1024;
  const sessions = new Map();

  function isTrustedBridgeOrigin(origin) {
    try {
      const url = new URL(origin);
      const host = url.hostname.toLowerCase();
      return url.protocol === 'https:' && (
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

  function removeSession(session) {
    if (!session) return;
    clearTimeout(session.readyTimer);
    clearTimeout(session.responseTimer);
    sessions.delete(session.challenge);
    if (session.iframe && session.iframe.parentNode) {
      session.iframe.parentNode.removeChild(session.iframe);
    }
  }

  function handleMessage(event) {
    if (!isTrustedBridgeOrigin(event.origin)) return;
    const data = event.data || {};
    if (data.source !== BRIDGE_SOURCE) return;

    const challenge = String(data.challenge || '');
    const session = sessions.get(challenge);
    if (!session) return;

    if (data.type === 'ready') {
      const token = String(data.token || '');
      if (!/^[a-f0-9]{64}$/i.test(token)) {
        const reject = session.rejectReady;
        removeSession(session);
        if (reject) reject(new Error('Token koneksi server tidak valid.'));
        return;
      }
      if (session.resolveReady) {
        session.token = token;
        clearTimeout(session.readyTimer);
        const resolve = session.resolveReady;
        session.resolveReady = null;
        session.rejectReady = null;
        resolve(session);
      }
      return;
    }

    if (data.type !== 'response' || String(data.id || '') !== session.requestId) return;
    clearTimeout(session.responseTimer);
    const resolve = session.resolveResponse;
    const reject = session.rejectResponse;
    removeSession(session);
    if (data.ok) {
      if (resolve) resolve(data.result);
    } else if (reject) {
      const errorData = data.error || {};
      reject(Object.assign(
        new Error(String(errorData.message || 'Terjadi kesalahan komunikasi dengan backend.')),
        errorData
      ));
    }
  }

  window.addEventListener('message', handleMessage);

  function openBridgeSession() {
    return new Promise((resolve, reject) => {
      let challenge;
      try {
        challenge = randomHex(16);
      } catch (error) {
        reject(error);
        return;
      }

      const iframe = document.createElement('iframe');
      const frameName = 'psb_bridge_' + challenge;
      iframe.name = frameName;
      iframe.title = 'PSB API Bridge';
      iframe.setAttribute('aria-hidden', 'true');
      iframe.tabIndex = -1;
      iframe.style.cssText = 'position:fixed;left:-10000px;top:-10000px;width:1px;height:1px;border:0;opacity:0;pointer-events:none;';

      const session = {
        challenge: challenge,
        iframe: iframe,
        frameName: frameName,
        token: '',
        requestId: '',
        resolveReady: resolve,
        rejectReady: reject,
        readyTimer: null,
        responseTimer: null,
        resolveResponse: null,
        rejectResponse: null
      };
      sessions.set(challenge, session);
      session.readyTimer = setTimeout(() => {
        const fail = session.rejectReady;
        removeSession(session);
        if (fail) fail(new Error('API Bridge belum siap. Apps Script tidak mengirim token koneksi.'));
      }, TIMEOUT_MS);

      iframe.src = BRIDGE_URL + '?bridge=1&origin=' +
        encodeURIComponent(location.origin) + '&challenge=' +
        encodeURIComponent(challenge) + '&v=32.5.0';
      document.body.appendChild(iframe);
    });
  }

  function submitBridgeRequest(session, functionName, args) {
    return new Promise((resolve, reject) => {
      const requestId = 'rpc_' + session.challenge;
      session.requestId = requestId;
      session.resolveResponse = resolve;
      session.rejectResponse = reject;
      session.responseTimer = setTimeout(() => {
        removeSession(session);
        reject(new Error('Koneksi ke server timeout saat menunggu hasil permintaan.'));
      }, TIMEOUT_MS);

      const payload = JSON.stringify({
        origin: location.origin,
        challenge: session.challenge,
        id: requestId,
        token: session.token,
        fn: String(functionName || ''),
        args: Array.isArray(args) ? args : []
      });

      if (payload.length > MAX_PAYLOAD_CHARS) {
        removeSession(session);
        reject(new Error('Data permintaan terlalu besar untuk dikirim ke server.'));
        return;
      }

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = BRIDGE_URL;
      form.target = session.frameName;
      form.acceptCharset = 'UTF-8';
      form.style.cssText = 'position:absolute;width:1px;height:1px;left:-10000px;top:-10000px;';
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'psb_payload';
      input.value = payload;
      form.appendChild(input);
      document.body.appendChild(form);

      try {
        form.submit();
      } catch (error) {
        clearTimeout(session.responseTimer);
        removeSession(session);
        reject(error);
      } finally {
        if (form.parentNode) form.parentNode.removeChild(form);
      }
    });
  }

  window.PSBBridge = {
    url: BRIDGE_URL,
    origin: BRIDGE_ORIGIN,
    ready: function () { return true; },
    call: async function (fn, args) {
      const session = await openBridgeSession();
      return submitBridgeRequest(session, fn, args);
    }
  };
})();
