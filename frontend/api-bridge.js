// PSB Fathan Mubina — resilient static PWA transport bridge
// Uses a retryable postMessage handshake because Apps Script may redirect
// the iframe from script.google.com to script.googleusercontent.com.
(function(){
  'use strict';
  const BRIDGE_URL="https://script.google.com/macros/s/AKfycbxs1zVZdEFwbhHFVO5nGHHhEqHQDdjVOVjfnWc1Kc6mhD5t_n8VgrdUTKhAvg8JGiau/exec";
  const BRIDGE_ORIGIN=new URL(BRIDGE_URL).origin;
  const TRUSTED_BRIDGE_ORIGINS=new Set([BRIDGE_ORIGIN,'https://script.googleusercontent.com']);
  function isTrustedBridgeOrigin(origin){
    if(TRUSTED_BRIDGE_ORIGINS.has(origin))return true;
    try{const u=new URL(origin);return u.protocol==='https:'&&(u.hostname==='script.googleusercontent.com'||u.hostname.endsWith('.script.googleusercontent.com'));}
    catch(e){return false;}
  }
  let activeBridgeOrigin=BRIDGE_ORIGIN, iframe=null, ready=false, seq=0, readyPromise=null;
  const PWA_SOURCE='psb-fm-pwa', BRIDGE_SOURCE='psb-fm-api-bridge';
  const TIMEOUT_MS=30000, pending=new Map();
  function ensureFrame(){
    if(iframe&&iframe.isConnected)return iframe;
    ready=false; readyPromise=null;
    iframe=document.createElement('iframe');
    iframe.title='PSB API Bridge';
    iframe.setAttribute('aria-hidden','true');
    iframe.tabIndex=-1;
    iframe.style.cssText='position:fixed;left:-10000px;top:-10000px;width:1px;height:1px;border:0;opacity:0;pointer-events:none;';
    iframe.addEventListener('load',()=>{activeBridgeOrigin=BRIDGE_ORIGIN;pingBridge();});
    iframe.addEventListener('error',()=>console.warn('PSB API Bridge iframe gagal dimuat.'));
    iframe.src=BRIDGE_URL+'?bridge=1&v=32.4.17';
    document.body.appendChild(iframe);
    return iframe;
  }
  // Ping berisi metadata saja; target origin * diperlukan karena URL Apps Script
  // dapat redirect. Semua balasan tetap diverifikasi berdasarkan origin dan source.
  function pingBridge(){
    if(!iframe?.contentWindow||ready)return;
    try{iframe.contentWindow.postMessage({source:PWA_SOURCE,type:'ping'},'*');}catch(e){}
  }
  function post(data){
    if(!iframe?.contentWindow)throw new Error('API bridge belum tersedia.');
    iframe.contentWindow.postMessage(Object.assign({source:PWA_SOURCE},data),activeBridgeOrigin);
  }
  function handleMessage(event){
    if(!isTrustedBridgeOrigin(event.origin)||event.source!==iframe?.contentWindow)return;
    const data=event.data||{};
    if(data.source!==BRIDGE_SOURCE)return;
    activeBridgeOrigin=event.origin;
    if(data.type==='ready'){
      ready=true;
      if(readyPromise){readyPromise.resolve();readyPromise=null;}
      return;
    }
    if(data.type!=='response')return;
    const id=String(data.id||''), item=pending.get(id);
    if(!item)return;
    pending.delete(id);clearTimeout(item.timer);
    if(data.ok)item.resolve(data.result);
    else item.reject(Object.assign(new Error(String(data.error?.message||'Terjadi kesalahan komunikasi dengan backend.')),data.error||{}));
  }
  function waitReady(){
    ensureFrame();
    if(ready)return Promise.resolve();
    if(readyPromise)return readyPromise.promise;
    let resolveReady,rejectReady;
    const promise=new Promise((resolve,reject)=>{resolveReady=resolve;rejectReady=reject;});
    const timer=setTimeout(()=>{
      if(readyPromise){readyPromise=null;rejectReady(new Error('API Bridge belum siap. Iframe Apps Script tidak mengirim sinyal siap. Periksa deployment Bridge dan izin iframe.'));}
    },TIMEOUT_MS);
    readyPromise={promise,resolve:()=>{clearTimeout(timer);resolveReady();}};
    pingBridge();
    const retry=setInterval(()=>{if(ready){clearInterval(retry);return;}pingBridge();},700);
    promise.finally(()=>clearInterval(retry)).catch(()=>{});
    return promise;
  }
  window.addEventListener('message',handleMessage);
  window.PSBBridge={
    url:BRIDGE_URL,
    origin:BRIDGE_ORIGIN,
    ready:()=>ready,
    call:async function(fn,args){
      await waitReady();
      const id='rpc_'+Date.now()+'_'+(++seq);
      return new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Koneksi ke server timeout.'));},TIMEOUT_MS);
        pending.set(id,{resolve,reject,timer});
        try{post({type:'request',id,fn:String(fn||''),args:Array.isArray(args)?args:[]});}
        catch(e){clearTimeout(timer);pending.delete(id);reject(e);}
      });
    }
  };
  ensureFrame();
})();