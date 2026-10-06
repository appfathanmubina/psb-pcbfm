// PSB Fathan Mubina frontend extracted from the original Apps Script Index.html.
// Business logic is intentionally preserved; only the server transport is abstracted.

(function lockDeviceLayout(){
  const ua = navigator.userAgent || navigator.vendor || '';
  const mobileUA = /Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini|webOS/i.test(ua);
  const coarse = window.matchMedia ? window.matchMedia('(pointer: coarse)').matches : false;
  const touch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  const sw = Number(window.screen && window.screen.width || 0);
  const sh = Number(window.screen && window.screen.height || 0);
  const shortSide = Math.min(sw || 9999, sh || 9999);
  const mobile = mobileUA || ((coarse || touch) && shortSide <= 1024);
  const root = document.documentElement;
  const app = document.getElementById('app');
  root.classList.toggle('mobile-device', mobile);
  root.classList.toggle('desktop-device', !mobile);
  // Keep the device class on <body> too because the shell CSS scopes
  // desktop/mobile layout rules from body descendants.
  document.body.classList.toggle('mobile-device', mobile);
  document.body.classList.toggle('desktop-device', !mobile);

  // Do not use CSS zoom/transform to force a mobile layout. In Apps Script
  // HTML Service the app runs inside a sandboxed iframe; the iframe itself is
  // the app viewport. Keep the canvas at 1:1 so text, icons and touch targets
  // remain physically usable and accessible.
  if(app){
    root.style.setProperty('--app-viewport-width', (window.visualViewport?.width || window.innerWidth || root.clientWidth || 0) + 'px');
    root.style.setProperty('--app-viewport-height', (window.visualViewport?.height || window.innerHeight || root.clientHeight || 0) + 'px');
  }
})();
const state={token:localStorage.getItem('psb_session')||'',user:null,config:{},page:'home',appInitialized:false,initialData:null,preloadRunning:false,preloadReady:false,cache:{registration:null,documents:{},payments:{},pages:{}},pageSnapshots:{},pageSnapshotTtlMs:180000,paymentRegistrationId:'',paymentData:null,paymentTypes:[],masterKey:'MASTER_TAHUN_AJARAN',masterItems:[],masterDefinitions:{},masterCache:{},academicYearLifecycle:null,auditData:null,registrationList:[],registrationOptions:null,registrationDetail:null,documentRegistrationId:'',documentData:null,selectionData:null,selectionTab:'overview',selectionRegistrationId:'',chatData:null,chatThread:null,chatThreadCache:{},chatPollTimer:null,chatLoading:false,detailLoadingLocks:{}};
const $=id=>document.getElementById(id);
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function normalizeAssetUrl(raw){
  let url=String(raw||'').trim();
  if(!url)return '';
  // Support the common Google Drive share/copy-link variants stored in CONFIG.
  // Drive's thumbnail endpoint is more reliable inside Apps Script HTML Service
  // than rendering a /file/d/... page as an <img>.
  let m=url.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]{10,})/i);
  if(!m)m=url.match(/drive\.google\.com\/(?:open|uc)\?(?:[^#]*?&)?id=([A-Za-z0-9_-]{10,})/i);
  if(!m)m=url.match(/docs\.google\.com\/(?:uc|file)\?(?:[^#]*?&)?id=([A-Za-z0-9_-]{10,})/i);
  if(!m)m=url.match(/[?&]id=([A-Za-z0-9_-]{10,})/i);
  if(m)return 'https://drive.google.com/thumbnail?id='+encodeURIComponent(m[1])+'&sz=w512';
  return url;
}
function configAssetUrl(...keys){
  for(const key of keys){
    const raw=String(state.config?.[key]||'').trim();
    if(raw)return normalizeAssetUrl(raw);
  }
  return '';
}
const BRAND_ASSET_FALLBACKS={
  icon:'https://appfathanmubina.github.io/psb-pcbfm/assets/logo-fathan-mubina.png?v=32.4.2',
  logo:'https://appfathanmubina.github.io/psb-pcbfm/assets/logo-fathan-mubina.png?v=32.4.2'
};
function configAssetSources(kind='logo'){
  // CONFIG Database adalah sumber kebenaran utama. Asset yang ditanam di script
  // hanya fallback terakhir agar brand tidak kembali ke FM ketika CONFIG kosong.
  const keys=kind==='icon'
    ? ['APP_ICON_URL','APP_ICON_DATA_URL','APP_LOGO_URL','APP_LOGO_DATA_URL']
    : ['APP_LOGO_URL','APP_LOGO_DATA_URL','APP_ICON_URL','APP_ICON_DATA_URL'];
  const out=[];
  for(const key of keys){
    const raw=String(state.config?.[key]||'').trim();
    if(!raw)continue;
    const normalized=key.endsWith('_URL')?normalizeAssetUrl(raw):raw;
    if(normalized && !out.includes(normalized))out.push(normalized);
  }
  const fallbackRaw=String(BRAND_ASSET_FALLBACKS[kind]||'').trim();
  const fallback=normalizeAssetUrl(fallbackRaw);
  if(fallback&&!out.includes(fallback))out.push(fallback);
  return out;
}
function appLogoMarkup(extraClass=''){
  // Visible logo: gunakan URL dari CONFIG sebagai sumber utama. Data URL hasil resolusi server hanya fallback.
  const sources=configAssetSources('logo');
  const url=sources[0]||'';
  const fallback=sources[1]||'';
  const alt=esc(state.config.APP_NAME||'PSB Fathan Mubina');
  if(!url)return `<span class="app-logo-fallback">FM</span>`;
  // URL dari CONFIG tetap diprioritaskan. Bila sumber pertama gagal, coba fallback berikutnya;
  // hanya setelah seluruh sumber yang dikonfigurasi gagal tampilkan fallback FM.
  const fallbackJs=fallback ? `if(this.dataset.brandRetry!=='1'){this.dataset.brandRetry='1';this.src='${esc(fallback)}';return;}this.onerror=null;this.style.display='none';this.nextElementSibling.style.display='grid'` : `this.onerror=null;this.style.display='none';this.nextElementSibling.style.display='grid'`;
  return `<img class="app-logo-img ${extraClass}" src="${esc(url)}" alt="${alt}" loading="eager" referrerpolicy="no-referrer" onerror="${fallbackJs}"><span class="app-logo-fallback">FM</span>`;
}
function applyAppIcon(){
  // Favicon mengikuti APP_ICON_URL dari CONFIG terlebih dahulu; data URL/APP_LOGO hanya fallback.
  const sources=configAssetSources('icon');
  const url=sources[0]||'';
  let link=document.getElementById('appFavicon');
  if(!link){link=document.createElement('link');link.id='appFavicon';link.rel='icon';document.head.appendChild(link);}
  if(url)link.href=url;
}
const SPLASH_LOGO_URL='https://appfathanmubina.github.io/psb-pcbfm/assets/logo-fathan-mubina.png?v=32.4.2';
const SPLASH_LOGO_SOURCE='https://appfathanmubina.github.io/psb-pcbfm/assets/logo-fathan-mubina.png?v=32.4.2';
function hydrateSplashLogo(){
  const splashLogo=$('splashLogo');
  if(!splashLogo)return;
  splashLogo.innerHTML=`<img class="app-logo-img splash-app-logo" src="${SPLASH_LOGO_URL}" alt="PSB Fathan Mubina" loading="eager" referrerpolicy="no-referrer" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span class="app-logo-fallback">FM</span>`;
}
function loading(show,text='Memproses...'){ const t=$('loadingText'); if(t)t.textContent=text; if(state.appInitialized){if(show)bootProgress(true,text);else bootProgress(false);return;} $('loading').classList.toggle('hidden',!show); }
const MUTATING_SERVER_FUNCTIONS=new Set(['registerWali','changePassword','saveRegistration','submitRegistration','uploadDocument','verifyDocument','finalizeVerification','submitPayment','verifyPayment','createBill','createSelectionSchedule','updateSelectionScheduleStatus','addSelectionParticipant','addSelectionParticipantsBulk','updateSelectionParticipantStatus','saveSelectionScore','saveSelectionResult','publishAnnouncement','markNotificationRead','markAllNotificationsRead','finalizeReregistration','saveMasterItem','deactivateMasterItem','setActiveAcademicYear','createManualUser','adminResetUserPassword','runSecurityMaintenance','sendCommunication']);
function invalidatePageSnapshots(){state.pageSnapshots={};}
function server(fn,...args){
  return new Promise((resolve,reject)=>{
    try{
      if(window.PSBBridge && typeof window.PSBBridge.call==='function'){
        Promise.resolve(window.PSBBridge.call(fn,args))
          .then(result=>{
            if(MUTATING_SERVER_FUNCTIONS.has(fn)&&result?.success){invalidatePageSnapshots();invalidatePageDataCache();}
            resolve(result);
          }).catch(reject);
        return;
      }
      if(window.google?.script?.run){
        window.google.script.run
          .withSuccessHandler(result=>{
            if(MUTATING_SERVER_FUNCTIONS.has(fn)&&result?.success){invalidatePageSnapshots();invalidatePageDataCache();}
            resolve(result);
          })
          .withFailureHandler(reject)[fn](...args);
        return;
      }
      reject(new Error('PSBBridge belum tersedia. Jalankan melalui Apps Script atau konfigurasi API bridge.'));
    }catch(e){reject(e);}
  });
}
const SNAPSHOT_PAGES=new Set(['home','documents','notifications','announcement','payments','reregistration','reports','audit','master']);
function pageSnapshotKey(page){let key=String(page||'');if(page==='documents')key+=':'+String(state.documentRegistrationId||'');if(page==='payments')key+=':'+String(state.paymentRegistrationId||'');if(page==='selection')key+=':'+String(state.selectionRegistrationId||'');if(page==='master')key+=':'+String(state.masterKey||'');return key;}
function savePageSnapshot(page){if(!SNAPSHOT_PAGES.has(page)||!$('content')?.innerHTML)return;state.pageSnapshots[pageSnapshotKey(page)]={html:$('content').innerHTML,ts:Date.now()};}
function restorePageSnapshot(page){if(!SNAPSHOT_PAGES.has(page))return false;const key=pageSnapshotKey(page),snap=state.pageSnapshots[key];if(!snap||Date.now()-snap.ts>state.pageSnapshotTtlMs){if(snap)delete state.pageSnapshots[key];return false;}$('content').innerHTML=snap.html;return true;}
function pageDataCached(page,ttl=180000){const x=state.cache.pages?.[page];if(!x||Date.now()-x.ts>ttl){if(x)delete state.cache.pages[page];return null;}return x.data;}
function setPageDataCache(page,data){state.cache.pages[page]={data:data,ts:Date.now()};return data;}
function invalidatePageDataCache(){if(state.cache.pages)state.cache.pages={};}
function warmPageData(page,loader){if(!state.prefetchPromises)state.prefetchPromises={};if(state.prefetchPromises[page])return state.prefetchPromises[page];const cached=pageDataCached(page);if(cached)return Promise.resolve(cached);const p=Promise.resolve().then(loader).then(data=>{if(data?.success!==false)setPageDataCache(page,data);return data;}).catch(()=>null).finally(()=>{delete state.prefetchPromises[page]});state.prefetchPromises[page]=p;return p;}
async function warmNavigationData(){
  if(!state.token)return;
  const tasks=[];
  if(hasAnyRole(['SUPERADMIN','ADMIN_PSB','VERIFIKATOR'])){
    tasks.push(['applicants',()=>server('getRegistrationList',state.token,{})]);
    tasks.push(['verification',()=>server('getVerificationQueue',state.token,{})]);
  }
  if(hasAnyRole(['SUPERADMIN','ADMIN_PSB','SELEKSI','VERIFIKATOR','WALI']))tasks.push(['selection',()=>server('getSelectionPageData',state.token,'')]);
  tasks.push(['announcement',()=>server('getAnnouncementPageData',state.token)]);
  tasks.push(['notifications',()=>server('getNotifications',state.token)]);
  if(hasAnyRole(['WALI','SUPERADMIN','ADMIN_PSB','VERIFIKATOR','KEUANGAN']))tasks.push(['reregistration',()=>server('getReregistrationPageData',state.token)]);
  if(hasAnyRole(['SUPERADMIN','ADMIN_PSB','VERIFIKATOR','SELEKSI','KEUANGAN']))tasks.push(['reports',()=>server('getReportingPageData',state.token,{})]);
  if(hasAnyRole(['SUPERADMIN','ADMIN_PSB']))tasks.push(['audit',()=>server('getAuditLogPageData',state.token,{page:1,search:'',action:'',module:'',from:'',to:'',pageSize:50})]);
  if(hasAnyRole(['SUPERADMIN','ADMIN_PSB']))tasks.push(['master',async()=>{const [defs,items,lifecycle]=await Promise.all([server('getMasterDefinitions',state.token),server('getMasterData',state.token,state.masterKey,true),server('getAcademicYearLifecycleData',state.token)]);return {success:!!(defs?.success&&items?.success),definitions:defs?.definitions||{},items:items?.items||[],lifecycle:lifecycle?.success?lifecycle:null};}]);
  if(hasAnyRole(['WALI','SUPERADMIN','ADMIN_PSB']))tasks.push(['chat',()=>server('getChatPageData',state.token)]);
  // Sequential background warm-up avoids flooding Apps Script with simultaneous Spreadsheet reads.
  for(const [page,loader] of tasks){if(pageDataCached(page))continue;await warmPageData(page,loader);}
}

function showMessage(text,type='error'){return `<div class="message ${type}">${esc(text)}</div>`}
function ico(name){
  const m={
    search:'<circle cx="10.8" cy="10.8" r="6.3"/><path d="m16 16 4.2 4.2"/>',
    home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/><path d="M9.5 21v-6h5v6"/>',
    menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
    clipboard:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5V3h6v1.5"/><path d="m8 12 2 2 5-5"/>',
    file:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 13h5M9 17h5"/>',
    wallet:'<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H18a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M4 7h14"/><path d="M20 11h-5a2 2 0 0 0 0 4h5"/><circle cx="15.5" cy="13" r=".7" fill="currentColor" stroke="none"/>',
    grad:'<path d="M3 9 12 4l9 5-9 5z"/><path d="M6 11v5c2 2 10 2 12 0v-5"/><path d="M21 9v7"/>',
    bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    user:'<circle cx="12" cy="8" r="3.5"/><path d="M5 21a7 7 0 0 1 14 0"/>',
    logout:'<path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5"/><path d="M13 8l4 4-4 4M8 12h9"/>',
    settings:'<path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.7 1.7-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.1h-2.4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1-1.7-1.7.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H4.7v-2.4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L6 8.6l1.7-1.7.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.1h2.4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.7 1.7-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0-1.6 1h.1V14h-.1a1.7 1.7 0 0 0-1.6 1Z"/>',
    list:'<path d="M8 6h11M8 12h11M8 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
    check:'<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/>',
    warning:'<path d="m12 3 9 16H3z"/><path d="M12 9v4M12 16h.01"/>',
    error:'<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    users:'<circle cx="9" cy="8" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0M14 19a4.5 4.5 0 0 1 7 1"/>',
    chart:'<path d="M4 19V5M4 19h17"/><path d="m7 15 3-4 3 2 5-7"/>',
    shield:'<path d="M12 3 20 6v5c0 5-3.2 8.5-8 10-4.8-1.5-8-5-8-10V6z"/><path d="m8.5 12 2.3 2.3 4.8-5"/>',
    megaphone:'<path d="m4 11 13-5v12L4 13z"/><path d="M17 10h3a2 2 0 0 1 0 4h-3M7 14l1.5 5"/>',
    database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/>',
    refresh:'<path d="M20 11a8 8 0 0 0-14.9-3M4 5v4h4M4 13a8 8 0 0 0 14.9 3M20 19v-4h-4"/>',
    power:'<path d="M12 3v9"/><path d="M6.4 5.8a8 8 0 1 0 11.2 0"/>',
    school:'<path d="m3 9 9-5 9 5-9 5z"/><path d="M6 11v5c2 2 10 2 12 0v-5M21 9v7"/>',
    chat:'<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 12.5z"/><path d="M8 8h8M8 11h5"/>',
    send:'<path d="m4 4 16 8-16 8 3.5-8z"/><path d="M7.5 12H20"/>',
    whatsapp:'<path d="M20.2 11.4a8.1 8.1 0 0 1-11.8 7.1L4 20l1.6-4.2A8.1 8.1 0 1 1 20.2 11.4Z"/><path d="M9.2 8.8c.2-.4.4-.4.7-.4h.5c.2 0 .4.1.5.4l.7 1.7c.1.2 0 .4-.1.6l-.6.7c-.1.1-.1.3 0 .5.4.7 1 1.2 1.7 1.6.2.1.4.1.5-.1l.7-.8c.1-.2.3-.2.5-.1l1.6.8c.2.1.3.3.2.5-.1.5-.3 1-.8 1.2-.5.3-1.1.4-1.6.2-1.1-.3-2.5-1.1-3.6-2.2-1.1-1.1-1.9-2.4-2.2-3.5-.2-.5-.1-1.1.2-1.6.2-.3.5-.5.9-.5Z"/>'
  };
  return `<span class="ico-visual ${name}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${m[name]||m.info}</svg></span>`;
}
function showAlert(title,text,type='info',confirmText='Tutup',cancelText=''){const id='alert_'+Date.now();const icon=type==='success'?'check':type==='warning'?'warning':type==='error'?'error':'info';document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop alert-modal" id="${id}"><div class="modal"><div class="alert-icon ${type}">${ico(icon)}</div><h3 class="alert-title">${esc(title)}</h3><p class="alert-text">${esc(text)}</p><div class="alert-actions"><button class="btn btn-primary" onclick="closeAlert('${id}')">${esc(confirmText)}</button>${cancelText?`<button class="btn btn-secondary" onclick="closeAlert('${id}')">${esc(cancelText)}</button>`:''}</div></div></div>`)}
function showConfirm(title,text,onConfirm,confirmText='Lanjutkan'){const id='confirm_'+Date.now();window[id]=()=>{closeAlert(id);onConfirm()};document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop alert-modal" id="${id}"><div class="modal"><div class="alert-icon warning">${ico('warning')}</div><h3 class="alert-title">${esc(title)}</h3><p class="alert-text">${esc(text)}</p><div class="alert-actions"><button class="btn btn-primary" onclick="window['${id}']()">${esc(confirmText)}</button><button class="btn btn-secondary" onclick="closeAlert('${id}')">Batal</button></div></div></div>`)}
function closeAlert(id){delete window[id];document.getElementById(id)?.remove()}

function bootProgress(show,text='Menyiapkan aplikasi...',done=false){const el=$('bootProgress'),tx=$('bootProgressText');if(!el)return;if(!show){el.classList.add('hidden');el.classList.remove('done');return}if(tx)tx.textContent=text;el.classList.remove('hidden','done');if(done){el.classList.add('done');setTimeout(()=>el.classList.add('hidden'),650)}}
async function initializeAfterLogin(){
  if(state.appInitialized || state.preloadRunning)return;
  state.appInitialized=true;
  state.preloadRunning=true;
  bootProgress(true,'Memuat data Pendaftaran (1/3)...');
  try{
    let reg=null;
    try{reg=await server('getMyRegistrations',state.token);}catch(e){reg=null;}
    if(reg?.success){state.registrationList=reg.registrations||[];state.cache.registration=state.registrationList;}
    const firstId=String(state.registrationList?.[0]?.registrationId||'');
    if(firstId){
      bootProgress(true,'Memuat data Dokumen & Pembayaran (2/3)...');
      const [doc,pay]=await Promise.allSettled([
        server('getDocumentPageData',state.token,firstId),
        server('getPaymentPageData',state.token,firstId)
      ]);
      if(doc.status==='fulfilled' && doc.value?.success){
        state.documentRegistrationId=String(doc.value.documentData?.registration?.registrationId||firstId);
        state.documentData=doc.value.documentData||null;
        state.cache.documents[state.documentRegistrationId]=doc.value;
      }
      if(pay.status==='fulfilled' && pay.value?.success){
        state.paymentRegistrationId=String(pay.value.paymentData?.registrationId||firstId);
        state.paymentData=pay.value.paymentData||null;
        state.paymentTypes=pay.value.paymentTypes||[];
        state.cache.payments[state.paymentRegistrationId]=pay.value;
      }
    }
    bootProgress(true,'Menyiapkan tampilan menu (3/3)...');
    state.preloadReady=true;
    bootProgress(true,'Data awal siap digunakan.',true);
  }catch(e){
    state.preloadReady=false;
    bootProgress(true,'Beranda siap. Data menu akan dilanjutkan saat dibuka.',true);
  }finally{state.preloadRunning=false;}
}
async function boot(){
  loading(true,'Memeriksa aplikasi...');
  try{
    // Jalankan pemeriksaan konfigurasi dan sesi secara paralel agar splash tidak
    // menunggu dua request server secara berurutan.
    if(state.token){
      const [pub,r]=await Promise.all([
        server('getPublicConfig',true),
        server('validateSession',state.token)
      ]);
      state.config=pub?.config||{}; applyAppIcon();
      hydrateSplashLogo();
      if(r?.success){
        state.user=r.user;
        renderApp();
        loading(false);
        initializeAfterLogin();
      }else{
        state.token='';
        localStorage.removeItem('psb_session');
        renderPublicHome('Sesi sebelumnya sudah berakhir. Silakan masuk kembali.');
      }
    }else{
      const pub=await server('getPublicConfig',true);
      state.config=pub?.config||{}; applyAppIcon();
      hydrateSplashLogo();
      renderPublicHome();
    }
  }catch(e){
    console.error('PSB boot error:',e);
    renderLogin('Koneksi ke server aplikasi belum tersedia. Silakan tunggu sebentar lalu coba lagi.');
  }
  loading(false);
}
function renderPublicHome(message=''){
  const year=esc(state.config.ACTIVE_YEAR||'2027/2028');
  $('app').innerHTML=`<div class="public-wrap"><div class="public-shell">
    <header class="public-top"><div class="logo">${appLogoMarkup()}</div><div class="public-brand"><h1>PSB Fathan Mubina</h1><p>Pendaftaran Santri Baru · ${year}</p></div><button class="public-login" onclick="renderLogin()">Masuk</button></header>
    ${message?showMessage(message,'info'):''}
    <section class="public-hero"><h2>PCB FATHAN MUBINA</h2><p>Portal Pendaftaran Santri Baru (PSB) Pesantren Ciawi Bogor Fathan Mubina. Langkah Awal Perjalanan Impian menjadi santri berilmu, berakhlaq dan berprestasi</p></section>

    <section class="public-gallery" aria-label="Galeri Fathan Mubina">
      <div class="public-gallery-head"><div class="public-section-title">Galeri Fathan Mubina</div><span class="public-gallery-count" id="galleryCount">Memuat...</span></div>
      <div class="gallery-frame" id="publicGalleryFrame">
        <div class="gallery-track" id="galleryTrack"><div class="gallery-empty">Memuat foto kegiatan pesantren...</div></div>
        <div class="gallery-nav"><button type="button" aria-label="Foto sebelumnya" onclick="movePublicGallery(-1)">‹</button><button type="button" aria-label="Foto berikutnya" onclick="movePublicGallery(1)">›</button></div>
      </div>
      <div class="gallery-dots" id="galleryDots"></div>
    </section>

    <section class="public-video" aria-label="Video Fathan Mubina">
      <div class="public-video-head"><div class="public-section-title">Video Fathan Mubina</div><span class="public-video-count" id="publicVideoCount">3 video</span></div>
      <div class="video-frame" id="publicVideoFrame">
        <div class="video-track" id="publicVideoTrack"></div>
        <div class="video-nav"><button type="button" aria-label="Video sebelumnya" onclick="movePublicVideo(-1)">‹</button><button type="button" aria-label="Video berikutnya" onclick="movePublicVideo(1)">›</button></div>
      </div>
      <div class="video-dots" id="publicVideoDots"></div>
    </section>

    <section class="public-social" aria-label="Media Sosial Pesantren">
      <div class="public-social-title">Media Sosial Pesantren</div>
      <div class="social-list">
        <a class="social-link website" href="https://www.fathanmubina.com" target="_blank" rel="noopener noreferrer"><span class="social-icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg></span><span>Website</span></a>
        <a class="social-link youtube" href="https://www.youtube.com/@fathanmubinaibs0303" target="_blank" rel="noopener noreferrer"><span class="social-icon"><svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="3"/><path d="m10 9 5 3-5 3z" fill="currentColor" stroke="none"/></svg></span><span>YouTube</span></a>
        <a class="social-link instagram" href="https://www.instagram.com/pesantrenfathanmubina" target="_blank" rel="noopener noreferrer"><span class="social-icon"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.5"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg></span><span>Instagram</span></a>
        <a class="social-link facebook" href="https://www.facebook.com/fathanmubina.todays" target="_blank" rel="noopener noreferrer"><span class="social-icon"><svg viewBox="0 0 24 24"><path d="M14 21v-8h3l.5-3H14V8.3c0-1 .3-1.8 1.9-1.8H18V3.7c-.6-.1-1.5-.2-2.5-.2-2.7 0-4.5 1.6-4.5 4.6V10H8v3h3v8z" fill="currentColor" stroke="none"/></svg></span><span>Facebook</span></a>
        <a class="social-link tiktok" href="https://www.tiktok.com/@pesantrenfathanmubina" target="_blank" rel="noopener noreferrer"><span class="social-icon"><svg viewBox="0 0 24 24"><path d="M14 4v10.2a4.2 4.2 0 1 1-3-4M14 4c1.1 2.4 2.7 3.7 5.5 4"/></svg></span><span>TikTok</span></a>
      </div>
    </section>
  </div></div>`;
  loadPublicGallery();
  renderPublicVideoSection();
}
const PSB_PUBLIC_VIDEOS=[
  {id:'HDrWuSwkbak',title:'Video 1'},
  {id:'0G0xGqSSI5Y',title:'Video 2'},
  {id:'fA63UYz0Jlg',title:'Video 3'}
];
let psbPublicVideoIndex=0;
function renderPublicVideoSection(){
  const track=document.getElementById('publicVideoTrack');
  const dots=document.getElementById('publicVideoDots');
  if(!track||!dots)return;
  track.innerHTML=PSB_PUBLIC_VIDEOS.map(function(item,index){
    const title=esc(item.title);
    return '<div class="video-slide">'+
      '<img class="video-thumb" src="https://i.ytimg.com/vi/'+encodeURIComponent(item.id)+'/hqdefault.jpg" alt="'+title+'" loading="'+(index===0?'eager':'lazy')+'">'+
      '<button type="button" class="video-play" aria-label="Putar '+title+'" onclick="playPublicVideo('+index+')"></button>'+
      '<div class="video-caption">'+title+'</div>'+
      '</div>';
  }).join('');
  dots.innerHTML=PSB_PUBLIC_VIDEOS.map(function(item,index){
    return '<button type="button" class="video-dot'+(index===0?' active':'')+'" aria-label="Video '+(index+1)+'" onclick="goPublicVideo('+index+')"></button>';
  }).join('');
  updatePublicVideo();
}
function updatePublicVideo(){
  const track=document.getElementById('publicVideoTrack');
  const dots=document.getElementById('publicVideoDots');
  if(!track)return;
  track.style.transform='translateX(-'+(psbPublicVideoIndex*100)+'%)';
  if(dots)Array.prototype.forEach.call(dots.children,function(el,index){el.classList.toggle('active',index===psbPublicVideoIndex);});
}
function goPublicVideo(index){
  const total=PSB_PUBLIC_VIDEOS.length;
  psbPublicVideoIndex=(index+total)%total;
  updatePublicVideo();
}
function movePublicVideo(delta){goPublicVideo(psbPublicVideoIndex+delta);}
function playPublicVideo(index){
  psbPublicVideoIndex=index;
  updatePublicVideo();
  const track=document.getElementById('publicVideoTrack');
  const slide=track&&track.children[index];
  const item=PSB_PUBLIC_VIDEOS[index];
  if(!slide||!item)return;
  if(slide.querySelector('iframe'))return;
  const iframe=document.createElement('iframe');
  iframe.className='video-iframe';
  iframe.src='https://www.youtube-nocookie.com/embed/'+encodeURIComponent(item.id)+'?autoplay=1&rel=0&modestbranding=1';
  iframe.title=item.title;
  iframe.setAttribute('allow','autoplay; encrypted-media; picture-in-picture');
  iframe.setAttribute('allowfullscreen','');
  const thumb=slide.querySelector('.video-thumb');
  const play=slide.querySelector('.video-play');
  const caption=slide.querySelector('.video-caption');
  if(thumb)thumb.style.display='none';
  if(play)play.style.display='none';
  if(caption)caption.style.display='none';
  slide.appendChild(iframe);
}
function resetPublicGallery(){
  if(state.publicGalleryTimer){clearInterval(state.publicGalleryTimer);state.publicGalleryTimer=null;}
  state.publicGalleryItems=[];state.publicGalleryIndex=0;
}
function renderPublicGallery(items){
  resetPublicGallery();
  state.publicGalleryItems=Array.isArray(items)?items:[];
  const track=$('galleryTrack'),dots=$('galleryDots'),count=$('galleryCount');
  if(!track||!dots||!count)return;
  if(!state.publicGalleryItems.length){
    track.innerHTML='<div class="gallery-empty">Foto galeri belum tersedia.</div>';
    dots.innerHTML='';count.textContent='';return;
  }
  count.textContent=`${state.publicGalleryItems.length} foto`;
  track.innerHTML=state.publicGalleryItems.map((item,i)=>`<div class="gallery-slide"><img src="${esc(item.url)}" alt="${esc(item.name||'Foto Fathan Mubina')}" loading="${i===0?'eager':'lazy'}" referrerpolicy="no-referrer" onerror="this.style.display='none'"><div class="gallery-caption">${esc(item.name||'Fathan Mubina')}</div></div>`).join('');
  dots.innerHTML=state.publicGalleryItems.map((_,i)=>`<button type="button" class="gallery-dot${i===0?' active':''}" aria-label="Foto ${i+1}" onclick="goPublicGallery(${i})"></button>`).join('');
  updatePublicGallery();
  if(state.publicGalleryItems.length>1) state.publicGalleryTimer=setInterval(()=>movePublicGallery(1),5000);
}
function updatePublicGallery(){
  const track=$('galleryTrack'),dots=$('galleryDots');
  if(!track||!dots||!state.publicGalleryItems?.length)return;
  track.style.transform=`translateX(-${state.publicGalleryIndex*100}%)`;
  Array.from(dots.children).forEach((el,i)=>el.classList.toggle('active',i===state.publicGalleryIndex));
}
function goPublicGallery(index){
  const total=state.publicGalleryItems?.length||0;if(!total)return;
  state.publicGalleryIndex=(index+total)%total;updatePublicGallery();
}
function movePublicGallery(delta){goPublicGallery((state.publicGalleryIndex||0)+delta)}
async function loadPublicGallery(){
  try{
    const result=await server('getPublicGallery',false);
    if(result?.success) renderPublicGallery(result.items||[]);
    else renderPublicGallery([]);
  }catch(e){renderPublicGallery([]);}
}

function openRegistrationEntry(){
  if(state.user && hasAnyRole(['WALI','SUPERADMIN','ADMIN_PSB'])){state.page='registration';renderApp();goPage('registration');return;}
  renderLogin('Silakan masuk terlebih dahulu untuk membuka Pendaftaran.');
}
function renderPublicInfo(title,desc){
  $('app').innerHTML=`<div class="public-wrap"><div class="public-shell"><header class="public-top"><div class="logo">${appLogoMarkup()}</div><div class="public-brand"><h1>PSB Fathan Mubina</h1><p>${esc(state.config.ACTIVE_YEAR||'2027/2028')}</p></div><button class="public-login" onclick="renderLogin()">Masuk</button></header><section class="hero"><h2>${esc(title)}</h2><p>${esc(desc)}</p></section><button class="btn btn-secondary" onclick="renderPublicHome()">Kembali ke Beranda</button></div></div>`;
}
function renderLogin(error=''){
  $('app').innerHTML=`<div class="login-wrap"><div class="login-card">
    <div class="logo login-logo center">${appLogoMarkup()}</div><div class="center"><h1 class="login-title">PSB Fathan Mubina</h1><div class="login-sub">Pendaftaran Santri Baru · ${esc(state.config.ACTIVE_YEAR||'2027/2028')}</div></div>
    ${error?showMessage(error):''}<form onsubmit="submitLogin(event)">
      <div class="field"><label>Username, No. HP atau Email</label><input id="identifier" autocomplete="username" inputmode="text" placeholder="Superadmin, 08xxxxxxxxxx, atau email" required></div>
      <div class="field"><label>Password</label><div class="input-wrap"><input id="password" type="password" autocomplete="current-password" placeholder="Masukkan password" required><button class="toggle" type="button" onclick="togglePassword()">Lihat</button></div></div>
      <button class="btn btn-primary" id="loginBtn">Masuk</button>
    </form>
    <div class="center" style="margin-top:18px"><span class="muted">Belum punya akun?</span> <button type="button" class="link-btn" onclick="renderRegisterWali()">Daftar sebagai Wali</button></div>
    <div class="center" style="margin-top:10px"><button type="button" class="link-btn muted" onclick="renderPublicHome()">← Kembali ke Beranda</button></div>
  </div></div>`;
}
function renderRegisterWali(error=''){
  $('app').innerHTML=`<div class="login-wrap"><div class="login-card">
    <div class="logo login-logo center">${appLogoMarkup()}</div><div class="center"><h1 class="login-title">Daftar Akun Wali</h1><div class="login-sub">PSB Fathan Mubina · ${esc(state.config.ACTIVE_YEAR||'2027/2028')}</div></div>
    ${error?showMessage(error):''}
    <form onsubmit="submitRegisterWali(event)">
      <div class="field"><label>Nama Lengkap *</label><input id="regName" autocomplete="name" placeholder="Nama ayah / ibu / wali" required></div>
      <div class="field"><label>No. HP</label><input id="regPhone" autocomplete="tel" inputmode="tel" placeholder="08xxxxxxxxxx"></div>
      <div class="field"><label>Email</label><input id="regEmail" type="email" autocomplete="email" placeholder="nama@email.com"></div>
      <div class="muted" style="font-size:12px;margin:-2px 0 12px">Isi minimal salah satu: No. HP atau Email.</div>
      <div class="field"><label>Password *</label><div class="input-wrap"><input id="regPassword" type="password" autocomplete="new-password" placeholder="Minimal 6 karakter" required><button class="toggle" type="button" onclick="toggleRegisterPassword('regPassword',this)">Lihat</button></div></div>
      <div class="field"><label>Konfirmasi Password *</label><input id="regConfirmPassword" type="password" autocomplete="new-password" placeholder="Ulangi password" required></div>
      <button class="btn btn-primary" id="registerBtn">Buat Akun Wali</button>
    </form>
    <div class="status-card" style="margin-top:14px;box-shadow:none"><b>Tanpa OTP</b><div class="muted" style="font-size:11px;margin-top:5px">Akun langsung aktif setelah data berhasil disimpan. Gunakan No. HP atau Email dan password tersebut untuk masuk kembali.</div></div>
    <div class="center" style="margin-top:14px"><button type="button" class="link-btn" onclick="renderLogin()">Sudah punya akun? Masuk</button></div>
  </div></div>`;
}
function toggleRegisterPassword(id,button){const i=$(id);i.type=i.type==='password'?'text':'password';button.textContent=i.type==='password'?'Lihat':'Sembunyikan'}
async function submitRegisterWali(e){
  e.preventDefault();const btn=$('registerBtn');btn.disabled=true;btn.textContent='Membuat akun...';loading(true,'Membuat akun wali...');
  try{
    const r=await server('registerWali',{name:$('regName').value,phone:$('regPhone').value,email:$('regEmail').value,password:$('regPassword').value,confirmPassword:$('regConfirmPassword').value});
    if(r.success){state.token=r.sessionToken;state.user=r.user;localStorage.setItem('psb_session',state.token);showToast('Akun WALI berhasil dibuat.','success');renderApp();setTimeout(()=>goPage('registration'),0);}
    else renderRegisterWali(r.message);
  }catch(err){renderRegisterWali('Terjadi kesalahan koneksi aplikasi.')}finally{loading(false)}
}
function togglePassword(){const i=$('password');const b=i.nextElementSibling;i.type=i.type==='password'?'text':'password';b.textContent=i.type==='password'?'Lihat':'Sembunyikan'}
async function submitLogin(e){
  e.preventDefault();const btn=$('loginBtn');btn.disabled=true;btn.textContent='Memeriksa...';loading(true,'Memeriksa akun...');
  try{const r=await server('login',$('identifier').value,$('password').value);if(r.success){state.token=r.sessionToken;state.user=r.user;state.appInitialized=false;state.preloadRunning=false;state.preloadReady=false;state.initialData=null;state.cache={registration:null,documents:{},payments:{},pages:{}};state.prefetchPromises={};state.pageSnapshots={};state.registrationList=[];state.documentData=null;state.paymentData=null;localStorage.setItem('psb_session',state.token);renderApp();loading(false);initializeAfterLogin();server('finalizeLogin',state.token).catch(()=>{});if(r.mustChangePassword)setTimeout(openChangePassword,200);}else renderLogin(r.message)}catch(err){renderLogin('Terjadi kesalahan koneksi aplikasi.')}finally{if(!state.appInitialized)loading(false)}
}
function buildRoleNav(){
  const wali=hasAnyRole(['WALI']);
  if(wali)return [
    ['home','Beranda','home'],['registration','Pendaftaran','clipboard'],['documents','Dokumen','file'],['payments','Pembayaran','wallet'],['selection','Tes','grad'],['announcement','Pengumuman','bell'],['chat','Chat','chat']
  ];
  const finance=hasAnyRole(['KEUANGAN']);
  const operational=hasAnyRole(['SUPERADMIN','ADMIN_PSB','VERIFIKATOR','SELEKSI']);
  if(operational||finance){
    const items=[
      ['home','Dashboard','home'],['applicants','Pendaftar','users'],['verification','Verifikasi','check'],['payments','Pembayaran','wallet'],['selection','Tes','grad'],['announcement','Pengumuman','megaphone'],['reregistration','Daftar Ulang','refresh'],['reports','Reporting','chart'],['chat','Chat','chat'],['master','Data','database']
    ];
    if(hasAnyRole(['SUPERADMIN','ADMIN_PSB']))items.push(['audit','Audit','shield']);
    if(hasAnyRole(['SUPERADMIN']))items.push(['userManagement','Manajemen Pengguna','users']);
    return items;
  }
  return [['home','Beranda','home']];
}
function buildMobileNav(){
  const all=buildRoleNav();
  if(all.length<=5)return all;

  // Maksimal 5 tombol di bottom nav. Jika menu role lebih dari 5,
  // empat menu utama ditampilkan langsung dan sisanya masuk ke Lainnya.
  const preferred={
    SUPERADMIN:['home','applicants','reports','announcement'],
    ADMIN_PSB:['home','applicants','reports','announcement'],
    WALI:['home','registration','announcement','documents']
  };
  const role=hasAnyRole(['SUPERADMIN'])?'SUPERADMIN':hasAnyRole(['ADMIN_PSB'])?'ADMIN_PSB':hasAnyRole(['WALI'])?'WALI':'';
  const ids=preferred[role]||all.slice(0,4).map(x=>x[0]);
  const direct=ids.map(id=>all.find(x=>x[0]===id)).filter(Boolean);
  return [...direct,['more','Lainnya','settings']];
}
function navButtonsHtml(items,side){return items.map((x,i)=>`<button class="${side?'side-btn':'nav-btn'} ${i===0?'active':''}" id="${side?'side':'nav'}-${x[0]}" onclick="goPage('${x[0]}')"><span class="${side?'side-icon':'nav-icon'}">${ico(x[2])}</span><span>${x[1]}</span></button>`).join('');}
function renderApp(){
  document.body.classList.remove('sidebar-collapsed');
  const sideItems=buildRoleNav();
  const items=buildMobileNav();
  const wali=hasAnyRole(['WALI']);
  const roleLabel=hasAnyRole(['SUPERADMIN'])?'SUPERADMIN':hasAnyRole(['ADMIN_PSB'])?'ADMIN PSB':hasAnyRole(['VERIFIKATOR'])?'VERIFIKATOR':hasAnyRole(['SELEKSI'])?'SELEKSI':'WALI';
  const nav=navButtonsHtml(items,false);
  const side=navButtonsHtml(sideItems,true);
  const chatFab=hasAnyRole(['WALI','SUPERADMIN','ADMIN_PSB'])?`<button class="chat-fab" type="button" onclick="goPage('chat')" title="Buka Chat Wali ↔ Admin PSB" aria-label="Buka Chat Wali ↔ Admin PSB"><span class="fab-icon">${ico('chat')}</span><span class="fab-label">Chat PSB</span><span id="chatFabBadge" class="chat-fab-badge" aria-label="Pesan belum dibaca"></span></button>`:'';
  $('app').innerHTML=`<aside class="sidebar"><div class="sidebar-nav">${side}</div><div class="sidebar-footer"><button class="side-user side-user-button" onclick="goPage('profile')" title="Buka profil"><div>${ico('user')}</div><div style="min-width:0"><div class="side-user-name">${esc(state.user.name)}</div><div class="side-user-role">${roleLabel}</div></div></button></div></aside><div class="topbar"><div class="brand"><button class="sidebar-toggle" type="button" title="Tampilkan/sembunyikan menu" aria-label="Tampilkan/sembunyikan menu" onclick="toggleSidebar()">${ico('menu')}</button><div class="logo">${appLogoMarkup()}</div><div class="brand-copy"><h1>PSB Fathan Mubina</h1><p>${esc(state.config.ACTIVE_YEAR||'2027/2028')}</p></div><div class="top-actions"><button class="header-action" id="reloadDataBtn" type="button" title="Reload data" aria-label="Reload data" onclick="reloadCurrentData()">${ico('refresh')}</button><button class="header-action notification-bell-wrap" title="Notifikasi" aria-label="Notifikasi" onclick="goPage('notifications')">${ico('bell')}<span id="notificationBadge" class="notification-badge" style="display:none">0</span></button><button class="user-chip" type="button" title="Profil" onclick="goPage('profile')"><span class="user-name">${esc(state.user.name)}</span><span class="user-icon">${ico('user')}</span></button></div></div></div><main class="shell" id="content"></main><nav class="bottom-nav"><div class="nav-inner" style="grid-template-columns:repeat(${items.length},minmax(0,1fr))">${nav}</div></nav>${chatFab}`;
  goPage('home');
  updateNotificationBadge();
}
async function reloadCurrentData(){
  if(!state.token || state.reloadingData)return;
  state.reloadingData=true;
  const btn=$('reloadDataBtn');
  if(btn){btn.disabled=true;btn.classList.add('is-reloading');btn.title='Memuat ulang data...';}
  try{
    invalidatePageSnapshots();
    invalidatePageDataCache();
    state.initialData=null;
    state.preloadReady=false;
    const [pub,session]=await Promise.all([
      server('getPublicConfig',true),
      server('validateSession',state.token)
    ]);
    if(!session?.success){
      localStorage.removeItem('psb_session');
      state.token='';
      state.user=null;
      renderPublicHome('Sesi sudah berakhir. Silakan masuk kembali.');
      showToast('Sesi sudah berakhir.','warning');
      return;
    }
    state.config=pub?.config||state.config||{};
    state.user=session.user||state.user;
    applyAppIcon();
    const current=state.page||'home';
    renderApp();
    state.page=current;
    goPage(current);
    showToast('Data berhasil dimuat ulang.','success');
  }catch(e){
    showToast('Gagal memuat ulang data. Silakan coba lagi.','error');
  }finally{
    state.reloadingData=false;
    if(btn){btn.disabled=false;btn.classList.remove('is-reloading');btn.title='Reload data';}
  }
}

function toggleSidebar(){
  if(!document.body.classList.contains('desktop-device'))return;
  document.body.classList.toggle('sidebar-collapsed');
}
function goPage(page){
  // Menekan menu Chat PSB ketika Chat sudah aktif harus benar-benar no-op.
  // Jangan menyimpan/memulihkan snapshot karena itu dapat mengganti DOM chat
  // yang sedang aktif dan terasa seperti reload.
  if(state.page===page){
    if(page==='chat')return;
    savePageSnapshot(page);
    if(restorePageSnapshot(page)){window.scrollTo({top:0,behavior:'auto'});return;}
  }
  if(state.page==='chat' && page!=='chat') stopChatPolling();
  else if(state.page)savePageSnapshot(state.page);
  state.page=page;
  document.querySelectorAll('.nav-btn,.side-btn').forEach(x=>x.classList.remove('active'));
  $('nav-'+page)?.classList.add('active');$('side-'+page)?.classList.add('active');
  if(restorePageSnapshot(page)){window.scrollTo({top:0,behavior:'auto'});return;}
  if(page==='home')renderHome();else if(page==='profile')renderProfile();else if(page==='master')renderMasterData();else if(page==='registration')renderRegistrationHub();else if(page==='applicants')renderApplicants();else if(page==='documents')renderDocuments();else if(page==='notifications')renderNotifications();else if(page==='announcement')renderAnnouncements();else if(page==='verification')renderVerification();else if(page==='payments')renderPayments();else if(page==='selection')renderSelection();else if(page==='reregistration')renderReregistration();else if(page==='reports')renderReports();else if(page==='chat')renderChat();else if(page==='audit')renderAudit();else if(page==='userManagement')renderUserManagementPage();else renderMore();
  window.scrollTo({top:0,behavior:'auto'});
}
function dashboardLocalKey(){return 'psb_dashboard_'+String(state.user?.userId||'guest')+'_'+String(state.config?.ACTIVE_YEAR||'2027/2028');}
function readDashboardLocal(){try{const raw=sessionStorage.getItem(dashboardLocalKey());if(!raw)return null;const x=JSON.parse(raw);if(!x||Date.now()-Number(x.ts||0)>120000)return null;return x.data||null;}catch(e){return null}}
function writeDashboardLocal(data){try{sessionStorage.setItem(dashboardLocalKey(),JSON.stringify({ts:Date.now(),data:data}));}catch(e){}}

async function renderHome(){
  const wali=hasAnyRole(['WALI']);
  const admin=hasAnyRole(['SUPERADMIN','ADMIN_PSB','VERIFIKATOR']);
  if(!wali){
    const local=readDashboardLocal();
    $('content').innerHTML=`<section class="hero"><div style="display:flex;gap:10px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap"><div><h2>Dashboard</h2><p>Ringkasan operasional PSB periode ${esc(state.config.ACTIVE_YEAR||'2027/2028')}.</p></div><span class="pill info">v${esc(state.config.APP_VERSION||'25.0')} · ${esc(state.config.RELEASE_STAGE||'PRODUCTION')}</span></div></section><div id="dashboardPanel"><div class="empty-state">${local?'Memperbarui ringkasan...':'Memuat dashboard...'}</div></div>`;
    if(local){state.cache.pages.dashboard={data:local,ts:Date.now()};renderAdminDashboard(local);}
    try{const r=await server('getDashboardPageData',state.token);if(!r.success){if(!local)$('dashboardPanel').innerHTML=showMessage(r.message);return;}state.cache.pages.dashboard={data:r,ts:Date.now()};writeDashboardLocal(r);renderAdminDashboard(r);setTimeout(()=>warmNavigationData(),0);}catch(e){if(!local)$('dashboardPanel').innerHTML=showMessage('Gagal memuat dashboard.');}
    return;
  }
  const maintenanceBanner=String(state.config.MAINTENANCE_MODE||'').toUpperCase()==='TRUE'?`<div class="status-card" style="margin-bottom:12px"><div class="status-row"><div><b>Sistem dalam pemeliharaan</b><div class="muted" style="font-size:10px;margin-top:3px">Akses informasi tetap tersedia, tetapi tindakan perubahan data sementara dinonaktifkan.</div></div><span class="pill warning">Maintenance</span></div></div>`:''; $('content').innerHTML=`<section class="hero"><h2>Selamat datang, ${esc(state.user.name)}</h2><p>Pantau tahapan setiap pendaftaran anak dan lanjutkan langkah yang masih harus dilakukan.</p></section>${maintenanceBanner}<div id="waliHomeFlow"><div class="empty-state">Memuat alur pendaftaran...</div></div>`;
  try{
    const r=await server('getWaliHomeData',state.token);
    if(!r.success){$('waliHomeFlow').innerHTML=showMessage(r.message||'Alur pendaftaran belum dapat dimuat.');return}
    renderWaliHomeFlow(r);setTimeout(()=>warmNavigationData(),0);
  }catch(e){$('waliHomeFlow').innerHTML=showMessage('Gagal memuat alur pendaftaran. Silakan coba lagi.');}
}
function waliFlowAction(key,id){
  if(key==='registration') goPage('registration');
  else if(key==='payments'){state.paymentRegistrationId=id;goPage('payments');}
  else if(key==='selection'){state.selectionRegistrationId=id;state.selectionData=null;goPage('selection');}
  else if(key==='announcement') goPage('announcement');
}
function renderWaliHomeFlow(data){
  const el=$('waliHomeFlow');if(!el)return;
  const items=data.registrations||[];
  if(!items.length){el.innerHTML=`<section class="card wali-flow-card"><div class="wali-flow-head"><div><div class="wali-flow-title">Alur Pendaftaran</div><div class="wali-flow-sub">Belum ada pendaftaran pada tahun ajaran ${esc(data.activeYear||'berjalan')}.</div></div></div><div class="wali-flow-next"><div class="wali-flow-next-title">Mulai pendaftaran pertama</div><div class="wali-flow-next-desc">Buat pendaftaran calon santri untuk memulai seluruh proses PSB.</div><div class="wali-flow-actions"><button class="btn btn-primary" onclick="goPage('registration')">+ Pendaftaran Baru</button></div></div></section>`;return}
  const stages=[
    ['Pendaftaran','Isi dan kirim data calon santri.'],
    ['Verifikasi','Data dan dokumen diperiksa petugas.'],
    ['Pembayaran Formulir','Lakukan pembayaran setelah pendaftaran terverifikasi.'],
    ['Tes & Seleksi','Ikuti tes sesuai jadwal dan tunggu hasil seleksi.'],
    ['Pengumuman','Lihat hasil seleksi setelah diumumkan.'],
    ['Daftar Ulang','Jika lulus, lanjutkan proses daftar ulang.']
  ];
  el.innerHTML=items.map(r=>{
    const completed=Math.max(0,Math.min(6,Number(r.completed||0)));
    const flow=stages.map((st,i)=>{const n=i+1,done=n<=completed,current=n===completed+1&&!((r.result?.published)&&r.result?.status==='NOT_PASSED');let badge=done?'Sudah dilewati':current?'Berikutnya':'Selanjutnya';if(r.result?.published&&r.result?.status==='NOT_PASSED'&&n===6)badge='Tidak diperlukan';if(r.result?.published&&r.result?.status==='WAITLIST'&&n===6)badge='Menunggu informasi';return `<div class="wali-flow-item ${done?'done':''} ${current?'current':''}"><div class="wali-flow-dot">${done?'✓':n}</div><div class="wali-flow-copy"><b>${esc(st[0])}</b><span>${esc(st[1])}</span><span class="wali-flow-badge">${esc(badge)}</span></div></div>`}).join('');
    const next=r.next||{};
    const stageIndex=Math.max(0,Math.min(6,completed));
    const progress=Math.round((stageIndex/6)*100);
    const currentStage=stageIndex<6?stages[stageIndex][0]:'Selesai';
    const progressLabel=stageIndex===0?'Belum mulai':stageIndex>=6?'Semua tahap selesai':`Tahap ${stageIndex} dari 6`;
    return `<section class="card wali-flow-card">
      <div class="wali-flow-head">
        <div><div class="wali-flow-title">${esc(r.candidateName)}</div><div class="wali-flow-sub">${esc(r.registrationNumber)} · ${esc(r.statusLabel||r.status||'-')}</div></div>
        <span class="pill ${r.status==='PASSED'?'ok':''}">${esc(r.statusLabel||r.status||'-')}</span>
      </div>
      <div class="wali-flow-progress-head"><span>${esc(progressLabel)}</span><b>${progress}%</b></div>
      <div class="wali-flow-progress"><span style="width:${progress}%"></span></div>
      ${stageIndex<6?`<div class="wali-flow-current"><div class="wali-flow-current-icon">${ico('arrow-right')}</div><div><b>Tahap berikutnya: ${esc(currentStage)}</b><span>${esc(next.description||stages[stageIndex][1])}</span></div></div>`:`<div class="wali-flow-current complete"><div class="wali-flow-current-icon">✓</div><div><b>Alur pendaftaran selesai</b><span>Tidak ada tindakan yang perlu dilakukan saat ini.</span></div></div>`}
      <div class="wali-flow-list">${flow}</div>
      <div class="wali-flow-next"><div class="wali-flow-next-title">${esc(next.title||'Proses selesai')}</div><div class="wali-flow-next-desc">${esc(next.description||'Tidak ada tindakan yang perlu dilakukan saat ini.')}</div>${next.key?`<div class="wali-flow-actions"><button class="btn btn-primary" onclick="waliFlowAction('${esc(next.key)}','${esc(r.registrationId)}')">${esc(next.button||'Buka')}</button></div>`:''}</div>
    </section>`;
  }).join('');
}


function dashboardTaskItems(items, emptyText){
  if(!items||!items.length)return `<div class="dashboard-task-empty">${esc(emptyText||'Tidak ada tugas saat ini.')}</div>`;
  return items.map(x=>`<div class="dashboard-task-item"><div class="dashboard-task-copy"><div class="dashboard-task-name">${esc(x.candidateName||'-')}</div><div class="dashboard-task-meta">${esc(x.registrationNumber||x.statusLabel||x.label||'-')}${x.amount?` · ${formatRupiah(x.amount)}`:''}${x.resultStatus?` · ${esc(x.resultStatus)}`:''}</div></div><div class="dashboard-task-action"><button class="btn btn-secondary btn-sm" onclick="goPage('${esc(x.action||'applicants')}')">Buka</button></div></div>`).join('');
}
function renderDashboardSchedule(data){
  const op=data.operational||{}, today=op.schedules?.today||[], tomorrow=op.schedules?.tomorrow||[];
  const block=(title,items,empty)=>`<div><div class="dashboard-task-head" style="margin-bottom:8px"><div><div class="dashboard-task-title">${esc(title)}</div><span class="dashboard-task-sub">Jadwal tes aktif</span></div><div class="dashboard-task-count">${items.length}</div></div>${items.length?items.map(x=>`<div class="dashboard-schedule-item"><b>${esc(x.name||'Tes Seleksi')}</b><span>${esc(x.selectionDate||'-')}${x.location?' · '+esc(x.location):''}</span></div>`).join(''):`<div class="dashboard-task-empty">${esc(empty)}</div>`}</div>`;
  return `<section class="dashboard-task-card"><div class="dashboard-task-head"><div><div class="dashboard-task-title">Jadwal Tes</div><span class="dashboard-task-sub">Pantau agenda hari ini dan besok.</span></div><button class="btn btn-secondary btn-sm" onclick="goPage('selection')">Buka Tes</button></div><div class="dashboard-schedule-grid">${block('Hari ini',today,'Tidak ada jadwal tes hari ini.')} ${block('Besok',tomorrow,'Tidak ada jadwal tes besok.')}</div></section>`;
}
function renderAdminDashboard(data){
  const s=data.summary||{},p=data.payments||{},sel=data.selection||{},rr=data.reregistration||{},fin=data.finance||{},op=data.operational||{},perm=data.permissions||{};
  const cards=[['Total Pendaftar',s.total||0,'Periode aktif'],['Perlu Ditinjau',Number(s.submitted||0)+Number(s.underReview||0)+Number(s.revision||0),'Submitted · Review · Revisi'],['Terverifikasi',s.verified||0,'Data pendaftaran'],['Selesai',s.completed||0,'Daftar ulang selesai'],['Pembayaran Lunas',p.paid||0,'Semua jenis tagihan'],['Peserta Tes',sel.participants||0,'Sudah dijadwalkan'],['Lulus Seleksi',sel.passed||0,'Hasil seleksi'],['Pendapatan Lunas',formatRupiah(fin.paidAmount||0),'Tagihan berstatus PAID']];
  const kpis=cards.map(x=>`<article class="dashboard-kpi"><div class="kpi-label">${esc(x[0])}</div><div class="kpi-value">${typeof x[1]==='number'?Number(x[1]).toLocaleString('id-ID'):esc(x[1])}</div><div class="kpi-note">${esc(x[2])}</div></article>`).join('');
  const maxJ=Math.max(1,...(data.distributions?.jenjang||[]).map(x=>Number(x.count||0))),maxG=Math.max(1,...(data.distributions?.gelombang||[]).map(x=>Number(x.count||0)));
  const bars=(arr,max)=>arr.length?arr.map(x=>`<div><div class="dashboard-bar-row"><div class="dashboard-bar-label">${esc(x.name)}</div><div class="dashboard-bar-value">${Number(x.count||0)}</div></div><div class="dashboard-bar-track"><div class="dashboard-bar-fill" style="width:${Math.round(Number(x.count||0)/max*100)}%"></div></div></div>`).join(''):'<div class="muted" style="font-size:11px">Belum ada data.</div>';
  const ops=[];
  if(perm.canVerification)ops.push(`<section class="dashboard-task-card"><div class="dashboard-task-head"><div><div class="dashboard-task-title">Verifikasi</div><span class="dashboard-task-sub">Pendaftaran yang menunggu pemeriksaan atau perbaikan.</span></div><div class="dashboard-task-count">${Number(op.verification?.count||0)}</div></div><div class="dashboard-task-list">${dashboardTaskItems(op.verification?.items,'Tidak ada antrean verifikasi.')}</div><div class="dashboard-quick-actions"><button class="btn btn-secondary btn-sm" onclick="goPage('verification')">Buka Verifikasi</button></div></section>`);
  if(perm.canPayments)ops.push(`<section class="dashboard-task-card"><div class="dashboard-task-head"><div><div class="dashboard-task-title">Pembayaran Menunggu Verifikasi</div><span class="dashboard-task-sub">Bukti pembayaran yang baru masuk.</span></div><div class="dashboard-task-count">${Number(op.payments?.count||0)}</div></div><div class="dashboard-task-list">${dashboardTaskItems(op.payments?.items,'Tidak ada pembayaran yang menunggu verifikasi.')}</div><div class="dashboard-quick-actions"><button class="btn btn-secondary btn-sm" onclick="goPage('payments')">Buka Pembayaran</button></div></section>`);
  if(perm.canSelection)ops.push(`<section class="dashboard-task-card"><div class="dashboard-task-head"><div><div class="dashboard-task-title">Peserta Tes</div><span class="dashboard-task-sub">Peserta terjadwal yang masih perlu ditindaklanjuti.</span></div><div class="dashboard-task-count">${Number(op.selection?.count||0)}</div></div><div class="dashboard-task-list">${dashboardTaskItems(op.selection?.items,'Tidak ada peserta yang perlu ditindaklanjuti.')}</div><div class="dashboard-quick-actions"><button class="btn btn-secondary btn-sm" onclick="goPage('selection')">Buka Tes</button></div></section>`);
  if(perm.canAnnouncement)ops.push(`<section class="dashboard-task-card"><div class="dashboard-task-head"><div><div class="dashboard-task-title">Hasil Siap Dipublikasikan</div><span class="dashboard-task-sub">Hasil seleksi yang belum diumumkan.</span></div><div class="dashboard-task-count">${Number(op.announcements?.count||0)}</div></div><div class="dashboard-task-list">${dashboardTaskItems(op.announcements?.items,'Tidak ada hasil yang menunggu publikasi.')}</div><div class="dashboard-quick-actions"><button class="btn btn-secondary btn-sm" onclick="goPage('announcement')">Buka Pengumuman</button></div></section>`);
  if(perm.canReregistration)ops.push(`<section class="dashboard-task-card"><div class="dashboard-task-head"><div><div class="dashboard-task-title">Daftar Ulang</div><span class="dashboard-task-sub">Pendaftar lulus yang proses daftar ulangnya belum selesai.</span></div><div class="dashboard-task-count">${Number(op.reregistration?.count||0)}</div></div><div class="dashboard-task-list">${dashboardTaskItems(op.reregistration?.items,'Tidak ada daftar ulang yang tertunda.')}</div><div class="dashboard-quick-actions"><button class="btn btn-secondary btn-sm" onclick="goPage('reregistration')">Buka Daftar Ulang</button></div></section>`);
  $('dashboardPanel').innerHTML=`<div class="dashboard-kpi-grid">${kpis}</div><section class="dashboard-section"><div class="dashboard-section-head"><div><b>Operasional Hari Ini</b><span style="display:block;margin-top:3px">Antrean kerja dan agenda yang perlu dipantau dari dashboard.</span></div><span>${esc(op.today||'')}</span></div>${ops.length?`<div class="dashboard-ops-grid">${ops.join('')}</div>`:'<div class="empty-state">Tidak ada panel operasional yang tersedia untuk role ini.</div>'}</section>${renderDashboardSchedule(data)}<div class="dashboard-section"><div class="dashboard-section-head"><div><b>Status Alur</b><span style="display:block;margin-top:3px">Distribusi pendaftar pada workflow utama.</span></div></div><div class="dashboard-kpi-grid" style="margin-top:0"><article class="dashboard-kpi"><div class="kpi-label">Menunggu proses</div><div class="kpi-value">${Number(s.submitted||0)+Number(s.underReview||0)+Number(s.revision||0)}</div><div class="kpi-note">Pendaftaran</div></article><article class="dashboard-kpi"><div class="kpi-label">Pembayaran formulir</div><div class="kpi-value">${Number(s.paymentVerified||0).toLocaleString('id-ID')}</div><div class="kpi-note">Siap proses tes</div></article><article class="dashboard-kpi"><div class="kpi-label">Hasil seleksi</div><div class="kpi-value">${Number(sel.results||0).toLocaleString('id-ID')}</div><div class="kpi-note">Sudah memiliki hasil</div></article><article class="dashboard-kpi"><div class="kpi-label">Daftar ulang</div><div class="kpi-value">${Number(rr.completed||0).toLocaleString('id-ID')}</div><div class="kpi-note">Sudah selesai</div></article></div></section><section class="dashboard-section"><div class="dashboard-section-head"><div><b>Alat Operasional</b><span style="display:block;margin-top:3px">Akses cepat ke alat kerja tanpa mencampurnya dengan status alur.</span></div></div><div class="dashboard-tools-grid">${perm.canReport?`<button class="dashboard-tool" onclick="goPage('reports')">${ico('chart')}<span>Reporting</span></button>`:''}${perm.canMonitoring?`<button class="dashboard-tool" onclick="openMonitoringUI()">${ico('shield')}<span>Monitoring</span></button>`:''}${perm.canChat?`<button class="dashboard-tool" onclick="goPage('chat')">${ico('chat')}<span>Chat Wali</span></button>`:''}${hasAnyRole(['SUPERADMIN','ADMIN_PSB'])?`<button class="dashboard-tool" onclick="openCommunicationCenterUI()">${ico('megaphone')}<span>Komunikasi</span></button><button class="dashboard-tool" onclick="openProductionReadinessUI()">${ico('check')}<span>Production Readiness</span></button><button class="dashboard-tool primary" onclick="openGoLiveCenterUI()">${ico('school')}<span>Go-Live Center</span></button>`:''}</div></section><div class="dashboard-section"><div class="dashboard-section-head"><div><b>Pendaftar per Jenjang</b><span style="display:block;margin-top:3px">Periode aktif</span></div></div><div class="dashboard-bars">${bars(data.distributions?.jenjang||[],maxJ)}</div></div><div class="dashboard-section"><div class="dashboard-section-head"><div><b>Pendaftar per Gelombang</b><span style="display:block;margin-top:3px">Periode aktif</span></div></div><div class="dashboard-bars">${bars(data.distributions?.gelombang||[],maxG)}</div></div>`;
}


async function openMonitoringUI(){
  if(!hasAnyRole(['SUPERADMIN','ADMIN_PSB','VERIFIKATOR','SELEKSI','KEUANGAN'])){showToast('Anda tidak memiliki akses monitoring.','warning');return}
  if(state.detailLoadingLocks.monitoring)return;state.detailLoadingLocks.monitoring=true;
  let shell=$('monitoringModal');if(!shell){document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="monitoringModal"><div class="modal" style="max-width:1120px;max-height:90vh;overflow:auto"><div class="status-row"><div><h3 style="margin:0">Monitoring, Reconciliation & Incident Control</h3><p class="muted" style="margin:4px 0 0">Memuat pemeriksaan operasional...</p></div><button class="btn btn-secondary" onclick="closeMonitoringUI()">Tutup</button></div><div id="monitoringBody" style="margin-top:14px"><div class="empty-state">Memuat monitoring...</div></div></div></div>`);shell=$('monitoringModal')}
  try{
    const r=await server('getMonitoringPageData',state.token); if(!r?.success){showToast(r?.message||'Monitoring tidak dapat dimuat.','error');return;}
    const sla=r.sla||{}, rec=r.reconciliation||{}, ex=r.exceptions||{}, daily=r.daily||{}, inc=r.incidents||{};
    const q=[...(sla.overdue||[]),...(sla.attention||[])];
    const queueRows=q.length?q.slice(0,12).map(x=>`<tr><td>${esc(x.candidateName||'-')}<div class="muted">${esc(x.registrationNumber||'-')}</div></td><td>${esc(x.label||'-')}</td><td>${esc(x.agingLabel||'-')}</td><td>${esc(x.ageDays===null?'-':x.ageDays+' hari')}</td></tr>`).join(''):`<tr><td colspan="4"><div class="empty-state">Tidak ada antrean yang melewati batas normal.</div></td></tr>`;
    const exRows=(ex.items||[]).slice(0,18).map(x=>`<tr><td><span class="pill ${x.severity==='ERROR'?'danger':'warning'}">${esc(x.severity)}</span></td><td>${esc(x.type)}</td><td>${esc(x.recordId||'-')}</td><td>${esc(x.detail||'-')}</td></tr>`).join('');
    const modal=$('monitoringModal');const body=$('monitoringBody');if(!modal||!body)return;
    body.innerHTML=`
      <div class="report-summary-grid" style="margin-top:14px"><article class="report-summary"><b>${Number(sla.total||0)}</b><span>Antrean dipantau</span></article><article class="report-summary"><b>${Number(sla.counts?.OVERDUE||0)}</b><span>Terlambat</span></article><article class="report-summary"><b>${Number(ex.errors||0)}</b><span>Exception error</span></article><article class="report-summary"><b>${Number(inc.open||0)}</b><span>Insiden terbuka</span></article></div>
      <div class="dashboard-section" style="margin-top:14px"><div class="dashboard-section-head"><div><b>SLA / Aging</b><span style="display:block;margin-top:3px">Normal &lt; 1 hari · Perlu perhatian 1–2 hari · Terlambat &gt; 2 hari</span></div><span>${Number(sla.counts?.NORMAL||0)} normal · ${Number(sla.counts?.ATTENTION||0)} perhatian · ${Number(sla.counts?.OVERDUE||0)} terlambat</span></div><div style="overflow:auto"><table class="data-table"><thead><tr><th>Calon Santri</th><th>Antrean</th><th>Aging</th><th>Umur</th></tr></thead><tbody>${queueRows}</tbody></table></div></div>
      <div class="dashboard-section"><div class="dashboard-section-head"><div><b>Rekonsiliasi Pembayaran</b><span style="display:block;margin-top:3px">BILLS → PAYMENTS → PAYMENT_VERIFICATIONS</span></div><span>${Number(rec.payments?.summary?.total||0)} exception</span></div><div class="report-summary-grid"><article class="report-summary"><b>${Number(rec.payments?.summary?.errors||0)}</b><span>Error</span></article><article class="report-summary"><b>${Number(rec.payments?.summary?.warnings||0)}</b><span>Warning</span></article></div></div>
      <div class="dashboard-section"><div class="dashboard-section-head"><div><b>Rekonsiliasi Pendaftaran</b><span style="display:block;margin-top:3px">Relasi user, calon santri, dokumen, pembayaran, tes, hasil, dan daftar ulang.</span></div><span>${Number(rec.registrations?.summary?.total||0)} exception</span></div><div class="report-summary-grid"><article class="report-summary"><b>${Number(rec.registrations?.summary?.errors||0)}</b><span>Error</span></article><article class="report-summary"><b>${Number(rec.registrations?.summary?.warnings||0)}</b><span>Warning</span></article></div></div>
      <div class="dashboard-section"><div class="dashboard-section-head"><div><b>Exception Report</b><span style="display:block;margin-top:3px">Masalah referensi, nominal, verifikasi, file, dan status yang terdeteksi.</span></div><span>${Number(ex.total||0)} total</span></div><div style="overflow:auto"><table class="data-table"><thead><tr><th>Level</th><th>Tipe</th><th>Record</th><th>Detail</th></tr></thead><tbody>${exRows||'<tr><td colspan="4"><div class="empty-state">Tidak ada exception terdeteksi.</div></td></tr>'}</tbody></table></div></div>
      <div class="dashboard-section"><div class="dashboard-section-head"><div><b>Daily Operations Summary</b><span style="display:block;margin-top:3px">Ringkasan aktivitas pada ${esc(daily.date||'-')}.</span></div></div><div class="dashboard-kpi-grid"><article class="dashboard-kpi"><div class="kpi-label">Pendaftaran baru</div><div class="kpi-value">${Number(daily.newRegistrations||0)}</div></article><article class="dashboard-kpi"><div class="kpi-label">Kirim pendaftaran</div><div class="kpi-value">${Number(daily.submitted||0)}</div></article><article class="dashboard-kpi"><div class="kpi-label">Pembayaran masuk</div><div class="kpi-value">${Number(daily.paymentsSubmitted||0)}</div></article><article class="dashboard-kpi"><div class="kpi-label">Pembayaran diverifikasi</div><div class="kpi-value">${Number(daily.paymentsVerified||0)}</div></article><article class="dashboard-kpi"><div class="kpi-label">Peserta tes</div><div class="kpi-value">${Number(daily.selectionParticipants||0)}</div></article><article class="dashboard-kpi"><div class="kpi-label">Pengumuman</div><div class="kpi-value">${Number(daily.announcements||0)}</div></article><article class="dashboard-kpi"><div class="kpi-label">Daftar ulang selesai</div><div class="kpi-value">${Number(daily.reregCompleted||0)}</div></article></div></div>
      ${hasAnyRole(['SUPERADMIN','ADMIN_PSB'])?`<div class="dashboard-section"><div class="dashboard-section-head"><div><b>Incident Center</b><span style="display:block;margin-top:3px">Kelola insiden operasional dan tindak lanjutnya.</span></div><span>${Number(inc.open||0)} terbuka</span></div><div class="modal-actions"><button class="btn btn-primary" onclick="openIncidentCenterUI()">Buka Incident Center</button></div></div>`:''}
    `;
  }catch(e){const b=$('monitoringBody');if(b)b.innerHTML=showMessage('Gagal memuat monitoring.','error')}finally{state.detailLoadingLocks.monitoring=false}
}
function closeMonitoringUI(){state.detailLoadingLocks.monitoring=false;const x=$('monitoringModal');if(x)x.remove()}
async function openIncidentCenterUI(){
  if(state.detailLoadingLocks.incident)return;state.detailLoadingLocks.incident=true;let shell=$('incidentModal');if(!shell){document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="incidentModal"><div class="modal" style="max-width:1050px;max-height:90vh;overflow:auto"><div class="status-row"><div><h3 style="margin:0">Incident Center</h3><p style="margin:4px 0 0">Memuat data insiden...</p></div><button class="btn btn-secondary" onclick="closeIncidentCenterUI()">Tutup</button></div><div id="incidentBody" style="margin-top:14px"><div class="empty-state">Memuat Incident Center...</div></div></div></div>`);shell=$('incidentModal')}
  try{const r=await server('getIncidentPageData',state.token);if(!r?.success){const b=$('incidentBody');if(b)b.innerHTML=showMessage(r?.message||'Incident Center tidak dapat dimuat.','warning');return}
    window._incidentItems=r.items||[];const rows=window._incidentItems.map(x=>`<tr><td>${esc(x.incidentId)}</td><td>${esc(x.title)}</td><td><span class="pill">${esc(x.priority)}</span></td><td>${esc(x.status)}</td><td>${esc(x.assignedTo||'-')}</td><td><button class="btn btn-secondary" onclick="editIncident('${esc(x.incidentId)}')">Edit</button>${x.status!=='CLOSED'?`<button class="btn btn-primary" onclick="closeIncidentUI('${esc(x.incidentId)}')" style="margin-left:5px">Tutup</button>`:''}</td></tr>`).join('');
    const modal=$('incidentModal'),body=$('incidentBody');if(!modal||!body)return;body.innerHTML=`<div id="incidentForm" style="margin-top:14px"></div><div style="overflow:auto;margin-top:14px"><table class="data-table"><thead><tr><th>ID</th><th>Judul</th><th>Prioritas</th><th>Status</th><th>Assign</th><th>Aksi</th></tr></thead><tbody>${rows||'<tr><td colspan="6"><div class="empty-state">Belum ada insiden.</div></td></tr>'}</tbody></table></div><div class="modal-actions"><button class="btn btn-primary" onclick="editIncident(null)">Tambah Insiden</button></div>`;
  }catch(e){const b=$('incidentBody');if(b)b.innerHTML=showMessage('Gagal memuat Incident Center.','error')}finally{state.detailLoadingLocks.incident=false}
}
function closeIncidentCenterUI(){state.detailLoadingLocks.incident=false;const x=$('incidentModal');if(x)x.remove()}
function editIncident(id){const f=$('incidentForm');if(!f)return; const x=(window._incidentItems||[]).find(v=>String(v.incidentId)===String(id))||{};f.innerHTML=`<div class="dashboard-section"><div class="field"><label>Judul</label><input id="incidentTitle" value="${esc(x.title||'')}" placeholder="Contoh: Pembayaran tidak sinkron"></div><div class="field"><label>Deskripsi</label><textarea id="incidentDescription" rows="3" placeholder="Jelaskan kejadian, dampak, dan konteks.">${esc(x.description||'')}</textarea></div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px"><div class="field"><label>Prioritas</label><select id="incidentPriority"><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></div><div class="field"><label>Status</label><select id="incidentStatus"><option>OPEN</option><option>INVESTIGATING</option><option>RESOLVED</option><option>CLOSED</option></select></div></div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px"><div class="field"><label>Modul terkait</label><input id="incidentModule" value="${esc(x.relatedModule||'')}" placeholder="PAYMENT / REGISTRATION / ..."></div><div class="field"><label>Record ID terkait</label><input id="incidentRecord" value="${esc(x.relatedRecordId||'')}" placeholder="ID record bila ada"></div></div><div class="field"><label>Assigned To</label><input id="incidentAssigned" value="${esc(x.assignedTo||'')}" placeholder="User ID / petugas"></div><div class="field"><label>Catatan resolusi</label><textarea id="incidentResolution" rows="2">${esc(x.resolutionNote||'')}</textarea></div><div class="modal-actions"><button class="btn btn-primary" onclick='saveIncidentUI(${JSON.stringify(x.incidentId||'')})'>Simpan Insiden</button></div></div>`; $('incidentPriority').value=x.priority||'MEDIUM';$('incidentStatus').value=x.status||'OPEN';f.scrollIntoView({behavior:'smooth',block:'nearest'})}
async function saveIncidentUI(id){const payload={incidentId:id,title:$('incidentTitle').value,description:$('incidentDescription').value,priority:$('incidentPriority').value,status:$('incidentStatus').value,relatedModule:$('incidentModule').value,relatedRecordId:$('incidentRecord').value,assignedTo:$('incidentAssigned').value,resolutionNote:$('incidentResolution').value};loading(true,'Menyimpan insiden...');try{const r=await server('saveIncident',state.token,payload);if(!r?.success){showToast(r?.message||'Insiden belum tersimpan.','error');return}showToast(r.message,'success');closeIncidentCenterUI();openIncidentCenterUI()}catch(e){showToast('Gagal menyimpan insiden.','error')}finally{loading(false)}}
async function closeIncidentUI(id){const note=prompt('Catatan resolusi/penutupan (opsional):','');if(note===null)return;loading(true,'Menutup insiden...');try{const r=await server('closeIncident',state.token,id,note);if(!r?.success){showToast(r?.message||'Insiden belum ditutup.','error');return}showToast(r.message,'success');closeIncidentCenterUI();openIncidentCenterUI()}catch(e){showToast('Gagal menutup insiden.','error')}finally{loading(false)}}

async function openProductionReadinessUI(){
  if(!hasAnyRole(['SUPERADMIN','ADMIN_PSB']))return;if(state.detailLoadingLocks.productionReadiness)return;state.detailLoadingLocks.productionReadiness=true;
  let shell=$('productionReadinessModal');if(!shell){document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="productionReadinessModal"><div class="modal" style="max-width:820px;max-height:88vh;overflow:auto"><div class="status-row"><div><h3 style="margin:0">Production Readiness</h3><p style="margin:4px 0 0">Memeriksa kesiapan produksi...</p></div><button class="btn btn-secondary" onclick="closeProductionReadinessUI()">Tutup</button></div><div id="productionReadinessBody" style="margin-top:14px"><div class="empty-state">Memuat pemeriksaan...</div></div></div></div>`);shell=$('productionReadinessModal')}
  try{
    const r=await server('getProductionReadiness',state.token);
    if(!r.success){const b=$("productionReadinessBody");if(b)b.innerHTML=showMessage(r.message||'Tidak dapat memeriksa kesiapan produksi.','warning');return;}
    const groups={};(r.checks||[]).forEach(x=>(groups[x.category||'Lainnya']||(groups[x.category||'Lainnya']=[])).push(x));
    const statusLabel=x=>x.status==='OK'?'OK':x.status==='ERROR'?'Perlu diperbaiki':x.status==='WARNING'?'Perhatian':x.status==='OPEN'?'Terbuka':'Tertutup';
    const statusClass=x=>x.status==='OK'?'ok':x.status==='ERROR'?'danger':x.status==='WARNING'?'warning':'info';
    const groupHtml=Object.keys(groups).map(g=>`<section style="margin-top:14px"><div class="muted" style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;margin-bottom:7px">${esc(g)}</div>${groups[g].map(x=>`<div class="status-card" style="margin:0 0 7px"><div class="status-row"><div style="min-width:0"><b>${esc(x.label)}</b><div class="muted" style="font-size:10px;margin-top:3px">${esc(x.detail)}</div></div><span class="pill ${statusClass(x)}">${esc(statusLabel(x))}</span></div></div>`).join('')}</section>`).join('');
    const body=$("productionReadinessBody");if(!body)return;body.innerHTML=`<div class="report-summary-grid" style="margin-top:14px"><article class="report-summary"><b>${Number(r.summary?.ok||0)}</b><span>OK</span></article><article class="report-summary"><b>${Number(r.summary?.warnings||0)}</b><span>Perhatian</span></article><article class="report-summary"><b>${Number(r.summary?.errors||0)}</b><span>Perlu diperbaiki</span></article><article class="report-summary"><b>${r.productionReady?'SIAP':'BELUM'}</b><span>Status produksi</span></article></div>${groupHtml}<div class="muted" style="font-size:10px;margin-top:14px">Diperiksa: ${esc(r.checkedAt||'-')}</div>`;
  }catch(e){const b=$("productionReadinessBody");if(b)b.innerHTML=showMessage('Terjadi gangguan saat memeriksa kesiapan produksi.','error')}finally{state.detailLoadingLocks.productionReadiness=false}
}
function closeProductionReadinessUI(){state.detailLoadingLocks.productionReadiness=false;document.getElementById('productionReadinessModal')?.remove();}

async function openGoLiveCenterUI(){
  if(!hasAnyRole(['SUPERADMIN','ADMIN_PSB']))return;if(state.detailLoadingLocks.goLive)return;state.detailLoadingLocks.goLive=true;
  let shell=$('goLiveCenterModal');if(!shell){document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="goLiveCenterModal"><div class="modal" style="max-width:920px;max-height:90vh;overflow:auto"><div class="status-row"><div><h3 style="margin:0">Go-Live Center</h3><p style="margin:4px 0 0">Memeriksa checklist dan kontrol produksi...</p></div><button class="btn btn-secondary" onclick="closeGoLiveCenterUI()">Tutup</button></div><div id="goLiveCenterBody" style="margin-top:14px"><div class="empty-state">Memuat Go-Live Center...</div></div></div></div>`);shell=$('goLiveCenterModal')}
  try{
    const r=await server('getGoLiveChecklist',state.token);
    if(!r.success){const b=$("goLiveCenterBody");if(b)b.innerHTML=showMessage(r.message||'Pemeriksaan gagal.','warning');return;}
    const c=await server('getProductionControlData',state.token);
    const items=(r.items||[]).map(x=>`<div class="status-card" style="margin:0 0 7px"><div class="status-row"><div style="min-width:0"><b>${esc(x.label)}</b><div class="muted" style="font-size:10px;margin-top:3px">${esc(x.detail)}</div></div><span class="pill ${x.ok?'ok':'danger'}">${x.ok?'Siap':'Belum'}</span></div></div>`).join('');
    const cfg=c.config||{};
    const isSuper=hasAnyRole(['SUPERADMIN']);
    const body=$("goLiveCenterBody");if(!body)return;body.innerHTML=`<div class="report-summary-grid" style="margin-top:14px"><article class="report-summary"><b>${Number(r.summary?.ready||0)}</b><span>Siap</span></article><article class="report-summary"><b>${Number(r.summary?.blocked||0)}</b><span>Belum siap</span></article><article class="report-summary"><b>${r.productionReady?'SIAP':'BELUM'}</b><span>Go-Live</span></article><article class="report-summary"><b>v${esc(cfg.APP_VERSION||'25.0')}</b><span>Versi</span></article></div><section style="margin-top:16px"><div class="status-row"><div><b>Checklist Go-Live</b><span class="muted" style="display:block;font-size:10px;margin-top:3px">Pemeriksaan bersifat non-destruktif.</span></div><button class="btn btn-secondary btn-sm" onclick="refreshGoLiveCenterUI()">Periksa Ulang</button></div>${items}</section><section style="margin-top:18px"><div class="muted" style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;margin-bottom:7px">Production Control</div><div class="form-grid"><div class="field"><label>App Version</label><input id="glVersion" value="${esc(cfg.APP_VERSION||'25.0')}" ${isSuper?'':'disabled'}></div><div class="field"><label>Release Stage</label><select id="glRelease" ${isSuper?'':'disabled'}><option value="PRODUCTION" ${String(cfg.RELEASE_STAGE)==='PRODUCTION'?'selected':''}>PRODUCTION</option><option value="STAGING" ${String(cfg.RELEASE_STAGE)==='STAGING'?'selected':''}>STAGING</option></select></div><div class="field"><label>Pendaftaran</label><select id="glRegistration" ${isSuper?'':'disabled'}><option value="TRUE" ${String(cfg.REGISTRATION_OPEN).toUpperCase()==='TRUE'?'selected':''}>OPEN</option><option value="FALSE" ${String(cfg.REGISTRATION_OPEN).toUpperCase()!=='TRUE'?'selected':''}>CLOSED</option></select></div><div class="field"><label>Maintenance Mode</label><select id="glMaintenance" ${isSuper?'':'disabled'}><option value="FALSE" ${String(cfg.MAINTENANCE_MODE).toUpperCase()!=='TRUE'?'selected':''}>OFF</option><option value="TRUE" ${String(cfg.MAINTENANCE_MODE).toUpperCase()==='TRUE'?'selected':''}>ON</option></select></div></div>${isSuper?`<div class="form-actions" style="margin-top:10px"><button class="btn btn-primary" onclick="saveProductionControlUI()">Simpan Kontrol Produksi</button><button class="btn btn-secondary" onclick="createProductionBackupUI()">Buat Backup</button></div>`:''}<div class="muted" style="font-size:10px;margin-top:8px">ACTIVE_YEAR: ${esc(cfg.ACTIVE_YEAR||state.config.ACTIVE_YEAR||'-')} · TIMEZONE: ${esc(cfg.TIMEZONE||'Asia/Jakarta')}</div></section>`;
  }catch(e){const b=$("goLiveCenterBody");if(b)b.innerHTML=showMessage('Terjadi gangguan saat memeriksa sistem.','error')}finally{state.detailLoadingLocks.goLive=false}
}
function closeGoLiveCenterUI(){state.detailLoadingLocks.goLive=false;document.getElementById('goLiveCenterModal')?.remove();}
async function refreshGoLiveCenterUI(){closeGoLiveCenterUI();await openGoLiveCenterUI();}
async function saveProductionControlUI(){
  if(!hasAnyRole(['SUPERADMIN']))return;
  const payload={APP_VERSION:$('glVersion')?.value||'',RELEASE_STAGE:$('glRelease')?.value||'PRODUCTION',REGISTRATION_OPEN:$('glRegistration')?.value||'FALSE',MAINTENANCE_MODE:$('glMaintenance')?.value||'FALSE'};
  loading(true,'Menyimpan kontrol produksi...');
  try{const r=await server('setProductionControl',state.token,payload);if(!r.success){showAlert('Gagal',r.message||'Kontrol produksi gagal disimpan.','error');return;}state.config=Object.assign({},state.config,r.config||{});showAlert('Berhasil','Kontrol produksi berhasil diperbarui.','success');closeGoLiveCenterUI();await openGoLiveCenterUI();}catch(e){showAlert('Gagal','Kontrol produksi gagal disimpan.','error')}finally{loading(false)}
}
async function createProductionBackupUI(){
  if(!hasAnyRole(['SUPERADMIN']))return;
  if(!confirm('Buat salinan backup spreadsheet produksi sekarang?'))return;
  loading(true,'Membuat backup...');
  try{const r=await server('createProductionBackup',state.token);if(!r.success){showAlert('Backup gagal',r.message||'Backup gagal dibuat.','error');return;}showAlert('Backup berhasil',`${r.fileName||'Backup spreadsheet'} berhasil dibuat di Drive produksi.`,'success');}catch(e){showAlert('Backup gagal','Terjadi gangguan saat membuat backup.','error')}finally{loading(false)}
}

async function renderReports(){
  if(!hasAnyRole(['SUPERADMIN','ADMIN_PSB','VERIFIKATOR','SELEKSI','KEUANGAN'])){renderMore();return;}
  $('content').innerHTML=`<section class="hero"><h2>Reporting</h2><p>Ringkasan pendaftar, pembayaran, seleksi, dan Daftar Ulang. Data dapat difilter dan diunduh sebagai CSV.</p></section><section class="dashboard-section"><div class="report-filter-grid"><div class="field"><label>Tahun Ajaran</label><select id="reportYear" class="select-field professional-select"><option value="">Menyiapkan pilihan...</option></select></div><div class="field"><label>Gelombang</label><select id="reportGelombang" class="select-field professional-select"><option value="">Semua gelombang</option></select></div><div class="field"><label>Jenjang</label><select id="reportJenjang" class="select-field professional-select"><option value="">Semua jenjang</option></select></div><div class="field"><label>Jenis Kelamin</label><select id="reportGender" class="select-field professional-select"><option value="">Semua jenis kelamin</option></select></div><div class="field"><label>Status</label><select id="reportStatus" class="select-field professional-select"><option value="">Semua status</option></select></div><div class="field"><label>Dari tanggal</label><input id="reportFromDate" type="date" class="select-field"></div><div class="field"><label>Sampai tanggal</label><input id="reportToDate" type="date" class="select-field"></div></div><div class="report-actions"><button class="btn btn-primary" onclick="loadReports()">Terapkan Filter</button><button class="btn btn-secondary" onclick="exportReportCsv()">Export CSV</button><button class="btn btn-secondary" onclick="loadAdvancedReports()">Advanced Analytics</button></div></section><div id="reportPanel"><div class="empty-state">Memuat reporting...</div></div><div id="advancedReportPanel" style="margin-top:14px"><div class="empty-state">Advanced Analytics dimuat saat tombol dibuka.</div></div>`;
  await loadReports();
}
async function loadReports(){
  const panel=$('reportPanel');if(panel)panel.innerHTML='<div class="empty-state">Memuat data reporting...</div>';
  try{
    const filters={tahunAjaranId:$('reportYear')?.value||'',gelombangId:$('reportGelombang')?.value||'',jenjangId:$('reportJenjang')?.value||'',gender:$('reportGender')?.value||'',status:$('reportStatus')?.value||'',fromDate:$('reportFromDate')?.value||'',toDate:$('reportToDate')?.value||''};
    const isDefault=!filters.tahunAjaranId&&!filters.gelombangId&&!filters.jenjangId&&!filters.gender&&!filters.status&&!filters.fromDate&&!filters.toDate;const r=(isDefault&&pageDataCached('reports'))||await warmPageData(isDefault?'reports':'reports-filter',()=>server('getReportingPageData',state.token,filters));if(!r?.success){if(panel)panel.innerHTML=showMessage(r.message);return;}state.reportData=r;populateReportFilters(r);renderReportPanel(r);
  }catch(e){if(panel)panel.innerHTML=showMessage('Gagal memuat reporting.');}
}
function populateReportFilters(data){
  const o=data.options||{};const year=$('reportYear'),gel=$('reportGelombang'),jen=$('reportJenjang'),gender=$('reportGender'),st=$('reportStatus');if(!year)return;
  const selected=data.filters||{};
  year.innerHTML=(o.tahunAjaran||[]).map(x=>`<option value="${esc(x.tahunAjaranId)}" ${String(x.tahunAjaranId)===String(selected.tahunAjaranId)?'selected':''}>${esc(x.name)}</option>`).join('')||'<option value="">-</option>';
  gel.innerHTML='<option value="">Semua gelombang</option>'+(o.gelombang||[]).map(x=>`<option value="${esc(x.gelombangId)}" ${String(x.gelombangId)===String(selected.gelombangId)?'selected':''}>${esc(x.name)}</option>`).join('');
  jen.innerHTML='<option value="">Semua jenjang</option>'+(o.jenjang||[]).map(x=>`<option value="${esc(x.jenjangId)}" ${String(x.jenjangId)===String(selected.jenjangId)?'selected':''}>${esc(x.name)}</option>`).join('');
  gender.innerHTML='<option value="">Semua jenis kelamin</option>'+(o.gender||[]).map(x=>`<option value="${esc(x.value)}" ${String(x.value)===String(selected.gender)?'selected':''}>${esc(x.name)}</option>`).join('');
  st.innerHTML='<option value="">Semua status</option>'+(o.statuses||[]).map(x=>`<option value="${esc(x)}" ${String(x)===String(selected.status)?'selected':''}>${esc(statusLabel(x))}</option>`).join('');
}
function renderReportPanel(data){
  const s=data.summary||{},rows=data.rows||[],el=$('reportPanel');if(!el)return;
  const groups=data.groupBreakdown||[];
  const groupCards=groups.length?`<section class="report-group-section"><div class="status-row"><div><h3 style="margin:0">Kelompok Pendaftar</h3><p style="margin:4px 0 0">Pemisahan laporan berdasarkan jenjang dan jenis kelamin.</p></div></div><div class="report-summary-grid report-group-grid">${groups.slice(0,12).map(x=>`<article class="report-summary"><b>${Number(x.count||0).toLocaleString('id-ID')}</b><span>${esc(x.label)}</span></article>`).join('')}</div></section>`:'';
  const table=rows.length?`<div class="report-table-wrap"><table class="report-table"><thead><tr><th>Pendaftar</th><th>Kelompok</th><th>Jenjang</th><th>Gelombang</th><th>Status</th><th>Pembayaran</th><th>Seleksi</th><th>Daftar Ulang</th></tr></thead><tbody>${rows.map(x=>`<tr><td><b>${esc(x.candidateName)}</b><br><span class="muted">${esc(x.registrationNumber||x.registrationId)}</span></td><td><strong>${esc(x.reportGroup||'-')}</strong><br><span class="muted">${esc(x.genderName||'-')}</span></td><td>${esc(x.jenjangName)}</td><td>${esc(x.gelombangName)}</td><td>${esc(statusLabel(x.status))}</td><td>${esc(x.paymentStatus==='PAID'?'Lunas':x.paymentStatus==='SUBMITTED'?'Menunggu verifikasi':x.paymentStatus==='REJECTED'?'Ditolak':'Belum bayar')}${Number(x.paidAmount||0)?`<br><span class="muted">${esc(formatRupiah(x.paidAmount))}</span>`:''}</td><td>${esc(x.selectionStatus?selectionStatusLabel(x.selectionStatus):'-')}</td><td>${esc(x.reregistrationStatus?reregStatusLabel(x.reregistrationStatus):'-')}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state">Tidak ada data sesuai filter.</div>';
  el.innerHTML=`<div class="report-summary-grid"><article class="report-summary"><b>${Number(s.total||0).toLocaleString('id-ID')}</b><span>Total pendaftar</span></article><article class="report-summary"><b>${Number(s.paid||0).toLocaleString('id-ID')}</b><span>Pembayaran lunas</span></article><article class="report-summary"><b>${Number(s.passed||0).toLocaleString('id-ID')}</b><span>Lulus seleksi</span></article><article class="report-summary"><b>${Number(s.completed||0).toLocaleString('id-ID')}</b><span>Daftar ulang selesai</span></article></div>${groupCards}<section class="dashboard-section" style="margin-top:14px"><div class="status-row"><div><h3 style="margin:0">Detail Pendaftar</h3><p style="margin:4px 0 0">Data sesuai filter yang dipilih.</p></div></div>${table}</section>`;
}
async function loadAdvancedReports(){
  const el=$('advancedReportPanel');
  if(!el)return;
  el.innerHTML='<div class="empty-state">Memuat Advanced Analytics...</div>';
  try{
    const filters={tahunAjaranId:$('reportYear')?.value||'',gelombangId:$('reportGelombang')?.value||'',jenjangId:$('reportJenjang')?.value||'',gender:$('reportGender')?.value||'',status:$('reportStatus')?.value||'',fromDate:$('reportFromDate')?.value||'',toDate:$('reportToDate')?.value||''};
    const r=await server('getAdvancedReportingData',state.token,filters);
    if(!r?.success){el.innerHTML=showMessage(r?.message||'Gagal memuat analytics.');return;}
    state.advancedReportData=r;
    renderAdvancedReports(r);
  }catch(e){el.innerHTML=showMessage('Gagal memuat Advanced Analytics.');}
}
function renderAdvancedReports(d){
  const el=$('advancedReportPanel');if(!el)return;
  const f=d.funnel||{},c=d.conversion||{},fin=d.finance||{},o=d.outcome||{},p=d.processing||{};
  const rate=v=>Number(v||0).toLocaleString('id-ID')+'%';
  const day=v=>v==null?'-':Number(v).toLocaleString('id-ID')+' hari';
  const bar=(label,value,total)=>'<div class="analytics-list-row"><div><div>'+esc(label)+'</div><div class="analytics-bar"><i style="width:'+(total?Math.max(3,Math.round(Number(value||0)/total*100)):0)+'%"></i></div></div><div class="v">'+Number(value||0).toLocaleString('id-ID')+'</div></div>';
  const trend=(d.trends||[]).map(x=>'<tr><td>'+esc(x.month)+'</td><td>'+Number(x.registrations||0)+'</td><td>'+Number(x.submitted||0)+'</td><td>'+Number(x.verified||0)+'</td></tr>').join('')||'<tr><td colspan="4">Tidak ada data trend.</td></tr>';
  const breakdown=arr=>{if(!arr||!arr.length)return '<div class="empty-state">Tidak ada data.</div>';const max=Math.max(1,...arr.map(x=>Number(x.count||0)));return arr.slice(0,8).map(x=>bar(x.label,x.count,max)).join('');};
  el.innerHTML='<section class="dashboard-section"><div class="status-row"><div><h3 style="margin:0">Advanced Reporting & Analytics</h3><p style="margin:4px 0 0">Funnel, conversion, tren, outcome seleksi, keuangan, dan waktu proses.</p></div><button class="btn btn-secondary btn-sm" onclick="exportAdvancedReports()">Export Analytics</button></div><div class="analytics-grid">'+
    '<article class="analytics-card"><b>'+Number(f.registrations||0).toLocaleString('id-ID')+'</b><span>Pendaftar</span></article>'+
    '<article class="analytics-card"><b>'+rate(c.verificationRate)+'</b><span>Verification rate</span></article>'+
    '<article class="analytics-card"><b>'+rate(c.paymentRate)+'</b><span>Payment conversion</span></article>'+
    '<article class="analytics-card"><b>'+rate(c.passRate)+'</b><span>Pass rate</span></article>'+
    '<article class="analytics-card"><b>'+rate(c.reregistrationCompletionRate)+'</b><span>Daftar ulang selesai</span></article>'+
    '<article class="analytics-card"><b>'+formatRupiah(fin.paidAmount||0)+'</b><span>Total pembayaran lunas</span></article>'+
    '<article class="analytics-card"><b>'+Number(f.selection||0).toLocaleString('id-ID')+'</b><span>Peserta seleksi</span></article>'+
    '<article class="analytics-card"><b>'+Number(f.completed||0).toLocaleString('id-ID')+'</b><span>Selesai</span></article></div></section>'+
    '<section class="dashboard-section analytics-section"><h3>Funnel PSB</h3><div class="analytics-list">'+
    bar('Pendaftaran',f.registrations,f.registrations)+bar('Submit',f.submitted,f.registrations)+bar('Terverifikasi',f.verified,f.registrations)+bar('Pembayaran terverifikasi',f.paymentVerified,f.registrations)+bar('Peserta seleksi',f.selection,f.registrations)+bar('Pengumuman',f.announced,f.registrations)+bar('Lulus',f.passed,f.registrations)+bar('Daftar ulang',f.reregistration,f.registrations)+bar('Selesai',f.completed,f.registrations)+
    '</div></section>'+ 
    '<section class="analytics-grid"><div class="dashboard-section analytics-section"><h3>Jenjang</h3><div class="analytics-list">'+breakdown(d.breakdowns?.jenjang)+'</div></div>'+ 
    '<div class="dashboard-section analytics-section"><h3>Putra / Putri</h3><div class="analytics-list">'+breakdown(d.breakdowns?.kelompok)+'</div></div>'+ 
    '<div class="dashboard-section analytics-section"><h3>Gelombang</h3><div class="analytics-list">'+breakdown(d.breakdowns?.gelombang)+'</div></div>'+ 
    '<div class="dashboard-section analytics-section"><h3>Status</h3><div class="analytics-list">'+breakdown(d.breakdowns?.status)+'</div></div>'+ 
    '<div class="dashboard-section analytics-section"><h3>Outcome Seleksi</h3><div class="analytics-list">'+bar('Lulus',o.passed,Math.max(1,f.selection))+bar('Tidak lulus',o.notPassed,Math.max(1,f.selection))+bar('Cadangan',o.waitlist,Math.max(1,f.selection))+'</div></div></section>'+ 
    '<section class="dashboard-section analytics-section"><h3>Trend Bulanan</h3><div class="report-table-wrap"><table class="report-table"><thead><tr><th>Bulan</th><th>Pendaftar</th><th>Submit</th><th>Verified</th></tr></thead><tbody>'+trend+'</tbody></table></div></section>'+ 
    '<section class="dashboard-section analytics-section"><h3>Waktu Proses</h3><div class="analytics-grid">'+
    '<article class="analytics-card"><b>'+day(p.registrationToSubmit)+'</b><span>Draft → Submit</span></article>'+ 
    '<article class="analytics-card"><b>'+day(p.submitToVerified)+'</b><span>Submit → Verified</span></article>'+ 
    '<article class="analytics-card"><b>'+day(p.paymentToSelection)+'</b><span>Verified → Seleksi</span></article>'+ 
    '<article class="analytics-card"><b>'+day(p.resultToAnnouncement)+'</b><span>Hasil → Pengumuman</span></article>'+ 
    '<article class="analytics-card"><b>'+day(p.reregistrationCompletion)+'</b><span>Daftar ulang → selesai</span></article></div></section>';
}
async function exportAdvancedReports(){
  try{
    const filters={tahunAjaranId:$('reportYear')?.value||'',gelombangId:$('reportGelombang')?.value||'',jenjangId:$('reportJenjang')?.value||'',status:$('reportStatus')?.value||'',fromDate:$('reportFromDate')?.value||'',toDate:$('reportToDate')?.value||''};
    const r=await server('exportAdvancedReportingCsv',state.token,filters);
    if(!r?.success){showAlert('Export gagal',r?.message||'Tidak dapat mengekspor analytics.','error');return;}
    const blob=new Blob([r.csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=r.filename||'PSB_Fathan_Mubina_Advanced_Analytics.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},500);
  }catch(e){showAlert('Export gagal','Terjadi gangguan saat export analytics.','error');}
}
function exportReportCsv(){
  const rows=state.reportData?.rows||[];if(!rows.length){showAlert('Belum ada data','Tidak ada baris reporting yang dapat diekspor.','warning');return;}
  const headers=['No Pendaftaran','Nama Calon Santri','Jenjang','Jenis Kelamin','Kelompok','Gelombang','Status Pendaftaran','Status Pembayaran','Nominal Lunas','Status Seleksi','Status Daftar Ulang'];
  const lines=[headers,...rows.map(x=>[x.registrationNumber||x.registrationId,x.candidateName,x.jenjangName,x.genderName||'',x.reportGroup||'',x.gelombangName,statusLabel(x.status),x.paymentStatus==='PAID'?'Lunas':x.paymentStatus==='SUBMITTED'?'Menunggu verifikasi':x.paymentStatus==='REJECTED'?'Ditolak':'Belum bayar',x.paidAmount||0,x.selectionStatus?selectionStatusLabel(x.selectionStatus):'',x.reregistrationStatus?reregStatusLabel(x.reregistrationStatus):''])].map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(','));
  const blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='PSB_Fathan_Mubina_Reporting.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
}

async function renderAudit(){
  if(!hasAnyRole(['SUPERADMIN','ADMIN_PSB'])){renderMore();return;}
  $('content').innerHTML=`<section class="hero"><h2>Audit</h2><p>Jejak aktivitas penting aplikasi. Data ditampilkan dari AUDIT_LOG dan dapat difilter.</p></section><section class="dashboard-section"><div class="report-filter-grid"><div class="field"><label>Pencarian</label><input id="auditSearch" class="select-field" placeholder="User, aksi, modul, record, deskripsi..."></div><div class="field"><label>Aksi</label><select id="auditAction" class="select-field"><option value="">Semua aksi</option></select></div><div class="field"><label>Modul</label><select id="auditModule" class="select-field"><option value="">Semua modul</option></select></div><div class="field"><label>Dari tanggal</label><input id="auditFrom" type="date" class="select-field"></div><div class="field"><label>Sampai tanggal</label><input id="auditTo" type="date" class="select-field"></div></div><div class="report-actions"><button class="btn btn-primary" onclick="loadAudit(1)">Terapkan Filter</button><button class="btn btn-secondary" onclick="exportAuditCsv()">Export CSV</button>${hasAnyRole(['SUPERADMIN'])?`<button class="btn btn-secondary" onclick="runSecurityMaintenanceUI()">Maintenance Security</button>`:''}</div></section><div id="auditPanel"><div class="empty-state">Memuat audit...</div></div>`;
  await loadAudit(1);
}
async function loadAudit(page=1){
  const panel=$('auditPanel');if(panel)panel.innerHTML='<div class="empty-state">Memuat audit...</div>';
  try{const filters={page:page,search:$('auditSearch')?.value||'',action:$('auditAction')?.value||'',module:$('auditModule')?.value||'',from:$('auditFrom')?.value||'',to:$('auditTo')?.value||'',pageSize:50};const isDefault=page===1&&!filters.search&&!filters.action&&!filters.module&&!filters.from&&!filters.to;const r=(isDefault&&pageDataCached('audit'))||await warmPageData(isDefault?'audit':'audit-filter',()=>server('getAuditLogPageData',state.token,filters));if(!r?.success){if(panel)panel.innerHTML=showMessage(r.message);return;}state.auditData=r;const action=$('auditAction'),module=$('auditModule');const keepA=filters.action,keepM=filters.module;if(action)action.innerHTML='<option value="">Semua aksi</option>'+(r.options?.actions||[]).map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');if(module)module.innerHTML='<option value="">Semua modul</option>'+(r.options?.modules||[]).map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');if(action)action.value=keepA;if(module)module.value=keepM;renderAuditPanel(r);}catch(e){if(panel)panel.innerHTML=showMessage('Gagal memuat audit.');}
}
function renderAuditPanel(data){
  const el=$('auditPanel');if(!el)return;const rows=data.rows||[];const table=rows.length?`<div class="report-table-wrap"><table class="report-table"><thead><tr><th>Waktu</th><th>User</th><th>Aksi</th><th>Modul</th><th>Record</th><th>Deskripsi</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.timestamp||'-')}</td><td>${esc(x.userId||'-')}</td><td><span class="pill">${esc(x.action||'-')}</span></td><td>${esc(x.module||'-')}</td><td>${esc(x.recordId||'-')}</td><td>${esc(x.description||'-')}${(x.oldValue||x.newValue)?`<details style="margin-top:5px"><summary class="muted" style="font-size:10px;cursor:pointer">Detail perubahan</summary><div class="muted" style="font-size:10px;margin-top:5px;word-break:break-word"><b>Lama:</b> ${esc(x.oldValue||'-')}<br><b>Baru:</b> ${esc(x.newValue||'-')}</div></details>`:''}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state">Tidak ada aktivitas sesuai filter.</div>';const page=Number(data.page||1),size=Number(data.pageSize||50),total=Number(data.total||0),from=total?((page-1)*size+1):0,to=Math.min(page*size,total);el.innerHTML=`<div class="report-summary-grid"><article class="report-summary"><b>${total.toLocaleString('id-ID')}</b><span>Aktivitas terfilter</span></article><article class="report-summary"><b>${from.toLocaleString('id-ID')}–${to.toLocaleString('id-ID')}</b><span>Rentang halaman</span></article></div>${table}<div class="report-actions" style="margin-top:12px"><button class="btn btn-secondary" ${page<=1?'disabled':''} onclick="loadAudit(${page-1})">Sebelumnya</button><button class="btn btn-secondary" ${!data.hasMore?'disabled':''} onclick="loadAudit(${page+1})">Berikutnya</button></div>`;
}
function exportAuditCsv(){const rows=state.auditData?.rows||[];if(!rows.length){showAlert('Belum ada data','Tidak ada aktivitas audit yang dapat diekspor.','warning');return;}const headers=['Waktu','User','Aksi','Modul','Record','Deskripsi','Nilai Lama','Nilai Baru'];const lines=[headers,...rows.map(x=>[x.timestamp,x.userId,x.action,x.module,x.recordId,x.description,x.oldValue,x.newValue])].map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(','));const blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='PSB_Fathan_Mubina_Audit.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);}
async function runSecurityMaintenanceUI(){showConfirm('Jalankan maintenance security?','Session yang sudah kedaluwarsa atau idle akan ditandai berakhir. Data utama tidak dihapus.',async()=>{loading(true,'Menjalankan maintenance security...');try{const r=await server('runSecurityMaintenance',state.token);if(r.success){showToast(`Maintenance selesai: ${Number(r.result?.processed||0)} session diproses.`,'success');await loadAudit(1);}else showAlert('Maintenance gagal',r.message||'Operasi gagal.','warning')}catch(e){showAlert('Maintenance gagal','Terjadi gangguan saat menjalankan maintenance security.','error')}finally{loading(false)}} ,'Jalankan');}

function renderFeaturePlaceholder(title,desc){$('content').innerHTML=`<section class="hero"><h2>${esc(title)}</h2><p>${esc(desc)}</p></section><div class="empty-state">Modul ini belum aktif pada stage saat ini.</div>`;}
async function renderSelection(){
  if(!hasAnyRole(['WALI','SUPERADMIN','ADMIN_PSB','SELEKSI','VERIFIKATOR'])){renderMore();return}
  state.selectionTab=state.selectionTab||'overview';
  $('content').innerHTML=`<section class="hero"><h2>Tes</h2><p>${hasAnyRole(['WALI'])?'Lihat jadwal tes, status peserta, dan hasil seleksi calon santri.':'Kelola jadwal tes, peserta, nilai, dan hasil seleksi.'}</p></section><div id="selectionPanel"><div class="selection-empty">Memuat data tes dan seleksi...</div></div>`;
  try{
    const id=state.selectionRegistrationId||'';
    const cached=state.selectionData || (!id?pageDataCached('selection'):null);
    if(cached && !id){renderSelectionPanel(cached);return}
    const r=await warmPageData('selection',()=>server('getSelectionPageData',state.token,id));
    if(!r.success){$('selectionPanel').innerHTML=showMessage(r.message);return}
    state.selectionData=r;
    renderSelectionPanel(r);
  }catch(e){$('selectionPanel').innerHTML=showMessage('Gagal memuat data tes dan seleksi.');}
}
function renderSelectionPanel(data){
  const admin=hasAnyRole(['SUPERADMIN','ADMIN_PSB','SELEKSI']);
  const tabs=admin?`<div class="selection-tabs"><button class="selection-tab ${state.selectionTab==='overview'?'active':''}" onclick="switchSelectionTab('overview')">Ringkasan</button><button class="selection-tab ${state.selectionTab==='schedule'?'active':''}" onclick="switchSelectionTab('schedule')">Jadwal Tes</button><button class="selection-tab ${state.selectionTab==='participants'?'active':''}" onclick="switchSelectionTab('participants')">Peserta</button><button class="selection-tab ${state.selectionTab==='results'?'active':''}" onclick="switchSelectionTab('results')">Hasil Seleksi</button></div>`:'';
  const panel=$('selectionPanel');if(!panel)return;
  panel.innerHTML=tabs+`<div id="selectionTabContent"></div>`;
  renderSelectionTabContent(data);
}
function switchSelectionTab(tab){state.selectionTab=tab;renderSelectionPanel(state.selectionData||{});}
function selectionStatusLabel(s){const m={SCHEDULED:'Terjadwal',PRESENT:'Hadir',ABSENT:'Tidak hadir',COMPLETED:'Selesai',PENDING:'Menunggu hasil',PASSED:'Lulus seleksi',NOT_PASSED:'Tidak lulus',WAITLIST:'Cadangan',PAYMENT_VERIFIED:'Siap tes'};return m[String(s||'').toUpperCase()]||String(s||'-');}
function renderSelectionTabContent(data){
  const el=$('selectionTabContent');if(!el)return;
  if(hasAnyRole(['WALI'])){renderSelectionWali(data);return;}
  if(state.selectionTab==='schedule')renderSelectionSchedules(data);
  else if(state.selectionTab==='participants')renderSelectionParticipants(data);
  else if(state.selectionTab==='results')renderSelectionResults(data);
  else renderSelectionOverview(data);
}
function renderSelectionOverview(data){
  const el=$('selectionTabContent');const regs=data.registrations||[], participants=data.participants||[], schedules=data.schedules||[];
  el.innerHTML=`<div class="selection-grid"><article class="selection-card"><h3>Jadwal aktif</h3><div style="font-size:28px;font-weight:900">${schedules.length}</div><div class="selection-note">Jadwal tes yang aktif untuk tahun ajaran berjalan.</div></article><article class="selection-card"><h3>Peserta tes</h3><div style="font-size:28px;font-weight:900">${participants.length}</div><div class="selection-note">Peserta yang sudah dijadwalkan mengikuti tes.</div></article><article class="selection-card"><h3>Pendaftar terverifikasi</h3><div style="font-size:28px;font-weight:900">${regs.filter(x=>String(x.status).toUpperCase()==='PAYMENT_VERIFIED').length}</div><div class="selection-note">Sudah melalui verifikasi dan Pembayaran Formulir.</div></article><article class="selection-card"><h3>Hasil tersedia</h3><div style="font-size:28px;font-weight:900">${(data.results||[]).filter(x=>['PASSED','NOT_PASSED','WAITLIST'].includes(String(x.status))).length}</div><div class="selection-note">Hasil internal yang siap diteruskan ke Stage 9.</div></article></div><section class="card" style="margin-top:14px"><b>Catatan alur</b><p class="selection-note">Peserta hanya dapat ditambahkan setelah pendaftaran terverifikasi dan Pembayaran Formulir berstatus lunas. Pengumuman resmi belum dipublikasikan pada Stage 8.</p></section>`;
}
function renderSelectionSchedules(data){
  const el=$('selectionTabContent');
  const form=`<section class="card" style="margin-bottom:14px"><div class="section-title" style="margin-top:0">Buat Jadwal Tes</div><div class="selection-form"><div class="field"><label>Nama Tes *</label><input id="selScheduleName" class="input-field" placeholder="Contoh: Tes Seleksi Gelombang 1"></div><div class="field"><label>Tanggal Tes *</label><input id="selScheduleDate" class="input-field" type="date"></div><div class="field full"><label>Lokasi</label><input id="selScheduleLocation" class="input-field" placeholder="Contoh: Kampus Fathan Mubina / Online"></div></div><div class="registration-actions" style="margin-top:12px"><button id="saveSelectionScheduleBtn" class="btn btn-primary" onclick="createSelectionScheduleUI()">+ Simpan Jadwal</button></div></section>`;
  const cards=(data.schedules||[]).map(x=>`<article class="selection-card"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start"><div><h3>${esc(x.name)}</h3><div class="selection-note">${esc(x.selectionDate||'-')} · ${esc(x.location||'Lokasi belum ditentukan')}</div></div><span class="selection-status ok">Aktif</span></div><div class="selection-meta"><span>${esc(x.tahunAjaranId)}</span><span>${esc(x.scheduleId)}</span></div><div style="margin-top:12px"><button class="btn btn-secondary" onclick="toggleSelectionScheduleUI('${esc(x.scheduleId)}',false)">Nonaktifkan</button></div></article>`).join('');
  el.innerHTML=form+`<div class="selection-grid">${cards||'<div class="selection-empty" style="grid-column:1/-1">Belum ada jadwal tes. Buat jadwal pertama untuk memulai Stage 8.</div>'}</div>`;
}
async function createSelectionScheduleUI(){
  const btn=$('saveSelectionScheduleBtn');
  const name=String($('selScheduleName')?.value||'').trim(),date=String($('selScheduleDate')?.value||'').trim(),location=String($('selScheduleLocation')?.value||'').trim();
  if(!name||!date){showAlert('Data belum lengkap','Nama tes dan tanggal tes wajib diisi.','warning');return}
  if(btn?.disabled)return;
  if(btn){btn.disabled=true;btn.textContent='Menyimpan...';}
  loading(true,'Menyimpan jadwal tes...');
  try{
    const r=await server('createSelectionSchedule',state.token,{name,selectionDate:date,location});
    if(r.success){
      showToast(r.message,'success');
      state.selectionData=null;
      state.selectionTab='schedule';
      await renderSelection();
    }else{
      if(btn){btn.disabled=false;btn.textContent='+ Simpan Jadwal';}
      showAlert('Jadwal belum tersimpan',r.message,'warning');
    }
  }catch(e){
    if(btn){btn.disabled=false;btn.textContent='+ Simpan Jadwal';}
    showAlert('Gagal menyimpan','Terjadi gangguan saat membuat jadwal.','error');
  }finally{loading(false)}
}
async function toggleSelectionScheduleUI(id,isActive){loading(true,'Memperbarui jadwal...');try{const r=await server('updateSelectionScheduleStatus',state.token,{scheduleId:id,isActive});if(r.success){showToast(r.message,'success');state.selectionData=null;await renderSelection();state.selectionTab='schedule';}else showAlert('Belum dapat diproses',r.message,'warning')}catch(e){showAlert('Gagal memperbarui','Terjadi gangguan saat memperbarui jadwal.','error')}finally{loading(false)}}
function renderSelectionParticipants(data){
  const el=$('selectionTabContent'), schedules=data.schedules||[], regs=(data.registrations||[]).filter(x=>['PAYMENT_VERIFIED','VERIFIED'].includes(String(x.status).toUpperCase()));
  const options=schedules.map(x=>`<option value="${esc(x.scheduleId)}">${esc(x.name)} · ${esc(x.selectionDate)}</option>`).join('');
  const existing=new Set((data.participants||[]).map(x=>String(x.registrationId)));
  const eligible=regs.filter(x=>!existing.has(String(x.registrationId)));
  const regOptions=regs.map(x=>`<option value="${esc(x.registrationId)}">${esc(x.registrationNumber||x.registrationId)} · ${esc(x.candidateName)}</option>`).join('');
  const bulkRows=eligible.map(x=>`<label class="selection-check-row"><input type="checkbox" class="selection-participant-check" value="${esc(x.registrationId)}" onchange="updateSelectionBulkCount()"><span class="selection-check-copy"><b>${esc(x.candidateName||'-')}</b><span>${esc(x.registrationNumber||x.registrationId)} · ${esc(x.gelombangName||'-')}</span></span></label>`).join('');
  const bulk=`<section class="selection-bulk-box" id="selectionBulkBox"><div class="selection-bulk-head"><div><div class="selection-bulk-title">Generate Tes Seleksi</div><div class="selection-note">Pilih banyak pendaftar sekaligus untuk dimasukkan ke satu jadwal tes.</div></div></div><div class="selection-form"><div class="field" style="margin:10px 0"><label>Jadwal Tes *</label><select id="selBulkSchedule" class="select-field"><option value="">Pilih jadwal tes</option>${options}</select></div></div><div class="selection-bulk-actions"><button type="button" class="btn btn-secondary" onclick="toggleAllSelectionParticipants(true)">Pilih Semua</button><button type="button" class="btn btn-secondary" onclick="toggleAllSelectionParticipants(false)">Kosongkan</button><button type="button" class="btn btn-primary" id="generateSelectionBtn" onclick="generateSelectionParticipantsUI()">Generate Tes Seleksi</button></div><div class="selection-check-list">${bulkRows||'<div class="selection-bulk-empty">Tidak ada pendaftar eligible yang belum memiliki jadwal tes.</div>'}</div><div class="selection-bulk-summary" id="selectionBulkSummary">0 peserta dipilih</div><div class="selection-bulk-processing"><span class="selection-processing-dot"></span><span>Sedang membuat peserta tes. Mohon tunggu...</span></div></section>`;
  const form=`<section class="card" style="margin-bottom:14px"><div class="section-title" style="margin-top:0">Tambahkan Satu Peserta</div><div class="selection-form"><div class="field"><label>Pendaftaran *</label><select id="selParticipantReg" class="select-field"><option value="">Pilih pendaftar</option>${regOptions}</select></div><div class="field"><label>Jadwal Tes *</label><select id="selParticipantSchedule" class="select-field"><option value="">Pilih jadwal</option>${options}</select></div></div><div class="registration-actions" style="margin-top:12px"><button class="btn btn-secondary" onclick="addSelectionParticipantUI()">+ Tambahkan Peserta</button></div></section>`;
  const rows=(data.participants||[]).map(x=>{const st=String(x.status||'').toUpperCase();return `<article class="selection-card"><div style="display:flex;justify-content:space-between;gap:10px"><div><h3>${esc(x.candidateName||'-')}</h3><div class="selection-note">${esc(x.registration?.registrationNumber||x.registrationId)} · ${esc(x.scheduleId)}</div></div><span class="selection-status ${st==='COMPLETED'||st==='PRESENT'?'ok':st==='ABSENT'?'bad':'warn'}">${esc(selectionStatusLabel(st))}</span></div><div class="registration-actions" style="margin-top:12px"><button class="btn btn-secondary" onclick="updateParticipantStatusUI('${esc(x.participantId)}','PRESENT')">Hadir</button><button class="btn btn-secondary" onclick="updateParticipantStatusUI('${esc(x.participantId)}','ABSENT')">Tidak Hadir</button><button class="btn btn-primary" onclick="openSelectionDetailUI('${esc(x.registrationId)}')">Nilai & Hasil</button></div></article>`}).join('');
  el.innerHTML=bulk+form+`<div class="selection-grid">${rows||'<div class="selection-empty" style="grid-column:1/-1">Belum ada peserta tes.</div>'}</div>`;
  updateSelectionBulkCount();
}
function getSelectedSelectionParticipants(){return Array.from(document.querySelectorAll('.selection-participant-check:checked')).map(x=>x.value).filter(Boolean)}
function updateSelectionBulkCount(){const n=getSelectedSelectionParticipants().length;const el=$('selectionBulkSummary');if(el)el.textContent=`${n} peserta dipilih`}
function toggleAllSelectionParticipants(checked){document.querySelectorAll('.selection-participant-check').forEach(x=>x.checked=checked);updateSelectionBulkCount()}
async function generateSelectionParticipantsUI(){
  const scheduleId=$('selBulkSchedule')?.value||'',registrationIds=getSelectedSelectionParticipants(),box=$('selectionBulkBox'),btn=$('generateSelectionBtn');
  if(!scheduleId){showAlert('Jadwal belum dipilih','Pilih jadwal tes terlebih dahulu.','warning');return}
  if(!registrationIds.length){showAlert('Peserta belum dipilih','Pilih minimal satu pendaftar untuk Generate Tes Seleksi.','warning');return}
  if(btn?.disabled)return;
  if(box)box.classList.add('processing'); if(btn){btn.disabled=true;btn.textContent='Generating...';}
  loading(true,`Membuat ${registrationIds.length} peserta tes...`);
  try{
    const r=await server('addSelectionParticipantsBulk',state.token,{registrationIds,scheduleId});
    if(!r.success){showAlert('Generate belum selesai',r.message||'Peserta belum dapat ditambahkan.','warning');return}
    const added=Number(r.addedCount||0),skipped=Number(r.skippedCount||0),failed=Number(r.failedCount||0);
    showToast(`Generate selesai: ${added} peserta ditambahkan${skipped?`, ${skipped} dilewati`:''}${failed?`, ${failed} gagal`:''}.`,'success');
    state.selectionData=null; state.selectionTab='participants';
    try{await renderSelection()}catch(refreshError){}
  }catch(e){showAlert('Generate gagal','Terjadi gangguan saat membuat peserta tes. Silakan cek daftar peserta sebelum mencoba lagi.','error')}
  finally{loading(false);if(box)box.classList.remove('processing');if(btn){btn.disabled=false;btn.textContent='Generate Tes Seleksi';}}
}
async function addSelectionParticipantUI(){const registrationId=$('selParticipantReg')?.value||'',scheduleId=$('selParticipantSchedule')?.value||'';if(!registrationId||!scheduleId){showAlert('Data belum lengkap','Pilih pendaftar dan jadwal tes.','warning');return}loading(true,'Menambahkan peserta...');try{const r=await server('addSelectionParticipant',state.token,{registrationId,scheduleId});if(r.success){showToast(r.message,'success');state.selectionData=null;state.selectionTab='participants';try{await renderSelection()}catch(refreshError){}}else showAlert('Belum dapat ditambahkan',r.message,'warning')}catch(e){showAlert('Gagal menambahkan','Terjadi gangguan saat menyimpan peserta.','error')}finally{loading(false)}}
async function updateParticipantStatusUI(id,status){loading(true,'Memperbarui kehadiran...');try{const r=await server('updateSelectionParticipantStatus',state.token,{participantId:id,status});if(r.success){showToast(r.message,'success');state.selectionData=null;await renderSelection();state.selectionTab='participants';}else showAlert('Belum dapat diproses',r.message,'warning')}catch(e){showAlert('Gagal memperbarui','Terjadi gangguan saat menyimpan status peserta.','error')}finally{loading(false)}}
function renderSelectionResults(data){const el=$('selectionTabContent');const results=data.results||[];const regs=data.registrations||[];const rows=results.map(x=>{const reg=regs.find(r=>String(r.registrationId)===String(x.registrationId));return `<article class="selection-card"><div style="display:flex;justify-content:space-between;gap:10px"><div><h3>${esc(reg?.candidateName||x.registrationId)}</h3><div class="selection-note">${esc(reg?.registrationNumber||x.registrationId)}</div></div><span class="selection-status ${x.status==='PASSED'?'ok':x.status==='NOT_PASSED'?'bad':'warn'}">${esc(selectionStatusLabel(x.status))}</span></div><p class="selection-note" style="margin-top:10px">${esc(x.note||'Belum ada catatan.')}</p><button class="btn btn-primary" onclick="openSelectionDetailUI('${esc(x.registrationId)}')">Buka Detail</button></article>`}).join('');el.innerHTML=`<div class="selection-grid">${rows||'<div class="selection-empty" style="grid-column:1/-1">Belum ada hasil seleksi.</div>'}</div>`;}
function renderSelectionWali(data){const el=$('selectionTabContent'), regs=data.registrations||[], pmap={};(data.participants||[]).forEach(p=>pmap[String(p.registrationId)]=p);const rmap={};(data.results||[]).forEach(r=>rmap[String(r.registrationId)]=r);const cards=regs.map(r=>{const p=pmap[String(r.registrationId)],res=rmap[String(r.registrationId)];return `<article class="selection-card"><h3>${esc(r.candidateName||'-')}</h3><div class="selection-note">${esc(r.registrationNumber||r.registrationId)} · ${esc(r.gelombangName||'-')}</div><div class="selection-progress"><div class="selection-progress-step done"></div><div class="selection-progress-step ${p?'done':''}"></div><div class="selection-progress-step ${res?'done':''}"></div></div><div class="selection-meta"><span>${esc(selectionStatusLabel(r.status))}</span>${p?`<span>${esc(p.status==='SCHEDULED'?'Terjadwal':selectionStatusLabel(p.status))}</span>`:''}${res?`<span>${esc(selectionStatusLabel(res.status))}</span>`:''}</div>${p?`<p class="selection-note" style="margin-top:10px">Jadwal: ${esc((data.schedules||[]).find(s=>String(s.scheduleId)===String(p.scheduleId))?.name||p.scheduleId)}</p>`:'<p class="selection-note" style="margin-top:10px">Belum memiliki jadwal tes.</p>'}</article>`}).join('');el.innerHTML=cards||'<div class="selection-empty">Belum ada data pendaftaran untuk proses tes.</div>';}
async function openSelectionDetailUI(registrationId){
  if(state.selectionDetailOpening)return;
  const id=String(registrationId||'').trim(); if(!id)return;
  state.selectionDetailOpening=true; state.selectionRegistrationId=id; state.selectionTab='participants';
  let modal=$('selectionDetailModal');
  if(!modal){
    document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="selectionDetailModal"><div class="modal" style="max-width:860px;width:min(94vw,860px);max-height:90vh;overflow:auto"><div class="status-row"><div><h3 style="margin:0">Detail Seleksi</h3><p class="muted" style="margin:4px 0 0">Memuat data peserta...</p></div><button class="btn btn-secondary" type="button" onclick="closeSelectionDetailUI()" aria-label="Tutup detail seleksi">Tutup</button></div><div id="selectionDetailBody" style="margin-top:14px"><div class="selection-empty">Memuat detail seleksi...</div></div></div></div>`);
    modal=$('selectionDetailModal');
  }else{
    const body=$('selectionDetailBody'); if(body)body.innerHTML='<div class="selection-empty">Memuat detail seleksi...</div>';
    modal.style.display='flex';
  }
  try{
    const r=await server('getSelectionPageData',state.token,id);
    const current=$('selectionDetailModal'),body=$('selectionDetailBody');
    if(!current||!body)return;
    if(!r.success){body.innerHTML=showMessage(r.message||'Detail seleksi tidak dapat dimuat.','warning');return}
    state.selectionData=r; renderSelectionDetail(r,body);
  }catch(e){
    const body=$('selectionDetailBody'); if(body)body.innerHTML=showMessage('Terjadi gangguan saat memuat detail seleksi.','error');
  }finally{state.selectionDetailOpening=false}
}
function closeSelectionDetailUI(){state.selectionDetailOpening=false;$('selectionDetailModal')?.remove();}
function renderSelectionDetail(data,targetEl){const el=targetEl||$('selectionTabContent');if(!el)return;const d=data.detail||{},admin=hasAnyRole(['SUPERADMIN','ADMIN_PSB','SELEKSI']);const p=d.participant,res=d.result,scores=d.scores||[];if(!p){el.innerHTML='<div class="selection-empty">Peserta tes belum tersedia.</div>';return}const scoreRows=scores.map(x=>`<tr><td>${esc(x.component)}</td><td>${esc(x.score)}</td><td>${esc(x.note||'-')}</td></tr>`).join('');const internal=admin?`<section class="card" style="margin-top:14px"><div class="section-title" style="margin-top:0">Input Nilai</div><div class="selection-form"><div class="field"><label>Komponen *</label><input id="selScoreComponent" class="input-field" placeholder="Contoh: Wawancara"></div><div class="field"><label>Nilai *</label><input id="selScoreValue" class="input-field" type="number" min="0" max="100" step="0.01" placeholder="0 - 100"></div><div class="field full"><label>Catatan</label><textarea id="selScoreNote" class="textarea-field" placeholder="Catatan hasil tes"></textarea></div></div><div class="registration-actions" style="margin-top:12px"><button class="btn btn-primary" onclick="saveSelectionScoreUI('${esc(p.participantId)}')">Simpan Nilai</button></div></section><section class="card" style="margin-top:14px"><div class="section-title" style="margin-top:0">Hasil Seleksi</div><div class="selection-form"><div class="field"><label>Status *</label><select id="selResultStatus" class="select-field"><option value="PENDING">Menunggu hasil</option><option value="PASSED">Lulus</option><option value="NOT_PASSED">Tidak lulus</option><option value="WAITLIST">Cadangan</option></select></div><div class="field"><label>Catatan</label><input id="selResultNote" class="input-field" value="${esc(res?.note||'')}" placeholder="Catatan keputusan"></div></div><div class="registration-actions" style="margin-top:12px"><button class="btn btn-primary" onclick="saveSelectionResultUI('${esc(d.registration?.registrationId||'')}')">Simpan Hasil</button></div><p class="selection-note" style="margin-top:10px">Hasil ini masih merupakan hasil internal. Publikasi pengumuman dilakukan setelah hasil ditetapkan.</p></section>`:'';el.innerHTML=`<section class="selection-grid" style="margin-top:0"><article class="selection-card"><h3>${esc(d.registration?.candidateName||'-')}</h3><div class="selection-note">${esc(d.registration?.registrationNumber||'-')}</div><div class="selection-meta"><span>${esc(selectionStatusLabel(p.status))}</span>${res?`<span>${esc(selectionStatusLabel(res.status))}</span>`:''}</div></article><article class="selection-card"><h3>Nilai Seleksi</h3>${scoreRows?`<table class="score-table"><thead><tr><th>Komponen</th><th>Nilai</th><th>Catatan</th></tr></thead><tbody>${scoreRows}</tbody></table>`:'<div class="selection-note">Belum ada nilai.</div>'}</article></section>${internal}${!admin?`<div class="selection-note" style="margin-top:12px">Informasi di atas adalah hasil seleksi yang tersedia untuk akun Wali.</div>`:''}`;}
async function saveSelectionScoreUI(participantId){const component=String($('selScoreComponent')?.value||'').trim(),score=Number($('selScoreValue')?.value),note=String($('selScoreNote')?.value||'').trim();if(!component||!Number.isFinite(score)){showAlert('Nilai belum lengkap','Komponen dan nilai wajib diisi.','warning');return}loading(true,'Menyimpan nilai...');try{const r=await server('saveSelectionScore',state.token,{participantId,component,score,note});if(r.success){showToast(r.message,'success');await openSelectionDetailUI(state.selectionRegistrationId)}else showAlert('Nilai belum tersimpan',r.message,'warning')}catch(e){showAlert('Gagal menyimpan','Terjadi gangguan saat menyimpan nilai.','error')}finally{loading(false)}}
async function saveSelectionResultUI(registrationId){const status=$('selResultStatus')?.value||'',note=String($('selResultNote')?.value||'').trim();loading(true,'Menyimpan hasil seleksi...');try{const r=await server('saveSelectionResult',state.token,{registrationId,status,note});if(r.success){showToast(r.message,'success');await openSelectionDetailUI(registrationId)}else showAlert('Hasil belum tersimpan',r.message,'warning')}catch(e){showAlert('Gagal menyimpan','Terjadi gangguan saat menyimpan hasil seleksi.','error')}finally{loading(false)}}

async function renderAnnouncements(){
  if(!hasAnyRole(['WALI','SUPERADMIN','ADMIN_PSB','SELEKSI','VERIFIKATOR'])){renderMore();return}
  $('content').innerHTML=`<section class="hero"><h2>Pengumuman</h2><p>${hasAnyRole(['WALI'])?'Lihat hasil seleksi yang sudah diumumkan untuk pendaftaran Anda.':'Kelola dan publikasikan hasil seleksi kepada wali santri.'}</p></section><div id="announcementPanel"><div class="announcement-empty">Memuat pengumuman...</div></div>`;
  try{const r=pageDataCached('announcement')||await warmPageData('announcement',()=>server('getAnnouncementPageData',state.token));if(!r?.success){$('announcementPanel').innerHTML=showMessage(r.message);return}renderAnnouncementPanel(r)}catch(e){$('announcementPanel').innerHTML=showMessage('Gagal memuat pengumuman.')}
}
function announcementStatusLabel(s){return ({PASSED:'Lulus',NOT_PASSED:'Tidak lulus',WAITLIST:'Cadangan',PENDING:'Menunggu hasil'})[String(s||'').toUpperCase()]||String(s||'-')}
function renderAnnouncementPanel(data){
  const el=$('announcementPanel');if(!el)return;const admin=!!data.canPublish,items=data.items||[];
  if(!items.length){el.innerHTML='<div class="announcement-empty">Belum ada hasil seleksi yang tersedia untuk pengumuman.</div>';return}
  const rows=items.map(x=>{const status=String(x.status||'').toUpperCase();const published=!!x.isPublished;const cls=status==='PASSED'?'ok':status==='NOT_PASSED'?'bad':'warn';return `<article class="announcement-card"><div class="announcement-top"><div><div class="announcement-title">${esc(x.candidateName||'-')}</div><div class="announcement-sub">${esc(x.registrationNumber||'-')} · Hasil seleksi</div></div><span class="announcement-status ${cls}">${esc(announcementStatusLabel(status))}</span></div><div class="announcement-message">${published?`Diumumkan pada ${esc(String(x.announcementDate||'-'))}.`:'Hasil sudah ditetapkan tetapi belum dipublikasikan.'}${x.note?`<br><span style="display:block;margin-top:5px">Catatan: ${esc(x.note)}</span>`:''}</div>${admin?`<div class="announcement-actions">${published?'<span class="pill ok">Sudah diumumkan</span>':`<button class="btn btn-primary" onclick="publishAnnouncementUI('${esc(x.registrationId)}')">Publikasikan</button>`}</div>`:''}${!admin&&hasAnyRole(['WALI'])&&status==='PASSED'&&published?`<div class="announcement-actions"><button class="btn btn-primary" onclick="goPage('reregistration')">Lanjut Daftar Ulang</button></div>`:''}</article>`}).join('');
  el.innerHTML=`<div class="announcement-list">${rows}</div>`;
}
async function publishAnnouncementUI(registrationId){
  showConfirm('Publikasikan pengumuman?','Hasil seleksi akan dapat dilihat oleh wali dan notifikasi akan dikirim ke akun wali.',async()=>{
    loading(true,'Mempublikasikan pengumuman...');
    try{const r=await server('publishAnnouncement',state.token,{registrationId});if(r.success){showToast(r.message,'success');await renderAnnouncements()}else showAlert('Belum dapat dipublikasikan',r.message||'Periksa hasil seleksi.','warning')}catch(e){showAlert('Gagal mempublikasikan','Terjadi gangguan saat menyimpan pengumuman.','error')}finally{loading(false)}} ,'Publikasikan');
}
async function updateNotificationBadge(){
  const badge=document.getElementById('notificationBadge'); if(!badge||!state.token)return;
  try{
    const cached=pageDataCached('notifications');
    const r=cached||await warmPageData('notifications',()=>server('getNotifications',state.token));
    const count=Number(r?.unreadCount||0);
    badge.textContent=count>99?'99+':String(count);
    badge.style.display=count>0?'grid':'none';
  }catch(e){badge.style.display='none';}
}

function openCommunicationCenterUI(){
  if(!hasAnyRole(['SUPERADMIN','ADMIN_PSB']))return;
  const id='communicationCenterModal'; document.getElementById(id)?.remove();
  document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="${id}"><div class="modal" style="max-width:980px;max-height:90vh;overflow:auto"><div class="status-row"><div><h3 style="margin:0">Communication Center</h3><p style="margin:4px 0 0">Kirim notifikasi internal dan pantau otomasi komunikasi PSB.</p></div><button class="btn btn-secondary" onclick="closeCommunicationCenterUI()">Tutup</button></div><div id="communicationCenterBody" class="empty-state" style="margin-top:14px">Memuat pusat komunikasi...</div></div></div>`);
  loadCommunicationCenterUI();
}
function closeCommunicationCenterUI(){document.getElementById('communicationCenterModal')?.remove()}
async function loadCommunicationCenterUI(){
  const el=$('communicationCenterBody'); if(!el)return;
  try{
    const r=await server('getCommunicationCenterData',state.token); if(!r?.success){el.innerHTML=showMessage(r?.message||'Communication Center tidak dapat dimuat.');return;}
    const roles=['WALI','SUPERADMIN','ADMIN_PSB','VERIFIKATOR','SELEKSI','KEUANGAN'];
    const roleLabels={WALI:'WALI',SUPERADMIN:'SUPERADMIN',ADMIN_PSB:'ADMIN_PSB',VERIFIKATOR:'VERIFIKATOR',SELEKSI:'SELEKSI',KEUANGAN:'KEUANGAN'};
    const checks=roles.map(role=>`<label class="check-option" style="display:flex;gap:8px;align-items:center;padding:8px 10px;border:1px solid var(--line);border-radius:10px"><input type="checkbox" name="commRole" value="${role}"><span>${roleLabels[role]} <small class="muted">(${Number(r.roleCounts?.[role]||0)})</small></span></label>`).join('');
    const automation=(r.automation||[]).map(x=>`<div class="status-row" style="padding:7px 0;border-bottom:1px solid var(--line)"><div><b style="font-size:11px">${esc(x.event)}</b><div class="muted" style="font-size:10px">${esc(x.target)}</div></div><span class="pill ok">Aktif</span></div>`).join('');
    const recent=(r.recent||[]).slice(0,12).map(x=>`<article class="notification-card"><div class="announcement-top"><b>${esc(x.title||'-')}</b><span class="announcement-status">${esc(notificationTypeLabel(x.type))}</span></div><p>${esc(x.message||'')}</p><div class="notification-meta">${esc(formatNotificationDate(x.createdAt))}</div></article>`).join('')||'<div class="empty-state">Belum ada riwayat notifikasi.</div>';
    el.innerHTML=`<div class="report-summary-grid"><article class="report-summary"><b>${Number(r.activeUsers||0)}</b><span>Pengguna aktif</span></article><article class="report-summary"><b>${Number((r.recent||[]).length)}</b><span>Riwayat terakhir</span></article><article class="report-summary"><b>${Number((r.automation||[]).filter(x=>x.enabled).length)}</b><span>Otomasi aktif</span></article></div><section style="margin-top:16px"><div class="muted" style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;margin-bottom:7px">Kirim Komunikasi</div><div class="form-grid"><div class="field"><label>Judul *</label><input id="commTitle" maxlength="120" placeholder="Contoh: Informasi Jadwal Tes"></div><div class="field"><label>Tipe</label><select id="commType"><option value="INFO">Informasi</option><option value="SUCCESS">Berhasil</option><option value="WARNING">Perlu perhatian</option><option value="ERROR">Kesalahan</option></select></div><div class="field" style="grid-column:1/-1"><label>Pesan *</label><textarea id="commMessage" maxlength="1000" rows="4" placeholder="Tulis pesan yang akan diterima pengguna..."></textarea></div></div><div style="margin-top:10px"><label class="muted" style="font-size:11px;font-weight:800">PENERIMA</label><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;margin-top:7px">${checks}</div></div><div class="form-actions" style="margin-top:12px"><button class="btn btn-primary" onclick="sendCommunicationUI()">Kirim Notifikasi</button></div></section><section style="margin-top:18px"><div class="muted" style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;margin-bottom:7px">Otomasi Komunikasi</div>${automation}</section><section style="margin-top:18px"><div class="status-row"><div><b>Riwayat Komunikasi</b><span class="muted" style="display:block;font-size:10px;margin-top:3px">12 notifikasi terbaru.</span></div></div><div class="notification-list" style="margin-top:9px">${recent}</div></section>`;
  }catch(e){el.innerHTML=showMessage('Gagal memuat Communication Center.')}
}
async function sendCommunicationUI(){
  const title=String($('commTitle')?.value||'').trim(), message=String($('commMessage')?.value||'').trim(), type=String($('commType')?.value||'INFO');
  const roles=[...document.querySelectorAll('input[name="commRole"]:checked')].map(x=>x.value);
  if(!title||!message||!roles.length){showAlert('Data belum lengkap','Isi judul, pesan, dan pilih minimal satu role penerima.','warning');return}
  showConfirm('Kirim komunikasi?',`Pesan akan dikirim sebagai notifikasi internal ke ${roles.join(', ')}.`,async()=>{
    loading(true,'Mengirim komunikasi...');
    try{const r=await server('sendCommunication',state.token,{title,message,type,roles});if(r?.success){showToast(r.message,'success');await loadCommunicationCenterUI();}else showAlert('Belum terkirim',r?.message||'Periksa data komunikasi.','warning');}catch(e){showAlert('Gagal mengirim','Terjadi gangguan saat mengirim komunikasi.','error')}finally{loading(false)}
  },'Kirim');
}

async function renderNotifications(){
  $('content').innerHTML=`<section class="hero"><h2>Notifikasi</h2><p>Informasi penting terkait proses PSB akan muncul di sini.</p></section><div id="notificationPanel"><div class="announcement-empty">Memuat notifikasi...</div></div>`;
  try{const r=pageDataCached('notifications')||await warmPageData('notifications',()=>server('getNotifications',state.token));if(!r?.success){$('notificationPanel').innerHTML=showMessage(r.message);return}renderNotificationPanel(r)}catch(e){$('notificationPanel').innerHTML=showMessage('Gagal memuat notifikasi.')}
}
function notificationTypeLabel(type){return ({SUCCESS:'Berhasil',WARNING:'Perlu perhatian',INFO:'Informasi',ERROR:'Kesalahan'})[String(type||'INFO').toUpperCase()]||'Informasi'}
function formatNotificationDate(value){const d=new Date(value);if(Number.isNaN(d.getTime()))return String(value||'-');return d.toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});}
function renderNotificationPanel(data){const el=$('notificationPanel');if(!el)return;const items=data.items||[];const unreadCount=Number(data.unreadCount||0);if(!items.length){el.innerHTML='<div class="announcement-empty">Belum ada notifikasi.</div>';updateNotificationBadge();return}el.innerHTML=`<div class="notification-toolbar" style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px"><div><strong>${unreadCount}</strong> belum dibaca</div><button class="btn btn-secondary" onclick="markAllNotificationsReadUI()">Tandai semua dibaca</button></div><div class="notification-list">${items.map(x=>{const unread=String(x.isRead).toUpperCase()!=='TRUE';const type=String(x.type||'INFO').toUpperCase();const cls=type==='SUCCESS'?'ok':type==='WARNING'?'warn':type==='ERROR'?'bad':'';return `<article class="notification-card ${unread?'unread':''}"><div class="announcement-top"><div><b>${esc(x.title||'Notifikasi')}</b><div class="notification-meta">${esc(notificationTypeLabel(type))} · ${esc(formatNotificationDate(x.createdAt))}</div></div><span class="announcement-status ${cls}">${esc(notificationTypeLabel(type))}</span></div><p>${esc(x.message||'')}</p>${unread?`<div class="notification-actions"><button class="btn btn-secondary" onclick="markNotificationReadUI('${esc(x.notificationId)}')">Tandai dibaca</button></div>`:''}</article>`}).join('')}</div>`;updateNotificationBadge();}
async function markNotificationReadUI(id){try{const r=await server('markNotificationRead',state.token,id);if(r.success){await renderNotifications();updateNotificationBadge();}}catch(e){}}
async function markAllNotificationsReadUI(){loading(true,'Memperbarui notifikasi...');try{const r=await server('markAllNotificationsRead',state.token);if(r.success){showToast('Semua notifikasi ditandai sudah dibaca.','success');await renderNotifications();updateNotificationBadge()}}catch(e){showToast('Gagal memperbarui notifikasi.','error')}finally{loading(false)}}

async function renderVerification(){
  if(!hasAnyRole(['SUPERADMIN','ADMIN_PSB','VERIFIKATOR'])){renderMore();return}
  $('content').innerHTML=`<section class="hero"><h2>Verifikasi</h2><p>Periksa data pendaftaran dan dokumen sebelum menetapkan hasil verifikasi.</p></section><div id="verificationPanel"><div class="empty-state">Memuat antrean verifikasi...</div></div>`;
  try{const r=pageDataCached('verification')||await warmPageData('verification',()=>server('getVerificationQueue',state.token,{}));if(!r?.success){$('verificationPanel').innerHTML=showMessage(r.message);return}renderVerificationQueue(r.registrations||[]);}catch(e){$('verificationPanel').innerHTML=showMessage('Gagal memuat antrean verifikasi.')}
}
function renderVerificationQueue(items){
  const el=$('verificationPanel'); if(!el)return;
  el.innerHTML=`<div class="verification-toolbar"><div class="search-box"><span class="search-icon">${ico('search')}</span><input id="verificationSearch" class="search-input" placeholder="Cari nama atau nomor pendaftaran..." autocomplete="off" oninput="filterVerificationQueue()"><button type="button" class="search-clear" id="verificationSearchClear" onclick="clearVerificationSearch()" aria-label="Hapus pencarian">×</button></div><div class="filter-box professional-filter"><span class="filter-label">Status</span><select id="verificationStatus" class="select-field compact professional-select" onchange="loadVerificationQueue()"><option value="">Semua status</option><option value="SUBMITTED">Menunggu verifikasi</option><option value="UNDER_REVIEW">Sedang diperiksa</option><option value="REVISION">Perlu revisi</option><option value="REREGISTRATION">Daftar ulang</option><option value="VERIFIED">Terverifikasi</option></select></div></div><div id="verificationList" class="registration-list"></div>`;
  state.verificationQueue=items; renderVerificationList(items);
}
function renderVerificationList(items){const el=$('verificationList');if(!el)return; if(!items.length){el.innerHTML='<div class="empty-state">Tidak ada pendaftaran pada antrean verifikasi.</div>';return}el.innerHTML=items.map(x=>`<article class="registration-item"><div class="registration-item-top"><div><div class="registration-name">${esc(x.candidateName||'-')}</div><div class="registration-number">${esc(x.registrationNumber||'-')}</div></div><span class="pill ${String(x.status)==='VERIFIED'?'ok':''}">${esc(statusLabel(x.status))}</span></div><div class="registration-meta"><span>${esc(x.jenjangName||'-')} · ${esc(x.gelombangName||'-')}</span></div><div class="registration-actions"><button class="btn btn-primary" onclick="openVerification('${esc(x.registrationId)}')">Periksa</button></div></article>`).join('')}
function filterVerificationQueue(){const q=String($('verificationSearch')?.value||'').trim().toLowerCase();const clear=$('verificationSearchClear');if(clear)clear.classList.toggle('show',!!q);renderVerificationList((state.verificationQueue||[]).filter(x=>String(x.registrationNumber||'').toLowerCase().includes(q)||String(x.candidateName||'').toLowerCase().includes(q)));}
function clearVerificationSearch(){const el=$('verificationSearch');if(el){el.value='';el.focus();}filterVerificationQueue();}
async function loadVerificationQueue(){loading(true,'Memuat antrean...');try{const r=await server('getVerificationQueue',state.token,{status:$('verificationStatus')?.value||''});if(r.success){state.verificationQueue=r.registrations||[];filterVerificationQueue();}else showToast(r.message,'error')}catch(e){showToast('Gagal memuat antrean.','error')}finally{loading(false)}}
async function openVerification(id){
  const key='verification';if(state.detailLoadingLocks[key])return;state.detailLoadingLocks[key]=true;
  let modal=$('verificationDetailModal');
  if(!modal){document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="verificationDetailModal"><div class="modal" style="max-width:980px;width:min(94vw,980px);max-height:90vh;overflow:auto"><div class="status-row"><div><h3 style="margin:0">Detail Verifikasi</h3><p class="muted" style="margin:4px 0 0">Memuat data pendaftaran...</p></div><button class="btn btn-secondary" onclick="closeVerificationDetailUI()">Tutup</button></div><div id="verificationDetailBody" style="margin-top:14px"><div class="empty-state">Memuat detail verifikasi...</div></div></div></div>`);modal=$('verificationDetailModal')}
  else{const b=$('verificationDetailBody');if(b)b.innerHTML='<div class="empty-state">Memuat detail verifikasi...</div>';modal.style.display='flex'}
  try{const r=await server('getVerificationDetail',state.token,id);const b=$('verificationDetailBody');if(!b)return;if(!r.success){b.innerHTML=showMessage(r.message||'Detail verifikasi tidak dapat dimuat.','warning');return}state.verificationDetail=r;renderVerificationDetail(r,b)}catch(e){const b=$('verificationDetailBody');if(b)b.innerHTML=showMessage('Gagal memuat detail verifikasi.','error')}finally{state.detailLoadingLocks[key]=false}
}
function closeVerificationDetailUI(){state.detailLoadingLocks.verification=false;$('verificationDetailModal')?.remove()}
function renderVerificationDetail(d,target){
 const r=d.registration,c=d.candidate||{},g=d.guardian||{},a=d.address||{},s=d.school||{};const root=target||$('content');
 root.innerHTML=`<section class="hero">${target?'':'<button class="btn btn-secondary" onclick="renderVerification()">← Kembali</button>'}<h2 style="margin-top:12px">Verifikasi ${esc(r.registrationNumber||'')}</h2><p>${esc(c.fullName||'-')} · ${esc(statusLabel(r.status))}</p></section><div class="grid"><article class="card"><div class="icon">${ico('user')}</div><b>Data Pribadi</b><p>${esc(c.fullName||'-')}<br>${esc(c.birthPlace||'-')}, ${esc(c.birthDate||'-')}<br>Jenis kelamin: ${esc(c.gender||'-')}</p></article><article class="card"><div class="icon">${ico('users')}</div><b>Data Wali</b><p>${esc(g.fullName||'-')}<br>${esc(g.relationship||'-')} · ${esc(g.phone||'-')}</p></article><article class="card"><div class="icon">${ico('home')}</div><b>Alamat</b><p>${esc(a.addressLine||'-')}<br>${esc(a.village||'-')}, ${esc(a.district||'-')}</p></article><article class="card"><div class="icon">${ico('school')}</div><b>Sekolah</b><p>${esc(s.schoolName||'-')}<br>Tahun lulus: ${esc(s.graduationYear||'-')}</p></article></div><section class="progress-card" style="margin-top:14px"><div class="progress-head"><div><b>Dokumen</b><div class="muted" style="font-size:11px;margin-top:3px">Periksa setiap berkas sebelum verifikasi akhir.</div></div></div><div id="verificationDocs">${renderVerificationDocsHtml(d)}</div></section><section class="card" style="margin-top:14px"><b>Keputusan Verifikasi</b><p class="muted">Verifikasi akhir hanya dapat dilakukan jika seluruh dokumen wajib sudah berstatus terverifikasi.</p><div class="verification-note-box"><div class="verification-note-head"><div class="verification-note-icon">${ico('info')}</div><div><div class="verification-note-title">Catatan untuk Wali Santri</div><div class="verification-note-help">Tuliskan alasan atau arahan yang perlu diketahui wali jika pendaftaran dikembalikan untuk revisi.</div></div></div><textarea id="verificationNote" class="textarea-field" placeholder="Contoh: Mohon perbaiki dokumen KK karena foto kurang jelas."></textarea></div><div class="registration-actions" style="margin-top:12px"><button id="verificationRevisionBtn" class="btn btn-secondary" onclick="finalizeVerificationUI('REVISION','${esc(r.registrationId)}')">Minta Revisi</button><button id="verificationApproveBtn" class="btn btn-primary" onclick="finalizeVerificationUI('VERIFIED','${esc(r.registrationId)}')">Verifikasi</button></div></section>`;
}
function renderVerificationDocsHtml(d){return (d.checklist||[]).map(x=>{const doc=x.document;return `<article class="registration-item"><div class="registration-item-top"><div><div class="registration-name">${esc(x.name||'-')} ${x.required?'· Wajib':''}</div><div class="registration-number">${doc?esc(doc.fileName||'-'):'Belum diunggah'}</div></div><span class="pill ${doc&&String(doc.status)==='VERIFIED'?'ok':''}">${doc?esc(statusLabel(doc.status)):'Belum ada'}</span></div>${doc?`<div class="registration-meta"><a href="${esc(doc.fileUrl||'#')}" target="_blank" rel="noopener">Buka dokumen</a>${doc.revisionNote?` · Catatan: ${esc(doc.revisionNote)}`:''}</div><div class="registration-actions"><button class="btn btn-secondary" onclick="verifyDocumentUI('${esc(doc.documentId)}','REVISION')">Revisi</button><button class="btn btn-primary" onclick="verifyDocumentUI('${esc(doc.documentId)}','VERIFIED')">Terima</button></div>`:`<div class="registration-meta"><span>Dokumen belum tersedia.</span></div>`}</article>`}).join('')||'<div class="empty-state">Belum ada jenis dokumen aktif.</div>'}
async function verifyDocumentUI(id,status){const note=status==='REVISION'?(prompt('Catatan revisi dokumen:')||''):'';if(status==='REVISION'&&!note.trim()){showAlert('Catatan diperlukan','Tuliskan alasan revisi dokumen.','warning');return}loading(true,'Menyimpan verifikasi dokumen...');try{const r=await server('verifyDocument',state.token,{documentId:id,status,note});if(r.success){showToast(r.message,'success');await openVerification(state.verificationDetail.registration.registrationId)}else showAlert('Verifikasi gagal',r.message||'Operasi gagal.','warning')}catch(e){showAlert('Verifikasi gagal','Terjadi gangguan saat menyimpan.','error')}finally{loading(false)}}
async function finalizeVerificationUI(decision,id){
  const note=String($('verificationNote')?.value||'').trim();
  if(decision==='REVISION'&&!note){showAlert('Catatan diperlukan','Tuliskan alasan revisi untuk wali.','warning');return}
  showConfirm(decision==='VERIFIED'?'Verifikasi pendaftaran?':'Kembalikan untuk revisi?','Keputusan akan dicatat pada audit log.',async()=>{
    const revBtn=$('verificationRevisionBtn'),okBtn=$('verificationApproveBtn');
    if(revBtn?.disabled||okBtn?.disabled)return;
    if(revBtn)revBtn.disabled=true;if(okBtn)okBtn.disabled=true;
    const active=decision==='VERIFIED'?okBtn:revBtn;if(active)active.textContent=decision==='VERIFIED'?'Memverifikasi...':'Menyimpan revisi...';
    loading(true,'Menyimpan keputusan...');
    try{const r=await server('finalizeVerification',state.token,{registrationId:id,decision,note});if(r.success){showToast(r.message,'success');renderVerification()}else{if(revBtn)revBtn.disabled=false;if(okBtn)okBtn.disabled=false;if(active)active.textContent=decision==='VERIFIED'?'Verifikasi':'Minta Revisi';showAlert('Belum dapat diproses',r.message||'Periksa kelengkapan dokumen.','warning')}}catch(e){if(revBtn)revBtn.disabled=false;if(okBtn)okBtn.disabled=false;if(active)active.textContent=decision==='VERIFIED'?'Verifikasi':'Minta Revisi';showAlert('Gagal menyimpan','Terjadi gangguan saat menyimpan.','error')}finally{loading(false)}} ,decision==='VERIFIED'?'Verifikasi':'Minta Revisi')}



async function renderRegistrationHub(){
  if(!hasAnyRole(['WALI','SUPERADMIN','ADMIN_PSB'])){renderMore();return;}
  $('content').innerHTML=`<section class="hero"><h2>Pendaftaran</h2><p>Satu akun wali dapat mengelola beberapa pendaftaran anak.</p></section><div id="registrationPanel"><div class="empty-state">Memuat pendaftaran...</div></div>`;
  if(state.cache.registration){state.registrationList=state.cache.registration;renderRegistrationList();return;}
  try{const r=await server('getMyRegistrations',state.token);if(!r.success){$('registrationPanel').innerHTML=showMessage(r.message);return}state.registrationList=r.registrations||[];state.cache.registration=state.registrationList;renderRegistrationList();}catch(e){$('registrationPanel').innerHTML=showMessage('Gagal memuat pendaftaran.');}
}
function renderRegistrationList(){
  const el=$('registrationPanel');if(!el)return;
  const items=state.registrationList||[];
  el.innerHTML=`<div class="master-head"><div><h2 style="margin:0;font-size:18px">Anak / Pendaftaran</h2><p>Draft dapat dilanjutkan sebelum dikirim untuk verifikasi.</p></div><button class="btn btn-primary master-add" onclick="openRegistrationForm()">+ Pendaftaran</button></div>${items.length?`<div class="registration-list">${items.map(r=>`<article class="registration-item"><div class="registration-item-top"><div><div class="registration-name">${esc(r.candidateName||'Belum diisi')}</div><div class="registration-number">${esc(r.registrationNumber||'-')}</div></div><span class="pill ${r.status==='VERIFIED'?'ok':''}">${esc(statusLabel(r.status))}</span></div><div class="registration-meta"><span>${esc(r.jenjangName||'-')} · ${esc(r.gelombangName||'-')}</span><span>Diperbarui: ${esc(String(r.updatedAt||'-').replace('T',' ').substring(0,16))}</span></div><div class="registration-actions">${['DRAFT','REVISION'].includes(String(r.status))?`<button class="btn btn-secondary" onclick="openRegistrationForm('${esc(r.registrationId)}')">Lanjutkan</button>`:`<button class="btn btn-secondary" onclick="viewRegistration('${esc(r.registrationId)}')">Lihat</button>`}${r.status==='DRAFT'||r.status==='REVISION'?`<button class="btn btn-primary" onclick="submitRegistrationUI('${esc(r.registrationId)}')">Kirim Pendaftaran</button>`:''}</div></article>`).join('')}</div>`:`<div class="empty-state">Belum ada pendaftaran.<br>Mulai pendaftaran pertama untuk calon santri.</div>`}`;
}
function statusLabel(s){return ({DRAFT:'Draft',SUBMITTED:'Menunggu verifikasi',UNDER_REVIEW:'Sedang diverifikasi',REVISION:'Perlu perbaikan',VERIFIED:'Terverifikasi',PENDING:'Menunggu verifikasi dokumen',REPLACED:'Diganti',PAYMENT_PENDING:'Menunggu pembayaran',PAYMENT_VERIFIED:'Pembayaran terverifikasi',SELECTION:'Seleksi',PASSED:'Lulus',NOT_PASSED:'Tidak lulus',REREGISTRATION:'Daftar ulang',COMPLETED:'Selesai',CANCELLED:'Dibatalkan'})[s]||s||'-';}
async function openRegistrationForm(registrationId){
  $('content').innerHTML='<div class="empty-state">Menyiapkan formulir pendaftaran...</div>';
  try{const opt=await server('getRegistrationFormOptions',state.token);if(!opt.success){$('content').innerHTML=showMessage(opt.message);return}state.registrationOptions=opt;let detail=null;if(registrationId){const d=await server('getRegistrationDetail',state.token,registrationId);if(!d.success){$('content').innerHTML=showMessage(d.message);return}detail=d;state.registrationDetail=d;}else state.registrationDetail=null;renderRegistrationForm(detail);}
  catch(e){$('content').innerHTML=showMessage('Gagal menyiapkan formulir pendaftaran.');}
}
function renderRegistrationForm(detail){
  const r=detail?.registration||{}, c=detail?.candidate||{}, g=detail?.guardian||{}, a=detail?.address||{}, s=detail?.school||{}, o=state.registrationOptions||{};
  const years=o.years||[], waves=o.waves||[], levels=o.jenjang||[];
  $('content').innerHTML=`<section class="hero"><div style="display:flex;align-items:flex-start;gap:10px"><div style="flex:1"><h2>${r.registrationId?'Lanjutkan Pendaftaran':'Pendaftaran Baru'}</h2><p>Lengkapi data calon santri, lalu kirim pendaftaran setelah seluruh data wajib selesai. Anda tetap dapat menyimpan sementara jika belum siap mengirim.</p></div><button type="button" class="top-action" title="Kembali" onclick="exitRegistrationForm()">${ico('logout')}</button></div></section><div id="registrationFormMsg"></div><form id="registrationForm" onsubmit="return false"><input type="hidden" id="rf_registrationId" value="${esc(r.registrationId||'')}"><section class="form-section"><div class="form-section-head"><span class="form-step">1</span><div><h3>Formulir Pendaftaran</h3><p>Tahun ajaran, gelombang, dan jenjang tujuan.</p></div></div><div class="form-grid"><div class="field"><label>Tahun Ajaran *</label><select id="rf_tahunAjaranId" class="select-field" onchange="filterRegistrationWaves()"><option value="">Pilih tahun ajaran</option>${years.map(x=>`<option value="${esc(x.tahunAjaranId)}" ${String(x.tahunAjaranId)===String(r.tahunAjaranId||o.activeYearId)?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div><div class="field"><label>Gelombang *</label><select id="rf_gelombangId" class="select-field"><option value="">Pilih gelombang</option>${waves.map(x=>`<option data-year="${esc(x.tahunAjaranId)}" value="${esc(x.gelombangId)}" ${String(x.gelombangId)===String(r.gelombangId||'')?'selected':''}>${esc(x.name)}${x.startDate?' · '+esc(x.startDate):''}</option>`).join('')}</select></div><div class="field"><label>Jenjang Tujuan *</label><select id="rf_jenjangId" class="select-field"><option value="">Pilih jenjang</option>${levels.map(x=>`<option value="${esc(x.jenjangId)}" ${String(x.jenjangId)===String(r.jenjangId||'')?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div></div></section><section class="form-section"><div class="form-section-head"><span class="form-step">2</span><div><h3>Data Calon Santri</h3><p>Identitas dasar calon santri.</p></div></div><div class="form-grid"><div class="field"><label>Nama Lengkap *</label><input id="rf_fullName" value="${esc(c.fullName||'')}" autocomplete="name"></div><div class="field"><label>NIK</label><input id="rf_nik" inputmode="numeric" maxlength="16" value="${esc(c.nik||'')}"></div><div class="field"><label>Tempat Lahir *</label><input id="rf_birthPlace" value="${esc(c.birthPlace||'')}"></div><div class="field"><label>Tanggal Lahir *</label><input id="rf_birthDate" type="date" value="${esc(String(c.birthDate||'').substring(0,10))}"></div><div class="field"><label>Jenis Kelamin *</label><select id="rf_gender" class="select-field"><option value="">Pilih</option><option value="L" ${c.gender==='L'?'selected':''}>Laki-laki</option><option value="P" ${c.gender==='P'?'selected':''}>Perempuan</option></select></div><div class="field"><label>Anak Ke-</label><input id="rf_birthOrder" type="number" min="1" inputmode="numeric" value="${esc(c.birthOrder||'')}"></div><div class="field"><label>Status Dalam Keluarga</label><input id="rf_familyStatus" placeholder="Contoh: Anak kandung" value="${esc(c.familyStatus||'')}"></div></div></section><section class="form-section"><div class="form-section-head"><span class="form-step">3</span><div><h3>Data Wali</h3><p>Data wali utama yang bertanggung jawab atas pendaftaran.</p></div></div><div class="form-grid"><div class="field"><label>Hubungan *</label><select id="rf_relationship" class="select-field"><option value="">Pilih</option>${['Ayah','Ibu','Wali'].map(x=>`<option ${g.relationship===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Nama Wali *</label><input id="rf_guardianName" value="${esc(g.fullName||state.user.name||'')}" autocomplete="name"></div><div class="field"><label>NIK Wali</label><input id="rf_guardianNik" inputmode="numeric" maxlength="16" value="${esc(g.nik||'')}"></div><div class="field"><label>No. HP Wali *</label><input id="rf_guardianPhone" inputmode="tel" value="${esc(g.phone||state.user.phone||'')}" autocomplete="tel"></div><div class="field"><label>Email</label><input id="rf_guardianEmail" type="email" value="${esc(g.email||state.user.email||'')}" autocomplete="email"></div><div class="field"><label>Pekerjaan</label><input id="rf_occupation" value="${esc(g.occupation||'')}"></div><div class="field"><label>Pendidikan</label><input id="rf_education" value="${esc(g.education||'')}"></div></div></section><section class="form-section"><div class="form-section-head"><span class="form-step">4</span><div><h3>Alamat Domisili</h3><p>Alamat tempat tinggal calon santri.</p></div></div><div class="form-grid"><div class="field"><label>Alamat Lengkap *</label><input id="rf_addressLine" value="${esc(a.addressLine||'')}"></div><div class="form-grid two"><div class="field"><label>RT</label><input id="rf_rt" inputmode="numeric" value="${esc(a.rt||'')}"></div><div class="field"><label>RW</label><input id="rf_rw" inputmode="numeric" value="${esc(a.rw||'')}"></div></div><div class="field"><label>Desa/Kelurahan *</label><input id="rf_village" value="${esc(a.village||'')}"></div><div class="field"><label>Kecamatan *</label><input id="rf_district" value="${esc(a.district||'')}"></div><div class="field"><label>Kabupaten/Kota *</label><input id="rf_regency" value="${esc(a.regency||'')}"></div><div class="field"><label>Provinsi *</label><input id="rf_province" value="${esc(a.province||'')}"></div><div class="field"><label>Kode Pos</label><input id="rf_postalCode" inputmode="numeric" value="${esc(a.postalCode||'')}"></div></div></section><section class="form-section"><div class="form-section-head"><span class="form-step">5</span><div><h3>Sekolah Asal</h3><p>Informasi sekolah terakhir calon santri.</p></div></div><div class="form-grid"><div class="field"><label>Nama Sekolah *</label><input id="rf_schoolName" value="${esc(s.schoolName||'')}"></div><div class="field"><label>Jenis Sekolah</label><input id="rf_schoolType" placeholder="Contoh: SD / MI / SMP / MTs" value="${esc(s.schoolType||'')}"></div><div class="field"><label>NPSN</label><input id="rf_npsn" inputmode="numeric" value="${esc(s.npsn||'')}"></div><div class="field"><label>Alamat Sekolah</label><input id="rf_schoolAddress" value="${esc(s.address||'')}"></div><div class="field"><label>Tahun Lulus *</label><input id="rf_graduationYear" type="number" min="1900" max="2200" inputmode="numeric" value="${esc(s.graduationYear||'')}"></div></div></section><div class="form-actions"><div class="form-actions-inner"><button type="button" class="btn btn-secondary" onclick="saveRegistrationUI(false)">Simpan Sementara</button><button type="button" class="btn btn-primary" onclick="saveRegistrationUI(true)">Simpan &amp; Kirim Pendaftaran</button></div></div></form>`;
  filterRegistrationWaves();
}
function filterRegistrationWaves(){const y=$('rf_tahunAjaranId')?.value;const current=$('rf_gelombangId')?.value;const waves=state.registrationOptions?.waves||[];if(!$('rf_gelombangId'))return;$('rf_gelombangId').innerHTML='<option value="">Pilih gelombang</option>'+waves.filter(x=>!y||String(x.tahunAjaranId)===String(y)).map(x=>`<option value="${esc(x.gelombangId)}" ${String(x.gelombangId)===String(current)?'selected':''}>${esc(x.name)}${x.startDate?' · '+esc(x.startDate):''}</option>`).join('');}
function newRegistrationClientId(){return 'REG-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,8).toUpperCase()}
function validateRegistrationRequiredUI(){
  const required=[
    ['rf_tahunAjaranId','Tahun Ajaran'],['rf_gelombangId','Gelombang'],['rf_jenjangId','Jenjang Tujuan'],
    ['rf_fullName','Nama Lengkap'],['rf_birthPlace','Tempat Lahir'],['rf_birthDate','Tanggal Lahir'],['rf_gender','Jenis Kelamin'],
    ['rf_relationship','Hubungan Wali'],['rf_guardianName','Nama Wali'],['rf_guardianPhone','No. HP Wali'],
    ['rf_addressLine','Alamat Lengkap'],['rf_village','Desa/Kelurahan'],['rf_district','Kecamatan'],['rf_regency','Kabupaten/Kota'],['rf_province','Provinsi'],
    ['rf_schoolName','Nama Sekolah'],['rf_graduationYear','Tahun Lulus']
  ];
  for(const [id,label] of required){
    const el=$(id);
    if(!el || !String(el.value||'').trim()){
      if(el){
        el.classList.add('field-invalid');
        el.focus({preventScroll:true});
        el.scrollIntoView({behavior:'smooth',block:'center'});
        setTimeout(()=>el.classList.remove('field-invalid'),2200);
      }
      return {valid:false,label};
    }
  }
  return {valid:true};
}
function exitRegistrationForm(){showConfirm('Keluar dari formulir?','Jika data belum tersimpan sebagai draft, perubahan terakhir dapat hilang. Pastikan sudah menyimpan sebelum keluar.',()=>goPage('registration'),'Keluar')}
function confirmLogout(){showConfirm('Keluar dari akun?','Sesi Anda akan diakhiri pada perangkat ini.',()=>doLogout(),'Keluar')}
function registrationPayload(){const g=id=>$(id)?.value||'';return {registrationId:g('rf_registrationId'),tahunAjaranId:g('rf_tahunAjaranId'),gelombangId:g('rf_gelombangId'),jenjangId:g('rf_jenjangId'),candidate:{fullName:g('rf_fullName'),nik:g('rf_nik'),birthPlace:g('rf_birthPlace'),birthDate:g('rf_birthDate'),gender:g('rf_gender'),birthOrder:g('rf_birthOrder'),familyStatus:g('rf_familyStatus')},guardian:{relationship:g('rf_relationship'),fullName:g('rf_guardianName'),nik:g('rf_guardianNik'),phone:g('rf_guardianPhone'),email:g('rf_guardianEmail'),occupation:g('rf_occupation'),education:g('rf_education')},address:{addressLine:g('rf_addressLine'),rt:g('rf_rt'),rw:g('rf_rw'),village:g('rf_village'),district:g('rf_district'),regency:g('rf_regency'),province:g('rf_province'),postalCode:g('rf_postalCode')},school:{schoolName:g('rf_schoolName'),schoolType:g('rf_schoolType'),npsn:g('rf_npsn'),address:g('rf_schoolAddress'),graduationYear:g('rf_graduationYear')}};}
async function saveRegistrationUI(andSubmit){
  if(window.registrationSaving)return;
  const requiredCheck=validateRegistrationRequiredUI();
  if(!requiredCheck.valid){
    const msg='Lengkapi data yang wajib diisi bertanda bintang. Data yang belum lengkap: '+requiredCheck.label+'.';
    $('registrationFormMsg').innerHTML=showMessage(msg,'warning');
    showAlert('Formulir belum lengkap',msg,'warning');
    return;
  }
  window.registrationSaving=true;
  const buttons=[...document.querySelectorAll('#registrationForm button')];
  buttons.forEach(b=>b.disabled=true);
  const idEl=$('rf_registrationId');
  if(idEl&&!idEl.value)idEl.value=newRegistrationClientId();
  const payload=registrationPayload();
  $('registrationFormMsg').innerHTML='';
  loading(true,andSubmit?'Menyimpan dan mengirim...':'Menyimpan draft...');
  try{
    const r=await server('saveRegistration',state.token,payload);
    if(!r.success){
      $('registrationFormMsg').innerHTML=showMessage(r.message);
      showAlert('Pendaftaran belum tersimpan',r.message||'Silakan periksa data lalu coba lagi.','warning');
      return;
    }

    // Server sudah menyimpan data. Jangan biarkan kegagalan refresh UI
    // sesudah penyimpanan mengubah hasil menjadi "Gagal menyimpan".
    const savedId=String(r.registration?.registrationId||payload.registrationId||'');
    if(idEl && savedId) idEl.value=savedId;
    state.registrationDetail=r;
    state.registrationList=state.registrationList||[];
    const idx=state.registrationList.findIndex(x=>String(x.registrationId)===savedId);
    const summary={registrationId:savedId,registrationNumber:r.registration?.registrationNumber||'',status:r.registration?.status||'DRAFT',candidateName:r.candidate?.fullName||'',tahunAjaranId:r.registration?.tahunAjaranId||'',gelombangId:r.registration?.gelombangId||'',jenjangId:r.registration?.jenjangId||'',updatedAt:r.registration?.updatedAt||''};
    if(idx>=0)state.registrationList[idx]=Object.assign({},state.registrationList[idx],summary);else state.registrationList.unshift(summary);
    state.cache.registration=state.registrationList;

    if(andSubmit){
      const sub=await server('submitRegistration',state.token,savedId);
      if(!sub.success){
        // Simpan berhasil; hanya proses pengiriman yang belum berhasil.
        $('registrationFormMsg').innerHTML=showMessage(sub.message||'Pendaftaran tersimpan sebagai draft.','warning');
        showAlert('Data sudah tersimpan',sub.message||'Pendaftaran belum dapat dikirim. Periksa kembali data lalu coba lagi.','warning');
        return;
      }
      delete state.cache.registration;
      showToast(sub.message,'success');
      await renderRegistrationHub();
    }else{
      showToast(r.message,'success');
      // Refresh formulir adalah operasi UI terpisah. Jika gagal, jangan
      // mengubah status penyimpanan menjadi gagal.
      try{
        await openRegistrationForm(savedId);
      }catch(refreshError){
        $('registrationFormMsg').innerHTML=showMessage('Draft berhasil disimpan. Formulir dapat dibuka kembali dari menu Pendaftaran.','success');
      }
    }
  }catch(e){
    const msg='Terjadi gangguan saat menyimpan. Jika data sudah masuk, jangan klik Simpan berulang kali; buka kembali Pendaftaran untuk memeriksa draft. Jika belum ada data, Anda dapat mencoba lagi.';
    $('registrationFormMsg').innerHTML=showMessage(msg,'error');
    showAlert('Penyimpanan belum dapat dikonfirmasi',msg,'error');
  }finally{
    loading(false);
    window.registrationSaving=false;
    buttons.forEach(b=>b.disabled=false);
  }
}
async function submitRegistrationUI(id){showConfirm('Kirim pendaftaran?','Setelah dikirim, data masuk ke proses verifikasi dan tidak dapat diedit sampai ada revisi.',async()=>{loading(true,'Mengirim pendaftaran...');try{const r=await server('submitRegistration',state.token,id);if(r.success){showToast(r.message,'success');await renderRegistrationHub();}else showAlert('Belum dapat dikirim',r.message||'Silakan periksa kembali data pendaftaran.','warning')}catch(e){showAlert('Gagal mengirim', 'Terjadi gangguan saat mengirim pendaftaran. Silakan coba lagi.','error')}finally{loading(false)}} ,'Kirim Pendaftaran')}
async function viewRegistration(id){
  const key='registrationDetail';if(state.detailLoadingLocks[key])return;state.detailLoadingLocks[key]=true;
  let modal=$('registrationDetailModal');
  if(!modal){document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="registrationDetailModal"><div class="modal" style="max-width:900px;width:min(94vw,900px);max-height:90vh;overflow:auto"><div class="status-row"><div><h3 style="margin:0">Detail Pendaftaran</h3><p class="muted" style="margin:4px 0 0">Memuat data pendaftaran...</p></div><button class="btn btn-secondary" onclick="closeRegistrationDetailUI()">Tutup</button></div><div id="registrationDetailBody" style="margin-top:14px"><div class="empty-state">Memuat pendaftaran...</div></div></div></div>`);modal=$('registrationDetailModal')}
  else{const b=$('registrationDetailBody');if(b)b.innerHTML='<div class="empty-state">Memuat pendaftaran...</div>';modal.style.display='flex'}
  try{const r=await server('getRegistrationDetail',state.token,id);const b=$('registrationDetailBody');if(!b)return;if(!r.success){b.innerHTML=showMessage(r.message||'Pendaftaran tidak dapat dimuat.','warning');return}state.registrationDetail=r;renderRegistrationDetail(r,b)}catch(e){const b=$('registrationDetailBody');if(b)b.innerHTML=showMessage('Gagal memuat detail pendaftaran.','error')}finally{state.detailLoadingLocks[key]=false}
}
function closeRegistrationDetailUI(){state.detailLoadingLocks.registrationDetail=false;$('registrationDetailModal')?.remove()}
function renderRegistrationDetail(d,target){const r=d.registration,c=d.candidate||{},g=d.guardian||{},a=d.address||{},s=d.school||{};const root=target||$('content');root.innerHTML=`<section class="hero"><h2>${esc(c.fullName||'Pendaftaran')}</h2><p>${esc(r.registrationNumber||'-')} · ${esc(statusLabel(r.status))}</p></section><section class="form-section"><h3>Data Pendaftaran</h3><div class="registration-meta"><span>Tahun Ajaran: ${esc(state.registrationOptions?.activeYearName||r.tahunAjaranId)}</span><span>Jenjang: ${esc(r.jenjangId)}</span><span>Gelombang: ${esc(r.gelombangId)}</span></div></section><section class="form-section"><h3>Calon Santri</h3><div class="registration-meta"><span>Nama: ${esc(c.fullName||'-')}</span><span>Tempat/Tanggal lahir: ${esc(c.birthPlace||'-')} / ${esc(String(c.birthDate||'-').substring(0,10))}</span><span>Jenis kelamin: ${esc(c.gender==='L'?'Laki-laki':c.gender==='P'?'Perempuan':'-')}</span></div></section><section class="form-section"><h3>Wali</h3><div class="registration-meta"><span>${esc(g.relationship||'-')} · ${esc(g.fullName||'-')}</span><span>${esc(g.phone||'-')} · ${esc(g.email||'-')}</span></div></section><section class="form-section"><h3>Alamat</h3><div class="registration-meta"><span>${esc(a.addressLine||'-')}</span><span>${esc(a.village||'-')}, ${esc(a.district||'-')}, ${esc(a.regency||'-')}, ${esc(a.province||'-')}</span></div></section><section class="form-section"><h3>Sekolah Asal</h3><div class="registration-meta"><span>${esc(s.schoolName||'-')} · ${esc(s.schoolType||'-')}</span><span>Tahun lulus: ${esc(s.graduationYear||'-')}</span></div></section><div style="display:grid;gap:9px"><button class="btn btn-primary" onclick="openDocumentsForRegistration('${esc(r.registrationId)}')">${ico('file')} &nbsp; Kelola Dokumen</button>${target?'':'<button class="btn btn-secondary" onclick="goPage(\'registration\')">Kembali</button>'}</div>`;}
async function renderApplicants(){
  if(!hasAnyRole(['SUPERADMIN','ADMIN_PSB','VERIFIKATOR'])){renderMore();return;}
  $('content').innerHTML=`<section class="hero"><h2>Pendaftar</h2><p>Daftar pendaftaran yang masuk ke sistem.</p></section><div id="applicantPanel"><div class="empty-state">Memuat pendaftar...</div></div>`;
  try{const r=pageDataCached('applicants')||await warmPageData('applicants',()=>server('getRegistrationList',state.token,{}));if(!r?.success){$('applicantPanel').innerHTML=showMessage(r.message);return}const items=r.registrations||[];$('applicantPanel').innerHTML=items.length?`<div class="registration-list">${items.map(x=>`<article class="registration-item"><div class="registration-item-top"><div><div class="registration-name">${esc(x.candidateName||'-')}</div><div class="registration-number">${esc(x.registrationNumber||'-')}</div></div><span class="pill">${esc(statusLabel(x.status))}</span></div><div class="registration-meta"><span>${esc(x.jenjangName||'-')} · ${esc(x.gelombangName||'-')}</span></div><div class="registration-actions"><button class="btn btn-secondary" onclick="viewRegistration('${esc(x.registrationId)}')">Lihat</button><button class="btn btn-primary" onclick="openDocumentsForRegistration('${esc(x.registrationId)}')">Dokumen</button></div></article>`).join('')}</div>`:'<div class="empty-state">Belum ada pendaftaran masuk.</div>';}catch(e){$('applicantPanel').innerHTML=showMessage('Gagal memuat pendaftar.');}
}


async function renderDocuments(registrationId){
  if(!hasAnyRole(['WALI','SUPERADMIN','ADMIN_PSB','VERIFIKATOR'])){renderMore();return;}
  state.documentRegistrationId=registrationId||state.documentRegistrationId||'';
  $('content').innerHTML=`<section class="hero"><h2>Dokumen Pendaftaran</h2><p>Kelola berkas persyaratan dan simpan file secara terstruktur di Google Drive.</p></section><div id="documentPanel"><div class="empty-state">Memuat daftar pendaftaran...</div></div>`;
  try{
    let r=state.cache.documents[state.documentRegistrationId]||null;
    if(!r){r=await server('getDocumentPageData',state.token,state.documentRegistrationId);if(r?.success)state.cache.documents[state.documentRegistrationId]=r;}
    if(!r?.success){$('documentPanel').innerHTML=showMessage(r?.message||'Gagal memuat dokumen.');return;}
    const list=r.registrations||state.registrationList||[];state.registrationList=list;state.cache.registration=list;
    if(!list.length){$('documentPanel').innerHTML='<div class="doc-empty">Belum ada pendaftaran. Buat pendaftaran terlebih dahulu sebelum mengunggah dokumen.</div>';return;}
    state.documentRegistrationId=String((r.documentData?.registration?.registrationId)||state.documentRegistrationId||list[0].registrationId);
    state.documentData=r.documentData||null;
    $('documentPanel').innerHTML=`<div class="doc-toolbar"><select class="doc-select" id="documentRegistrationSelect" onchange="loadDocumentsForRegistration(this.value)">${list.map(x=>`<option value="${esc(x.registrationId)}" ${String(x.registrationId)===String(state.documentRegistrationId)?'selected':''}>${esc(x.candidateName||'Belum diisi')} · ${esc(x.registrationNumber||'-')}</option>`).join('')}</select></div><div id="documentContent"></div>`;
    if(state.documentData) renderDocumentContent(); else await loadDocumentsForRegistration(state.documentRegistrationId);
  }catch(e){$('documentPanel').innerHTML=showMessage('Gagal memuat modul dokumen.');}
}
async function loadDocumentsForRegistration(id){
  state.documentRegistrationId=String(id||'');const target=$('documentContent');if(!target)return;
  const cached=state.cache.documents[state.documentRegistrationId];
  if(cached?.documentData){state.documentData=cached.documentData;renderDocumentContent();return;}
  target.innerHTML='<div class="empty-state">Memuat dokumen...</div>';
  try{const r=await server('getDocumentOptions',state.token,id);if(!r.success){target.innerHTML=showMessage(r.message);return}state.documentData=r;state.cache.documents[state.documentRegistrationId]={success:true,registrations:state.registrationList||[],documentData:r};renderDocumentContent();}catch(e){target.innerHTML=showMessage('Gagal memuat dokumen.');}
}
function renderDocumentContent(){
  const d=state.documentData||{}, checks=d.checklist||[], current=d.documents||[];
  const required=checks.filter(x=>x.required), uploadedRequired=required.filter(x=>x.uploaded).length, pending=current.filter(x=>String(x.status||'').toUpperCase()==='PENDING').length;
  const canUpload=!!d.canUpload;
  const cards=checks.length?checks.map(x=>{const doc=x.document;const st=String(doc?.status||'').toUpperCase();const statusClass=st==='VERIFIED'?'verified':st==='REVISION'?'revision':st==='PENDING'?'pending':'';return `<article class="doc-item"><div class="doc-item-top"><div class="doc-icon">${ico('file')}</div><div class="doc-copy"><div class="doc-title">${esc(x.name||'-')}</div><div class="doc-meta">${x.required?'Dokumen wajib':'Dokumen opsional'} · Maks. ${esc(x.maxSizeMb||'-')} MB${x.allowedMimeTypes?' · '+esc(x.allowedMimeTypes):''}</div></div><span class="doc-required ${x.uploaded?'ok':''}">${x.uploaded?(st==='VERIFIED'?'Lengkap':'Sudah ada'):(x.required?'Wajib':'Opsional')}</span></div>${doc?`<div class="doc-meta" style="margin-top:10px"><b>${esc(doc.fileName||'-')}</b> · ${esc(formatFileSize(doc.fileSize))} · ${esc(statusLabel(doc.status))}${doc.revisionNote?`<br>Catatan: ${esc(doc.revisionNote)}`:''}</div>`:'<div class="doc-meta" style="margin-top:10px">Belum ada file yang diunggah.</div>'}<div class="doc-actions ${doc?'':'single'}">${doc?.fileUrl?`<button class="btn btn-secondary" onclick="window.open('${esc(doc.fileUrl)}','_blank')">Buka File</button>`:''}${canUpload?`<button class="btn btn-primary" onclick='openDocumentUpload(${JSON.stringify(x)})'>${doc?'Ganti File':'Unggah File'}</button>`:''}</div></article>`}).join(''):'<div class="doc-empty">Belum ada jenis dokumen aktif pada Master Data.</div>';
  $('documentContent').innerHTML=`<div class="status-card"><div class="status-row"><div><b>${esc(d.candidate?.fullName||'Pendaftaran')}</b><div class="muted" style="font-size:11px;margin-top:4px">${esc(d.registration?.registrationNumber||'-')} · ${esc(statusLabel(d.registration?.status))}</div></div><span class="pill">Stage 5</span></div></div><div class="doc-summary"><div class="doc-stat"><b>${uploadedRequired}/${required.length}</b><span>Dokumen wajib tersedia</span></div><div class="doc-stat"><b>${pending}</b><span>Menunggu verifikasi</span></div></div><div class="doc-list">${cards}</div><div class="status-card" style="margin-top:12px"><div class="muted" style="font-size:11px;line-height:1.5">File fisik disimpan di folder Google Drive pendaftaran. Spreadsheet hanya menyimpan metadata file, status, dan jejak audit.</div></div>`;
}
function formatFileSize(bytes){const n=Number(bytes||0);if(!n)return '-';if(n<1024)return n+' B';if(n<1024*1024)return (n/1024).toFixed(1)+' KB';if(n<1024*1024*1024)return (n/1024/1024).toFixed(2)+' MB';return (n/1024/1024/1024).toFixed(2)+' GB';}
function openDocumentUpload(type){
  const allowed=String(type.allowedMimeTypes||'').split(',').map(x=>x.trim()).filter(Boolean);const accept=allowed.join(',');
  const old=type.document||{};
  document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="documentUploadModal"><div class="modal"><h3>${old.fileId?'Ganti':'Unggah'} ${esc(type.name||'Dokumen')}</h3><p>Pilih file yang sesuai dengan aturan dokumen. File akan disimpan pada folder Google Drive pendaftaran ini.</p><div id="documentUploadMsg"></div><div class="upload-box"><input id="documentFileInput" type="file" ${accept?`accept="${esc(accept)}"`:''} onchange="previewDocumentFile()"><div class="file-picker"><button type="button" class="file-picker-btn" onclick="$('documentFileInput').click()">Pilih File</button><span class="file-picker-name" id="documentFileName">Belum ada file dipilih</span></div><div id="documentFileInfo" class="upload-note">Tipe diizinkan: ${esc(type.allowedMimeTypes||'Semua tipe file')} · Maksimum ${esc(type.maxSizeMb||'-')} MB</div></div><div class="modal-actions"><button id="documentUploadSubmitBtn" class="btn btn-primary" onclick='submitDocumentUpload(${JSON.stringify(type)})'>${old.fileId?'Ganti File':'Unggah Sekarang'}</button><button class="btn btn-secondary" onclick="closeDocumentUpload()">Batal</button></div></div></div>`);
}
function previewDocumentFile(){const input=$('documentFileInput'),info=$('documentFileInfo'),name=$('documentFileName');const f=input?.files?.[0];if(!f||!info)return;if(name){name.textContent=f.name;name.classList.add('selected')}info.innerHTML=`<div class="file-name">${esc(f.name)}</div><div class="upload-note">${formatFileSize(f.size)} · ${esc(f.type||'Tipe tidak terdeteksi')}</div>`;}
function closeDocumentUpload(){$('documentUploadModal')?.remove()}
async function submitDocumentUpload(type){
  const input=$('documentFileInput'),msg=$('documentUploadMsg'),file=input?.files?.[0],btn=$('documentUploadSubmitBtn');
  if(!file){msg.innerHTML=showMessage('Pilih file terlebih dahulu.','warning');return}
  const max=Number(type.maxSizeMb||0);if(max>0&&file.size>max*1024*1024){msg.innerHTML=showMessage('Ukuran file melebihi batas '+max+' MB.','warning');return}
  const allowed=String(type.allowedMimeTypes||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);const mime=String(file.type||'').toLowerCase();if(allowed.length&&!allowed.some(rule=>rule===mime||(rule.endsWith('/*')&&mime.startsWith(rule.slice(0,-1))))){msg.innerHTML=showMessage('Tipe file tidak diizinkan untuk dokumen ini.','warning');return}
  if(btn?.disabled)return;
  if(btn){btn.disabled=true;btn.textContent=type.document?.fileId?'Mengganti...':'Mengunggah...'}
  if(input)input.disabled=true;
  const reader=new FileReader();reader.onload=async()=>{const dataUrl=String(reader.result||'');const base64=dataUrl.indexOf(',')>=0?dataUrl.split(',')[1]:dataUrl;loading(true,'Mengunggah dokumen...');try{const r=await server('uploadDocument',state.token,{registrationId:state.documentRegistrationId,documentTypeId:type.documentTypeId,fileName:file.name,mimeType:file.type,fileSize:file.size,base64:base64});if(!r.success){if(btn){btn.disabled=false;btn.textContent=type.document?.fileId?'Ganti File':'Unggah Sekarang'}if(input)input.disabled=false;msg.innerHTML=showMessage(r.message);return}closeDocumentUpload();showToast(r.message,'success');delete state.cache.documents[state.documentRegistrationId];await loadDocumentsForRegistration(state.documentRegistrationId);}catch(e){if(btn){btn.disabled=false;btn.textContent=type.document?.fileId?'Ganti File':'Unggah Sekarang'}if(input)input.disabled=false;if($('documentUploadMsg'))$('documentUploadMsg').innerHTML=showMessage('Gagal mengunggah dokumen. Silakan coba lagi.')}finally{loading(false)}};reader.onerror=()=>{if(btn){btn.disabled=false;btn.textContent=type.document?.fileId?'Ganti File':'Unggah Sekarang'}if(input)input.disabled=false;if(msg)msg.innerHTML=showMessage('File tidak dapat dibaca. Silakan pilih file lain.','error')};reader.readAsDataURL(file);
}
function openDocumentsForRegistration(id){state.documentRegistrationId=id;goPage('documents');}

function renderProfile(){
 const superadmin=hasAnyRole(['SUPERADMIN']);
 $('content').innerHTML=`<div class="status-card"><div style="display:flex;gap:12px;align-items:center"><div class="logo" style="flex:none">${esc((state.user.name||'U').charAt(0).toUpperCase())}</div><div><h2 style="font-size:18px;margin:0">${esc(state.user.name)}</h2><div class="muted" style="font-size:12px">${esc(state.user.role)}</div></div></div></div>
 <div class="status-card"><div class="field"><label>No. HP</label><div class="muted">${esc(state.user.phone||'-')}</div></div><div class="field"><label>Email</label><div class="muted">${esc(state.user.email||'-')}</div></div>${superadmin?`<div style="margin-top:18px;padding-top:16px;border-top:1px solid var(--line)"><div class="status-row"><div><b>Manajemen Akun Pengguna</b><div class="muted" style="font-size:11px;margin-top:4px">Buat akun manual dan tentukan role sesuai struktur: SUPERADMIN, ADMIN_PSB, VERIFIKATOR, SELEKSI, KEUANGAN, atau WALI.</div></div><span class="pill">SUPERADMIN</span></div><button class="btn btn-primary profile-action" style="margin-top:12px" onclick="openManualUserModal()"><span class="profile-action-icon">${ico('user')}</span><span class="profile-action-label">Buat Akun Pengguna</span></button></div>`:''}<div style="display:grid;gap:10px;margin-top:18px"><button class="btn btn-secondary profile-action" onclick="openChangePassword()"><span class="profile-action-icon">${ico('settings')}</span><span class="profile-action-label">Ganti Password</span></button><button class="btn btn-danger profile-action" onclick="confirmLogout()"><span class="profile-action-icon">${ico('logout')}</span><span class="profile-action-label">Keluar dari Akun</span></button></div></div>`;
}
function openManualUserModal(){
 const roles=['SUPERADMIN','ADMIN_PSB','VERIFIKATOR','SELEKSI','KEUANGAN','WALI'];
 document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="manualUserModal"><div class="modal" style="max-width:620px"><h3>Buat Akun Pengguna</h3><p>Akun dibuat langsung oleh SUPERADMIN dan disimpan pada profil pengguna. Password awal wajib diganti saat login pertama.</p><div id="manualUserMsg"></div><div class="field"><label>Nama Lengkap</label><input id="manualUserName" type="text" autocomplete="name" placeholder="Nama pengguna"></div><div class="field"><label>No. HP</label><input id="manualUserPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="08xxxxxxxxxx"></div><div class="field"><label>Email</label><input id="manualUserEmail" type="email" autocomplete="email" placeholder="nama@contoh.com"></div><div class="field"><label>Role</label><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">${roles.map(r=>`<label class="selection-check-row" style="border:1px solid var(--line);border-radius:12px"><input class="manual-user-role" type="checkbox" value="${r}"><span class="selection-check-copy"><b>${r}</b></span></label>`).join('')}</div></div><div class="field"><label>Status Akun</label><select id="manualUserStatus"><option value="ACTIVE">ACTIVE</option><option value="INACTIVE">INACTIVE</option></select></div><div class="field"><label>Password Awal</label><input id="manualUserPassword" type="password" autocomplete="new-password" placeholder="Minimal 6 karakter"></div><div class="field"><label>Ulangi Password Awal</label><input id="manualUserConfirmPassword" type="password" autocomplete="new-password" placeholder="Ulangi password"></div><div class="modal-actions"><button class="btn btn-primary" id="manualUserSaveBtn" onclick="saveManualUser()">Simpan Akun</button><button class="btn btn-secondary" onclick="closeManualUserModal()">Batal</button></div></div></div>`);
}
function closeManualUserModal(){$('manualUserModal')?.remove()}
async function saveManualUser(){
 const btn=$('manualUserSaveBtn'),msg=$('manualUserMsg');
 const roles=Array.from(document.querySelectorAll('.manual-user-role:checked')).map(x=>x.value);
 const payload={name:$('manualUserName')?.value||'',phone:$('manualUserPhone')?.value||'',email:$('manualUserEmail')?.value||'',roles,password:$('manualUserPassword')?.value||'',confirmPassword:$('manualUserConfirmPassword')?.value||'',status:$('manualUserStatus')?.value||'ACTIVE'};
 if(!payload.name.trim()){msg.innerHTML=showMessage('Nama lengkap wajib diisi.','warning');return}
 if(!payload.phone.trim()&&!payload.email.trim()){msg.innerHTML=showMessage('Isi No. HP atau Email minimal salah satu.','warning');return}
 if(!roles.length){msg.innerHTML=showMessage('Pilih minimal satu role.','warning');return}
 if(payload.password.length<6){msg.innerHTML=showMessage('Password minimal 6 karakter.','warning');return}
 if(payload.password!==payload.confirmPassword){msg.innerHTML=showMessage('Konfirmasi password tidak sama.','warning');return}
 if(btn?.disabled)return;
 if(btn){btn.disabled=true;btn.textContent='Menyimpan...'}
 try{const r=await server('createManualUser',state.token,payload);if(!r.success){msg.innerHTML=showMessage(r.message||'Akun belum dapat dibuat.','warning');return}closeManualUserModal();showToast(r.message,'success');await openUserManagementModal()}catch(e){msg.innerHTML=showMessage('Gagal membuat akun pengguna. Silakan coba lagi.','error')}finally{if(btn){btn.disabled=false;btn.textContent='Simpan Akun'}}
}
async function renderUserManagementPage(){
 if(!hasAnyRole(['SUPERADMIN'])){renderMore();return;}
 $('content').innerHTML=`<section class="hero"><div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px"><div><h2>Manajemen Pengguna</h2><p>Kelola akun pengguna dan reset password masing-masing pengguna.</p></div><span class="pill">SUPERADMIN</span></div></section><div id="userManagementPageBody"><div class="empty-state">Memuat daftar pengguna...</div></div>`;
 await loadUserManagementPage();
}
async function loadUserManagementPage(){
 const body=$('userManagementPageBody');if(!body||!state.token)return;
 body.innerHTML='<div class="empty-state">Memuat daftar pengguna...</div>';
 try{
   const r=await server('getUserManagementData',state.token);
   if(!r.success){body.innerHTML=showMessage(r.message||'Daftar pengguna tidak dapat dimuat.','warning');return;}
   const users=r.users||[];
   body.innerHTML=`<section class="status-card" style="margin-bottom:10px"><div class="status-row"><div><b>${users.length} akun pengguna</b><div class="muted" style="font-size:11px;margin-top:4px">Pilih Ganti Password untuk mengatur password baru pengguna.</div></div><button class="btn btn-secondary" onclick="loadUserManagementPage()">Refresh</button></div></section><div style="display:grid;gap:9px">${users.length?users.map(u=>{const jsId=JSON.stringify(String(u.userId||''));const jsName=JSON.stringify(String(u.name||'Pengguna'));return `<article class="status-card" style="margin:0"><div class="status-row" style="align-items:flex-start"><div style="min-width:0"><b>${esc(u.name||'-')}</b><div class="muted" style="font-size:10px;margin-top:3px">${esc(u.phone||'-')}${u.email?` · ${esc(u.email)}`:''}</div><div style="margin-top:7px;display:flex;gap:6px;flex-wrap:wrap"><span class="pill">${esc(u.role||'-')}</span><span class="pill">${esc(u.status||'-')}</span>${u.mustChangePassword?'<span class="pill warning">Wajib ganti password</span>':''}</div></div><div style="display:grid;gap:7px;justify-items:end"><span class="muted" style="font-size:9px">${esc(u.userId||'-')}</span><button class="btn btn-primary" onclick='openAdminResetPassword(${jsId},${jsName})'>Ganti Password</button></div></div></article>`}).join(''):'<div class="empty-state">Belum ada akun pengguna.</div>'}</div>`;
 }catch(e){body.innerHTML=showMessage('Terjadi gangguan saat memuat manajemen pengguna.','error');}
}
function openAdminResetPassword(userId,userName){
 if(!hasAnyRole(['SUPERADMIN']))return;
 document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="adminResetPasswordModal"><div class="modal" style="max-width:520px"><h3>Ganti Password</h3><p>Atur password baru untuk <b>${esc(userName||'pengguna')}</b>. Pengguna akan diwajibkan mengganti password tersebut saat login berikutnya.</p><div id="adminResetPasswordMsg"></div><div class="field"><label>Password Baru</label><div class="input-wrap"><input id="adminResetPassword" type="password" autocomplete="new-password" placeholder="Minimal 6 karakter"><button class="toggle" type="button" onclick="toggleAdminResetPassword('adminResetPassword',this)">Lihat</button></div></div><div class="field"><label>Ulangi Password Baru</label><input id="adminResetPasswordConfirm" type="password" autocomplete="new-password" placeholder="Ulangi password baru"></div><div class="modal-actions"><button class="btn btn-primary" id="adminResetPasswordSaveBtn" onclick='saveAdminResetPassword(${JSON.stringify(String(userId||''))})'>Simpan Password</button><button class="btn btn-secondary" onclick="closeAdminResetPassword()">Batal</button></div></div></div>`);
}
function toggleAdminResetPassword(id,button){const i=$(id);if(!i)return;i.type=i.type==='password'?'text':'password';if(button)button.textContent=i.type==='password'?'Lihat':'Sembunyikan'}
function closeAdminResetPassword(){$('adminResetPasswordModal')?.remove()}
async function saveAdminResetPassword(userId){
 const btn=$('adminResetPasswordSaveBtn'),msg=$('adminResetPasswordMsg');
 const newPassword=String($('adminResetPassword')?.value||''),confirmPassword=String($('adminResetPasswordConfirm')?.value||'');
 if(newPassword.length<6){msg.innerHTML=showMessage('Password baru minimal 6 karakter.','warning');return}
 if(newPassword!==confirmPassword){msg.innerHTML=showMessage('Konfirmasi password tidak sama.','warning');return}
 if(btn?.disabled)return;
 btn.disabled=true;btn.textContent='Menyimpan...';loading(true,'Menyimpan password pengguna...');
 try{
   const r=await server('adminResetUserPassword',state.token,{userId,newPassword,confirmPassword});
   if(!r.success){msg.innerHTML=showMessage(r.message||'Password belum berhasil diubah.','warning');return}
   closeAdminResetPassword();showToast(r.message||'Password berhasil direset.','success');await loadUserManagementPage();
 }catch(e){msg.innerHTML=showMessage('Gagal menyimpan password pengguna. Silakan coba lagi.','error');}
 finally{loading(false);if(btn){btn.disabled=false;btn.textContent='Simpan Password'}}
}
async function openUserManagementModal(){
 // Kompatibilitas untuk tombol lama dari Profil. Sekarang manajemen pengguna adalah halaman khusus.
 if(!hasAnyRole(['SUPERADMIN']))return;
 closeUserManagementModal();
 goPage('userManagement');
}
function closeUserManagementModal(){$('userManagementModal')?.remove();state.detailLoadingLocks.userManagement=false}
async function renderReregistration(){
  if(!hasAnyRole(['WALI','SUPERADMIN','ADMIN_PSB','VERIFIKATOR','KEUANGAN'])){renderMore();return;}
  $('content').innerHTML=`<section class="hero"><h2>Daftar Ulang</h2><p>Lengkapi tahap akhir setelah dinyatakan lulus seleksi.</p></section><div id="reregPanel"><div class="empty-state">Memuat data daftar ulang...</div></div>`;
  try{
    const r=pageDataCached('reregistration')||await warmPageData('reregistration',()=>server('getReregistrationPageData',state.token));
    if(!r.success){$('reregPanel').innerHTML=showMessage(r.message);return;}
    renderReregistrationPanel(r);
  }catch(e){$('reregPanel').innerHTML=showMessage('Gagal memuat data daftar ulang.');}
}
function reregStatusLabel(s){return ({PENDING:'Menunggu proses',PAYMENT_PENDING:'Menunggu pembayaran',PAYMENT_VERIFIED:'Pembayaran terverifikasi',COMPLETED:'Selesai'})[String(s||'').toUpperCase()]||String(s||'-')}
function renderReregistrationPanel(data){
  const el=$('reregPanel');if(!el)return;
  const admin=!!data.canManage, items=data.items||[];
  if(!items.length){el.innerHTML=`<div class="status-card"><div class="status-row"><div><b>Belum ada Daftar Ulang</b><div class="muted" style="margin-top:5px">Daftar Ulang hanya dibuka untuk pendaftaran yang hasil seleksinya sudah diumumkan sebagai Lulus.</div></div></div></div>`;return;}
  el.innerHTML=`<div class="status-card"><div class="status-row"><div><b>Ringkasan</b><div class="muted" style="margin-top:4px">${Number(data.summary?.completed||0)} selesai · ${Number(data.summary?.pending||0)} masih diproses</div></div><span class="pill">Stage 10</span></div></div><div class="registration-list" style="margin-top:10px">${items.map(x=>{const rr=x.reregistration||{},reg=x.registration||{},c=x.candidate||{},docs=x.documents||{},pay=x.payment;const ready=!!x.readyToComplete;const st=String(rr.status||'PENDING').toUpperCase();return `<article class="registration-item"><div class="registration-item-top"><div><div class="registration-name">${esc(c.fullName||'-')}</div><div class="registration-number">${esc(reg.registrationNumber||reg.registrationId||'-')}</div></div><span class="pill ${st==='COMPLETED'?'ok':''}">${esc(reregStatusLabel(st))}</span></div><div class="registration-meta"><span>Dokumen wajib: ${Number(docs.verifiedCount||0)}/${Number(docs.requiredCount||0)} terverifikasi</span><span>${pay?`Daftar Ulang: Rp ${Number(pay.amount||0).toLocaleString('id-ID')}`:'Tagihan belum tersedia'}</span></div>${docs.missing?.length?`<div class="status-card" style="margin:10px 0 0;background:#fff8ef;box-shadow:none"><b>Dokumen perlu dilengkapi</b><div class="muted" style="margin-top:5px">${docs.missing.map(v=>esc(v)).join(', ')}</div></div>`:'<div class="registration-meta" style="margin-top:8px"><span>✓ Dokumen wajib sudah lengkap/terverifikasi.</span></div>'}${pay?`<div class="registration-meta" style="margin-top:8px"><span>Status pembayaran: ${esc(pay.status==='PAID'?'LUNAS':pay.paymentStatus==='SUBMITTED'?'MENUNGGU VERIFIKASI':pay.paymentStatus==='REJECTED'?'DITOLAK':pay.status==='PAYMENT_REVIEW'?'MENUNGGU VERIFIKASI':'BELUM BAYAR')}</span>${pay.dueDate?`<span>Jatuh tempo: ${esc(pay.dueDate)}</span>`:''}</div>`:''}<div class="registration-actions" style="margin-top:10px">${docs.missing?.length&&hasAnyRole(['WALI'])?`<button class="btn btn-secondary" onclick="openDocumentsForRegistration('${esc(reg.registrationId)}')">Lengkapi Dokumen</button>`:''}${pay&&String(pay.status)!=='PAID'&&hasAnyRole(['WALI'])?`<button class="btn btn-primary" onclick="goPage('payments')">Bayar Daftar Ulang</button>`:''}${x.needsOpen&&hasAnyRole(['WALI'])?`<button class="btn btn-primary" onclick="openReregistrationUI('${esc(reg.registrationId)}')">Buka Daftar Ulang</button>`:''}${admin&&ready&&st!=='COMPLETED'?`<button class="btn btn-primary" onclick="finalizeReregistrationUI('${esc(reg.registrationId)}')">Selesaikan Daftar Ulang</button>`:''}</div></article>`}).join('')}</div>`;
}
async function openReregistrationUI(registrationId){loading(true,'Membuka daftar ulang...');try{const r=await server('openReregistration',state.token,registrationId);if(r.success){showToast(r.message,'success');await renderReregistration()}else showAlert('Belum dapat dibuka',r.message||'Daftar ulang belum dapat dibuka.','warning')}catch(e){showAlert('Gagal membuka daftar ulang','Terjadi gangguan saat membuka daftar ulang.','error')}finally{loading(false)}}
async function finalizeReregistrationUI(registrationId){showConfirm('Selesaikan Daftar Ulang?','Pastikan dokumen wajib sudah lengkap dan pembayaran Daftar Ulang sudah lunas.',async()=>{loading(true,'Menyelesaikan daftar ulang...');try{const r=await server('finalizeReregistration',state.token,registrationId);if(r.success){showToast(r.message,'success');await renderReregistration()}else showAlert('Belum dapat diselesaikan',r.message||'Periksa dokumen dan pembayaran.','warning')}catch(e){showAlert('Gagal menyelesaikan','Terjadi gangguan saat menyimpan daftar ulang.','error')}finally{loading(false)}} ,'Selesaikan');}
function renderMore(){
  const canPayment=hasAnyRole(['SUPERADMIN','ADMIN_PSB','KEUANGAN']);
  const canSelection=hasAnyRole(['SUPERADMIN','ADMIN_PSB','SELEKSI']);
  const canAnnouncement=hasAnyRole(['SUPERADMIN','ADMIN_PSB','SELEKSI']);
  const canRereg=hasAnyRole(['WALI','SUPERADMIN','ADMIN_PSB','VERIFIKATOR','KEUANGAN']);
  const canReport=hasAnyRole(['SUPERADMIN','ADMIN_PSB','VERIFIKATOR','SELEKSI','KEUANGAN']);
  const isMaster=hasAnyRole(['SUPERADMIN','ADMIN_PSB']);
  const cards=[];
  const add=(condition,page,title,desc,badge,mt='')=>{if(condition)cards.push(`<button class="status-card" style="width:100%;text-align:left;cursor:pointer${mt?`;margin-top:${mt}`:''}" onclick="goPage('${page}')"><div class="status-row"><div><b>${title}</b><div class="muted" style="font-size:11px;margin-top:4px">${desc}</div></div><span class="pill">${badge}</span></div></button>`)};
  add(canPayment,'payments','Pembayaran','Kelola tagihan, bukti pembayaran, dan verifikasi pembayaran.','Stage 7');
  add(canSelection,'selection','Tes','Kelola jadwal tes, peserta, nilai, dan hasil seleksi.','Stage 8','10px');
  add(canAnnouncement,'announcement','Pengumuman','Kelola hasil seleksi dan publikasi pengumuman kepada wali.','Stage 9','10px');
  add(canRereg,'reregistration','Daftar Ulang','Kelola kelengkapan dokumen dan pembayaran bagi santri yang lulus seleksi.','Stage 10','10px');
  add(canReport,'reports','Reporting','Filter dan rekap pendaftar, pembayaran, seleksi, dan Daftar Ulang.','Stage 11','10px');
  add(isMaster,'master','Data','Kelola tahun ajaran, gelombang, jenjang, kelas, dokumen, dan pembayaran.','Kelola','10px');
  add(hasAnyRole(['SUPERADMIN','ADMIN_PSB']),'audit','Audit','Lihat jejak aktivitas penting dan perubahan data aplikasi.','Stage 12','10px');
  add(hasAnyRole(['SUPERADMIN']),'userManagement','Manajemen Pengguna','Lihat semua akun pengguna dan ganti password masing-masing akun.','SUPERADMIN','10px');
  $('content').innerHTML=`<section class="hero"><h2>Lainnya</h2><p>Fungsi tambahan dan pengaturan aplikasi berada di sini.</p></section>${cards.join('')}`;
}

function hasAnyRole(roles){const current=String(state.user?.role||'').split(',').map(x=>x.trim().toUpperCase());return roles.some(r=>current.includes(r));}
async function renderPayments(registrationId,force=false){
  if(!hasAnyRole(['WALI','SUPERADMIN','ADMIN_PSB','KEUANGAN'])){renderMore();return;}
  state.paymentRegistrationId=String(registrationId||state.paymentRegistrationId||state.registrationList?.[0]?.registrationId||'');
  $('content').innerHTML=`<section class="hero"><h2>Pembayaran</h2><p>Tagihan, bukti transfer, dan status verifikasi pembayaran.</p></section><div id="paymentPanel"><div class="empty-state">Memuat data pembayaran...</div></div>`;
  try{
    let r=!force&&state.paymentRegistrationId?state.cache.payments[state.paymentRegistrationId]:null;
    if(!r){r=await server('getPaymentPageData',state.token,state.paymentRegistrationId);if(r?.success&&r.paymentData?.registrationId)state.cache.payments[String(r.paymentData.registrationId)]=r;}
    if(!r?.success){$('paymentPanel').innerHTML=showMessage(r?.message||'Gagal memuat pembayaran.');return}
    state.paymentData=r.paymentData;state.paymentTypes=r.paymentTypes||[];state.registrationList=r.registrations||state.registrationList||[];state.cache.registration=state.registrationList;
    if(!state.registrationList.length){$('paymentPanel').innerHTML='<div class="empty-state">Belum ada pendaftaran.</div>';return}
    state.paymentRegistrationId=String(r.paymentData?.registrationId||state.paymentRegistrationId||state.registrationList[0].registrationId);renderPaymentContent();
  }catch(e){$('paymentPanel').innerHTML=showMessage('Gagal memuat pembayaran.')}
}
function renderPaymentContent(){
 const d=state.paymentData||{}, items=d.bills||[], isWali=hasAnyRole(['WALI']), canManage=hasAnyRole(['SUPERADMIN','ADMIN_PSB','KEUANGAN']);
 const list=items.length?items.map(b=>{const p=b.payment, st=String(b.status||'').toUpperCase();return `<article class="registration-item"><div class="registration-item-top"><div><div class="registration-name">${esc(b.paymentTypeName||'Tagihan')}</div><div class="registration-number">Rp ${Number(b.amount||0).toLocaleString('id-ID')}</div></div><span class="pill">${esc(st==='PAID'?'LUNAS':st==='PAYMENT_REVIEW'?'MENUNGGU VERIFIKASI':p?.status==='REJECTED'?'DITOLAK':'BELUM BAYAR')}</span></div><div class="registration-meta"><span>Jatuh tempo: ${esc(b.dueDate||'-')}</span>${p?.submittedAt?`<span>Dikirim: ${esc(String(p.submittedAt).substring(0,10))}</span>`:''}</div><div class="registration-actions">${p?.proofFileUrl?`<button class="btn btn-secondary" onclick="window.open('${esc(p.proofFileUrl)}','_blank')">Bukti</button>`:''}${isWali&&st!=='PAID'?`<button class="btn btn-primary" onclick="openPaymentUpload('${esc(b.billId)}')">${p?.status==='REJECTED'?'Upload Ulang':'Upload Bukti'}</button>`:''}${canManage&&p&&p.status==='SUBMITTED'?`<button class="btn btn-primary" onclick="verifyPaymentUI('${esc(p.paymentId)}','VERIFIED')">Verifikasi</button><button class="btn btn-danger" onclick="verifyPaymentUI('${esc(p.paymentId)}','REJECTED')">Tolak</button>`:''}</div></article>`}).join(''):'<div class="empty-state">Belum ada tagihan pembayaran.</div>';
 const regOptions=(state.registrationList||[]).map(x=>`<option value="${esc(x.registrationId)}" ${String(x.registrationId)===String(state.paymentRegistrationId)?'selected':''}>${esc(x.candidateName||'-')} · ${esc(x.registrationNumber||'-')}</option>`).join('');
 $('paymentPanel').innerHTML=`<div class="status-card"><div class="status-row"><div><b>Pendaftaran</b><div class="muted" style="font-size:11px;margin-top:4px">Pilih santri untuk melihat tagihan.</div></div><span class="pill">Stage 7</span></div><select class="doc-select" onchange="renderPayments(this.value)">${regOptions}</select></div>${canManage?`<div class="status-card" style="margin-top:10px"><b>Buat Tagihan</b><div class="registration-actions" style="margin-top:10px"><button class="btn btn-primary" onclick="openCreateBill()">Tambah Tagihan</button></div></div>`:''}<div class="registration-list" style="margin-top:10px">${list}</div>`;
}
function openPaymentUpload(billId){document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="paymentUploadModal"><div class="modal"><h3>Upload Bukti Pembayaran</h3><p>File JPG, PNG, WEBP, atau PDF maksimal 5 MB.</p><div id="paymentUploadMsg"></div><div class="upload-box"><input id="paymentFileInput" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onchange="previewPaymentFile()"><div class="file-picker"><button type="button" class="file-picker-btn" onclick="$('paymentFileInput').click()">Pilih File</button><span class="file-picker-name" id="paymentFileName">Belum ada file dipilih</span></div><div class="upload-note" id="paymentFileInfo">JPG, PNG, WEBP, atau PDF · Maks. 5 MB</div></div><div class="modal-actions"><button class="btn btn-primary" onclick="submitPaymentUpload('${esc(billId)}')">Kirim Bukti</button><button class="btn btn-secondary" onclick="closePaymentUpload()">Batal</button></div></div></div>`)}
function previewPaymentFile(){const f=$('paymentFileInput')?.files?.[0],name=$('paymentFileName'),info=$('paymentFileInfo');if(!f)return;if(name){name.textContent=f.name;name.classList.add('selected')}if(info)info.textContent=`${formatFileSize(f.size)} · ${f.type||'Tipe file'}`}
function closePaymentUpload(){$('paymentUploadModal')?.remove()}
async function submitPaymentUpload(billId){const f=$('paymentFileInput')?.files?.[0],msg=$('paymentUploadMsg');if(!f){msg.innerHTML=showMessage('Pilih file bukti pembayaran terlebih dahulu.','warning');return}if(f.size>5*1024*1024){msg.innerHTML=showMessage('Ukuran file maksimal 5 MB.','warning');return}const reader=new FileReader();reader.onload=async()=>{const dataUrl=String(reader.result||''),base64=dataUrl.split(',')[1]||'';loading(true,'Mengirim bukti pembayaran...');try{const r=await server('submitPayment',state.token,{billId,fileName:f.name,mimeType:f.type,fileSize:f.size,base64});if(!r.success){msg.innerHTML=showMessage(r.message||'Bukti pembayaran belum dapat disimpan.');return}closePaymentUpload();showToast(r.message||'Bukti pembayaran berhasil dikirim.','success');delete state.cache.payments[state.paymentRegistrationId];try{await renderPayments(state.paymentRegistrationId,true);}catch(refreshError){/* Data sudah berhasil disimpan; refresh hanya pelengkap. */}}catch(e){if($('paymentUploadMsg'))$('paymentUploadMsg').innerHTML=showMessage('Koneksi terputus setelah pengiriman. Silakan cek status pembayaran.','warning')}finally{loading(false)}};reader.onerror=()=>{if(msg)msg.innerHTML=showMessage('File tidak dapat dibaca. Silakan pilih file lain.','error')};reader.readAsDataURL(f)}
async function verifyPaymentUI(paymentId,status){showConfirm(status==='VERIFIED'?'Verifikasi pembayaran?':'Tolak pembayaran?','Keputusan akan dicatat pada audit log.',async()=>{loading(true,status==='VERIFIED'?'Memverifikasi pembayaran...':'Menolak pembayaran...');try{const r=await server('verifyPayment',state.token,{paymentId,status,note:''});if(r.success){showToast(r.message,'success');await renderPayments(state.paymentRegistrationId)}else showAlert('Belum dapat diproses',r.message||'Operasi gagal.','warning')}catch(e){showAlert('Gagal menyimpan','Terjadi gangguan saat menyimpan.','error')}finally{loading(false)}} ,status==='VERIFIED'?'Verifikasi':'Tolak')}
function openCreateBill(){const types=state.paymentTypes||[];document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="createBillModal"><div class="modal"><h3>Buat Tagihan</h3><div id="createBillMsg"></div><div class="field"><label>Jenis Pembayaran</label><select id="billType">${types.map(x=>`<option value="${esc(x.paymentTypeId)}">${esc(x.name)} · Rp ${Number(x.amount||0).toLocaleString('id-ID')}</option>`).join('')}</select></div><div class="field"><label>Nominal</label><input id="billAmount" type="number" min="1" value="${Number(types[0]?.amount||0)}"></div><div class="field"><label>Jatuh Tempo</label><input id="billDueDate" type="date"></div><div class="modal-actions"><button class="btn btn-primary" onclick="createBillUI()">Simpan</button><button class="btn btn-secondary" onclick="$('createBillModal')?.remove()">Batal</button></div></div></div>`)}
async function createBillUI(){const msg=$('createBillMsg');loading(true,'Membuat tagihan...');try{const r=await server('createBill',state.token,{registrationId:state.paymentRegistrationId,paymentTypeId:$('billType').value,amount:Number($('billAmount').value||0),dueDate:$('billDueDate').value});if(r.success){$('createBillModal')?.remove();showToast(r.message,'success');await renderPayments(state.paymentRegistrationId)}else msg.innerHTML=showMessage(r.message)}catch(e){msg.innerHTML=showMessage('Gagal membuat tagihan.')}finally{loading(false)}}

async function renderMasterData(){
  if(!hasAnyRole(['SUPERADMIN','ADMIN_PSB'])){renderMore();return;}
  $('content').innerHTML=`<section class="hero"><h2>Data</h2><p>Data dasar yang menjadi referensi seluruh workflow PSB.</p></section><div id="masterPanel"><div class="empty-state">Memuat master data...</div></div>`;
  try{
    const warmed=pageDataCached('master');
    if(warmed?.success){
      state.masterDefinitions=warmed.definitions||state.masterDefinitions;
      state.masterItems=warmed.items||[];
      state.masterCache[state.masterKey]=state.masterItems;
      if(warmed.lifecycle)state.academicYearLifecycle=warmed.lifecycle;
    }
    if(!Object.keys(state.masterDefinitions).length){const d=await server('getMasterDefinitions',state.token);if(!d.success){$('masterPanel').innerHTML=showMessage(d.message);return}state.masterDefinitions=d.definitions||{};}
    if(!state.academicYearLifecycle){const lifecycle=await server('getAcademicYearLifecycleData',state.token);if(lifecycle?.success)state.academicYearLifecycle=lifecycle;}
    renderMasterPanel();
    await loadMasterData(state.masterKey,true,false);
  }catch(e){$('masterPanel').innerHTML=showMessage('Gagal memuat master data.');}
}
function renderMasterPanel(){
  const defs=state.masterDefinitions;const keys=Object.keys(defs);
  const tabs=keys.map(k=>`<button class="master-tab ${k===state.masterKey?'active':''}" onclick="switchMaster('${k}')">${esc(defs[k].title)}</button>`).join('');
  const isYear=state.masterKey==='MASTER_TAHUN_AJARAN';
  $('masterPanel').innerHTML=`<div class="master-toolbar">${tabs}</div><div class="master-head"><div><h2>${esc(defs[state.masterKey].title)}</h2><p>${isYear?'Kelola periode aktif, arsip tahun ajaran, dan lihat ringkasan data per periode.':'Data aktif ditampilkan. Data nonaktif tetap tersimpan.'}</p></div><button class="btn btn-primary master-add" onclick="openMasterForm()">+ Tambah</button></div>${isYear?'<div id="academicYearLifecycle"></div>':''}<div id="masterList" class="master-list"><div class="empty-state">Memuat...</div></div>`;
  if(isYear)renderAcademicYearLifecycle();
}
async function switchMaster(key){state.masterKey=key;renderMasterPanel();await loadMasterData(key,true,false)}
async function loadMasterData(key,includeInactive,force=false){
  if(!force && state.masterCache[key]){state.masterItems=state.masterCache[key];renderMasterList();return;}
  $('masterList')&&( $('masterList').innerHTML='<div class="empty-state">Memuat data...</div>');
  const r=await server('getMasterData',state.token,key,!!includeInactive);if(!r.success){if($('masterList'))$('masterList').innerHTML=showMessage(r.message);return}
  state.masterItems=r.items||[];state.masterCache[key]=state.masterItems;
  if(key==='MASTER_TAHUN_AJARAN'){if(!state.academicYearLifecycle){const lc=await server('getAcademicYearLifecycleData',state.token);if(lc?.success)state.academicYearLifecycle=lc;}renderAcademicYearLifecycle();}
  renderMasterList();
}
function masterLabel(key,id){const arr=state.masterCache[key]||[];const item=arr.find(x=>String(x[masterIdField(key)]||'')===String(id||''));return item?item.name:String(id||'-')}
function masterIdField(key){return state.masterDefinitions[key]?.idField||({MASTER_TAHUN_AJARAN:'tahunAjaranId',MASTER_GELOMBANG:'gelombangId',MASTER_JENJANG:'jenjangId',MASTER_KELAS:'kelasId',MASTER_DOKUMEN:'documentTypeId',MASTER_JENIS_PEMBAYARAN:'paymentTypeId'}[key]);}
function formatRupiah(v){const n=Number(v);return isFinite(n)?new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(n):'-'}
function renderAcademicYearLifecycle(){
  const el=$('academicYearLifecycle');if(!el)return;
  const lc=state.academicYearLifecycle||{};
  const items=lc.items||[];
  if(!items.length){el.innerHTML='';return;}
  const active=items.find(x=>x.lifecycleStatus==='ACTIVE');
  const archived=items.filter(x=>x.lifecycleStatus==='ARCHIVED').length;
  const available=items.filter(x=>x.lifecycleStatus==='AVAILABLE').length;
  el.innerHTML=`<div class="status-card" style="margin-bottom:10px"><div class="status-row"><div><b>Tahun Ajaran Aktif</b><div class="muted" style="font-size:11px;margin-top:4px">${esc(active?.name||lc.activeYearName||'Belum ditetapkan')}</div></div><span class="pill ok">${active?'AKTIF':'BELUM ADA'}</span></div><div class="registration-meta" style="margin-top:9px"><span>${items.length} periode tersimpan</span><span>${available} tersedia · ${archived} diarsipkan</span></div><div class="muted" style="margin-top:8px;font-size:11px;line-height:1.45">Mengganti tahun aktif hanya mengubah konteks operasional baru. Data pendaftaran tahun lain tetap tersimpan dan tidak dipindahkan.</div></div>`;
}

function renderMasterList(){
  const el=$('masterList');if(!el)return;
  if(!state.masterItems.length){el.innerHTML='<div class="empty-state">Belum ada data pada master ini.<br>Gunakan tombol <b>+ Tambah</b> untuk membuat data.</div>';return}
  const key=state.masterKey;const def=state.masterDefinitions[key];
  if(key==='MASTER_TAHUN_AJARAN'){
    const life=state.academicYearLifecycle?.items||[];
    const byId={};life.forEach(x=>byId[String(x.tahunAjaranId)]=x);
    el.innerHTML=state.masterItems.map(item=>{
      const info=byId[String(item.tahunAjaranId)]||item;
      const active=info.lifecycleStatus==='ACTIVE';
      const archived=info.lifecycleStatus==='ARCHIVED';
      return `<article class="master-item"><div class="master-item-top"><div><div class="master-item-title">${esc(item.name||'-')}</div><div class="master-meta"><span>${Number(info.registrationCount||0)} pendaftaran · ${Number(info.waveCount||0)} gelombang · ${Number(info.scheduleCount||0)} jadwal tes · ${Number(info.billCount||0)} tagihan</span></div></div><span class="pill ${active?'ok':''}">${active?'Tahun Aktif':archived?'Arsip':'Tersedia'}</span></div><div class="master-actions">${!active?`<button class="btn btn-primary" onclick="activateAcademicYear('${esc(item.tahunAjaranId)}')">Jadikan Aktif</button>`:''}<button class="btn btn-secondary" onclick='openMasterForm(${JSON.stringify(item)})'>Edit</button>${item.isActive&&!active?`<button class="btn btn-danger" onclick="deactivateMaster('${esc(item.tahunAjaranId)}')">Arsipkan</button>`:''}</div></article>`;
    }).join('');
    return;
  }
  el.innerHTML=state.masterItems.map(item=>{
    let meta='';
    if(key==='MASTER_GELOMBANG')meta=`${esc(masterLabel('MASTER_TAHUN_AJARAN',item.tahunAjaranId))} · ${esc(item.startDate||'-')} s/d ${esc(item.endDate||'-')}`;
    else if(key==='MASTER_KELAS')meta=esc(masterLabel('MASTER_JENJANG',item.jenjangId));
    else if(key==='MASTER_DOKUMEN')meta=`${item.required?'Wajib':'Opsional'} · ${esc(item.maxSizeMb||'-')} MB`;
    else if(key==='MASTER_JENIS_PEMBAYARAN')meta=formatRupiah(item.amount);
    else meta=esc(item.name||'-');
    return `<article class="master-item"><div class="master-item-top"><div><div class="master-item-title">${esc(item.name||'-')}</div><div class="master-meta"><span>${meta}</span></div></div><span class="pill ${item.isActive?'ok':''}">${item.isActive?'Aktif':'Nonaktif'}</span></div><div class="master-actions"><button class="btn btn-secondary" onclick='openMasterForm(${JSON.stringify(item)})'>Edit</button>${item.isActive?`<button class="btn btn-danger" onclick="deactivateMaster('${esc(item[def.idField])}')">Nonaktifkan</button>`:''}</div></article>`;
  }).join('');
}
async function openMasterForm(item){
  const key=state.masterKey,def=state.masterDefinitions[key]||{};item=item||{};
  let optionData={};
  for(const f of (def.fields||[])){if(f.optionMaster){if(!state.masterCache[f.optionMaster]){const r=await server('getMasterData',state.token,f.optionMaster,false);if(r.success)state.masterCache[f.optionMaster]=r.items||[]}optionData[f.optionMaster]=state.masterCache[f.optionMaster]||[];}}
  const fields=(def.fields||[]).map(f=>{
    const value=item[f.key]??'';
    if(f.type==='boolean')return `<div class="check-row"><label>${esc(f.label)}</label><input id="mf_${f.key}" type="checkbox" ${value===true||String(value).toUpperCase()==='TRUE'?'checked':''}></div>`;
    if(f.type==='select')return `<div class="field"><label>${esc(f.label)}</label><select id="mf_${f.key}" class="select-field"><option value="">Pilih ${esc(f.label)}</option>${(optionData[f.optionMaster]||[]).map(o=>{const oid=o[state.masterDefinitions[f.optionMaster]?.idField];return `<option value="${esc(oid)}" ${String(oid)===String(value)?'selected':''}>${esc(o.name)}</option>`}).join('')}</select></div>`;
    const inputType=f.type==='number'?'number':f.type==='date'?'date':'text';
    return `<div class="field"><label>${esc(f.label)}${f.required?' *':''}</label><input id="mf_${f.key}" type="${inputType}" value="${esc(value)}" placeholder="${esc(f.placeholder||'')}">${f.placeholder?`<div class="master-form-note">${esc(f.placeholder)}</div>`:''}</div>`;
  }).join('');
  $('app').insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="masterModal"><div class="modal"><h3>${item[def.idField]?'Edit':'Tambah'} ${esc(def.title)}</h3><p>Perubahan master akan divalidasi di server dan dicatat pada audit log.</p><div id="masterModalMsg"></div>${fields}<div class="modal-actions"><button class="btn btn-primary" onclick="saveMasterFromUI('${key}','${esc(item[def.idField]||'')}')">Simpan</button><button class="btn btn-secondary" onclick="closeMasterModal()">Batal</button></div></div></div>`);
}
function closeMasterModal(){$('masterModal')?.remove()}
async function saveMasterFromUI(key,id){
  const def=state.masterDefinitions[key];const payload={};if(id)payload[def.idField]=id;
  (def.fields||[]).forEach(f=>{const el=$('mf_'+f.key);payload[f.key]=f.type==='boolean'?!!el.checked:el.value});
  $('masterModalMsg').innerHTML='';loading(true,'Menyimpan master data...');
  try{const r=await server('saveMasterItem',state.token,key,payload);if(!r.success){$('masterModalMsg').innerHTML=showMessage(r.message);return}closeMasterModal();showToast(r.message,'success');await loadMasterData(key,true,true);}catch(e){$('masterModalMsg').innerHTML=showMessage('Gagal menyimpan master data.')}finally{loading(false)}
}
async function activateAcademicYear(id){
  const item=(state.masterItems||[]).find(x=>String(x.tahunAjaranId)===String(id));
  if(!item)return;
  showConfirm('Jadikan tahun aktif?',`Tahun ${item.name} akan menjadi konteks operasional aktif. Data tahun ajaran lain tetap tersimpan.`,async()=>{
    loading(true,'Mengganti tahun ajaran aktif...');
    try{const r=await server('setActiveAcademicYear',state.token,id);if(r.success){showToast(r.message,'success');state.config.ACTIVE_YEAR=r.activeYearName;state.config.ACTIVE_YEAR_ID=r.activeYearId;state.masterCache={};await loadMasterData('MASTER_TAHUN_AJARAN',true,true);}else showAlert('Tidak dapat mengganti tahun aktif',r.message||'Operasi gagal.','warning');}
    catch(e){showAlert('Gagal mengganti tahun aktif','Terjadi gangguan saat menyimpan perubahan.','error')}
    finally{loading(false)}
  },'Jadikan Aktif');
}
async function deactivateMaster(id){showConfirm('Nonaktifkan data?','Data master tidak dihapus permanen, tetapi tidak akan digunakan pada pilihan aktif.',async()=>{loading(true,'Menonaktifkan...');try{const r=await server('deactivateMasterItem',state.token,state.masterKey,id);if(r.success){showToast(r.message,'success');await loadMasterData(state.masterKey,true,true)}else showAlert('Tidak dapat dinonaktifkan',r.message||'Operasi gagal.','warning')}catch(e){showAlert('Gagal menonaktifkan','Terjadi gangguan saat menyimpan perubahan.','error')}finally{loading(false)}} ,'Nonaktifkan')}
function showToast(text,type='info'){const id='toast_'+Date.now();document.body.insertAdjacentHTML('beforeend',`<div id="${id}" class="message ${type}" style="position:fixed;left:12px;right:12px;bottom:88px;z-index:90;box-shadow:var(--shadow);margin:0">${esc(text)}</div>`);setTimeout(()=>$(id)?.remove(),2200)}

function openChangePassword(){
 $('app').insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="modal"><div class="modal"><h3>Ganti Password</h3><p>Gunakan minimal 6 karakter. Password lama tidak disimpan dalam bentuk asli.</p><div id="modalMsg"></div><div class="field"><label>Password Lama</label><input id="oldPass" type="password" autocomplete="current-password"></div><div class="field"><label>Password Baru</label><input id="newPass" type="password" autocomplete="new-password"></div><div class="field"><label>Ulangi Password Baru</label><input id="newPass2" type="password" autocomplete="new-password"></div><div class="modal-actions"><button class="btn btn-primary" onclick="savePassword()">Simpan Password</button><button class="btn btn-secondary" onclick="closeModal()">Batal</button></div></div></div>`);
}
function closeModal(){$('modal')?.remove()}
async function savePassword(){const a=$('oldPass').value,b=$('newPass').value,c=$('newPass2').value;if(b.length<6){$('modalMsg').innerHTML=showMessage('Password baru minimal 6 karakter.');return}if(b!==c){$('modalMsg').innerHTML=showMessage('Konfirmasi password baru tidak sama.');return}loading(true,'Menyimpan password...');try{const r=await server('changePassword',state.token,a,b);if(r.success){$('modalMsg').innerHTML=showMessage(r.message,'success');setTimeout(closeModal,700)}else $('modalMsg').innerHTML=showMessage(r.message)}catch(e){$('modalMsg').innerHTML=showMessage('Gagal menyimpan password.')}finally{loading(false)}}
async function doLogout(){
  const token=state.token;
  // Tutup sesi di UI segera agar tidak ada dialog/status keluar yang tertinggal.
  state.token='';state.user=null;state.appInitialized=false;state.preloadRunning=false;state.preloadReady=false;state.cache={registration:null,documents:{},payments:{},pages:{}};state.prefetchPromises={};state.pageSnapshots={};state.registrationList=[];state.documentData=null;state.paymentData=null;
  localStorage.removeItem('psb_session');
  try{sessionStorage.clear();}catch(e){}
  loading(false);
  renderPublicHome();
  showToast('Anda sudah keluar dari aplikasi.','success');
  // Invalidasi sesi server tetap dijalankan di belakang layar.
  if(token)server('logout',token).catch(()=>{});
}
function syncViewport(){
  const vv=window.visualViewport;
  document.documentElement.style.setProperty('--app-viewport-width',(vv?.width||window.innerWidth||document.documentElement.clientWidth||0)+'px');
  document.documentElement.style.setProperty('--app-viewport-height',(vv?.height||window.innerHeight||document.documentElement.clientHeight||0)+'px');
}
window.addEventListener('resize',syncViewport,{passive:true});
window.visualViewport?.addEventListener('resize',syncViewport,{passive:true});
syncViewport();
window.addEventListener('load',boot);

function stopChatPolling(){if(state.chatPollTimer){clearInterval(state.chatPollTimer);state.chatPollTimer=null;}}
function startChatPolling(){stopChatPolling();if(state.page!=='chat'||!state.token)return;const seconds=Math.max(5,Number(state.chatData?.pollSeconds||10));state.chatPollInFlight=false;state.chatPollTimer=setInterval(async()=>{if(state.page!=='chat'||document.hidden||state.chatPollInFlight)return;state.chatPollInFlight=true;try{const threadId=state.chatThread?.thread?.threadId||state.chatThread?.threadId;if(threadId&&$('chatConversation')){await loadChatThreadUI(threadId,true);}else{await loadChatDataUI(true);}}finally{state.chatPollInFlight=false;}},seconds*1000);}
async function renderChat(){if(!hasAnyRole(['WALI','SUPERADMIN','ADMIN_PSB'])){renderMore();return;}stopChatPolling();$('content').innerHTML=`<div id="chatPanel"><div class="empty-state">Memuat chat...</div></div>`;state.chatThread=null;await loadChatDataUI(false);startChatPolling();}
async function loadChatDataUI(silent){
  const el=$('chatPanel');
  if(!el||!state.token)return;
  const draftInput=$('chatMessageInput');
  const draftValue=draftInput?String(draftInput.value||''):'';
  const draftStart=draftInput&&typeof draftInput.selectionStart==='number'?draftInput.selectionStart:null;
  const draftEnd=draftInput&&typeof draftInput.selectionEnd==='number'?draftInput.selectionEnd:null;
  try{
    const r=pageDataCached('chat',30000)||await warmPageData('chat',()=>server('getChatPageData',state.token));
    if(!r?.success){if(!silent)el.innerHTML=showMessage(r?.message||'Chat belum dapat dimuat.');return;}
    state.chatData=r;
    const threads=r.threads||[],selectedId=state.chatThread?.threadId||state.chatThread?.thread?.threadId||'',isWali=hasAnyRole(['WALI']);
    const unreadTotal=threads.reduce((n,t)=>n+Number(t.unreadCount||0),0);
    const fabBadge=$('chatFabBadge');
    if(fabBadge){fabBadge.textContent=unreadTotal>99?'99+':String(unreadTotal);fabBadge.style.display=unreadTotal>0?'grid':'none';}

    if(!isWali && !state.chatAdminFilter)state.chatAdminFilter={q:'',status:'ALL',unreadOnly:false};
    const af=state.chatAdminFilter||{q:'',status:'ALL',unreadOnly:false};
    const q=String(af.q||'').trim().toLowerCase();
    const filteredThreads=isWali?threads:threads.filter(t=>{
      const hay=[t.candidateName,t.waliName,t.registrationNumber,t.jenjangName,t.tahunAjaranName,t.gelombangName,t.subject].map(x=>String(x||'').toLowerCase()).join(' ');
      const statusOk=af.status==='ALL'||String(t.status||'OPEN').toUpperCase()===af.status;
      const unreadOk=!af.unreadOnly||Number(t.unreadCount||0)>0;
      return (!q||hay.includes(q))&&statusOk&&unreadOk;
    });
    const openCount=threads.filter(t=>String(t.status||'OPEN').toUpperCase()==='OPEN').length;
    const closedCount=threads.filter(t=>String(t.status||'').toUpperCase()==='CLOSED').length;

    const list=filteredThreads.map(t=>`<button class="chat-list-item ${selectedId===t.threadId?'active':''}" onclick="loadChatThreadUI('${esc(t.threadId)}')"><div class="chat-list-item-title"><b>${esc(isWali?(t.jenjangName||'Pendaftaran'):t.candidateName||'Pendaftar')}</b>${Number(t.unreadCount||0)>0?`<span class="chat-unread">${Number(t.unreadCount)>99?'99+':Number(t.unreadCount)}</span>`:''}</div><div class="chat-list-item-meta">${esc(isWali?(t.registrationNumber||''):((t.waliName||'-')+' · '+(t.registrationNumber||'-')))}<br>${esc(isWali?(t.lastMessageAt?formatNotificationDate(t.lastMessageAt):'Belum ada pesan'):((t.jenjangName||'-')+' · '+(t.lastMessageAt?formatNotificationDate(t.lastMessageAt):'Belum ada pesan')))}</div></button>`).join('');
    const registrations=isWali?(r.registrations||[]).map(x=>`<article class="chat-registration-card"><b>${esc(x.candidateName)}</b><p>${esc(x.registrationNumber||'-')} · ${esc(x.jenjangName||'-')}</p><button class="btn ${x.hasOpenThread?'btn-secondary':'btn-primary'}" onclick="openChatForRegistration('${esc(x.registrationId)}')">${x.hasOpenThread?'Buka Chat':'Mulai Chat'}</button></article>`).join(''):'';
    const waliUnreadText=isWali&&unreadTotal>0?`<div class="chat-wali-unread-summary"><b>${unreadTotal}</b> pesan belum dibaca</div>`:`<div class="chat-wali-unread-summary">Pesan diperbarui otomatis saat Chat terbuka</div>`;
    const adminTools='';

    const left=`<section class="chat-list-card"><div class="chat-list-head"><div><b>${isWali?'Chat Anak':'Inbox Chat Wali'}</b>${isWali?waliUnreadText:`<div class="muted" style="font-size:9px;margin-top:3px">${filteredThreads.length} dari ${threads.length} percakapan</div>`}</div><div style="display:flex;gap:6px"><button class="btn btn-secondary" style="min-height:38px;padding:0 10px" onclick="loadChatDataUI(false)">Refresh</button>${r.canAutomate?`<button class="btn btn-secondary" style="min-height:38px;padding:0 10px" onclick="runChatAutomationUI()">Otomasi</button>`:''}${r.canCleanup?`<button class="btn btn-secondary" style="min-height:38px;padding:0 10px" onclick="cleanupChatRetentionUI()">Bersihkan Lama</button>`:''}</div></div>${isWali?`<div style="padding:11px;border-bottom:1px solid var(--line)"><div class="muted" style="font-size:9px;font-weight:900;text-transform:uppercase;margin-bottom:7px">Pilih pendaftaran</div><div class="chat-registration-grid">${registrations||'<div class="chat-empty">Belum ada pendaftaran.</div>'}</div></div>`:''}<div class="chat-list">${list||'<div class="chat-empty">Tidak ada percakapan yang sesuai filter.</div>'}</div></section>`;
    const right=`<section class="chat-conversation chat-conversation-placeholder"><div class="chat-empty" style="margin:auto">${isWali?'Pilih percakapan untuk membaca dan membalas pesan.':'Pilih percakapan wali untuk membaca dan membalas pesan.'}</div></section>`;
    const adminOpen=!isWali&&selectedId;
    el.innerHTML=`<div class="chat-layout ${isWali?'wali-chat-layout':'admin-chat-layout'}">${left}${right}</div>${state.chatThread?`<div class="chat-modal-backdrop" id="chatModalBackdrop" role="dialog" aria-modal="true" aria-label="Percakapan Chat PSB"><section class="chat-modal" id="chatConversation">${renderChatConversationMarkup(state.chatThread)}</section></div>`:''}`;
    const restored=$('chatMessageInput');
    if(restored&&draftValue){restored.value=draftValue;if(draftStart!==null){try{restored.setSelectionRange(Math.min(draftStart,restored.value.length),Math.min(draftEnd??draftStart,restored.value.length));}catch(e){}}}
  }catch(e){if(!silent)el.innerHTML=showMessage('Gagal memuat Chat. Silakan coba lagi.');}
}
function applyChatAdminFilters(){
  if(hasAnyRole(['WALI']))return;
  state.chatAdminFilter=state.chatAdminFilter||{q:'',status:'ALL',unreadOnly:false};
  const q=$('chatAdminSearch'),s=$('chatAdminStatus');
  state.chatAdminFilter.q=q?String(q.value||''):'';
  state.chatAdminFilter.status=s?String(s.value||'ALL'):'ALL';
  loadChatDataUI(true);
}
function toggleChatAdminUnread(){
  if(hasAnyRole(['WALI']))return;
  state.chatAdminFilter=state.chatAdminFilter||{q:'',status:'ALL',unreadOnly:false};
  state.chatAdminFilter.unreadOnly=!state.chatAdminFilter.unreadOnly;
  loadChatDataUI(true);
}
function backToAdminChatList(){if(hasAnyRole(['WALI']))return;closeChatConversationUI();window.scrollTo({top:0,behavior:'smooth'});}
function chatWhatsAppUrl_(){return 'https://wa.me/6281220003123';}
function openChatWhatsAppUI(){window.open(chatWhatsAppUrl_(),'_blank','noopener,noreferrer');}
function closeChatSendProgress_(){const el=$('chatSendProgress');if(el)el.remove();}
function showChatSendProgress_(){
  closeChatSendProgress_();
  document.body.insertAdjacentHTML('beforeend',`<div class="chat-send-progress" id="chatSendProgress" role="dialog" aria-modal="true" aria-label="Mengirim pesan"><div class="modal"><div class="progress-spinner"></div><div class="progress-title">Mengirim pesan, harap tunggu . . .</div><div class="progress-copy">Pesan sedang diproses. Mohon jangan menekan tombol kirim kembali.</div></div></div>`);
}
function refreshCurrentChatUI(){
  const tid=String(state.chatThread?.thread?.threadId||state.chatThread?.threadId||'').trim();
  if(!tid)return;
  loadChatThreadUI(tid,false,true);
}
function renderChatConversationMarkup(data,options={}){
  const t=data.thread||data,isWali=hasAnyRole(['WALI']),messages=data.messages||[],loadingState=!!options.loading,loadingText=String(options.loadingText||'Memuat percakapan...');
  const status=String(t.status||'OPEN').toUpperCase();
  const bubbles=messages.map(m=>{const legacyAtt=!!String(m.attachmentFileId||'').trim();const text=String(m.message||'')||(legacyAtt?'Lampiran lama':'');return `<div class="chat-bubble ${String(m.senderUserId)===String(state.user?.userId)?'mine':''}"><div class="chat-bubble-text">${esc(text)}</div><div class="chat-bubble-meta">${String(m.senderRole||'').toUpperCase()==='WALI'?'Wali':'Admin PSB'} · ${esc(formatNotificationDate(m.createdAt))}</div></div>`}).join('')||'<div class="chat-empty" style="margin:auto">Belum ada pesan. Silakan mulai percakapan.</div>';
  const messageBody=loadingState?`<div class="chat-loading-state"><span class="chat-loading-spinner"></span><b>${esc(loadingText)}</b><span>Chatbox dan tombol sudah siap. Isi percakapan sedang dimuat.</span></div>`:bubbles;
  const threadId=String(t.threadId||'');
  return `<div class="chat-conversation-head"><div class="chat-head-main"><div><div class="chat-conversation-title">${esc(t.candidateName||t.subject||'Chat PSB')}</div><div class="chat-conversation-sub">${esc(t.registrationNumber||'')} · ${esc(isWali?'Admin PSB':'Wali: '+(t.waliName||'-'))}</div><span class="chat-status-pill ${status==='OPEN'?'open':'closed'}">● ${status==='OPEN'?'Aktif':'Ditutup'}</span></div></div><div class="chat-head-actions"><button class="chat-head-action chat-head-icon-only" type="button" onclick="refreshCurrentChatUI()" title="Refresh percakapan" aria-label="Refresh percakapan"><span class="ico-visual refresh">${ico('refresh')}</span></button><button class="chat-head-action whatsapp" type="button" onclick="openChatWhatsAppUI()" title="Hubungi WhatsApp PSB"><span class="ico-visual whatsapp">${ico('whatsapp')}</span><span>WhatsApp</span></button>${!isWali&&status==='OPEN'?`<button class="chat-head-action chat-head-icon-only chat-head-close" type="button" onclick="closeChatThreadUI('${esc(threadId)}')" title="Tutup percakapan" aria-label="Tutup percakapan"><span class="ico-visual power">${ico('power')}</span></button>`:''}<button class="chat-modal-close" type="button" onclick="closeChatConversationUI()" aria-label="Tutup percakapan" title="Tutup">×</button></div></div><div class="chat-messages" id="chatMessages">${messageBody}</div>${status==='OPEN'?`<div class="chat-compose"><div class="chat-compose-row"><textarea id="chatMessageInput" maxlength="${Number(state.chatData?.maxMessageLength||1000)}" placeholder="Tulis pesan..."></textarea><button id="chatSendBtn" class="btn btn-primary chat-send-btn" onclick="sendChatMessageUI()" aria-label="Kirim pesan" title="Kirim pesan">${ico('send')}</button></div><div class="chat-status-note">Tekan Kirim sekali. Sistem akan memproses pesan dan mencegah pengiriman ganda.</div></div>`:`<div class="chat-status-note" style="padding:10px 12px">Percakapan ini sudah ditutup. Wali dapat membuka percakapan baru bila diperlukan.</div>`}`;
}
function closeChatConversationUI(){state.chatThread=null;document.body.style.overflow='';const bd=$('chatModalBackdrop');if(bd)bd.remove();closeChatSendProgress_();}
function backToWaliChatList(){if(!hasAnyRole(['WALI']))return;closeChatConversationUI();window.scrollTo({top:0,behavior:'smooth'});}
async function openChatForRegistration(registrationId){
  const id=String(registrationId||'').trim();if(!id)return;
  const summary=(state.chatData?.registrations||[]).find(x=>String(x.registrationId)===id)||{};
  const shell={thread:{threadId:String(summary.threadId||''),registrationId:id,subject:'Komunikasi PSB',status:'OPEN',candidateName:summary.candidateName||'Percakapan PSB',registrationNumber:summary.registrationNumber||'-',waliName:state.user?.name||'-'},messages:[]};
  state.chatThread=shell;
  state.chatThreadLoading=true;
  document.body.style.overflow='hidden';
  renderChatModalOnly_({loading:true,loadingText:'Memuat percakapan yang dipilih...'});
  try{
    const r=await server('openChatThread',state.token,id);
    if(r?.success){
      state.chatThread=r;state.chatThreadLoading=false;
      const tid=String(r.thread?.threadId||'');
      if(tid)state.chatThreadCache[tid]={data:r,ts:Date.now()};
      renderChatModalOnly_();
      if(tid)server('markChatThreadRead',state.token,tid).catch(()=>{});
    }else{
      state.chatThreadLoading=false;showAlert('Chat belum dapat dibuka',r?.message||'Pendaftaran tidak ditemukan.','warning');
      closeChatConversationUI();
    }
  }catch(e){
    state.chatThreadLoading=false;showAlert('Gagal membuka chat','Terjadi gangguan saat membuka percakapan.','error');closeChatConversationUI();
  }
}
function renderChatModalOnly_(options={}){
  const panel=$('chatPanel');if(!panel||!state.chatThread)return;
  const old=$('chatModalBackdrop');if(old)old.remove();
  panel.insertAdjacentHTML('beforeend',`<div class="chat-modal-backdrop" id="chatModalBackdrop" role="dialog" aria-modal="true" aria-label="Percakapan Chat PSB"><section class="chat-modal" id="chatConversation">${renderChatConversationMarkup(state.chatThread,options)}</section></div>`);
  const msgEl=$('chatMessages');if(msgEl&&!options.loading)msgEl.scrollTop=msgEl.scrollHeight;
}
function renderChatMessagesMarkup(data){
  const messages=data?.messages||[];
  return messages.map(m=>{const legacyAtt=!!String(m.attachmentFileId||'').trim();const text=String(m.message||'')||(legacyAtt?'Lampiran lama':'');return `<div class="chat-bubble ${String(m.senderUserId)===String(state.user?.userId)?'mine':''}"><div class="chat-bubble-text">${esc(text)}</div><div class="chat-bubble-meta">${String(m.senderRole||'').toUpperCase()==='WALI'?'Wali':'Admin PSB'} · ${esc(formatNotificationDate(m.createdAt))}</div></div>`}).join('')||'<div class="chat-empty" style="margin:auto">Belum ada pesan. Silakan mulai percakapan.</div>';
}
async function loadChatThreadUI(threadId,silent=false,forceRefresh=false){
  if(!threadId)return;
  const tid=String(threadId),cached=state.chatThreadCache?.[tid],fresh=cached&&Date.now()-Number(cached.ts||0)<120000;
  if(!silent&&!forceRefresh&&fresh){
    state.chatThread=cached.data;document.body.style.overflow='hidden';renderChatModalOnly_();
    const msgEl=$('chatMessages');if(msgEl)msgEl.scrollTop=msgEl.scrollHeight;
    return;
  }
  if(!silent){
    const summary=(state.chatData?.threads||[]).find(x=>String(x.threadId)===tid)||{};
    state.chatThread={thread:Object.assign({status:'OPEN'},summary),messages:[]};
    state.chatThreadLoading=true;document.body.style.overflow='hidden';renderChatModalOnly_({loading:true,loadingText:forceRefresh?'Memuat ulang percakapan...':'Memuat percakapan yang dipilih...'});
  }
  try{
    const r=await server('getChatThread',state.token,tid);
    if(!r?.success){if(!silent)showAlert('Chat tidak tersedia',r?.message||'Percakapan tidak dapat dimuat.','warning');return;}
    state.chatThread=r;state.chatThreadLoading=false;state.chatThreadCache[tid]={data:r,ts:Date.now()};
    if(!silent){renderChatModalOnly_();const msgEl=$('chatMessages');if(msgEl)msgEl.scrollTop=msgEl.scrollHeight;}
    else if($('chatConversation')){
      const msgEl=$('chatMessages');if(msgEl){const wasNearBottom=(msgEl.scrollHeight-msgEl.scrollTop-msgEl.clientHeight)<72;msgEl.innerHTML=renderChatMessagesMarkup(r);if(wasNearBottom)msgEl.scrollTop=msgEl.scrollHeight;}
    }
    server('markChatThreadRead',state.token,tid).then(()=>{if(state.chatData?.threads){const t=state.chatData.threads.find(x=>String(x.threadId)===tid);if(t)t.unreadCount=0;}}).catch(()=>{});
  }catch(e){if(!silent)showAlert('Gagal memuat chat','Terjadi gangguan saat membaca percakapan.','error');}
  finally{state.chatThreadLoading=false;}
}
function chatComposerKey(e){return true;}
let chatSendInFlight=false;
async function sendChatMessageUI(){
  const input=$('chatMessageInput'),button=$('chatSendBtn');
  if(!input||chatSendInFlight)return;
  const message=String(input.value||'').trim();
  const threadId=state.chatThread?.thread?.threadId||state.chatThread?.threadId;
  if(!message||!threadId)return;
  chatSendInFlight=true;
  const originalValue=message;
  input.disabled=true;
  if(button){button.disabled=true;button.setAttribute('aria-busy','true');button.dataset.originalHtml=button.innerHTML;button.innerHTML='<span style="font-size:11px;font-weight:900">…</span>';}
  showChatSendProgress_();
  try{
    const r=await server('sendChatMessage',state.token,threadId,originalValue,null);
    closeChatSendProgress_();
    if(r?.success){
      // Server sudah mengonfirmasi pesan tersimpan. Setelah titik ini,
      // kegagalan refresh UI TIDAK boleh diubah menjadi "Pesan gagal".
      input.value='';
      delete state.chatThreadCache[threadId];
      if(state.cache.pages)delete state.cache.pages.chat;
      await showAlert('Pesan terkirim','Pesan berhasil dikirim.','success');
      try{
        await loadChatThreadUI(threadId,true,true);
      }catch(refreshError){
        // Pesan sudah tersimpan; hanya refresh tampilan yang gagal.
        // Biarkan percakapan tetap terbuka tanpa memunculkan false failure.
        console.warn('Chat berhasil dikirim tetapi refresh percakapan gagal:',refreshError);
      }
    }else{
      input.value=originalValue;await showAlert('Pesan gagal',r?.message||'Pesan belum berhasil disimpan. Silakan coba lagi.','error');
    }
  }catch(e){
    closeChatSendProgress_();input.value=originalValue;await showAlert('Pesan gagal','Server tidak memberikan konfirmasi pengiriman. Pesan tidak akan dikirim ulang otomatis.','error');
  }finally{
    chatSendInFlight=false;input.disabled=false;
    if(button){button.disabled=false;button.removeAttribute('aria-busy');button.innerHTML=button.dataset.originalHtml||ico('send');}
  }
}

async function runChatAutomationUI(){showConfirm('Jalankan otomasi chat sekarang?','Sistem akan memeriksa chat yang menunggu balasan, menutup chat yang tidak aktif sesuai konfigurasi, lalu menjalankan cleanup retensi.',async()=>{loading(true,'Menjalankan otomasi chat...');try{const r=await server('runChatAutomationNow',state.token);if(r?.success){showToast(`Otomasi selesai: ${Number(r.reminders||0)} pengingat, ${Number(r.closedThreads||0)} chat ditutup, ${Number(r.cleanup?.deletedThreads||0)} chat lama dibersihkan.`,'success');state.chatThread=null;await loadChatDataUI(false);}else showAlert('Otomasi belum dijalankan',r?.message||'Periksa konfigurasi chat.','warning');}catch(e){showAlert('Otomasi gagal','Terjadi gangguan saat menjalankan otomasi chat.','error')}finally{loading(false)}},'Jalankan');}
async function cleanupChatRetentionUI(){showConfirm('Bersihkan chat lama?','Hanya percakapan yang sudah ditutup dan melewati masa retensi yang akan dihapus dari database.',async()=>{loading(true,'Membersihkan chat lama...');try{const r=await server('cleanupChatRetention',state.token);if(r?.success){showToast(`Cleanup selesai: ${Number(r.deletedMessages||0)} pesan dan ${Number(r.deletedThreads||0)} percakapan dihapus.`,'success');state.chatThread=null;await loadChatDataUI(false);}else showAlert('Cleanup belum dijalankan',r?.message||'Periksa konfigurasi chat.','warning');}catch(e){showAlert('Cleanup gagal','Terjadi gangguan saat membersihkan chat.','error')}finally{loading(false)}},'Bersihkan');}
async function closeChatThreadUI(threadId){showConfirm('Tutup percakapan?','Percakapan akan disimpan sampai melewati masa retensi. Wali dapat membuka percakapan baru.',async()=>{loading(true,'Menutup percakapan...');try{const r=await server('closeChatThread',state.token,threadId);if(r?.success){state.chatThread=null;document.body.style.overflow='';showToast(r.message,'success');await loadChatDataUI(false);}else showAlert('Belum ditutup',r?.message||'Percakapan tidak dapat ditutup.','warning');}catch(e){showAlert('Gagal menutup','Terjadi gangguan saat menutup percakapan.','error')}finally{loading(false)}},'Tutup Chat');}
