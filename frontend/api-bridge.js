// PSB Fathan Mubina — static PWA transport bridge v33
// GitHub Pages -> sandboxed Apps Script iframe -> google.script.run
(function(){
  'use strict';

  const BRIDGE_URL = 'https://script.google.com/macros/s/AKfycbxs1zVZdEFwbhHFVO5nGHHhEqHQDdjVOVjfnWc1Kc6mhD5t_n8VgrdUTKhAvg8JGiau/exec';
  const BRIDGE_ORIGIN = new URL(BRIDGE_URL).origin;
  const TRUSTED_BRIDGE_ORIGINS = new Set([
    BRIDGE_ORIGIN,
    'https://script.googleusercontent.com'
  ]);

  const PWA_SOURCE = 'psb-fm-pwa';
  const BRIDGE_SOURCE = 'psb-fm-api-bridge';
  const TIMEOUT_MS = 30000;
  const HELLO_RETRY_MS = 700;
  const MAX_HELLO_RETRIES = 12;

  let iframe = null;
  let ready = false;
  let seq = 0;
  let activeBridgeOrigin = null;
  let helloTimer = null;
  let helloAttempts = 0;
  const pending = new Map();
  let readyWaiters = [];

  function log(){
    try { console.log.apply(console, ['[PSB Bridge]'].concat([].slice.call(arguments))); } catch(e) {}
  }

  function ensureFrame(){
    if (iframe && iframe.isConnected) return iframe;

    iframe = document.createElement('iframe');
    iframe.id = 'psb-bridge-frame';
    iframe.title = 'PSB API Bridge';
    iframe.setAttribute('aria-hidden', 'true');
    iframe.tabIndex = -1;
    iframe.style.cssText = 'position:fixed;left:-10000px;top:-10000px;width:1px;height:1px;border:0;opacity:0;pointer-events:none;';
    iframe.src = BRIDGE_URL + '?bridge=1&transport=33';

    iframe.addEventListener('load', function(){
      log('iframe loaded:', iframe.src);
      helloAttempts = 0;
      sendHello();
    });

    document.body.appendChild(iframe);
    return iframe;
  }

  function post(data){
    if (!iframe || !iframe.contentWindow) {
      throw new Error('API bridge belum tersedia.');
    }

    // The first HELLO deliberately uses '*'. The actual Apps Script HTML
    // service document can be served from script.google.com and/or
    // script.googleusercontent.com. After READY, use the origin observed
    // from the actual message source.
    const targetOrigin = activeBridgeOrigin || '*';
    iframe.contentWindow.postMessage(
      Object.assign({source:PWA_SOURCE}, data),
      targetOrigin
    );
  }

  function sendHello(){
    if (ready || !iframe || !iframe.contentWindow) return;

    helloAttempts += 1;
    try {
      post({
        type: 'hello',
        version: '33.0.0',
        origin: window.location.origin,
        timestamp: Date.now()
      });
      log('HELLO sent, attempt', helloAttempts);
    } catch(error) {
      log('HELLO failed:', error);
    }

    clearTimeout(helloTimer);
    if (!ready && helloAttempts < MAX_HELLO_RETRIES) {
      helloTimer = setTimeout(sendHello, HELLO_RETRY_MS);
    }
  }

  function handleMessage(event){
    if (!iframe || event.source !== iframe.contentWindow) return;
    if (!TRUSTED_BRIDGE_ORIGINS.has(event.origin)) return;

    const data = event.data || {};
    if (data.source !== BRIDGE_SOURCE) return;

    activeBridgeOrigin = event.origin;

    if (data.type === 'ready') {
      ready = true;
      clearTimeout(helloTimer);
      log('READY received from', event.origin, data);

      const waiters = readyWaiters;
      readyWaiters = [];
      waiters.forEach(function(resolve){ resolve(); });
      return;
    }

    if (data.type !== 'response') return;

    const id = String(data.id || '');
    const item = pending.get(id);
    if (!item) return;

    pending.delete(id);
    clearTimeout(item.timer);

    if (data.ok) {
      item.resolve(data.result);
    } else {
      const error = Object.assign(
        new Error(String(data.error && data.error.message || 'Terjadi kesalahan komunikasi dengan backend.')),
        data.error || {}
      );
      item.reject(error);
    }
  }

  async function waitReady(){
    ensureFrame();
    if (ready) return;

    return new Promise(function(resolve, reject){
      const timer = setTimeout(function(){
        readyWaiters = readyWaiters.filter(function(fn){ return fn !== resolveReady; });
        reject(new Error('API bridge belum siap. Pastikan Web App Apps Script versi terbaru sudah dideploy.'));
      }, TIMEOUT_MS);

      function resolveReady(){
        clearTimeout(timer);
        resolve();
      }

      readyWaiters.push(resolveReady);
      sendHello();
    });
  }

  function call(fn, args){
    return waitReady().then(function(){
      const id = 'rpc_' + Date.now() + '_' + (++seq);

      return new Promise(function(resolve, reject){
        const timer = setTimeout(function(){
          pending.delete(id);
          reject(new Error('Koneksi ke server timeout.'));
        }, TIMEOUT_MS);

        pending.set(id, {resolve:resolve, reject:reject, timer:timer});

        try {
          post({
            type: 'request',
            id: id,
            fn: String(fn || ''),
            args: Array.isArray(args) ? args : []
          });
        } catch(error) {
          clearTimeout(timer);
          pending.delete(id);
          reject(error);
        }
      });
    });
  }

  function healthCheck(){
    return waitReady().then(function(){
      const id = 'health_' + Date.now() + '_' + (++seq);

      return new Promise(function(resolve, reject){
        const timer = setTimeout(function(){
          pending.delete(id);
          reject(new Error('Bridge health check timeout.'));
        }, TIMEOUT_MS);

        pending.set(id, {resolve:resolve, reject:reject, timer:timer});

        try {
          post({type:'health', id:id});
        } catch(error) {
          clearTimeout(timer);
          pending.delete(id);
          reject(error);
        }
      });
    });
  }

  window.addEventListener('message', handleMessage);

  window.PSBBridge = {
    url: BRIDGE_URL,
    origin: BRIDGE_ORIGIN,
    ready: function(){ return ready; },
    waitUntilReady: waitReady,
    healthCheck: healthCheck,
    call: call
  };

  function init(){
    if (!document.body) return;
    ensureFrame();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, {once:true});
  } else {
    init();
  }
})();
