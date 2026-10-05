// PSB Fathan Mubina — static PWA transport bridge
// Connects GitHub Pages to the Apps Script backend through a sandboxed iframe.
(function(){
  'use strict';
  const BRIDGE_URL="https://script.google.com/macros/s/AKfycbxs1zVZdEFwbhHFVO5nGHHhEqHQDdjVOVjfnWc1Kc6mhD5t_n8VgrdUTKhAvg8JGiau/exec";
  const BRIDGE_ORIGIN=new URL(BRIDGE_URL).origin;
  const PWA_SOURCE='psb-fm-pwa';
  const BRIDGE_SOURCE='psb-fm-api-bridge';
  const TIMEOUT_MS=30000;
  let iframe=null, ready=false, seq=0;
  const pending=new Map();
  let readyWaiters=[];

  function ensureFrame(){
    if(iframe && iframe.isConnected)return iframe;
    iframe=document.createElement('iframe');
    iframe.title='PSB API Bridge';
    iframe.setAttribute('aria-hidden','true');
    iframe.tabIndex=-1;
    iframe.style.cssText='position:fixed;left:-10000px;top:-10000px;width:1px;height:1px;border:0;opacity:0;pointer-events:none;';
    iframe.src=BRIDGE_URL+'?bridge=1';
    document.body.appendChild(iframe);
    return iframe;
  }
  function post(data){
    if(!iframe?.contentWindow)throw new Error('API bridge belum tersedia.');
    iframe.contentWindow.postMessage(Object.assign({source:PWA_SOURCE},data),BRIDGE_ORIGIN);
  }
  function handleMessage(event){
    if(event.origin!==BRIDGE_ORIGIN || event.source!==iframe?.contentWindow)return;
    const data=event.data||{};
    if(data.source!==BRIDGE_SOURCE)return;
    if(data.type==='ready'){
      ready=true;
      const waiters=readyWaiters; readyWaiters=[]; waiters.forEach(x=>x());
      return;
    }
    if(data.type!=='response')return;
    const id=String(data.id||''); const item=pending.get(id); if(!item)return;
    pending.delete(id); clearTimeout(item.timer);
    if(data.ok)item.resolve(data.result);
    else item.reject(Object.assign(new Error(String(data.error?.message||'Terjadi kesalahan komunikasi dengan backend.')),data.error||{}));
  }
  async function waitReady(){
    ensureFrame();
    if(ready)return;
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('API bridge belum siap. Pastikan Web App Apps Script sudah dideploy.')),TIMEOUT_MS);
      readyWaiters.push(()=>{clearTimeout(timer);resolve();});
      try{post({type:'ping'});}catch(e){clearTimeout(timer);reject(e);}
    });
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
