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
const state={authFlowId:0,token:localStorage.getItem('psb_session')||'',user:null,config:(()=>{try{return JSON.parse(localStorage.getItem('psb_public_config')||'{}')}catch(e){return {}}})(),page:'home',appInitialized:false,initialData:null,preloadRunning:false,preloadReady:false,cache:{registration:null,documents:{},payments:{},pages:{}},pageSnapshots:{},publicGalleryLoadScheduled:false,paymentRegistrationId:'',paymentData:null,paymentTypes:[],masterKey:'MASTER_TAHUN_AJARAN',masterItems:[],masterDefinitions:{},masterCache:{},academicYearLifecycle:null,auditData:null,registrationList:[],registrationOptions:null,registrationDetail:null,documentRegistrationId:'',documentData:null,selectionData:null,selectionTab:'overview',selectionRegistrationId:'',paymentQueuePage:1,paymentQueue:[],paymentQueueMeta:null,paymentQueueFilters:{search:'',status:''},paymentQueueSearchTimer:null,detailLoadingLocks:{}};
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
  icon:'https://appfathanmubina.github.io/psb-pcbfm/assets/logo-fathan-mubina.png?v=32.6.0',
  logo:'https://appfathanmubina.github.io/psb-pcbfm/assets/logo-fathan-mubina.png?v=32.6.0'
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
  if(!url)return `<span class="app-logo-fallback" aria-hidden="true"></span>`;
  // URL dari CONFIG tetap diprioritaskan. Bila sumber pertama gagal, coba fallback berikutnya;
  // hanya setelah seluruh sumber yang dikonfigurasi gagal tampilkan fallback FM.
  const fallbackJs=fallback ? `if(this.dataset.brandRetry!=='1'){this.dataset.brandRetry='1';this.src='${esc(fallback)}';return;}this.onerror=null;this.style.display='none';this.nextElementSibling.style.display='grid'` : `this.onerror=null;this.style.display='none';this.nextElementSibling.style.display='grid'`;
  return `<img class="app-logo-img ${extraClass}" src="${esc(url)}" alt="${alt}" loading="eager" referrerpolicy="no-referrer" onerror="${fallbackJs}"><span class="app-logo-fallback" aria-hidden="true"></span>`;
}
function applyAppIcon(){
  // Favicon mengikuti APP_ICON_URL dari CONFIG terlebih dahulu; data URL/APP_LOGO hanya fallback.
  const sources=configAssetSources('icon');
  const url=sources[0]||'';
  let link=document.getElementById('appFavicon');
  if(!link){link=document.createElement('link');link.id='appFavicon';link.rel='icon';document.head.appendChild(link);}
  if(url)link.href=url;
}
function hydrateSplashLogo(){
  const splashLogo=$('splashLogo');
  if(!splashLogo)return;
  const src='./assets/logo-fathan-mubina.png?v=32.6.0';
  if(splashLogo.querySelector('img'))return;
  splashLogo.innerHTML='<img class="app-logo-img splash-app-logo" src="'+src+'" alt="PSB Fathan Mubina" loading="eager" fetchpriority="high" decoding="async" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'grid\'"><span class="app-logo-fallback" aria-hidden="true"></span>';
}

function processLabelFor(fn){const labels={validateSession:'Memeriksa sesi akun',login:'Memeriksa akun',registerWali:'Membuat akun Wali',getDashboardPageData:'Memuat Dashboard',getWaliHomeData:'Memuat beranda',getMyRegistrations:'Memuat daftar pendaftaran',getRegistrationFormOptions:'Menyiapkan formulir',getRegistrationDetail:'Memuat detail pendaftaran',saveRegistration:'Menyimpan data pendaftaran',submitRegistration:'Mengirim pendaftaran',getDocumentPageData:'Memuat daftar dokumen',getDocumentOptions:'Memuat dokumen pendaftaran',uploadDocument:'Mengunggah dokumen',submitPayment:'Mengirim bukti pembayaran',getPaymentPageData:'Memuat tagihan pembayaran',finalizeVerification:'Menyimpan hasil verifikasi',verifyDocument:'Memverifikasi dokumen',getVerificationQueue:'Memuat antrean verifikasi'};return labels[fn]||(/^get|^load/i.test(fn)?'Memuat data aplikasi':'Memproses permintaan');}
function processPopupEnsure(){let root=$('psbProcessPopup');if(root)return root;document.body.insertAdjacentHTML('beforeend',`<div class="psb-process-backdrop" id="psbProcessPopup" role="status" aria-live="polite" aria-atomic="true"><div class="psb-process-card"><div class="psb-process-head"><span class="psb-process-spinner" id="psbProcessIcon"></span><div class="psb-process-copy"><b id="psbProcessTitle">Memproses...</b><span id="psbProcessDetail">Menyiapkan permintaan ke server.</span></div><strong id="psbProcessPercent">15%</strong></div><div class="psb-process-track"><span id="psbProcessBar" style="width:15%"></span></div></div></div>`);return $('psbProcessPopup');}
function processPopupUpdate(percent,title,detail,done){const root=processPopupEnsure(),bar=$('psbProcessBar'),pct=$('psbProcessPercent'),heading=$('psbProcessTitle'),copy=$('psbProcessDetail');root.classList.toggle('is-done',done===true);root.classList.toggle('is-error',done==='error');if(bar)bar.style.width=Math.max(0,Math.min(100,Number(percent)||0))+'%';if(pct)pct.textContent=Math.max(0,Math.min(100,Number(percent)||0))+'%';if(heading)heading.textContent=title||'Memproses...';if(copy)copy.textContent=detail||'';}
function processBegin(label){if(!state.appInitialized)return false;const p=window.PSBProcessUI||(window.PSBProcessUI={count:0,timer:null,hideTimer:null,cycle:0,failed:false,message:''});if(p.count===0){p.failed=false;p.message='';}p.count++;p.cycle++;clearTimeout(p.hideTimer);clearTimeout(p.timer);processPopupUpdate(Math.max(15,Number($('psbProcessPercent')?.textContent?.replace('%',''))||15),label||'Memproses...','Menyiapkan permintaan...',false);const cycle=p.cycle;p.timer=setTimeout(()=>{if(p.count>0&&p.cycle===cycle)processPopupUpdate(68,label||'Memproses...','Permintaan telah dikirim. Menunggu konfirmasi server.',false);},450);return true;}
function friendlyErrorMessage(error,fallback='Permintaan belum berhasil diselesaikan.'){
  const code=String(error?.code||'').toUpperCase();
  const raw=String(error?.userMessage||error?.message||error||'').trim();
  if(code==='BRIDGE_TEMPORARILY_BUSY')return 'Server sedang sibuk. Tunggu sebentar, lalu coba kembali.';
  if(code==='BRIDGE_HANDSHAKE_TIMEOUT'||code==='BRIDGE_IFRAME_LOAD_FAILED'||code==='BRIDGE_TOKEN_ISSUE_FAILED')return 'Koneksi ke layanan belum siap. Periksa internet Anda, lalu coba kembali.';
  if(/timeout|timed out|failed to fetch|networkerror|network request failed|koneksi.*terputus/i.test(raw))return 'Respons server belum diterima. Periksa status data sebelum mengirim ulang.';
  if(/^(?:exception|error|typeerror|referenceerror|syntaxerror)\b|\.gs:\d+|\bat\s+[\w.$]+\s*\(|BRIDGE_[A-Z_]+|service invoked too many times/i.test(raw))return fallback;
  return raw||fallback;
}
function processEnd(result,error){const p=window.PSBProcessUI;if(!p||p.count<1)return;const failed=!!error||result?.success===false;if(failed){p.failed=true;p.message=friendlyErrorMessage(error||result?.message,'Server belum dapat menyelesaikan permintaan.');}p.count=Math.max(0,p.count-1);if(p.count>0)return;clearTimeout(p.timer);processPopupUpdate(100,p.failed?'Belum berhasil':'Proses selesai',p.message||(p.failed?'Server belum dapat menyelesaikan permintaan.':'Data berhasil diproses.'),p.failed?'error':true);p.hideTimer=setTimeout(()=>{if(p.count===0)$('psbProcessPopup')?.remove();},p.failed?4000:850);}
function sessionCheckNotice(message,status='loading'){
  let notice=$('sessionCheckNotice');
  if(!notice){document.body.insertAdjacentHTML('beforeend','<div class="session-check-notice" id="sessionCheckNotice" role="status" aria-live="polite"><span class="session-check-spinner"></span><span class="session-check-copy"></span></div>');notice=$('sessionCheckNotice');}
  clearTimeout(window.PSBSessionCheckNoticeTimer);
  notice.className='session-check-notice '+(status==='loading'?'is-loading':status==='success'?'is-success':'is-error');
  const copy=notice.querySelector('.session-check-copy');if(copy)copy.textContent=message;
  if(status!=='loading')window.PSBSessionCheckNoticeTimer=setTimeout(()=>notice.remove(),2600);
}
async function openLogin(){
  // A new login screen supersedes any pending logout notification.
  const authFlowId=state.authFlowId=Number(state.authFlowId||0)+1;
  renderLogin();
  $('app')?.querySelector('.login-wrap')?.classList.add('session-check-open');
  sessionCheckNotice('Mohon tunggu sebentar. Sedang cek sesi . . .','loading');
  const token=String(state.token||localStorage.getItem('psb_session')||'');
  const checkId=state.sessionCheckId=Number(state.sessionCheckId||0)+1;
  state.processSilentDepth=Number(state.processSilentDepth||0)+1;
  try{
    const result=await server('validateSession',token);
    if(state.sessionCheckId!==checkId)return;
    const latestToken=String(state.token||localStorage.getItem('psb_session')||'');
    if(latestToken!==token){clearTimeout(window.PSBSessionCheckNoticeTimer);$('sessionCheckNotice')?.remove();return;}
    if(result?.success){sessionCheckNotice('Sesi aktif. Silakan lanjutkan masuk.','success');}
    else{
      state.token='';state.user=null;localStorage.removeItem('psb_session');sessionStorage.removeItem('psb_current_page');
      sessionCheckNotice('Sesi berakhir. Silakan masuk dengan akun Anda.','error');
    }
  }catch(error){
    sessionCheckNotice('Sesi belum dapat diperiksa. Anda tetap dapat mencoba masuk.','error');
  }finally{state.processSilentDepth=Math.max(0,Number(state.processSilentDepth||1)-1);}
}
function loading(show,text='Memproses...'){const t=$('loadingText');if(t)t.textContent=text;if(!state.appInitialized){$('loading').classList.toggle('hidden',!show);return;}if(show)processBegin(text);else processEnd({success:true,message:'Proses selesai.'});}
async function refreshPublicConfig(){
  try{
    const result=await server('getPublicConfig',true);
    const config=result?.config||{};
    if(Object.keys(config).length){
      state.config=config;
      try{localStorage.setItem('psb_public_config',JSON.stringify(config));}catch(e){}
      applyAppIcon();
      if(!state.user){
        const yearLabel=document.querySelector('.public-brand p');
        if(yearLabel)yearLabel.textContent='Pendaftaran Santri Baru · '+String(state.config.ACTIVE_YEAR||'2027/2028');
      }
    }
    return config;
  }catch(e){console.warn('Public config refresh:',e);return null;}
}
const MUTATING_SERVER_FUNCTIONS=new Set(['registerWali','changePassword','saveRegistration','submitRegistration','uploadDocument','verifyDocument','finalizeVerification','submitPayment','verifyPayment','createBill','createSelectionSchedule','updateSelectionScheduleStatus','addSelectionParticipant','addSelectionParticipantsBulk','updateSelectionParticipantStatus','saveSelectionScore','saveSelectionResult','publishAnnouncement','markNotificationRead','markAllNotificationsRead','finalizeReregistration','openReregistration','saveMasterItem','deactivateMasterItem','setActiveAcademicYear','createManualUser','adminResetUserPassword','runSecurityMaintenance','sendCommunication']);
function invalidatePageSnapshots(){state.pageSnapshots={};}
function server(fn,...args){return new Promise((resolve,reject)=>{const tracked=!!state.appInitialized&&!(Number(state.processSilentDepth||0)>0);if(tracked)processBegin(processLabelFor(fn));let settled=false;const finish=(result,error)=>{if(settled)return;settled=true;if(tracked)processEnd(result,error);};const success=result=>{if(MUTATING_SERVER_FUNCTIONS.has(fn)&&result?.success){invalidatePageDataCache();}finish(result,null);resolve(result);};const failure=error=>{finish(null,error);reject(error);};try{if(window.PSBBridge&&typeof window.PSBBridge.call==='function'){Promise.resolve(window.PSBBridge.call(fn,args)).then(success).catch(failure);return;}if(window.google?.script?.run){window.google.script.run.withSuccessHandler(success).withFailureHandler(failure)[fn](...args);return;}failure(new Error('PSBBridge belum tersedia. Jalankan melalui Apps Script atau konfigurasi API bridge.'));}catch(e){failure(e);}});}
const SNAPSHOT_PAGES=new Set(['home','profile','master','registration','applicants','documents','notifications','announcement','verification','verificationStatus','payments','selection','reregistration','reports','audit','userManagement','more']);
function pageSnapshotKey(page){let key=String(page||'');if(page==='documents')key+=':'+String(state.documentRegistrationId||'');if(page==='payments')key+=':'+String(state.paymentRegistrationId||'');if(page==='selection')key+=':'+String(state.selectionRegistrationId||'');if(page==='master')key+=':'+String(state.masterKey||'');return key;}
function savePageSnapshot(page){if(!SNAPSHOT_PAGES.has(page)||!$('content')?.innerHTML)return;state.pageSnapshots[pageSnapshotKey(page)]={html:$('content').innerHTML,ts:Date.now()};}
function restorePageSnapshot(page){if(!SNAPSHOT_PAGES.has(page))return false;const snap=state.pageSnapshots[pageSnapshotKey(page)];if(!snap)return false;$('content').innerHTML=snap.html;return true;}
function pageDataCached(page,ttl=180000){const x=state.cache.pages?.[page];if(!x||Date.now()-x.ts>ttl){if(x)delete state.cache.pages[page];return null;}return x.data;}
function setPageDataCache(page,data){state.cache.pages[page]={data:data,ts:Date.now()};return data;}
function invalidatePageDataCache(){if(state.cache.pages)state.cache.pages={};}
function invalidateCurrentPageData(){
  invalidatePageSnapshots();
  invalidatePageDataCache();
  state.cache.registration=null;
  state.cache.documents={};
  state.cache.payments={};
  state.registrationList=[];
  state.documentData=null;
  state.paymentData=null;
  state.paymentTypes=[];
  state.selectionData=null;
  state.auditData=null;
  state.masterDefinitions={};
  state.masterItems=[];
  state.masterCache={};
  state.academicYearLifecycle=null;
  state.registrationOptions=null;
  state.registrationDetail=null;
  state.prefetchPromises={};
}
function warmPageData(page,loader){if(!state.prefetchPromises)state.prefetchPromises={};if(state.prefetchPromises[page])return state.prefetchPromises[page];const cached=pageDataCached(page);if(cached)return Promise.resolve(cached);const p=Promise.resolve().then(()=>{state.processSilentDepth=Number(state.processSilentDepth||0)+1;return Promise.resolve().then(loader).finally(()=>{state.processSilentDepth=Math.max(0,Number(state.processSilentDepth||1)-1);});}).then(data=>{if(data?.success!==false)setPageDataCache(page,data);return data;}).catch(()=>null).finally(()=>{delete state.prefetchPromises[page]});state.prefetchPromises[page]=p;return p;}
async function warmNavigationData(){
  if(!state.token||state.page!=='home'||document.visibilityState==='hidden')return;
  // Hanya hangatkan dua menu ringan yang sering dibuka. Data berat seperti
  // laporan, audit, master, dan antrean dimuat saat menu tersebut benar-benar dibuka.
  const tasks=[
    ['announcement',()=>server('getAnnouncementPageData',state.token)],
    ['notifications',()=>server('getNotifications',state.token)]
  ];
  for(const [page,loader] of tasks){
    if(document.visibilityState==='hidden'||state.page!=='home'||!state.token)return;
    if(pageDataCached(page))continue;
    await warmPageData(page,loader);
  }
}
function scheduleWarmNavigationData(){
  if(state.warmNavigationScheduled)return;
  state.warmNavigationScheduled=true;
  const run=()=>{
    state.warmNavigationScheduled=false;
    if(document.visibilityState!=='hidden'&&state.token&&state.page==='home')warmNavigationData();
  };
  if(typeof window.requestIdleCallback==='function'){
    window.requestIdleCallback(deadline=>{
      if(deadline&&!deadline.didTimeout&&deadline.timeRemaining()<80){
        state.warmNavigationScheduled=false;
        scheduleWarmNavigationData();
        return;
      }
      run();
    },{timeout:10000});
  }else{
    setTimeout(run,8000);
  }
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
    send:'<path d="m4 4 16 8-16 8 3.5-8z"/><path d="M7.5 12H20"/>',
    whatsapp:'<path d="M20.2 11.4a8.1 8.1 0 0 1-11.8 7.1L4 20l1.6-4.2A8.1 8.1 0 1 1 20.2 11.4Z"/><path d="M9.2 8.8c.2-.4.4-.4.7-.4h.5c.2 0 .4.1.5.4l.7 1.7c.1.2 0 .4-.1.6l-.6.7c-.1.1-.1.3 0 .5.4.7 1 1.2 1.7 1.6.2.1.4.1.5-.1l.7-.8c.1-.2.3-.2.5-.1l1.6.8c.2.1.3.3.2.5-.1.5-.3 1-.8 1.2-.5.3-1.1.4-1.6.2-1.1-.3-2.5-1.1-3.6-2.2-1.1-1.1-1.9-2.4-2.2-3.5-.2-.5-.1-1.1.2-1.6.2-.3.5-.5.9-.5Z"/>'
  };
  return `<span class="ico-visual ${name}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${m[name]||m.info}</svg></span>`;
}
function showAlert(title,text,type='info',confirmText='Tutup',cancelText=''){const id='alert_'+Date.now();const icon=type==='success'?'check':type==='warning'?'warning':type==='error'?'error':'info';document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop alert-modal" id="${id}"><div class="modal"><div class="alert-icon ${type}">${ico(icon)}</div><h3 class="alert-title">${esc(title)}</h3><p class="alert-text">${esc(text)}</p><div class="alert-actions"><button class="btn btn-primary" onclick="closeAlert('${id}')">${esc(confirmText)}</button>${cancelText?`<button class="btn btn-secondary" onclick="closeAlert('${id}')">${esc(cancelText)}</button>`:''}</div></div></div>`)}
function showConfirm(title,text,onConfirm,confirmText='Lanjutkan'){const id='confirm_'+Date.now();window[id]=()=>{closeAlert(id);onConfirm()};document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop alert-modal" id="${id}"><div class="modal"><div class="alert-icon warning">${ico('warning')}</div><h3 class="alert-title">${esc(title)}</h3><p class="alert-text">${esc(text)}</p><div class="alert-actions"><button class="btn btn-primary" onclick="window['${id}']()">${esc(confirmText)}</button><button class="btn btn-secondary" onclick="closeAlert('${id}')">Batal</button></div></div></div>`)}
function closeAlert(id){delete window[id];document.getElementById(id)?.remove()}

function bootProgress(show,text='Menyiapkan aplikasi...',done=false){const el=$('bootProgress'),tx=$('bootProgressText');if(!el)return;if(!show){el.classList.add('hidden');el.classList.remove('done');return}if(tx)tx.textContent=text;el.classList.remove('hidden','done');if(done){el.classList.add('done');setTimeout(()=>el.classList.add('hidden'),650)}}
function initializeAfterLogin(){
  // Login success must not wait for unrelated page preloads. The active page
  // loads its own data; navigation data is warmed later during browser idle.
  state.appInitialized=true;
  state.preloadRunning=false;
  state.preloadReady=true;
  bootProgress(false);
}
function scheduleWarmNavigationData(){
  if(state.warmNavigationScheduled)return;
  state.warmNavigationScheduled=true;
  const run=()=>{
    state.warmNavigationScheduled=false;
    if(document.visibilityState!=='hidden'&&state.token&&state.page==='home')warmNavigationData();
  };
  if(typeof window.requestIdleCallback==='function'){
    window.requestIdleCallback(deadline=>{
      if(deadline&&!deadline.didTimeout&&deadline.timeRemaining()<80){
        state.warmNavigationScheduled=false;
        scheduleWarmNavigationData();
        return;
      }
      run();
    },{timeout:10000});
  }else{
    setTimeout(run,8000);
  }
}
async function boot(){
  // Never restore or validate a saved session during the public first-page load.
  renderPublicHome();
  if(window.PSBBridge&&typeof window.PSBBridge.prepare==='function'){
    window.PSBBridge.prepare().catch(error=>console.warn('PSB bridge warm-up skipped:',error));
  }
  refreshPublicConfig().catch(()=>{});
}
function renderPublicHome(message=''){
  const year=esc(state.config.ACTIVE_YEAR||'2027/2028');
  $('app').innerHTML=`<div class="public-wrap"><div class="public-shell">
    <header class="public-top"><div class="logo">${appLogoMarkup()}</div><div class="public-brand"><h1>PSB Fathan Mubina</h1><p>Pendaftaran Santri Baru · ${year}</p></div><button class="public-login" onclick="openLogin()">Masuk</button></header>
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
  // Keep gallery image requests off the initial critical path. Images are served
  // directly by GitHub Pages; no Apps Script or Google Drive request is made.
  if(!state.publicGalleryLoadScheduled){
    state.publicGalleryLoadScheduled=true;
    const loadGalleryWhenIdle=()=>{
      state.publicGalleryLoadScheduled=false;
      if(document.getElementById('galleryTrack'))loadPublicGallery();
    };
    if(typeof window.requestIdleCallback==='function'){
      window.requestIdleCallback(loadGalleryWhenIdle,{timeout:3000});
    }else{
      setTimeout(loadGalleryWhenIdle,1200);
    }
  }
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
const PSB_PUBLIC_GALLERY_BASE_URL = 'https://appfathanmubina.github.io/psb-pcbfm/gallery/';
const PSB_PUBLIC_GALLERY_FILES = Object.freeze([
  "0. Abby KH. Chairuman Kamal, Lc.M.jpg",
  "1. Gerbang Depan.jpg",
  "2. Masjid Asmawi Jasim.jpg",
  "3. Ruang Kelas Putra.jpg",
  "4. Ruang Kelas Putri.jpg",
  "5. Gor Putra.jpg",
  "7. Masjid Putra.jpg",
  "8. Masjid Putri.jpg",
  "9. Asrama Putra.jpg",
  "10. Asrama Putri.jpg",
  "11. Kolam Renang Putra.jpg",
  "12. Kolam Renang Putri.jpg",
  "13. Pilar 9 FM.jpg",
  "14. Kelok Cipalayangan FM.jpg",
  "15. Kali Cipalayangan.jpg",
  "16. Outbound.jpg",
  "17. Flyfox.jpg",
  "18. Barisan Upacara Putra.jpg",
  "19. Barisan Upacara Putri.jpg",
  "20. Barisan Dewan Asatidz.jpg",
  "21. Barisan Dewan Asatidzah.jpg"
]);

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
function loadPublicGallery(){
  const items=PSB_PUBLIC_GALLERY_FILES.map(file=>({
    name:file.replace(/^\d+\.\s*/, '').replace(/\.jpe?g$/i, ''),
    url:PSB_PUBLIC_GALLERY_BASE_URL+encodeURIComponent(file)
  }));
  renderPublicGallery(items);
}

function openRegistrationEntry(){
  if(state.user && hasAnyRole(['WALI','SUPERADMIN','ADMIN_PSB'])){state.page='registration';renderApp();goPage('registration');return;}
  renderLogin('Silakan masuk terlebih dahulu untuk membuka Pendaftaran.');
}
function renderPublicInfo(title,desc){
  $('app').innerHTML=`<div class="public-wrap"><div class="public-shell"><header class="public-top"><div class="logo">${appLogoMarkup()}</div><div class="public-brand"><h1>PSB Fathan Mubina</h1><p>${esc(state.config.ACTIVE_YEAR||'2027/2028')}</p></div><button class="public-login" onclick="openLogin()">Masuk</button></header><section class="hero"><h2>${esc(title)}</h2><p>${esc(desc)}</p></section><button class="btn btn-secondary" onclick="renderPublicHome()">Kembali ke Beranda</button></div></div>`;
}
function renderLogin(error='',identifier=''){
  $('app').innerHTML=`<div class="login-wrap"><div class="login-card">
    <div class="logo login-logo center">${appLogoMarkup()}</div><div class="center"><h1 class="login-title">PSB Fathan Mubina</h1><div class="login-sub">Pendaftaran Santri Baru · ${esc(state.config.ACTIVE_YEAR||'2027/2028')}</div></div>
    ${error?showMessage(error):''}<form id="loginForm" autocomplete="on" onsubmit="submitLogin(event)">
      <div class="field"><label>Username, No. HP atau Email</label><input id="identifier" name="username" autocomplete="username" inputmode="text" placeholder="Masukkan username, nomor HP, atau email" value="${esc(identifier||(localStorage.getItem('psb_remember_me')==='true'?localStorage.getItem('psb_remembered_identifier'):'')||'')}" required></div>
      <div class="field"><label>Password</label><div class="input-wrap"><input id="password" name="password" type="password" autocomplete="current-password" placeholder="Masukkan password" required><button class="toggle" type="button" onclick="togglePassword()">Lihat</button></div></div>
      <label for="rememberMe" style="display:flex;align-items:center;gap:8px;font-size:13px;margin:8px 0 16px;color:var(--muted);cursor:pointer"><input id="rememberMe" type="checkbox" style="width:16px;height:16px;margin:0;accent-color:var(--purple)" ${localStorage.getItem('psb_remember_me')==='true'?'checked':''} onchange="if(!this.checked){localStorage.removeItem('psb_remember_me');localStorage.removeItem('psb_remembered_identifier')}"> Ingat saya di perangkat ini</label>
      <button class="btn btn-primary" id="loginBtn">Masuk</button>
    </form>
    <div class="center" style="margin-top:18px"><span class="muted">Belum punya akun?</span> <button type="button" class="link-btn" onclick="renderRegisterWali()">Daftar sebagai Wali</button></div>
    <div class="center" style="margin-top:10px"><button type="button" class="link-btn muted" onclick="renderPublicHome()">← Kembali ke Beranda</button></div>
  </div></div>`;
  restoreRememberedLogin();
}
function renderRegisterWali(error=''){
  $('app').innerHTML=`<div class="login-wrap"><div class="login-card">
    <div class="logo login-logo center">${appLogoMarkup()}</div><div class="center"><h1 class="login-title">Daftar Akun Wali</h1><div class="login-sub">PSB Fathan Mubina · ${esc(state.config.ACTIVE_YEAR||'2027/2028')}</div></div>
    ${error?showMessage(error):''}
    <form onsubmit="submitRegisterWali(event)">
      <div class="field"><label>Nama Lengkap *</label><input id="regName" autocomplete="name" placeholder="Nama ayah / ibu / wali" required maxlength="120"></div>
      <div class="field"><label>No. HP (opsional)</label><input id="regPhone" autocomplete="tel" inputmode="tel" placeholder="08xxxxxxxxxx"></div>
      <div class="field"><label>Email (opsional)</label><input id="regEmail" type="email" autocomplete="email" placeholder="nama@email.com"></div>
      <div class="muted" style="font-size:12px;margin:-2px 0 12px">Isi minimal salah satu: No. HP atau email. Tidak ada kode verifikasi email.</div>
      <div class="field"><label>Password *</label><div class="input-wrap"><input id="regPassword" type="password" autocomplete="new-password" placeholder="Minimal 6 karakter" required><button class="toggle" type="button" onclick="toggleRegisterPassword('regPassword',this)">Lihat</button></div></div>
      <div class="field"><label>Konfirmasi Password *</label><input id="regConfirmPassword" type="password" autocomplete="new-password" placeholder="Ulangi password" required></div>
      <button class="btn btn-primary" id="registerBtn">Daftar & Masuk</button>
    </form>
    <div class="center" style="margin-top:14px"><button type="button" class="link-btn" onclick="openLogin()">Sudah punya akun? Masuk</button></div>
  </div></div>`;
}
function toggleRegisterPassword(id,button){const i=$(id);i.type=i.type==='password'?'text':'password';button.textContent=i.type==='password'?'Lihat':'Sembunyikan'}
async function submitRegisterWali(e){
  e.preventDefault();
  const phone=String($('regPhone').value||'').trim();
  const email=String($('regEmail').value||'').trim();
  if(!phone&&!email){renderRegisterWali('Isi minimal salah satu: nomor HP atau email agar dapat digunakan untuk login.');return;}
  const btn=$('registerBtn');btn.disabled=true;btn.textContent='Membuat akun...';loading(true,'Membuat akun Wali...');
  try{
    const r=await server('registerWali',{name:$('regName').value,phone:phone,email:email,password:$('regPassword').value,confirmPassword:$('regConfirmPassword').value});
    if(r.success){
      state.token=r.sessionToken;state.user=r.user;state.appInitialized=false;state.preloadRunning=false;state.preloadReady=false;state.initialData=null;
      localStorage.setItem('psb_session',state.token);
      showToast('Akun berhasil dibuat. Selamat datang!','success');
      renderApp();setTimeout(()=>goPage('registration'),0);
    }else renderRegisterWali(r.message);
  }catch(err){renderRegisterWali('Pendaftaran belum dapat diproses. Periksa koneksi dan coba kembali.');}
  finally{loading(false);}
}
function togglePassword(){const i=$('password');const b=i.nextElementSibling;i.type=i.type==='password'?'text':'password';b.textContent=i.type==='password'?'Lihat':'Sembunyikan'}
async function restoreRememberedLogin(){
  if(localStorage.getItem('psb_remember_me')!=='true')return;
  const identifierInput=$('identifier');
  const passwordInput=$('password');
  if(identifierInput&&!identifierInput.value)identifierInput.value=localStorage.getItem('psb_remembered_identifier')||'';
  if(typeof window.PasswordCredential!=='function'||!navigator.credentials||typeof navigator.credentials.get!=='function')return;
  try{
    const credential=await navigator.credentials.get({password:true,mediation:'optional'});
    if(!credential)return;
    if(identifierInput&&!identifierInput.value)identifierInput.value=String(credential.id||'');
    if(passwordInput&&!passwordInput.value)passwordInput.value=String(credential.password||'');
  }catch(error){}
}
function rememberLoginCredentials(identifier,password){
  const remember=$('rememberMe')?.checked===true;
  if(!remember){
    localStorage.removeItem('psb_remember_me');
    localStorage.removeItem('psb_remembered_identifier');
    return;
  }
  localStorage.setItem('psb_remember_me','true');
  localStorage.setItem('psb_remembered_identifier',String(identifier||''));
  if(typeof window.PasswordCredential!=='function'||!navigator.credentials||typeof navigator.credentials.store!=='function')return;
  try{
    const credential=new window.PasswordCredential({id:String(identifier||''),password:String(password||'')});
    navigator.credentials.store(credential).catch(()=>{});
  }catch(error){}
}
async function submitLogin(e){
  e.preventDefault();
  const authFlowId=state.authFlowId=Number(state.authFlowId||0)+1;
  const identifier=String($('identifier')?.value||'').trim();
  const password=String($('password')?.value||'');
  const btn=$('loginBtn');
  if(!identifier||!password)return;
  if($('rememberMe')?.checked!==true){localStorage.removeItem('psb_remember_me');localStorage.removeItem('psb_remembered_identifier');}
  if(btn){btn.disabled=true;btn.textContent='Memeriksa...';}
  loading(true,'Memeriksa akun...');
  try{
    const r=await server('login',identifier,password);
    if(state.authFlowId!==authFlowId)return;
    if(r?.success){
      rememberLoginCredentials(identifier,password);
      state.token=r.sessionToken;
      state.user=r.user;
      state.appInitialized=false;
      state.preloadRunning=false;
      state.preloadReady=false;
      state.initialData=null;
      state.cache={registration:null,documents:{},payments:{},pages:{}};
      state.prefetchPromises={};
      state.pageSnapshots={};
      state.registrationList=[];
      state.documentData=null;
      state.paymentData=null;
      localStorage.setItem('psb_session',state.token);
      // Aktifkan pelacakan sebelum Beranda dirender agar RPC data awal
      // ikut menahan popup sampai renderer selesai memperbarui tampilan.
      initializeAfterLogin();
      $('loading')?.classList.add('hidden');
      renderApp();
      // Audit/last-login bookkeeping tetap best-effort dan tidak menahan popup Beranda.
      state.processSilentDepth=Number(state.processSilentDepth||0)+1;
      const finalizeLoginTask=server('finalizeLogin',state.token);
      state.processSilentDepth=Math.max(0,Number(state.processSilentDepth||1)-1);
      finalizeLoginTask.catch(()=>{});
      if(r.mustChangePassword)setTimeout(openChangePassword,200);
    }else{
      renderLogin(r?.message||'Login gagal. Periksa kembali identitas dan password.',identifier);
    }
  }catch(err){
    if(state.authFlowId!==authFlowId)return;
    console.error('PSB login transport error:',err);
    renderLogin('Koneksi ke server gagal: '+String(err?.message||'Periksa koneksi internet dan deployment Apps Script.'),identifier);
  }finally{
    if(!state.appInitialized)loading(false);
  }
}
function buildRoleNav(){
  const wali=hasAnyRole(['WALI']);
  if(wali)return [
    ['home','Beranda','home'],['registration','Pendaftaran','clipboard'],['payments','Pembayaran','wallet'],['documents','Dokumen','file'],['selection','Tes','grad'],['announcement','Pengumuman','bell']
  ];

  const admin=hasAnyRole(['SUPERADMIN','ADMIN_PSB']);
  if(admin){
    const items=[
      ['home','Dashboard','home'],['applicants','Pendaftar','users'],['verification','Verifikasi','check'],['payments','Pembayaran','wallet'],['selection','Tes','grad'],['announcement','Pengumuman','megaphone'],['reregistration','Daftar Ulang','refresh'],['reports','Laporan','chart'],['master','Data','database']
    ];
    items.push(['audit','Audit','shield']);
    if(hasAnyRole(['SUPERADMIN']))items.push(['userManagement','Manajemen Pengguna','users']);
    return items;
  }

  // Staff menus follow the same role gates as their page renderers.
  // Build a union so accounts with multiple operational roles see only
  // modules that at least one of their roles is authorized to open.
  const items=[['home','Dashboard','home']];
  if(hasAnyRole(['VERIFIKATOR']))items.push(['applicants','Pendaftar','users'],['verification','Verifikasi','check']);
  if(hasAnyRole(['KEUANGAN']))items.push(['payments','Pembayaran','wallet']);
  if(hasAnyRole(['SELEKSI','VERIFIKATOR']))items.push(['selection','Tes','grad'],['announcement','Pengumuman','megaphone']);
  if(hasAnyRole(['VERIFIKATOR','KEUANGAN']))items.push(['reregistration','Daftar Ulang','refresh']);
  if(hasAnyRole(['VERIFIKATOR','SELEKSI','KEUANGAN']))items.push(['reports','Laporan','chart']);
  return items;
}
function buildMobileNav(){
  const all=buildRoleNav();
  const role=hasAnyRole(['SUPERADMIN'])?'SUPERADMIN':hasAnyRole(['ADMIN_PSB'])?'ADMIN_PSB':hasAnyRole(['WALI'])?'WALI':'';
  if(role==='WALI'){
    const waliIds=['home','registration','payments','documents','announcement'];
    return waliIds.map(id=>all.find(x=>x[0]===id)).filter(Boolean);
  }
  if(all.length<=5)return all;
  const preferred={
    SUPERADMIN:['home','applicants','reports','announcement'],
    ADMIN_PSB:['home','applicants','reports','announcement']
  };
  const ids=preferred[role]||all.slice(0,4).map(x=>x[0]);
  const direct=ids.map(id=>all.find(x=>x[0]===id)).filter(Boolean);
  return [...direct,['more','Lainnya','settings']];
}
function navButtonsHtml(items,side){return items.map((x,i)=>`<button class="${side?'side-btn':'nav-btn'} ${i===0?'active':''}" id="${side?'side':'nav'}-${x[0]}" onclick="goPage('${x[0]}')"><span class="${side?'side-icon':'nav-icon'}">${ico(x[2])}</span><span>${x[1]}</span></button>`).join('');}
function renderApp(options={}){
  document.body.classList.remove('sidebar-collapsed');
  const sideItems=buildRoleNav();
  const items=buildMobileNav();
  const wali=hasAnyRole(['WALI']);
  const roleLabel=String(state.user?.role||'').split(',').map(role=>{const key=role.trim().toUpperCase();return ({SUPERADMIN:'SUPERADMIN',ADMIN_PSB:'ADMIN PSB',VERIFIKATOR:'VERIFIKATOR',SELEKSI:'SELEKSI',KEUANGAN:'KEUANGAN',WALI:'WALI'})[key]||key;}).filter(Boolean).join(' · ')||'PENGGUNA';
  const nav=navButtonsHtml(items,false);
  const side=navButtonsHtml(sideItems,true);
  $('app').innerHTML=`<aside class="sidebar"><div class="sidebar-nav">${side}</div><div class="sidebar-footer"><button class="side-user side-user-button" onclick="goPage('profile')" title="Buka profil"><div>${ico('user')}</div><div style="min-width:0"><div class="side-user-name">${esc(state.user.name)}</div><div class="side-user-role">${roleLabel}</div></div></button></div></aside><div class="topbar"><div class="brand"><button class="sidebar-toggle" type="button" title="Tampilkan/sembunyikan menu" aria-label="Tampilkan/sembunyikan menu" onclick="toggleSidebar()">${ico('menu')}</button><div class="logo">${appLogoMarkup()}</div><div class="brand-copy"><h1>PSB Fathan Mubina</h1><p>${esc(state.config.ACTIVE_YEAR||'2027/2028')}</p></div><div class="top-actions"><button class="header-action" id="reloadDataBtn" type="button" title="Reload data" aria-label="Reload data" onclick="reloadCurrentData()">${ico('refresh')}</button><button class="header-action notification-bell-wrap" title="Notifikasi" aria-label="Notifikasi" onclick="toggleNotificationPopup()" aria-haspopup="dialog" aria-controls="notificationPopupBackdrop" aria-expanded="false">${ico('bell')}<span id="notificationBadge" class="notification-badge" style="display:none">0</span></button><button class="user-chip" type="button" title="Profil" onclick="goPage('profile')"><span class="user-name">${esc(state.user.name)}</span><span class="user-icon">${ico('user')}</span></button></div></div></div><main class="shell" id="content"></main><nav class="bottom-nav"><div class="nav-inner ${wali?'wali-nav':''}" style="grid-template-columns:repeat(${items.length},minmax(0,1fr))">${nav}</div></nav>`;
  if(options.deferInitialPage!==true)goPage('home');
  updateNotificationBadge();
}
async function reloadCurrentData(){
  if(!state.token || state.reloadingData)return;
  state.reloadingData=true;
  const currentPage=state.page||'home';
  const btn=$('reloadDataBtn');
  if(btn){btn.disabled=true;btn.classList.add('is-reloading');btn.title='Memuat ulang data...';}
  try{
    invalidateCurrentPageData();
    state.initialData=null;
    state.preloadReady=false;
    const pub=await server('getPublicConfig',true);
    state.config=pub?.config||state.config||{};
    applyAppIcon();
    const yearLabel=document.querySelector('.brand-copy p');
    if(yearLabel)yearLabel.textContent=String(state.config.ACTIVE_YEAR||'2027/2028');
    document.querySelectorAll('.user-name,.side-user-name').forEach(el=>{el.textContent=state.user?.name||el.textContent;});
    // Jangan membangun ulang seluruh shell/header. Paksa hanya menu aktif
    // melewati snapshot dan cache agar renderer mengambil data baru dari server.
    if(state.page===currentPage)await goPage(currentPage,{forceReload:true});
    showToast('Data berhasil dimuat ulang.','success');
  }catch(e){
    showToast('Gagal memuat ulang data. Silakan coba lagi.','error');
  }finally{
    state.reloadingData=false;
    const activeBtn=$('reloadDataBtn');
    if(activeBtn){activeBtn.disabled=false;activeBtn.classList.remove('is-reloading');activeBtn.title='Reload data';}
  }
}
function toggleSidebar(){
  if(!document.body.classList.contains('desktop-device'))return;
  document.body.classList.toggle('sidebar-collapsed');
}
async function goPage(page,options={}){
  const forceReload=options===true||options?.forceReload===true;
  if(forceReload)invalidatePageSnapshots();
  if(!forceReload&&state.page===page){
    savePageSnapshot(page);
    if(restorePageSnapshot(page)){window.scrollTo({top:0,behavior:'auto'});return;}
  }
  if(state.page&&!forceReload&&!state.reloadingData)savePageSnapshot(state.page);
  state.page=page;
  try{sessionStorage.setItem('psb_current_page',page);}catch(e){}
  document.querySelectorAll('.nav-btn,.side-btn').forEach(x=>x.classList.remove('active'));
  const mobileNavPage=hasAnyRole(['WALI'])?(page==='verificationStatus'?'home':['selection','reregistration'].includes(page)?'announcement':page):page;
  $('nav-'+mobileNavPage)?.classList.add('active');$('side-'+page)?.classList.add('active');
  if(!forceReload&&restorePageSnapshot(page)){window.scrollTo({top:0,behavior:'auto'});return;}
  if(page==='home')await renderHome();
  else if(page==='verificationStatus')await renderWaliVerificationStatus();
  else if(page==='profile')renderProfile();
  else if(page==='master')await renderMasterData(forceReload);
  else if(page==='registration')await renderRegistrationHub(forceReload);
  else if(page==='applicants')await renderApplicants(forceReload);
  else if(page==='documents')await renderDocuments(state.documentRegistrationId,forceReload);
  else if(page==='notifications')await renderNotifications(forceReload);
  else if(page==='announcement')await renderAnnouncements(forceReload);
  else if(page==='verification')await renderVerification(forceReload);
  else if(page==='payments')await renderPayments(state.paymentRegistrationId,forceReload);
  else if(page==='selection')await renderSelection(forceReload);
  else if(page==='reregistration')await renderReregistration(forceReload);
  else if(page==='reports')await renderReports(forceReload);
  else if(page==='audit')await renderAudit(forceReload);
  else if(page==='userManagement')await renderUserManagementPage();
  else renderMore();
  window.scrollTo({top:0,behavior:'auto'});
}
function dashboardLocalKey(){return 'psb_dashboard_'+String(state.user?.userId||'guest')+'_'+String(state.config?.ACTIVE_YEAR||'2027/2028');}
function readDashboardLocal(){try{const raw=sessionStorage.getItem(dashboardLocalKey());if(!raw)return null;const x=JSON.parse(raw);if(!x||Date.now()-Number(x.ts||0)>120000)return null;return x.data||null;}catch(e){return null}}
function writeDashboardLocal(data){try{sessionStorage.setItem(dashboardLocalKey(),JSON.stringify({ts:Date.now(),data:data}));}catch(e){}}

async function renderHome(){
  const wali=hasAnyRole(['WALI']);
  const admin=hasAnyRole(['SUPERADMIN','ADMIN_PSB','VERIFIKATOR']);
  if(!wali){
    $('content').innerHTML=`<section class="hero"><div style="display:flex;gap:10px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap"><div><h2>Dashboard</h2><p>Ringkasan operasional PSB periode ${esc(state.config.ACTIVE_YEAR||'2027/2028')}.</p></div></div></section><div id="dashboardPanel"><div class="empty-state">Memuat ringkasan terbaru...</div></div>`;
    try{const r=await server('getDashboardPageData',state.token);if(!r.success){$('dashboardPanel').innerHTML=showMessage(r.message||'Dashboard belum dapat dimuat.');return;}state.cache.pages.dashboard={data:r,ts:Date.now()};renderAdminDashboard(r);scheduleWarmNavigationData();}catch(e){$('dashboardPanel').innerHTML=showMessage('Gagal memuat dashboard. Silakan coba kembali.');}
    return;
  }
  const maintenanceBanner=String(state.config.MAINTENANCE_MODE||'').toUpperCase()==='TRUE'?`<div class="status-card" style="margin-bottom:12px"><div class="status-row"><div><b>Sistem dalam pemeliharaan</b><div class="muted" style="font-size:10px;margin-top:3px">Akses informasi tetap tersedia, tetapi tindakan perubahan data sementara dinonaktifkan.</div></div><span class="pill warning">Maintenance</span></div></div>`:''; $('content').innerHTML=`<section class="hero"><h2>Selamat datang, ${esc(state.user.name)}</h2><p>Pantau tahapan setiap pendaftaran anak dan lanjutkan langkah yang masih harus dilakukan.</p></section>${maintenanceBanner}<div id="waliHomeFlow"><div class="empty-state">Memuat alur pendaftaran...</div></div>`;
  try{
    const r=await server('getWaliHomeData',state.token);
    if(!r.success){$('waliHomeFlow').innerHTML=showMessage(r.message||'Alur pendaftaran belum dapat dimuat.');return}
    renderWaliHomeFlow(r);scheduleWarmNavigationData();
  }catch(e){$('waliHomeFlow').innerHTML=showMessage('Gagal memuat alur pendaftaran. Silakan coba lagi.');}
}
function waliFlowAction(key,id){
  if(key==='registration') goPage('registration');
  else if(key==='documents'){state.documentRegistrationId=id;goPage('documents');}
  else if(key==='payments'){state.paymentRegistrationId=id;goPage('payments');}
  else if(key==='verification') goPage('verificationStatus');
  else if(key==='selection'){state.selectionRegistrationId=id;state.selectionData=null;goPage('selection');}
  else if(key==='announcement') goPage('announcement');
  else if(key==='reregistration') goPage('reregistration');
}
function renderWaliHomeFlow(data){
  const el=$('waliHomeFlow');if(!el)return;
  const items=data.registrations||[];
  if(!items.length){el.innerHTML=`<section class="card wali-flow-card"><div class="wali-flow-head"><div><div class="wali-flow-title">Alur Pendaftaran</div><div class="wali-flow-sub">Belum ada pendaftaran pada tahun ajaran ${esc(data.activeYear||'berjalan')}.</div></div></div><div class="wali-flow-empty-action"><button class="btn btn-primary" onclick="goPage('registration')">+ Pendaftaran Baru</button></div></section>`;return}
  const stages=[
    ['Pendaftaran','Isi dan kirim data calon santri.'],
    ['Pembayaran Formulir','Bayar biaya formulir dan tunggu konfirmasi Keuangan.'],
    ['Upload Dokumen','Unggah seluruh dokumen persyaratan setelah pembayaran dikonfirmasi.'],
    ['Verifikasi PSB','Petugas memeriksa data dan dokumen setelah pembayaran dikonfirmasi dan berkas diunggah.'],
    ['Tes & Seleksi','Ikuti tes sesuai jadwal dan tunggu hasil seleksi.'],
    ['Pengumuman','Lihat hasil seleksi setelah diumumkan.'],
    ['Daftar Ulang','Jika lulus, lanjutkan proses daftar ulang.']
  ];
  el.innerHTML=items.map(r=>{
    const completed=Math.max(0,Math.min(7,Number(r.completed||0)));
    const stageActions=['registration','payments','documents','verification','selection','announcement','reregistration'];
    const flow=stages.map((st,i)=>{const n=i+1,done=n<=completed,current=n===completed+1&&!((r.result?.published)&&r.result?.status==='NOT_PASSED');let badge=done?'Sudah dilewati':current?'Berikutnya':'Selanjutnya';if(r.result?.published&&r.result?.status==='NOT_PASSED'&&n===7)badge='Tidak diperlukan';if(r.result?.published&&r.result?.status==='WAITLIST'&&n===7)badge='Menunggu informasi';return `<button type="button" class="wali-flow-item wali-flow-clickable ${done?'done':''} ${current?'current':''}" onclick="waliFlowAction('${stageActions[i]}','${esc(r.registrationId)}')" aria-label="Buka tahap ${esc(st[0])}"><span class="wali-flow-dot">${done?'✓':n}</span><span class="wali-flow-copy"><b>${esc(st[0])}</b><span>${esc(st[1])}</span><span class="wali-flow-badge">${esc(badge)}</span></span><span class="wali-flow-open" aria-hidden="true">${ico('chevron-right')}</span></button>`}).join('');
    const stageIndex=Math.max(0,Math.min(7,completed));
    const progress=Math.round((stageIndex/7)*100);
    const progressLabel=stageIndex===0?'Belum mulai':stageIndex>=7?'Semua tahap selesai':`Tahap ${stageIndex} dari 7`;
    return `<section class="card wali-flow-card">
      <div class="wali-flow-head">
        <div><div class="wali-flow-title">${esc(r.candidateName)}</div><div class="wali-flow-sub">${esc(r.registrationNumber)} · ${esc(r.statusLabel||r.status||'-')}</div></div>
        <span class="pill ${r.status==='PASSED'?'ok':''}">${esc(r.statusLabel||r.status||'-')}</span>
      </div>
      <div class="wali-flow-progress-head"><span>${esc(progressLabel)}</span><b>${progress}%</b></div>
      <div class="wali-flow-progress"><span style="width:${progress}%"></span></div>
      <div class="wali-flow-list">${flow}</div>
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
  $('dashboardPanel').innerHTML=`<div class="dashboard-kpi-grid">${kpis}</div><section class="dashboard-section"><div class="dashboard-section-head"><div><b>Operasional Hari Ini</b><span style="display:block;margin-top:3px">Antrean kerja dan agenda yang perlu dipantau dari dashboard.</span></div><span>${esc(op.today||'')}</span></div>${ops.length?`<div class="dashboard-ops-grid">${ops.join('')}</div>`:'<div class="empty-state">Tidak ada panel operasional yang tersedia untuk role ini.</div>'}</section>${perm.canSelection?renderDashboardSchedule(data):''}<div class="dashboard-section"><div class="dashboard-section-head"><div><b>Status Alur</b><span style="display:block;margin-top:3px">Distribusi pendaftar pada workflow utama.</span></div></div><div class="dashboard-kpi-grid" style="margin-top:0"><article class="dashboard-kpi"><div class="kpi-label">Menunggu proses</div><div class="kpi-value">${Number(s.submitted||0)+Number(s.underReview||0)+Number(s.revision||0)}</div><div class="kpi-note">Pendaftaran</div></article><article class="dashboard-kpi"><div class="kpi-label">Pembayaran formulir</div><div class="kpi-value">${Number(s.paymentVerified||0).toLocaleString('id-ID')}</div><div class="kpi-note">Siap proses tes</div></article><article class="dashboard-kpi"><div class="kpi-label">Hasil seleksi</div><div class="kpi-value">${Number(sel.results||0).toLocaleString('id-ID')}</div><div class="kpi-note">Sudah memiliki hasil</div></article><article class="dashboard-kpi"><div class="kpi-label">Daftar ulang</div><div class="kpi-value">${Number(rr.completed||0).toLocaleString('id-ID')}</div><div class="kpi-note">Sudah selesai</div></article></div></section><section class="dashboard-section"><div class="dashboard-section-head"><div><b>Alat Operasional</b><span style="display:block;margin-top:3px">Akses cepat ke alat kerja tanpa mencampurnya dengan status alur.</span></div></div><div class="dashboard-tools-grid">${perm.canReport?`<button class="dashboard-tool" onclick="goPage('reports')">${ico('chart')}<span>Laporan</span></button>`:''}${perm.canMonitoring?`<button class="dashboard-tool" onclick="openMonitoringUI()">${ico('shield')}<span>Monitoring</span></button>`:''}${hasAnyRole(['SUPERADMIN','ADMIN_PSB'])?`<button class="dashboard-tool" onclick="openCommunicationCenterUI()">${ico('megaphone')}<span>Komunikasi</span></button><button class="dashboard-tool" onclick="openProductionReadinessUI()">${ico('check')}<span>Production Readiness</span></button><button class="dashboard-tool primary" onclick="openGoLiveCenterUI()">${ico('school')}<span>Go-Live Center</span></button>`:''}</div></section><div class="dashboard-section"><div class="dashboard-section-head"><div><b>Pendaftar per Jenjang</b><span style="display:block;margin-top:3px">Periode aktif</span></div></div><div class="dashboard-bars">${bars(data.distributions?.jenjang||[],maxJ)}</div></div><div class="dashboard-section"><div class="dashboard-section-head"><div><b>Pendaftar per Gelombang</b><span style="display:block;margin-top:3px">Periode aktif</span></div></div><div class="dashboard-bars">${bars(data.distributions?.gelombang||[],maxG)}</div></div>`;
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

async function renderReports(force=false){
  if(!hasAnyRole(['SUPERADMIN','ADMIN_PSB','VERIFIKATOR','SELEKSI','KEUANGAN'])){renderMore();return;}
  $('content').innerHTML=`<section class="hero"><h2>Laporan</h2><p>Ringkasan pendaftar, pembayaran, seleksi, dan Daftar Ulang. Data dapat difilter dan diunduh sebagai CSV.</p></section><section class="dashboard-section"><div class="report-filter-grid"><div class="field"><label>Tahun Ajaran</label><select id="reportYear" class="select-field professional-select"><option value="">Menyiapkan pilihan...</option></select></div><div class="field"><label>Gelombang</label><select id="reportGelombang" class="select-field professional-select"><option value="">Semua gelombang</option></select></div><div class="field"><label>Jenjang</label><select id="reportJenjang" class="select-field professional-select"><option value="">Semua jenjang</option></select></div><div class="field"><label>Jenis Kelamin</label><select id="reportGender" class="select-field professional-select"><option value="">Semua jenis kelamin</option></select></div><div class="field"><label>Status</label><select id="reportStatus" class="select-field professional-select"><option value="">Semua status</option></select></div><div class="field"><label>Dari tanggal</label><input id="reportFromDate" type="date" class="select-field"></div><div class="field"><label>Sampai tanggal</label><input id="reportToDate" type="date" class="select-field"></div></div><div class="report-actions"><button class="btn btn-primary" onclick="loadReports()">Terapkan Filter</button><button class="btn btn-secondary" onclick="exportReportCsv()">Export CSV</button><button class="btn btn-secondary" onclick="loadAdvancedReports()">Analisis Lanjutan</button></div></section><div id="reportPanel"><div class="empty-state">Memuat reporting...</div></div><div id="advancedReportPanel" style="margin-top:14px"><div class="empty-state">Analisis Lanjutan dimuat saat tombol dibuka.</div></div>`;
  await loadReports(force);
}
async function loadReports(force=false){
  const panel=$('reportPanel');if(panel)panel.innerHTML='<div class="empty-state">Memuat data reporting...</div>';
  try{
    const filters={tahunAjaranId:$('reportYear')?.value||'',gelombangId:$('reportGelombang')?.value||'',jenjangId:$('reportJenjang')?.value||'',gender:$('reportGender')?.value||'',status:$('reportStatus')?.value||'',fromDate:$('reportFromDate')?.value||'',toDate:$('reportToDate')?.value||''};
    const isDefault=!filters.tahunAjaranId&&!filters.gelombangId&&!filters.jenjangId&&!filters.gender&&!filters.status&&!filters.fromDate&&!filters.toDate;
    const r=force?await server('getReportingPageData',state.token,filters):((isDefault&&pageDataCached('reports'))||await warmPageData(isDefault?'reports':'reports-filter',()=>server('getReportingPageData',state.token,filters)));
    if(!r?.success){if(panel)panel.innerHTML=showMessage(r?.message||'Gagal memuat reporting.');return;}state.reportData=r;populateReportFilters(r);renderReportPanel(r);
  }catch(e){if(panel)panel.innerHTML=showMessage('Gagal memuat data reporting.');}
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
  el.innerHTML='<div class="empty-state">Memuat Analisis Lanjutan...</div>';
  try{
    const filters={tahunAjaranId:$('reportYear')?.value||'',gelombangId:$('reportGelombang')?.value||'',jenjangId:$('reportJenjang')?.value||'',gender:$('reportGender')?.value||'',status:$('reportStatus')?.value||'',fromDate:$('reportFromDate')?.value||'',toDate:$('reportToDate')?.value||''};
    const r=await server('getAdvancedReportingData',state.token,filters);
    if(!r?.success){el.innerHTML=showMessage(r?.message||'Gagal memuat analytics.');return;}
    state.advancedReportData=r;
    renderAdvancedReports(r);
  }catch(e){el.innerHTML=showMessage('Gagal memuat Analisis Lanjutan.');}
}
function renderAdvancedReports(d){
  const el=$('advancedReportPanel');if(!el)return;
  const f=d.funnel||{},c=d.conversion||{},fin=d.finance||{},o=d.outcome||{},p=d.processing||{};
  const rate=v=>Number(v||0).toLocaleString('id-ID')+'%';
  const day=v=>v==null?'-':Number(v).toLocaleString('id-ID')+' hari';
  const bar=(label,value,total)=>'<div class="analytics-list-row"><div><div>'+esc(label)+'</div><div class="analytics-bar"><i style="width:'+(total?Math.max(3,Math.round(Number(value||0)/total*100)):0)+'%"></i></div></div><div class="v">'+Number(value||0).toLocaleString('id-ID')+'</div></div>';
  const trend=(d.trends||[]).map(x=>'<tr><td>'+esc(x.month)+'</td><td>'+Number(x.registrations||0)+'</td><td>'+Number(x.submitted||0)+'</td><td>'+Number(x.verified||0)+'</td></tr>').join('')||'<tr><td colspan="4">Tidak ada data trend.</td></tr>';
  const breakdown=arr=>{if(!arr||!arr.length)return '<div class="empty-state">Tidak ada data.</div>';const max=Math.max(1,...arr.map(x=>Number(x.count||0)));return arr.slice(0,8).map(x=>bar(x.label,x.count,max)).join('');};
  el.innerHTML='<section class="dashboard-section"><div class="status-row"><div><h3 style="margin:0">Analisis Lanjutan</h3><p style="margin:4px 0 0">Funnel, conversion, tren, outcome seleksi, keuangan, dan waktu proses.</p></div><button class="btn btn-secondary btn-sm" onclick="exportAdvancedReports()">Export Analytics</button></div><div class="analytics-grid">'+
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
  const blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='PSB_Fathan_Mubina_Laporan.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);
}

async function renderAudit(force=false){
  if(!hasAnyRole(['SUPERADMIN','ADMIN_PSB'])){renderMore();return;}
  $('content').innerHTML=`<section class="hero"><h2>Audit</h2><p>Jejak aktivitas penting aplikasi. Data ditampilkan dari AUDIT_LOG dan dapat difilter.</p></section><section class="dashboard-section"><div class="report-filter-grid"><div class="field"><label>Pencarian</label><input id="auditSearch" class="select-field" placeholder="User, aksi, modul, record, deskripsi..."></div><div class="field"><label>Aksi</label><select id="auditAction" class="select-field"><option value="">Semua aksi</option></select></div><div class="field"><label>Modul</label><select id="auditModule" class="select-field"><option value="">Semua modul</option></select></div><div class="field"><label>Dari tanggal</label><input id="auditFrom" type="date" class="select-field"></div><div class="field"><label>Sampai tanggal</label><input id="auditTo" type="date" class="select-field"></div></div><div class="report-actions"><button class="btn btn-primary" onclick="loadAudit(1)">Terapkan Filter</button><button class="btn btn-secondary" onclick="exportAuditCsv()">Export CSV</button>${hasAnyRole(['SUPERADMIN'])?'<button class="btn btn-secondary" onclick="runSecurityMaintenanceUI()">Maintenance Security</button>':''}</div></section><div id="auditPanel"><div class="empty-state">Memuat audit...</div></div>`;
  await loadAudit(1,force);
}
async function loadAudit(page=1,force=false){
  const panel=$('auditPanel');if(panel)panel.innerHTML='<div class="empty-state">Memuat audit...</div>';
  try{const filters={page:page,search:$('auditSearch')?.value||'',action:$('auditAction')?.value||'',module:$('auditModule')?.value||'',from:$('auditFrom')?.value||'',to:$('auditTo')?.value||'',pageSize:50};const isDefault=page===1&&!filters.search&&!filters.action&&!filters.module&&!filters.from&&!filters.to;const r=force?await server('getAuditLogPageData',state.token,filters):((isDefault&&pageDataCached('audit'))||await warmPageData(isDefault?'audit':'audit-filter',()=>server('getAuditLogPageData',state.token,filters)));if(!r?.success){if(panel)panel.innerHTML=showMessage(r?.message||'Gagal memuat audit.');return;}state.auditData=r;const action=$('auditAction'),module=$('auditModule');const keepA=filters.action,keepM=filters.module;if(action)action.innerHTML='<option value="">Semua aksi</option>'+(r.options?.actions||[]).map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');if(module)module.innerHTML='<option value="">Semua modul</option>'+(r.options?.modules||[]).map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');if(action)action.value=keepA;if(module)module.value=keepM;renderAuditPanel(r);}catch(e){if(panel)panel.innerHTML=showMessage('Gagal memuat audit.');}
}
function renderAuditPanel(data){
  const el=$('auditPanel');if(!el)return;const rows=data.rows||[];const table=rows.length?`<div class="report-table-wrap"><table class="report-table"><thead><tr><th>Waktu</th><th>User</th><th>Aksi</th><th>Modul</th><th>Record</th><th>Deskripsi</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${esc(x.timestamp||'-')}</td><td>${esc(x.userId||'-')}</td><td><span class="pill">${esc(x.action||'-')}</span></td><td>${esc(x.module||'-')}</td><td>${esc(x.recordId||'-')}</td><td>${esc(x.description||'-')}${(x.oldValue||x.newValue)?`<details style="margin-top:5px"><summary class="muted" style="font-size:10px;cursor:pointer">Detail perubahan</summary><div class="muted" style="font-size:10px;margin-top:5px;word-break:break-word"><b>Lama:</b> ${esc(x.oldValue||'-')}<br><b>Baru:</b> ${esc(x.newValue||'-')}</div></details>`:''}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state">Tidak ada aktivitas sesuai filter.</div>';const page=Number(data.page||1),size=Number(data.pageSize||50),total=Number(data.total||0),from=total?((page-1)*size+1):0,to=Math.min(page*size,total);el.innerHTML=`<div class="report-summary-grid"><article class="report-summary"><b>${total.toLocaleString('id-ID')}</b><span>Aktivitas terfilter</span></article><article class="report-summary"><b>${from.toLocaleString('id-ID')}–${to.toLocaleString('id-ID')}</b><span>Rentang halaman</span></article></div>${table}<div class="report-actions" style="margin-top:12px"><button class="btn btn-secondary" ${page<=1?'disabled':''} onclick="loadAudit(${page-1})">Sebelumnya</button><button class="btn btn-secondary" ${!data.hasMore?'disabled':''} onclick="loadAudit(${page+1})">Berikutnya</button></div>`;
}
function exportAuditCsv(){const rows=state.auditData?.rows||[];if(!rows.length){showAlert('Belum ada data','Tidak ada aktivitas audit yang dapat diekspor.','warning');return;}const headers=['Waktu','User','Aksi','Modul','Record','Deskripsi','Nilai Lama','Nilai Baru'];const lines=[headers,...rows.map(x=>[x.timestamp,x.userId,x.action,x.module,x.recordId,x.description,x.oldValue,x.newValue])].map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(','));const blob=new Blob(['\ufeff'+lines.join('\n')],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='PSB_Fathan_Mubina_Audit.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);}
async function runSecurityMaintenanceUI(){showConfirm('Jalankan maintenance security?','Session yang sudah kedaluwarsa atau idle akan ditandai berakhir. Data utama tidak dihapus.',async()=>{loading(true,'Menjalankan maintenance security...');try{const r=await server('runSecurityMaintenance',state.token);if(r.success){showToast(`Maintenance selesai: ${Number(r.result?.processed||0)} session diproses.`,'success');await loadAudit(1);}else showAlert('Maintenance gagal',r.message||'Operasi gagal.','warning')}catch(e){showAlert('Maintenance gagal','Terjadi gangguan saat menjalankan maintenance security.','error')}finally{loading(false)}} ,'Jalankan');}

function renderFeaturePlaceholder(title,desc){$('content').innerHTML=`<section class="hero"><h2>${esc(title)}</h2><p>${esc(desc)}</p></section><div class="empty-state">Modul ini belum aktif pada stage saat ini.</div>`;}
async function renderSelection(force=false){
  if(!hasAnyRole(['WALI','SUPERADMIN','ADMIN_PSB','SELEKSI','VERIFIKATOR'])){renderMore();return true}
  state.selectionTab=state.selectionTab||'overview';
  $('content').innerHTML=`<section class="hero"><h2>Tes</h2><p>${hasAnyRole(['WALI'])?'Lihat jadwal tes, status peserta, dan hasil seleksi calon santri.':'Kelola jadwal tes, peserta, nilai, dan hasil seleksi.'}</p></section><div id="selectionPanel"><div class="selection-empty">Memuat data tes dan seleksi...</div></div>`;
  try{
    const id=state.selectionRegistrationId||'';
    const cached=!force&&(state.selectionData||(!id?pageDataCached('selection'):null));
    if(cached&&!id){renderSelectionPanel(cached);return true}
    const r=force?await server('getSelectionPageData',state.token,id):await warmPageData('selection',()=>server('getSelectionPageData',state.token,id));
    if(!r?.success){$('selectionPanel').innerHTML=showMessage(r?.message||'Gagal memuat data tes dan seleksi.');return false}
    state.selectionData=r;
    renderSelectionPanel(r);
    return true;
  }catch(e){$('selectionPanel').innerHTML=showMessage('Gagal memuat data tes dan seleksi.');return false}
}
async function refreshSelectionAfterMutation(){
  const message='Perubahan berhasil disimpan, tetapi daftar belum diperbarui. Muat ulang halaman untuk melihat status terbaru.';
  try{if(await renderSelection()===false)showToast(message,'warning')}
  catch(refreshError){showToast(message,'warning')}
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
  el.innerHTML=`<div class="selection-grid"><article class="selection-card"><h3>Jadwal aktif</h3><div style="font-size:28px;font-weight:900">${schedules.length}</div><div class="selection-note">Jadwal tes yang aktif untuk tahun ajaran berjalan.</div></article><article class="selection-card"><h3>Peserta tes</h3><div style="font-size:28px;font-weight:900">${participants.length}</div><div class="selection-note">Peserta yang sudah dijadwalkan mengikuti tes.</div></article><article class="selection-card"><h3>Pendaftar terverifikasi</h3><div style="font-size:28px;font-weight:900">${regs.filter(x=>String(x.status).toUpperCase()==='PAYMENT_VERIFIED').length}</div><div class="selection-note">Sudah melalui verifikasi dan Pembayaran Formulir.</div></article><article class="selection-card"><h3>Hasil tersedia</h3><div style="font-size:28px;font-weight:900">${(data.results||[]).filter(x=>['PASSED','NOT_PASSED','WAITLIST'].includes(String(x.status))).length}</div><div class="selection-note">Hasil internal yang siap diteruskan ke .</div></article></div><section class="card" style="margin-top:14px"><b>Catatan alur</b><p class="selection-note">Peserta hanya dapat ditambahkan setelah pendaftaran terverifikasi dan Pembayaran Formulir berstatus lunas. Pengumuman resmi belum dipublikasikan pada .</p></section>`;
}
function renderSelectionSchedules(data){
  const el=$('selectionTabContent');
  const form=`<section class="card" style="margin-bottom:14px"><div class="section-title" style="margin-top:0">Buat Jadwal Tes</div><div class="selection-form"><div class="field"><label>Nama Tes *</label><input id="selScheduleName" class="input-field" placeholder="Contoh: Tes Seleksi Gelombang 1"></div><div class="field"><label>Tanggal Tes *</label><input id="selScheduleDate" class="input-field" type="date"></div><div class="field full"><label>Lokasi</label><input id="selScheduleLocation" class="input-field" placeholder="Contoh: Kampus Fathan Mubina / Online"></div></div><div class="registration-actions" style="margin-top:12px"><button id="saveSelectionScheduleBtn" class="btn btn-primary" onclick="createSelectionScheduleUI()">+ Simpan Jadwal</button></div></section>`;
  const columns=[
    {label:'No.',className:'staff-col-number',render:(x,i)=>String(i+1)},
    {label:'Nama Tes',render:x=>`<div class="staff-primary-text">${esc(x.name||'-')}</div><div class="staff-secondary-text">${esc(x.scheduleId||'-')}</div>`},
    {label:'Tanggal',render:x=>esc(x.selectionDate||'-')},
    {label:'Lokasi',render:x=>esc(x.location||'Belum ditentukan')},
    {label:'Tahun Ajaran',render:x=>esc(x.tahunAjaranId||'-')},
    {label:'Status',render:x=>'<span class="pill ok">Aktif</span>'},
    {label:'Aksi',className:'staff-col-actions',render:x=>`<button class="btn btn-secondary staff-table-action" onclick="toggleSelectionScheduleUI('${esc(x.scheduleId)}',false)">Nonaktifkan</button>`}
  ];
  el.innerHTML=form+renderStaffDataTable(data.schedules||[],columns,'Belum ada jadwal tes. Buat jadwal tes pertama melalui formulir di atas.');
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
async function toggleSelectionScheduleUI(id,isActive){loading(true,'Memperbarui jadwal...');try{const r=await server('updateSelectionScheduleStatus',state.token,{scheduleId:id,isActive});if(r.success){showToast(r.message,'success');state.selectionData=null;state.selectionTab='schedule';await refreshSelectionAfterMutation()}else showAlert('Belum dapat diproses',r.message,'warning')}catch(e){showAlert('Status jadwal belum pasti','Koneksi terputus saat memperbarui jadwal. Muat ulang daftar jadwal sebelum mencoba lagi.','warning')}finally{loading(false)}}
function renderSelectionParticipants(data){
  const el=$('selectionTabContent'), schedules=data.schedules||[], regs=(data.registrations||[]).filter(x=>['PAYMENT_VERIFIED','VERIFIED'].includes(String(x.status).toUpperCase()));
  const options=schedules.map(x=>`<option value="${esc(x.scheduleId)}">${esc(x.name)} · ${esc(x.selectionDate)}</option>`).join('');
  const existing=new Set((data.participants||[]).map(x=>String(x.registrationId)));
  const eligible=regs.filter(x=>!existing.has(String(x.registrationId)));
  const regOptions=regs.map(x=>`<option value="${esc(x.registrationId)}">${esc(x.registrationNumber||x.registrationId)} · ${esc(x.candidateName)}</option>`).join('');
  const bulkRows=eligible.map(x=>`<label class="selection-check-row"><input type="checkbox" class="selection-participant-check" value="${esc(x.registrationId)}" onchange="updateSelectionBulkCount()"><span class="selection-check-copy"><b>${esc(x.candidateName||'-')}</b><span>${esc(x.registrationNumber||x.registrationId)} · ${esc(x.gelombangName||'-')}</span></span></label>`).join('');
  const bulk=`<section class="selection-bulk-box" id="selectionBulkBox"><div class="selection-bulk-head"><div><div class="selection-bulk-title">Generate Tes Seleksi</div><div class="selection-note">Pilih banyak pendaftar sekaligus untuk dimasukkan ke satu jadwal tes.</div></div></div><div class="selection-form"><div class="field" style="margin:10px 0"><label>Jadwal Tes *</label><select id="selBulkSchedule" class="select-field"><option value="">Pilih jadwal tes</option>${options}</select></div></div><div class="selection-bulk-actions"><button type="button" class="btn btn-secondary" onclick="toggleAllSelectionParticipants(true)">Pilih Semua</button><button type="button" class="btn btn-secondary" onclick="toggleAllSelectionParticipants(false)">Kosongkan</button><button type="button" class="btn btn-primary" id="generateSelectionBtn" onclick="generateSelectionParticipantsUI()">Generate Tes Seleksi</button></div><div class="selection-check-list">${bulkRows||'<div class="selection-bulk-empty">Tidak ada pendaftar eligible yang belum memiliki jadwal tes.</div>'}</div><div class="selection-bulk-summary" id="selectionBulkSummary">0 peserta dipilih</div><div class="selection-bulk-processing"><span class="selection-processing-dot"></span><span>Sedang membuat peserta tes. Mohon tunggu...</span></div></section>`;
  const form=`<section class="card" style="margin-bottom:14px"><div class="section-title" style="margin-top:0">Tambahkan Satu Peserta</div><div class="selection-form"><div class="field"><label>Pendaftaran *</label><select id="selParticipantReg" class="select-field"><option value="">Pilih pendaftar</option>${regOptions}</select></div><div class="field"><label>Jadwal Tes *</label><select id="selParticipantSchedule" class="select-field"><option value="">Pilih jadwal</option>${options}</select></div></div><div class="registration-actions" style="margin-top:12px"><button class="btn btn-secondary" onclick="addSelectionParticipantUI()">+ Tambahkan Peserta</button></div></section>`;
  const columns=[
    {label:'No.',className:'staff-col-number',render:(x,i)=>String(i+1)},
    {label:'Calon Santri',render:x=>`<div class="staff-primary-text">${esc(x.candidateName||'-')}</div><div class="staff-secondary-text">${esc(x.registration?.registrationNumber||x.registrationId||'-')}</div>`},
    {label:'Jadwal Tes',render:x=>esc(x.scheduleId||'-')},
    {label:'Kehadiran',render:x=>{const st=String(x.status||'').toUpperCase();return `<span class="pill ${st==='PRESENT'||st==='COMPLETED'?'ok':st==='ABSENT'?'':'warn'}">${esc(selectionStatusLabel(st))}</span>`;}},
    {label:'Aksi',className:'staff-col-actions',render:x=>`<div class="staff-table-actions"><button class="btn btn-secondary staff-table-action" onclick="updateParticipantStatusUI('${esc(x.participantId)}','PRESENT')">Hadir</button><button class="btn btn-secondary staff-table-action" onclick="updateParticipantStatusUI('${esc(x.participantId)}','ABSENT')">Tidak Hadir</button><button class="btn btn-primary staff-table-action" onclick="openSelectionDetailUI('${esc(x.registrationId)}')">Nilai & Hasil</button></div>`}
  ];
  el.innerHTML=bulk+form+renderStaffDataTable(data.participants||[],columns,'Belum ada peserta tes.');
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
    showToast(`Generate selesai: ${added} peserta ditambahkan${skipped?`, ${skipped} dilewati`:''}${failed?`, ${failed} gagal`:''}.`,failed?'warning':'success');
    state.selectionData=null; state.selectionTab='participants';
    await refreshSelectionAfterMutation();
  }catch(e){showAlert('Generate gagal','Terjadi gangguan saat membuat peserta tes. Silakan cek daftar peserta sebelum mencoba lagi.','error')}
  finally{loading(false);if(box)box.classList.remove('processing');if(btn){btn.disabled=false;btn.textContent='Generate Tes Seleksi';}}
}
async function addSelectionParticipantUI(){const registrationId=$('selParticipantReg')?.value||'',scheduleId=$('selParticipantSchedule')?.value||'';if(!registrationId||!scheduleId){showAlert('Data belum lengkap','Pilih pendaftar dan jadwal tes.','warning');return}loading(true,'Menambahkan peserta...');try{const r=await server('addSelectionParticipant',state.token,{registrationId,scheduleId});if(r.success){showToast(r.message,'success');state.selectionData=null;state.selectionTab='participants';await refreshSelectionAfterMutation()}else showAlert('Belum dapat ditambahkan',r.message,'warning')}catch(e){showAlert('Status penyimpanan belum pasti','Koneksi terputus saat menambahkan peserta. Muat ulang daftar sebelum mencoba lagi untuk menghindari duplikasi.','warning')}finally{loading(false)}}
async function updateParticipantStatusUI(id,status){loading(true,'Memperbarui kehadiran...');try{const r=await server('updateSelectionParticipantStatus',state.token,{participantId:id,status});if(r.success){showToast(r.message,'success');state.selectionData=null;state.selectionTab='participants';await refreshSelectionAfterMutation();}else showAlert('Belum dapat diproses',r.message,'warning')}catch(e){showAlert('Status peserta belum pasti','Koneksi terputus saat menyimpan. Muat ulang daftar peserta sebelum mencoba lagi.','warning')}finally{loading(false)}}
function renderSelectionResults(data){
  const el=$('selectionTabContent');const results=data.results||[];const regs=data.registrations||[];
  const columns=[
    {label:'No.',className:'staff-col-number',render:(x,i)=>String(i+1)},
    {label:'Calon Santri',render:x=>{const reg=regs.find(r=>String(r.registrationId)===String(x.registrationId));return `<div class="staff-primary-text">${esc(reg?.candidateName||x.registrationId||'-')}</div><div class="staff-secondary-text">${esc(reg?.registrationNumber||x.registrationId||'-')}</div>`;}},
    {label:'Hasil',render:x=>{const st=String(x.status||'').toUpperCase();return `<span class="pill ${st==='PASSED'?'ok':st==='NOT_PASSED'?'':'warn'}">${esc(selectionStatusLabel(st))}</span>`;}},
    {label:'Catatan',render:x=>esc(x.note||'Belum ada catatan.')},
    {label:'Aksi',className:'staff-col-actions',render:x=>`<button class="btn btn-primary staff-table-action" onclick="openSelectionDetailUI('${esc(x.registrationId)}')">Buka Detail</button>`}
  ];
  el.innerHTML=renderStaffDataTable(results,columns,'Belum ada hasil seleksi.');
}
function renderSelectionWali(data,targetEl=null){
  const el=targetEl||$('selectionTabContent'),regs=data.registrations||[],pmap={};(data.participants||[]).forEach(p=>pmap[String(p.registrationId)]=p);const rmap={};(data.results||[]).forEach(r=>rmap[String(r.registrationId)]=r);const cards=regs.map(r=>{const p=pmap[String(r.registrationId)],res=rmap[String(r.registrationId)];return `<article class="selection-card"><h3>${esc(r.candidateName||'-')}</h3><div class="selection-note">${esc(r.registrationNumber||r.registrationId)} · ${esc(r.gelombangName||'-')}</div><div class="selection-progress"><div class="selection-progress-step done"></div><div class="selection-progress-step ${p?'done':''}"></div><div class="selection-progress-step ${res?'done':''}"></div></div><div class="selection-meta"><span>${esc(selectionStatusLabel(r.status))}</span>${p?`<span>${esc(p.status==='SCHEDULED'?'Terjadwal':selectionStatusLabel(p.status))}</span>`:''}${res?`<span>${esc(selectionStatusLabel(res.status))}</span>`:''}</div>${p?`<p class="selection-note" style="margin-top:10px">Jadwal: ${esc((data.schedules||[]).find(s=>String(s.scheduleId)===String(p.scheduleId))?.name||p.scheduleId)}</p>`:'<p class="selection-note" style="margin-top:10px">Belum memiliki jadwal tes.</p>'}</article>`}).join('');if(el)el.innerHTML=cards||'<div class="selection-empty">Belum ada data pendaftaran untuk proses tes.</div>';
}

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
function renderSelectionDetail(data,targetEl){
  const el=targetEl||$('selectionTabContent');if(!el)return;
  const d=data.detail||{},admin=hasAnyRole(['SUPERADMIN','ADMIN_PSB','SELEKSI']),isWali=hasAnyRole(['WALI']);
  const p=d.participant,res=d.result,scores=d.scores||[];
  if(!p){el.innerHTML='<div class="selection-empty">Peserta tes belum tersedia.</div>';return}
  const publicResult=!isWali||(res&&String(res.announcementDate||'').trim())?res:null;
  const scoreRows=scores.map(x=>`<tr><td>${esc(x.component)}</td><td>${esc(x.score)}</td><td>${esc(x.note||'-')}</td></tr>`).join('');
  const internal=admin?`<section class="card" style="margin-top:14px"><div class="section-title" style="margin-top:0">Input Nilai</div><div class="selection-form"><div class="field"><label>Komponen *</label><input id="selScoreComponent" class="input-field" placeholder="Contoh: Wawancara"></div><div class="field"><label>Nilai *</label><input id="selScoreValue" class="input-field" type="number" min="0" max="100" step="0.01" placeholder="0 - 100"></div><div class="field full"><label>Catatan</label><textarea id="selScoreNote" class="textarea-field" placeholder="Catatan hasil tes"></textarea></div></div><div class="registration-actions" style="margin-top:12px"><button class="btn btn-primary" onclick="saveSelectionScoreUI('${esc(p.participantId)}')">Simpan Nilai</button></div></section><section class="card" style="margin-top:14px"><div class="section-title" style="margin-top:0">Hasil Seleksi</div><div class="selection-form"><div class="field"><label>Status *</label><select id="selResultStatus" class="select-field"><option value="PENDING">Menunggu hasil</option><option value="PASSED">Lulus</option><option value="NOT_PASSED">Tidak lulus</option><option value="WAITLIST">Cadangan</option></select></div><div class="field"><label>Catatan</label><input id="selResultNote" class="input-field" value="${esc(res?.note||'')}" placeholder="Catatan keputusan"></div></div><div class="registration-actions" style="margin-top:12px"><button class="btn btn-primary" onclick="saveSelectionResultUI('${esc(d.registration?.registrationId||'')}')">Simpan Hasil</button></div><p class="selection-note" style="margin-top:10px">Hasil ini masih merupakan hasil internal. Publikasi pengumuman dilakukan setelah hasil ditetapkan.</p></section>`:'';
  const scoreSection=isWali?'':`<article class="selection-card"><h3>Nilai Seleksi</h3>${scoreRows?`<table class="score-table"><thead><tr><th>Komponen</th><th>Nilai</th><th>Catatan</th></tr></thead><tbody>${scoreRows}</tbody></table>`:'<div class="selection-note">Belum ada nilai.</div>'}</article>`;
  const resultSection=isWali?(publicResult?`<div class="selection-meta"><span>Keterangan Hasil: ${esc(selectionStatusLabel(publicResult.status))}</span></div>`:''):`<div class="selection-meta">${res?`<span>${esc(selectionStatusLabel(res.status))}</span>`:''}</div>`;
  el.innerHTML=`<section class="selection-grid" style="margin-top:0"><article class="selection-card"><h3>${esc(d.registration?.candidateName||'-')}</h3><div class="selection-note">${esc(d.registration?.registrationNumber||'-')}</div><div class="selection-meta"><span>${esc(selectionStatusLabel(p.status))}</span></div>${resultSection}</article>${scoreSection}</section>${internal}${!admin&&!isWali?`<div class="selection-note" style="margin-top:12px">Informasi di atas adalah hasil seleksi yang tersedia untuk akun staf.</div>`:''}`;
}
async function saveSelectionScoreUI(participantId){const component=String($('selScoreComponent')?.value||'').trim(),score=Number($('selScoreValue')?.value),note=String($('selScoreNote')?.value||'').trim();if(!component||!Number.isFinite(score)){showAlert('Nilai belum lengkap','Komponen dan nilai wajib diisi.','warning');return}loading(true,'Menyimpan nilai...');try{const r=await server('saveSelectionScore',state.token,{participantId,component,score,note});if(r.success){showToast(r.message,'success');await openSelectionDetailUI(state.selectionRegistrationId)}else showAlert('Nilai belum tersimpan',r.message,'warning')}catch(e){showAlert('Gagal menyimpan','Terjadi gangguan saat menyimpan nilai.','error')}finally{loading(false)}}
async function saveSelectionResultUI(registrationId){const status=$('selResultStatus')?.value||'',note=String($('selResultNote')?.value||'').trim();loading(true,'Menyimpan hasil seleksi...');try{const r=await server('saveSelectionResult',state.token,{registrationId,status,note});if(r.success){showToast(r.message,'success');await openSelectionDetailUI(registrationId)}else showAlert('Hasil belum tersimpan',r.message,'warning')}catch(e){showAlert('Gagal menyimpan','Terjadi gangguan saat menyimpan hasil seleksi.','error')}finally{loading(false)}}

async function renderAnnouncements(force=false){
  if(!hasAnyRole(['WALI','SUPERADMIN','ADMIN_PSB','SELEKSI','VERIFIKATOR'])){renderMore();return}
  const isWali=hasAnyRole(['WALI']);
  $('content').innerHTML=`<section class="hero"><h2>Pengumuman</h2><p>${isWali?'Lihat informasi tes, hasil seleksi, dan tahapan daftar ulang pendaftaran Anda.':'Kelola dan publikasikan hasil seleksi kepada wali santri.'}</p></section><div id="announcementPanel"><div class="announcement-empty">Memuat informasi...</div></div>`;
  const loadPageData=(page,fn)=>force?server(fn,state.token):(pageDataCached(page)||warmPageData(page,()=>server(fn,state.token)));
  try{
    const tasks=[loadPageData('announcement','getAnnouncementPageData')];
    if(isWali){tasks.push(loadPageData('selection','getSelectionPageData'));tasks.push(loadPageData('reregistration','getReregistrationPageData'));}
    const results=await Promise.allSettled(tasks);
    const announcement=results[0].status==='fulfilled'?results[0].value:{success:false,message:'Gagal memuat pengumuman.'};
    const waliData=isWali?{
      selection:results[1]?.status==='fulfilled'?results[1].value:{success:false,message:'Informasi tes tidak dapat dimuat.'},
      reregistration:results[2]?.status==='fulfilled'?results[2].value:{success:false,message:'Informasi daftar ulang tidak dapat dimuat.'}
    }:null;
    if(isWali&&waliData.selection?.success)state.selectionData=waliData.selection;
    renderAnnouncementPanel(announcement,waliData);
  }catch(e){
    renderAnnouncementPanel({success:false,message:'Gagal memuat pengumuman.'},isWali?{
      selection:{success:false,message:'Informasi tes tidak dapat dimuat.'},
      reregistration:{success:false,message:'Informasi daftar ulang tidak dapat dimuat.'}
    }:null);
  }
}

function announcementStatusLabel(s){return ({PASSED:'Lulus',NOT_PASSED:'Tidak lulus',WAITLIST:'Cadangan',PENDING:'Menunggu hasil'})[String(s||'').toUpperCase()]||String(s||'-')}
function renderAnnouncementPanel(data,waliData=null){
  const el=$('announcementPanel');if(!el)return;
  if(waliData){
    el.innerHTML=`<section class="card announcement-workflow-section"><div class="section-title" style="margin-top:0">Informasi Tes</div><div id="announcementWaliSelection"></div></section><section class="card announcement-workflow-section"><div class="section-title" style="margin-top:0">Informasi Pengumuman</div><div id="announcementWaliResults"></div></section><section class="card announcement-workflow-section"><div class="section-title" style="margin-top:0">Informasi Daftar Ulang</div><div id="announcementWaliReregistration"></div></section>`;
    const selectionEl=$('announcementWaliSelection'),resultsEl=$('announcementWaliResults'),reregEl=$('announcementWaliReregistration');
    if(waliData.selection?.success)renderSelectionWali(waliData.selection,selectionEl);else if(selectionEl)selectionEl.innerHTML=showMessage(waliData.selection?.message||'Informasi tes tidak dapat dimuat.');
    if(data?.success===false){if(resultsEl)resultsEl.innerHTML=showMessage(data.message||'Gagal memuat pengumuman.');}else renderAnnouncementList(data,resultsEl);
    if(waliData.reregistration?.success)renderReregistrationPanel(waliData.reregistration,reregEl);else if(reregEl)reregEl.innerHTML=showMessage(waliData.reregistration?.message||'Informasi daftar ulang tidak dapat dimuat.');
    return;
  }
  renderAnnouncementList(data,el);
}
function renderAnnouncementList(data,targetEl){
  const el=targetEl||$('announcementPanel');if(!el)return;const admin=!!data?.canPublish,items=data?.items||[];
  if(data?.success===false){el.innerHTML=showMessage(data.message||'Gagal memuat pengumuman.');return;}
  if(!items.length){el.innerHTML='<div class="announcement-empty">Belum ada hasil seleksi yang tersedia untuk pengumuman.</div>';return}
  if(hasAnyRole(['WALI'])){
    const rows=items.map(x=>{const status=String(x.status||'').toUpperCase();const published=!!x.isPublished;const cls=status==='PASSED'?'ok':status==='NOT_PASSED'?'bad':'warn';return `<article class="announcement-card"><div class="announcement-top"><div><div class="announcement-title">${esc(x.candidateName||'-')}</div><div class="announcement-sub">${esc(x.registrationNumber||'-')} · Hasil seleksi</div></div><span class="announcement-status ${cls}">${esc(announcementStatusLabel(status))}</span></div><div class="announcement-message">${published?`Diumumkan pada ${esc(String(x.announcementDate||'-'))}.`:'Hasil sudah ditetapkan tetapi belum dipublikasikan.'}${x.note?`<br><span style="display:block;margin-top:5px">Catatan: ${esc(x.note)}</span>`:''}</div>${!admin&&status==='PASSED'&&published?`<div class="announcement-actions"><button class="btn btn-primary" onclick="goPage('reregistration')">Lanjut Daftar Ulang</button></div>`:''}</article>`}).join('');
    el.innerHTML=`<div class="announcement-list">${rows}</div>`;return;
  }
  const columns=[
    {label:'No.',className:'staff-col-number',render:(x,i)=>String(i+1)},
    {label:'Calon Santri',render:x=>`<div class="staff-primary-text">${esc(x.candidateName||'-')}</div><div class="staff-secondary-text">${esc(x.registrationNumber||'-')}</div>`},
    {label:'Hasil Seleksi',render:x=>{const st=String(x.status||'').toUpperCase();return `<span class="pill ${st==='PASSED'?'ok':st==='NOT_PASSED'?'':'warn'}">${esc(announcementStatusLabel(st))}</span>`;}},
    {label:'Publikasi',render:x=>x.isPublished?`<span class="pill ok">Sudah diumumkan</span><div class="staff-secondary-text">${esc(String(x.announcementDate||'-'))}</div>`:'<span class="pill">Belum dipublikasikan</span>'},
    {label:'Catatan',render:x=>esc(x.note||'-')},
    {label:'Aksi',className:'staff-col-actions',render:x=>admin&&!x.isPublished?`<button class="btn btn-primary staff-table-action" onclick="publishAnnouncementUI('${esc(x.registrationId)}')">Publikasikan</button>`:x.isPublished?'<span class="staff-secondary-text">Selesai</span>':'-'}
  ];
  el.innerHTML=renderStaffDataTable(items,columns,'Belum ada hasil seleksi yang tersedia untuk pengumuman.');
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

async function renderNotifications(force=false){
  $('content').innerHTML=`<section class="hero"><h2>Notifikasi</h2><p>Informasi penting terkait proses PSB akan muncul di sini.</p></section><div id="notificationPanel"><div class="announcement-empty">Memuat notifikasi...</div></div>`;
  try{const r=force?await server('getNotifications',state.token):(pageDataCached('notifications')||await warmPageData('notifications',()=>server('getNotifications',state.token)));if(!r?.success){$('notificationPanel').innerHTML=showMessage(r?.message||'Gagal memuat notifikasi.');return}renderNotificationPanel(r)}catch(e){$('notificationPanel').innerHTML=showMessage('Gagal memuat notifikasi.')}
}
function notificationTypeLabel(type){return ({SUCCESS:'Berhasil',WARNING:'Perlu perhatian',INFO:'Informasi',ERROR:'Kesalahan'})[String(type||'INFO').toUpperCase()]||'Informasi'}
function formatNotificationDate(value){const d=new Date(value);if(Number.isNaN(d.getTime()))return String(value||'-');return d.toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});}
function renderNotificationPanel(data){const el=$('notificationPanel');if(!el)return;const items=data.items||[];const unreadCount=Number(data.unreadCount||0);if(!items.length){el.innerHTML='<div class="announcement-empty">Belum ada notifikasi.</div>';updateNotificationBadge();return}el.innerHTML=`<div class="notification-toolbar" style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px"><div><strong>${unreadCount}</strong> belum dibaca</div><button class="btn btn-secondary" onclick="markAllNotificationsReadUI()">Tandai semua dibaca</button></div><div class="notification-list">${items.map(x=>{const unread=String(x.isRead).toUpperCase()!=='TRUE';const type=String(x.type||'INFO').toUpperCase();const cls=type==='SUCCESS'?'ok':type==='WARNING'?'warn':type==='ERROR'?'bad':'';return `<article class="notification-card ${unread?'unread':''}"><div class="announcement-top"><div><b>${esc(x.title||'Notifikasi')}</b><div class="notification-meta">${esc(notificationTypeLabel(type))} · ${esc(formatNotificationDate(x.createdAt))}</div></div><span class="announcement-status ${cls}">${esc(notificationTypeLabel(type))}</span></div><p>${esc(x.message||'')}</p>${unread?`<div class="notification-actions"><button class="btn btn-secondary" onclick="markNotificationReadUI('${esc(x.notificationId)}')">Tandai dibaca</button></div>`:''}</article>`}).join('')}</div>`;updateNotificationBadge();}
function closeNotificationPopup(){const popup=$('notificationPopupBackdrop');if(popup)popup.remove();const button=document.querySelector('.notification-bell-wrap');if(button)button.setAttribute('aria-expanded','false');}
async function toggleNotificationPopup(){if($('notificationPopupBackdrop')){closeNotificationPopup();return;}await openNotificationPopup();}
async function openNotificationPopup(force=false){
  if(!state.token)return;
  closeNotificationPopup();
  document.body.insertAdjacentHTML('beforeend','<div class="notification-popover-backdrop" id="notificationPopupBackdrop" onclick="if(event.target===this)closeNotificationPopup()"><section class="notification-popover" role="dialog" aria-modal="false" aria-labelledby="notificationPopupTitle"><div class="notification-popover-head"><div><b id="notificationPopupTitle">Notifikasi</b><span>Informasi terbaru terkait proses PSB</span></div><button type="button" class="notification-popover-close" aria-label="Tutup notifikasi" onclick="closeNotificationPopup()">×</button></div><div id="notificationPanel"><div class="announcement-empty">Memuat notifikasi...</div></div></section></div>');
  const button=document.querySelector('.notification-bell-wrap');if(button)button.setAttribute('aria-expanded','true');
  await refreshNotificationPopup(force);
}
async function refreshNotificationPopup(force=true){
  const panel=$('notificationPanel');if(!panel)return;
  panel.innerHTML='<div class="announcement-empty">Memuat notifikasi...</div>';
  try{const cached=pageDataCached('notifications');const r=force?await server('getNotifications',state.token):(cached||await warmPageData('notifications',()=>server('getNotifications',state.token)));if(!r?.success){panel.innerHTML=showMessage(r?.message||'Gagal memuat notifikasi.');return;}renderNotificationPanel(r);}
  catch(e){if($('notificationPanel'))$('notificationPanel').innerHTML=showMessage('Gagal memuat notifikasi.');}
}
async function markNotificationReadUI(id){try{const r=await server('markNotificationRead',state.token,id);if(!r?.success){showToast(r?.message||'Notifikasi belum dapat diperbarui. Silakan coba lagi.','warning');return}if($('notificationPopupBackdrop'))await refreshNotificationPopup();else await renderNotifications();updateNotificationBadge();}catch(e){showToast('Notifikasi belum dapat ditandai dibaca. Periksa koneksi, lalu coba lagi.','error')}}
async function markAllNotificationsReadUI(){loading(true,'Memperbarui notifikasi...');try{const r=await server('markAllNotificationsRead',state.token);if(r.success){showToast('Semua notifikasi ditandai sudah dibaca.','success');if($('notificationPopupBackdrop'))await refreshNotificationPopup();else await renderNotifications();updateNotificationBadge()}}catch(e){showToast('Gagal memperbarui notifikasi.','error')}finally{loading(false)}}

async function renderVerification(force=false){
  if(!hasAnyRole(['SUPERADMIN','ADMIN_PSB','VERIFIKATOR'])){renderMore();return}
  state.verificationSearch=state.verificationSearch||'';
  state.verificationStatus=state.verificationStatus||'';
  $('content').innerHTML=`<section class="hero"><h2>Verifikasi</h2><p>Periksa data pendaftaran dan dokumen sebelum menetapkan hasil verifikasi.</p></section><div id="verificationPanel"><div class="empty-state">Memuat antrean verifikasi...</div></div>`;
  try{
    const filters={page:1,pageSize:50,search:state.verificationSearch,status:state.verificationStatus};
    const useCache=!force&&!state.verificationSearch&&!state.verificationStatus;
    const r=useCache?(pageDataCached('verification')||await warmPageData('verification',()=>server('getVerificationQueue',state.token,filters))):await server('getVerificationQueue',state.token,filters);
    if(!r?.success){$('verificationPanel').innerHTML=showMessage(r?.message||'Gagal memuat antrean verifikasi.');return}
    renderVerificationQueue(r.registrations||[],r);
  }catch(e){$('verificationPanel').innerHTML=showMessage('Gagal memuat antrean verifikasi.')}
}
function renderStaffDataTable(rows, columns, emptyMessage){
  const items=Array.isArray(rows)?rows:[];
  if(!items.length)return `<div class="empty-state">${esc(emptyMessage||'Tidak ada data untuk ditampilkan.')}</div>`;
  const heads=columns.map(col=>`<th scope="col" class="${esc(col.className||'')}">${esc(col.label||'')}</th>`).join('');
  const body=items.map((row,rowIndex)=>`<tr>${columns.map(col=>`<td class="${esc(col.className||'')}">${typeof col.render==='function'?col.render(row,rowIndex):esc(row?.[col.key]??'-')}</td>`).join('')}</tr>`).join('');
  return `<div class="staff-table-scroll" role="region" aria-label="Tabel data" tabindex="0"><table class="staff-data-table"><thead><tr>${heads}</tr></thead><tbody>${body}</tbody></table></div>`;
}
function renderVerificationQueue(items,meta){
  const el=$('verificationPanel'); if(!el)return;
  state.verificationQueue=items||[];
  state.verificationPageMeta={page:Number(meta?.page||1),pageCount:Number(meta?.pageCount||1),total:Number(meta?.total||state.verificationQueue.length),pageSize:Number(meta?.pageSize||50)};
  const page=state.verificationPageMeta;
  el.innerHTML=`<div class="verification-toolbar"><div class="search-box"><span class="search-icon">${ico('search')}</span><input id="verificationSearch" class="search-input" placeholder="Cari nama atau nomor pendaftaran..." autocomplete="off" value="${esc(state.verificationSearch||'')}" onkeydown="if(event.key==='Enter')loadVerificationQueue(1)"><button type="button" class="btn btn-secondary staff-table-action" onclick="loadVerificationQueue(1)">Cari</button><button type="button" class="search-clear" id="verificationSearchClear" onclick="clearVerificationSearch()" aria-label="Hapus pencarian">×</button></div><div class="filter-box professional-filter"><span class="filter-label">Status</span><select id="verificationStatus" class="select-field compact professional-select" onchange="loadVerificationQueue(1)"><option value="">Semua status</option><option value="SUBMITTED">Menunggu verifikasi</option><option value="UNDER_REVIEW">Sedang diperiksa</option><option value="REVISION">Perlu revisi</option><option value="REREGISTRATION">Daftar ulang · pemeriksaan dokumen</option></select></div></div><div id="verificationList"></div><div class="staff-pagination"><button class="btn btn-secondary staff-table-action" onclick="loadVerificationQueue(${Math.max(1,page.page-1)})" ${page.page<=1?'disabled':''}>Sebelumnya</button><span>Halaman ${page.page} dari ${page.pageCount} · ${page.total} pendaftar</span><button class="btn btn-secondary staff-table-action" onclick="loadVerificationQueue(${Math.min(page.pageCount,page.page+1)})" ${page.page>=page.pageCount?'disabled':''}>Berikutnya</button></div>`;
  const status=$('verificationStatus');if(status)status.value=state.verificationStatus||'';
  const clear=$('verificationSearchClear');if(clear)clear.classList.toggle('show',!!state.verificationSearch);
  renderVerificationList(state.verificationQueue);
}
function renderVerificationList(items){
  const el=$('verificationList');if(!el)return;
  const columns=[
    {label:'No.',className:'staff-col-number',render:(x,i)=>String(((state.verificationPageMeta?.page||1)-1)*(state.verificationPageMeta?.pageSize||50)+i+1)},
    {label:'Nama Calon Santri',render:x=>`<div class="staff-primary-text">${esc(x.candidateName||'-')}</div><div class="staff-secondary-text">${esc(x.registrationNumber||'-')}</div>`},
    {label:'Jenjang / Gelombang',render:x=>`${esc(x.jenjangName||'-')}<div class="staff-secondary-text">${esc(x.gelombangName||'-')}</div>`},
    {label:'Pembayaran',render:x=>esc(x.formPaymentStatusLabel||'Belum diketahui')},
    {label:'Dokumen',render:x=>esc(x.documentsStatusLabel||'Belum diketahui')},
    {label:'Status',render:x=>`<span class="pill ${String(x.status)==='VERIFIED'?'ok':''}">${esc(statusLabel(x.status))}</span>`},
    {label:'Aksi',className:'staff-col-actions',render:x=>`<button class="btn btn-primary staff-table-action" onclick="openVerification('${esc(x.registrationId)}')">Periksa</button>`}
  ];
  const elHtml=renderStaffDataTable(items,columns,'Tidak ada pendaftaran pada antrean verifikasi.');
  el.innerHTML=elHtml;
}
function filterVerificationQueue(){renderVerificationList(state.verificationQueue||[]);}
function clearVerificationSearch(){state.verificationSearch='';const el=$('verificationSearch');if(el)el.value='';loadVerificationQueue(1);}
async function loadVerificationQueue(page){
  state.verificationSearch=String($('verificationSearch')?.value??state.verificationSearch??'').trim();
  state.verificationStatus=String($('verificationStatus')?.value??state.verificationStatus??'');
  loading(true,'Memuat antrean...');
  try{
    const r=await server('getVerificationQueue',state.token,{page:page||1,pageSize:50,search:state.verificationSearch,status:state.verificationStatus});
    if(r.success)renderVerificationQueue(r.registrations||[],r);else showToast(r.message,'error');
  }catch(e){showToast('Gagal memuat antrean.','error')}
  finally{loading(false)}
}
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
 const isReregistration=String(r.status||'').toUpperCase()==='REREGISTRATION';
 const decisionPanel=isReregistration?`<section class="card" style="margin-top:14px"><b>Pemeriksaan Dokumen Daftar Ulang</b><p class="muted">Gunakan tindakan pada tiap dokumen untuk menerima berkas atau meminta perbaikan. Keputusan administrasi pendaftaran sudah ditetapkan pada tahap sebelumnya.</p></section>`:`<section class="card" style="margin-top:14px"><b>Keputusan Verifikasi</b><p class="muted">Verifikasi akhir hanya dapat dilakukan jika seluruh dokumen wajib sudah berstatus terverifikasi.</p><div class="verification-note-box"><div class="verification-note-head"><div class="verification-note-icon">${ico('info')}</div><div><div class="verification-note-title">Catatan untuk Wali Santri</div><div class="verification-note-help">Tuliskan alasan atau arahan yang perlu diketahui wali jika pendaftaran dikembalikan untuk revisi.</div></div></div><textarea id="verificationNote" class="textarea-field" placeholder="Contoh: Mohon perbaiki dokumen KK karena foto kurang jelas."></textarea></div><div class="registration-actions" style="margin-top:12px"><button id="verificationRevisionBtn" class="btn btn-secondary" onclick="finalizeVerificationUI('REVISION','${esc(r.registrationId)}')">Minta Revisi</button><button id="verificationApproveBtn" class="btn btn-primary" onclick="finalizeVerificationUI('VERIFIED','${esc(r.registrationId)}')">Verifikasi</button></div></section>`;
 root.innerHTML=`<section class="hero">${target?'':'<button class="btn btn-secondary" onclick="renderVerification()">← Kembali</button>'}<h2 style="margin-top:12px">${isReregistration?'Pemeriksaan Dokumen Daftar Ulang':'Verifikasi'} ${esc(r.registrationNumber||'')}</h2><p>${esc(c.fullName||'-')} · ${esc(statusLabel(r.status))}</p></section><div class="grid"><article class="card"><div class="icon">${ico('user')}</div><b>Data Pribadi</b><p>${esc(c.fullName||'-')}<br>${esc(c.birthPlace||'-')}, ${esc(c.birthDate||'-')}<br>Jenis kelamin: ${esc(c.gender||'-')}</p></article><article class="card"><div class="icon">${ico('users')}</div><b>Data Wali</b><p>${esc(g.fullName||'-')}<br>${esc(g.relationship||'-')} · ${esc(g.phone||'-')}</p></article><article class="card"><div class="icon">${ico('home')}</div><b>Alamat</b><p>${esc(a.addressLine||'-')}<br>${esc(a.village||'-')}, ${esc(a.district||'-')}</p></article><article class="card"><div class="icon">${ico('school')}</div><b>Sekolah</b><p>${esc(s.schoolName||'-')}<br>Tahun lulus: ${esc(s.graduationYear||'-')}</p></article></div><section class="progress-card" style="margin-top:14px"><div class="progress-head"><div><b>Dokumen</b><div class="muted" style="font-size:11px;margin-top:3px">${isReregistration?'Periksa dokumen daftar ulang yang masuk.':'Periksa setiap berkas sebelum verifikasi akhir.'}</div></div></div><div id="verificationDocs">${renderVerificationDocsHtml(d)}</div></section>${decisionPanel}`;
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



async function renderRegistrationHub(force=false){
  if(!hasAnyRole(['WALI','SUPERADMIN','ADMIN_PSB'])){renderMore();return;}
  $('content').innerHTML=`<section class="hero"><h2>Pendaftaran</h2><p>Satu akun wali dapat mengelola beberapa pendaftaran anak.</p></section><div id="registrationPanel"><div class="empty-state">Memuat pendaftaran...</div></div>`;
  if(!force&&state.cache.registration){state.registrationList=state.cache.registration;renderRegistrationList();return;}
  try{const r=await server('getMyRegistrations',state.token);if(!r.success){$('registrationPanel').innerHTML=showMessage(r.message);return}state.registrationList=r.registrations||[];state.cache.registration=state.registrationList;renderRegistrationList();}catch(e){$('registrationPanel').innerHTML=showMessage('Gagal memuat pendaftaran.');}
}
function renderRegistrationList(){
  const el=$('registrationPanel');if(!el)return;
  const items=state.registrationList||[];
  el.innerHTML=`<div class="master-head"><div><h2 style="margin:0;font-size:18px">Anak / Pendaftaran</h2><p>Draft dapat dilanjutkan sebelum dikirim untuk verifikasi.</p></div><button class="btn btn-primary master-add" onclick="openRegistrationForm()">+ Pendaftaran</button></div>${items.length?`<div class="registration-list">${items.map(r=>`<article class="registration-item"><div class="registration-item-top"><div><div class="registration-name">${esc(r.candidateName||'Belum diisi')}</div><div class="registration-number">${esc(r.registrationNumber||'-')}</div></div><span class="pill ${r.status==='VERIFIED'?'ok':''}">${esc(statusLabel(r.status))}</span></div><div class="registration-meta"><span>${esc(r.jenjangName||'-')} · ${esc(r.gelombangName||'-')}</span><span>Pembayaran: ${esc(r.formPaymentStatusLabel||'Belum diketahui')}</span><span>Dokumen: ${esc(r.documentsStatusLabel||'Belum diketahui')}</span><span>Diperbarui: ${esc(String(r.updatedAt||'-').replace('T',' ').substring(0,16))}</span></div><div class="registration-actions">${['DRAFT','REVISION'].includes(String(r.status))?`<button class="btn btn-secondary" onclick="openRegistrationForm('${esc(r.registrationId)}')">Lanjutkan</button>`:`<button class="btn btn-secondary" onclick="viewRegistration('${esc(r.registrationId)}')">Lihat</button>`}${r.status==='DRAFT'||r.status==='REVISION'?`<button class="btn btn-primary" onclick="submitRegistrationUI('${esc(r.registrationId)}')">Kirim Pendaftaran</button>`:''}</div></article>`).join('')}</div>`:`<div class="empty-state">Belum ada pendaftaran.<br>Mulai pendaftaran pertama untuk calon santri.</div>`}`;
}
function statusLabel(s){return ({DRAFT:'Draft',SUBMITTED:'Pendaftaran dikirim',UNDER_REVIEW:'Sedang diverifikasi',REVISION:'Perlu perbaikan',VERIFIED:'Administrasi terverifikasi',PENDING:'Menunggu verifikasi dokumen',REPLACED:'Diganti',PAYMENT_PENDING:'Menunggu pembayaran',PAYMENT_VERIFIED:'Pembayaran terverifikasi',SELECTION:'Seleksi',PASSED:'Lulus',NOT_PASSED:'Tidak lulus',REREGISTRATION:'Daftar ulang',COMPLETED:'Selesai',CANCELLED:'Dibatalkan'})[s]||s||'-';}
async function openRegistrationForm(registrationId){
  $('content').innerHTML='<div class="empty-state">Menyiapkan formulir pendaftaran...</div>';
  try{const opt=await server('getRegistrationFormOptions',state.token);if(!opt.success){$('content').innerHTML=showMessage(opt.message);return}state.registrationOptions=opt;let detail=null;if(registrationId){const d=await server('getRegistrationDetail',state.token,registrationId);if(!d.success){$('content').innerHTML=showMessage(d.message);return}detail=d;state.registrationDetail=d;}else state.registrationDetail=null;renderRegistrationForm(detail);}
  catch(e){$('content').innerHTML=showMessage('Gagal menyiapkan formulir pendaftaran.');}
}
function renderRegistrationForm(detail){
  const r=detail?.registration||{}, c=detail?.candidate||{}, g=detail?.guardian||{}, a=detail?.address||{}, s=detail?.school||{}, o=state.registrationOptions||{};
  const years=o.years||[], waves=o.waves||[], levels=o.jenjang||[];
  $('content').innerHTML=`<section class="hero"><div style="display:flex;align-items:flex-start;gap:10px"><div style="flex:1"><h2>${r.registrationId?'Lanjutkan Pendaftaran':'Pendaftaran Baru'}</h2><p>Lengkapi data calon santri, lalu kirim pendaftaran setelah seluruh data wajib selesai. Anda tetap dapat menyimpan sementara jika belum siap mengirim.</p></div><button type="button" class="top-action" title="Kembali" onclick="exitRegistrationForm()">${ico('logout')}</button></div></section><div id="registrationFormMsg"></div><form id="registrationForm" onsubmit="return false"><input type="hidden" id="rf_registrationId" value="${esc(r.registrationId||'')}"><div class="registration-required-note"><span class="registration-required-mark">*</span> wajib diisi</div><section class="form-section"><div class="form-section-head"><span class="form-step">1</span><div><h3>Formulir Pendaftaran</h3><p>Tahun ajaran, gelombang, dan jenjang tujuan.</p></div></div><div class="form-grid"><div class="field"><label>Tahun Ajaran <span class="registration-required-mark">*</span></label><select id="rf_tahunAjaranId" class="select-field" onchange="filterRegistrationWaves()"><option value="">Pilih tahun ajaran</option>${years.map(x=>`<option value="${esc(x.tahunAjaranId)}" ${String(x.tahunAjaranId)===String(r.tahunAjaranId||o.activeYearId)?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div><div class="field"><label>Gelombang <span class="registration-required-mark">*</span></label><select id="rf_gelombangId" class="select-field"><option value="">Pilih gelombang</option>${waves.map(x=>`<option data-year="${esc(x.tahunAjaranId)}" value="${esc(x.gelombangId)}" ${String(x.gelombangId)===String(r.gelombangId||'')?'selected':''}>${esc(x.name)}${x.startDate?' · '+esc(x.startDate):''}</option>`).join('')}</select></div><div class="field"><label>Jenjang Tujuan <span class="registration-required-mark">*</span></label><select id="rf_jenjangId" class="select-field"><option value="">Pilih jenjang</option>${levels.map(x=>`<option value="${esc(x.jenjangId)}" ${String(x.jenjangId)===String(r.jenjangId||'')?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div></div></section><section class="form-section"><div class="form-section-head"><span class="form-step">2</span><div><h3>Data Calon Santri</h3><p>Identitas dasar calon santri.</p></div></div><div class="form-grid"><div class="field"><label>Nama Lengkap <span class="registration-required-mark">*</span></label><input id="rf_fullName" value="${esc(c.fullName||'')}" autocomplete="name"></div><div class="field"><label>NIK</label><input id="rf_nik" inputmode="numeric" maxlength="16" value="${esc(c.nik||'')}"></div><div class="field"><label>NISN</label><input id="rf_nisn" inputmode="numeric" maxlength="10" value="${esc(c.nisn||'')}" placeholder="10 digit"></div><div class="field"><label>Tempat Lahir <span class="registration-required-mark">*</span></label><input id="rf_birthPlace" value="${esc(c.birthPlace||'')}"></div><div class="field"><label>Tanggal Lahir <span class="registration-required-mark">*</span></label><input id="rf_birthDate" type="date" value="${esc(String(c.birthDate||'').substring(0,10))}"></div><div class="field"><label>Jenis Kelamin <span class="registration-required-mark">*</span></label><select id="rf_gender" class="select-field"><option value="">Pilih</option><option value="L" ${c.gender==='L'?'selected':''}>Laki-laki</option><option value="P" ${c.gender==='P'?'selected':''}>Perempuan</option></select></div><div class="field"><label>Anak Ke-</label><input id="rf_birthOrder" type="number" min="1" inputmode="numeric" value="${esc(c.birthOrder||'')}"></div><div class="field"><label>Status Dalam Keluarga</label><input id="rf_familyStatus" placeholder="Contoh: Anak kandung" value="${esc(c.familyStatus||'')}"></div></div></section><section class="form-section"><div class="form-section-head"><span class="form-step">3</span><div><h3>Data Wali</h3><p>Data wali utama yang bertanggung jawab atas pendaftaran.</p></div></div><div class="form-grid"><div class="field"><label>Hubungan <span class="registration-required-mark">*</span></label><select id="rf_relationship" class="select-field"><option value="">Pilih</option>${['Ayah','Ibu','Wali'].map(x=>`<option ${g.relationship===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="field"><label>Nama Wali <span class="registration-required-mark">*</span></label><input id="rf_guardianName" value="${esc(g.fullName||state.user.name||'')}" autocomplete="name"></div><div class="field"><label>NIK Wali</label><input id="rf_guardianNik" inputmode="numeric" maxlength="16" value="${esc(g.nik||'')}"></div><div class="field"><label>No. HP Wali <span class="registration-required-mark">*</span></label><input id="rf_guardianPhone" inputmode="tel" value="${esc(g.phone||state.user.phone||'')}" autocomplete="tel"></div><div class="field"><label>Email</label><input id="rf_guardianEmail" type="email" value="${esc(g.email||state.user.email||'')}" autocomplete="email"></div><div class="field"><label>Pekerjaan</label><input id="rf_occupation" value="${esc(g.occupation||'')}"></div><div class="field"><label>Pendidikan</label><input id="rf_education" value="${esc(g.education||'')}"></div></div></section><section class="form-section"><div class="form-section-head"><span class="form-step">4</span><div><h3>Alamat Domisili</h3><p>Alamat tempat tinggal calon santri.</p></div></div><div class="form-grid"><div class="field"><label>Alamat Lengkap <span class="registration-required-mark">*</span></label><input id="rf_addressLine" value="${esc(a.addressLine||'')}"></div><div class="form-grid two"><div class="field"><label>RT</label><input id="rf_rt" inputmode="numeric" value="${esc(a.rt||'')}"></div><div class="field"><label>RW</label><input id="rf_rw" inputmode="numeric" value="${esc(a.rw||'')}"></div></div><div class="field"><label>Desa/Kelurahan <span class="registration-required-mark">*</span></label><input id="rf_village" value="${esc(a.village||'')}"></div><div class="field"><label>Kecamatan <span class="registration-required-mark">*</span></label><input id="rf_district" value="${esc(a.district||'')}"></div><div class="field"><label>Kabupaten/Kota <span class="registration-required-mark">*</span></label><input id="rf_regency" value="${esc(a.regency||'')}"></div><div class="field"><label>Provinsi <span class="registration-required-mark">*</span></label><input id="rf_province" value="${esc(a.province||'')}"></div><div class="field"><label>Kode Pos</label><input id="rf_postalCode" inputmode="numeric" value="${esc(a.postalCode||'')}"></div></div></section><section class="form-section"><div class="form-section-head"><span class="form-step">5</span><div><h3>Sekolah Asal</h3><p>Informasi sekolah terakhir calon santri.</p></div></div><div class="form-grid"><div class="field"><label>Nama Sekolah <span class="registration-required-mark">*</span></label><input id="rf_schoolName" value="${esc(s.schoolName||'')}"></div><div class="field"><label>NPSN</label><input id="rf_npsn" inputmode="numeric" value="${esc(s.npsn||'')}"></div><div class="field"><label>Alamat Sekolah</label><input id="rf_schoolAddress" value="${esc(s.address||'')}"></div><div class="field"><label>Tahun Lulus <span class="registration-required-mark">*</span></label><input id="rf_graduationYear" type="number" min="1900" max="2200" inputmode="numeric" value="${esc(s.graduationYear||'')}"></div></div></section><div class="form-actions"><div class="form-actions-inner"><button type="button" class="btn btn-secondary" onclick="saveRegistrationUI(false)">Simpan Sementara</button><button type="button" class="btn btn-primary" onclick="saveRegistrationUI(true)">Simpan &amp; Kirim Pendaftaran</button></div></div></form>`;
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
  const nisn=$('rf_nisn')?.value||'';
  if(nisn && !/^\d{10}$/.test(nisn))return {valid:false,label:'NISN harus terdiri dari 10 digit jika diisi.'};
  return {valid:true};
}
function exitRegistrationForm(){showConfirm('Keluar dari formulir?','Jika data belum tersimpan sebagai draft, perubahan terakhir dapat hilang. Pastikan sudah menyimpan sebelum keluar.',()=>goPage('registration'),'Keluar')}
function confirmLogout(){showConfirm('Keluar dari akun?','Sesi Anda akan diakhiri pada perangkat ini.',()=>doLogout(),'Keluar')}
function registrationPayload(){const g=id=>$(id)?.value||'';return {registrationId:g('rf_registrationId'),tahunAjaranId:g('rf_tahunAjaranId'),gelombangId:g('rf_gelombangId'),jenjangId:g('rf_jenjangId'),candidate:{fullName:g('rf_fullName'),nik:g('rf_nik'),nisn:g('rf_nisn'),birthPlace:g('rf_birthPlace'),birthDate:g('rf_birthDate'),gender:g('rf_gender'),birthOrder:g('rf_birthOrder'),familyStatus:g('rf_familyStatus')},guardian:{relationship:g('rf_relationship'),fullName:g('rf_guardianName'),nik:g('rf_guardianNik'),phone:g('rf_guardianPhone'),email:g('rf_guardianEmail'),occupation:g('rf_occupation'),education:g('rf_education')},address:{addressLine:g('rf_addressLine'),rt:g('rf_rt'),rw:g('rf_rw'),village:g('rf_village'),district:g('rf_district'),regency:g('rf_regency'),province:g('rf_province'),postalCode:g('rf_postalCode')},school:{schoolName:g('rf_schoolName'),npsn:g('rf_npsn'),address:g('rf_schoolAddress'),graduationYear:g('rf_graduationYear')}};}
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
async function submitRegistrationUI(id){showConfirm('Kirim pendaftaran?','Setelah dikirim, silakan selesaikan pembayaran formulir terlebih dahulu. Menu Upload Dokumen akan aktif setelah pembayaran dikonfirmasi oleh Keuangan.',async()=>{loading(true,'Mengirim pendaftaran...');try{const r=await server('submitRegistration',state.token,id);if(r.success){showToast(r.message,'success');await renderRegistrationHub();}else showAlert('Belum dapat dikirim',r.message||'Silakan periksa kembali data pendaftaran.','warning')}catch(e){showAlert('Gagal mengirim', 'Terjadi gangguan saat mengirim pendaftaran. Silakan coba lagi.','error')}finally{loading(false)}} ,'Kirim Pendaftaran')}
async function viewRegistration(id){
  const key='registrationDetail';if(state.detailLoadingLocks[key])return;state.detailLoadingLocks[key]=true;
  let modal=$('registrationDetailModal');
  if(!modal){document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="registrationDetailModal"><div class="modal" style="max-width:900px;width:min(94vw,900px);max-height:90vh;overflow:auto"><div class="status-row"><div><h3 style="margin:0">Detail Pendaftaran</h3><p class="muted" style="margin:4px 0 0">Memuat data pendaftaran...</p></div><button class="btn btn-secondary" onclick="closeRegistrationDetailUI()">Tutup</button></div><div id="registrationDetailBody" style="margin-top:14px"><div class="empty-state">Memuat pendaftaran...</div></div></div></div>`);modal=$('registrationDetailModal')}
  else{const b=$('registrationDetailBody');if(b)b.innerHTML='<div class="empty-state">Memuat pendaftaran...</div>';modal.style.display='flex'}
  try{const r=await server('getRegistrationDetail',state.token,id);const b=$('registrationDetailBody');if(!b)return;if(!r.success){b.innerHTML=showMessage(r.message||'Pendaftaran tidak dapat dimuat.','warning');return}state.registrationDetail=r;renderRegistrationDetail(r,b)}catch(e){const b=$('registrationDetailBody');if(b)b.innerHTML=showMessage('Gagal memuat detail pendaftaran.','error')}finally{state.detailLoadingLocks[key]=false}
}
function closeRegistrationDetailUI(){state.detailLoadingLocks.registrationDetail=false;$('registrationDetailModal')?.remove()}
function renderRegistrationDetail(d,target){const r=d.registration,c=d.candidate||{},g=d.guardian||{},a=d.address||{},s=d.school||{};const root=target||$('content');root.innerHTML=`<section class="hero"><h2>${esc(c.fullName||'Pendaftaran')}</h2><p>${esc(r.registrationNumber||'-')} · ${esc(statusLabel(r.status))}</p></section><section class="form-section"><h3>Data Pendaftaran</h3><div class="registration-meta"><span>Tahun Ajaran: ${esc(state.registrationOptions?.activeYearName||r.tahunAjaranId)}</span><span>Jenjang: ${esc(r.jenjangId)}</span><span>Gelombang: ${esc(r.gelombangId)}</span></div></section><section class="form-section"><h3>Calon Santri</h3><div class="registration-meta"><span>Nama: ${esc(c.fullName||'-')}</span><span>NISN: ${esc(c.nisn||'-')}</span><span>Tempat/Tanggal lahir: ${esc(c.birthPlace||'-')} / ${esc(String(c.birthDate||'-').substring(0,10))}</span><span>Jenis kelamin: ${esc(c.gender==='L'?'Laki-laki':c.gender==='P'?'Perempuan':'-')}</span></div></section><section class="form-section"><h3>Wali</h3><div class="registration-meta"><span>${esc(g.relationship||'-')} · ${esc(g.fullName||'-')}</span><span>${esc(g.phone||'-')} · ${esc(g.email||'-')}</span></div></section><section class="form-section"><h3>Alamat</h3><div class="registration-meta"><span>${esc(a.addressLine||'-')}</span><span>${esc(a.village||'-')}, ${esc(a.district||'-')}, ${esc(a.regency||'-')}, ${esc(a.province||'-')}</span></div></section><section class="form-section"><h3>Sekolah Asal</h3><div class="registration-meta"><span>${esc(s.schoolName||'-')}</span><span>Tahun lulus: ${esc(s.graduationYear||'-')}</span></div></section><div style="display:grid;gap:9px"><button class="btn btn-primary" onclick="openDocumentsForRegistration('${esc(r.registrationId)}')">${ico('file')} &nbsp; Kelola Dokumen</button>${target?'':'<button class="btn btn-secondary" onclick="goPage(\'registration\')">Kembali</button>'}</div>`;}
async function renderApplicants(force=false){
  if(!hasAnyRole(['SUPERADMIN','ADMIN_PSB','VERIFIKATOR'])){renderMore();return;}
  state.applicantSearch=state.applicantSearch||'';
  state.applicantStatus=state.applicantStatus||'';
  $('content').innerHTML=`<section class="hero"><h2>Pendaftar</h2><p>Daftar pendaftaran yang masuk ke sistem.</p></section><div id="applicantPanel"><div class="empty-state">Memuat pendaftar...</div></div>`;
  try{
    const filters={page:1,pageSize:50,search:state.applicantSearch,status:state.applicantStatus};
    const useCache=!force&&!state.applicantSearch&&!state.applicantStatus;
    const r=useCache?(pageDataCached('applicants')||await warmPageData('applicants',()=>server('getRegistrationList',state.token,filters))):await server('getRegistrationList',state.token,filters);
    if(!r?.success){$('applicantPanel').innerHTML=showMessage(r.message);return;}
    state.applicantList=r.registrations||[];
    state.applicantPageMeta={page:Number(r.page||1),pageCount:Number(r.pageCount||1),total:Number(r.total||0),pageSize:Number(r.pageSize||50)};
    renderApplicantTable();
  }catch(e){$('applicantPanel').innerHTML=showMessage('Gagal memuat pendaftar.');}
}
function renderApplicantTable(){
  const el=$('applicantPanel');if(!el)return;
  const meta=state.applicantPageMeta||{page:1,pageCount:1,total:(state.applicantList||[]).length,pageSize:50};
  el.innerHTML=`<div class="staff-list-toolbar"><div class="search-box"><span class="search-icon">${ico('search')}</span><input id="applicantSearch" class="search-input" placeholder="Cari nama atau nomor pendaftaran..." autocomplete="off" value="${esc(state.applicantSearch||'')}" onkeydown="if(event.key==='Enter')loadApplicantPage(1)"><button type="button" class="btn btn-secondary staff-table-action" onclick="loadApplicantPage(1)">Cari</button></div><div class="filter-box professional-filter"><span class="filter-label">Status</span><select id="applicantStatus" class="select-field compact professional-select" onchange="loadApplicantPage(1)"><option value="">Semua status</option><option value="DRAFT">Draft</option><option value="SUBMITTED">Pendaftaran dikirim</option><option value="UNDER_REVIEW">Sedang diverifikasi</option><option value="REVISION">Perlu perbaikan</option><option value="VERIFIED">Terverifikasi</option><option value="SELECTION">Seleksi</option><option value="PASSED">Lulus</option><option value="NOT_PASSED">Tidak lulus</option><option value="REREGISTRATION">Daftar ulang</option><option value="COMPLETED">Selesai</option></select></div><div class="staff-result-count" id="applicantCount"></div></div><div id="applicantTable"></div><div class="staff-pagination"><button class="btn btn-secondary staff-table-action" onclick="loadApplicantPage(${Math.max(1,meta.page-1)})" ${meta.page<=1?'disabled':''}>Sebelumnya</button><span>Halaman ${meta.page} dari ${meta.pageCount} · ${meta.total} pendaftar</span><button class="btn btn-secondary staff-table-action" onclick="loadApplicantPage(${Math.min(meta.pageCount,meta.page+1)})" ${meta.page>=meta.pageCount?'disabled':''}>Berikutnya</button></div>`;
  const status=$('applicantStatus');if(status)status.value=state.applicantStatus||'';
  filterApplicantTable();
}
function filterApplicantTable(){
  const items=state.applicantList||[];
  const count=$('applicantCount');if(count)count.textContent=`Menampilkan ${items.length} data pada halaman ${state.applicantPageMeta?.page||1}`;
  const columns=[
    {label:'No.',className:'staff-col-number',render:(x,i)=>String(((state.applicantPageMeta?.page||1)-1)*(state.applicantPageMeta?.pageSize||50)+i+1)},
    {label:'Calon Santri',render:x=>`<div class="staff-primary-text">${esc(x.candidateName||'-')}</div><div class="staff-secondary-text">${esc(x.registrationNumber||'-')}</div>`},
    {label:'Jenjang / Gelombang',render:x=>`${esc(x.jenjangName||'-')}<div class="staff-secondary-text">${esc(x.gelombangName||'-')}</div>`},
    {label:'Pembayaran',render:x=>esc(x.formPaymentStatusLabel||'Belum diketahui')},
    {label:'Dokumen',render:x=>esc(x.documentsStatusLabel||'Belum diketahui')},
    {label:'Status',render:x=>`<span class="pill ${String(x.status)==='VERIFIED'?'ok':''}">${esc(statusLabel(x.status))}</span>`},
    {label:'Aksi',className:'staff-col-actions',render:x=>`<div class="staff-table-actions"><button class="btn btn-secondary staff-table-action" onclick="viewRegistration('${esc(x.registrationId)}')">Lihat</button><button class="btn btn-primary staff-table-action" onclick="openDocumentsForRegistration('${esc(x.registrationId)}')">Dokumen</button></div>`}
  ];
  const target=$('applicantTable');if(target)target.innerHTML=renderStaffDataTable(items,columns,'Belum ada pendaftaran yang sesuai dengan filter.');
}
async function loadApplicantPage(page){
  const search=String($('applicantSearch')?.value??state.applicantSearch??'').trim();
  const status=String($('applicantStatus')?.value??state.applicantStatus??'');
  state.applicantSearch=search;state.applicantStatus=status;
  loading(true,'Memuat daftar pendaftar...');
  try{
    const r=await server('getRegistrationList',state.token,{page:page||1,pageSize:50,search,status});
    if(!r?.success){showToast(r?.message||'Gagal memuat pendaftar.','error');return;}
    state.applicantList=r.registrations||[];
    state.applicantPageMeta={page:Number(r.page||1),pageCount:Number(r.pageCount||1),total:Number(r.total||0),pageSize:Number(r.pageSize||50)};
    renderApplicantTable();
  }catch(e){showToast('Gagal memuat pendaftar.','error');}
  finally{loading(false);}
}
async function renderDocuments(registrationId,force=false){
  if(!hasAnyRole(['WALI','SUPERADMIN','ADMIN_PSB','VERIFIKATOR'])){renderMore();return;}
  state.documentRegistrationId=registrationId||state.documentRegistrationId||'';
  $('content').innerHTML=`<section class="hero"><h2>Dokumen Pendaftaran</h2><p>Kelola berkas persyaratan dan simpan file secara terstruktur di Google Drive.</p></section><div id="documentPanel"><div class="empty-state">Memuat daftar pendaftaran...</div></div>`;
  try{
    let r=!force&&!hasAnyRole(['WALI'])?state.cache.documents[state.documentRegistrationId]||null:null;
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
  if(cached?.documentData&&!hasAnyRole(['WALI'])){state.documentData=cached.documentData;renderDocumentContent();return;}
  target.innerHTML='<div class="empty-state">Memuat dokumen...</div>';
  try{const r=await server('getDocumentOptions',state.token,id);if(!r.success){target.innerHTML=showMessage(r.message);return}state.documentData=r;state.cache.documents[state.documentRegistrationId]={success:true,registrations:state.registrationList||[],documentData:r};renderDocumentContent();}catch(e){target.innerHTML=showMessage('Gagal memuat dokumen.');}
}
function renderDocumentContent(){
  const d=state.documentData||{}, checks=d.checklist||[], current=d.documents||[];
  const required=checks.filter(x=>x.required), uploadedRequired=required.filter(x=>x.uploaded).length, pending=current.filter(x=>String(x.status||'').toUpperCase()==='PENDING').length;
  const canUpload=!!d.canUpload;
  const paymentNotice=d.paymentRequired?`<div class="message warning" style="margin-bottom:12px"><b>Pembayaran formulir belum dikonfirmasi.</b><div>Menu Upload Dokumen akan aktif setelah Keuangan mengonfirmasi pembayaran.</div><button type="button" class="btn btn-primary" style="margin-top:10px" onclick="state.paymentRegistrationId='${esc(d.registration?.registrationId||state.documentRegistrationId||'')}';goPage('payments')">Buka Pembayaran Formulir</button></div>`:'';
  const cards=checks.length?checks.map(x=>{const doc=x.document;const st=String(doc?.status||'').toUpperCase();const statusClass=st==='VERIFIED'?'verified':st==='REVISION'?'revision':st==='PENDING'?'pending':'';return `<article class="doc-item"><div class="doc-item-top"><div class="doc-icon">${ico('file')}</div><div class="doc-copy"><div class="doc-title">${esc(x.name||'-')}</div><div class="doc-meta">${x.required?'Dokumen wajib':'Dokumen opsional'} · Maks. ${esc(getDocumentMaxSizeMb(x))} MB${x.allowedMimeTypes?' · '+esc(x.allowedMimeTypes):''}</div></div><span class="doc-required ${x.uploaded?'ok':''}">${x.uploaded?(st==='VERIFIED'?'Lengkap':'Sudah ada'):(x.required?'Wajib':'Opsional')}</span></div>${doc?`<div class="doc-meta" style="margin-top:10px"><b>${esc(doc.fileName||'-')}</b> · ${esc(formatFileSize(doc.fileSize))} · ${esc(statusLabel(doc.status))}${doc.revisionNote?`<br>Catatan: ${esc(doc.revisionNote)}`:''}</div>`:'<div class="doc-meta" style="margin-top:10px">Belum ada file yang diunggah.</div>'}<div class="doc-actions ${doc?'':'single'}">${doc?.fileUrl?`<button class="btn btn-secondary" onclick="window.open('${esc(doc.fileUrl)}','_blank')">Buka File</button>`:''}${canUpload?`<button class="btn btn-primary" onclick='openDocumentUpload(${JSON.stringify(x)})'>${doc?'Ganti File':'Unggah File'}</button>`:''}</div></article>`}).join(''):'<div class="doc-empty">Belum ada jenis dokumen aktif pada Master Data.</div>';
  $('documentContent').innerHTML=`${paymentNotice}<div class="status-card"><div class="status-row"><div><b>${esc(d.candidate?.fullName||'Pendaftaran')}</b><div class="muted" style="font-size:11px;margin-top:4px">${esc(d.registration?.registrationNumber||'-')} · ${esc(statusLabel(d.registration?.status))}</div></div></div></div><div class="doc-summary"><div class="doc-stat"><b>${uploadedRequired}/${required.length}</b><span>Dokumen wajib tersedia</span></div><div class="doc-stat"><b>${pending}</b><span>Menunggu verifikasi</span></div></div><div class="doc-list">${cards}</div>`;
}

const UPLOAD_IMAGE_MAX_SIDE=2000;
const UPLOAD_IMAGE_COMPRESSION_THRESHOLD=1.5*1024*1024;
const SUPPORTED_UPLOAD_MIME_TYPES=['application/pdf','image/jpeg','image/png','image/webp'];
function getSupportedDocumentMimeTypes(rulesText){
  const rules=String(rulesText||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  return SUPPORTED_UPLOAD_MIME_TYPES.filter(type=>!rules.length||rules.some(rule=>rule===type||(rule==='image/*'&&type.startsWith('image/'))));
}
function uploadMimeAllowed(mime,rulesText){
  const type=String(mime||'').toLowerCase();
  return SUPPORTED_UPLOAD_MIME_TYPES.includes(type)&&getSupportedDocumentMimeTypes(rulesText).includes(type);
}
async function decodeUploadImage(file){
  if(typeof createImageBitmap==='function')return await createImageBitmap(file);
  const url=URL.createObjectURL(file);
  try{return await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Format foto tidak dapat dibaca.'));img.src=url;});}
  finally{URL.revokeObjectURL(url);}
}
async function prepareUploadFile(file,allowed){
  const original={blob:file,fileName:file.name,mimeType:file.type||'application/octet-stream',fileSize:file.size,compressed:false};
  if(!/^image\/(jpeg|png|webp)$/i.test(String(file.type||'')))return original;
  let image;try{image=await decodeUploadImage(file);}catch(e){return original;}
  try{
    const w=Number(image.width||image.naturalWidth||0),h=Number(image.height||image.naturalHeight||0);
    if(!w||!h)return original;
    const scale=Math.min(1,UPLOAD_IMAGE_MAX_SIDE/Math.max(w,h));
    if(scale===1&&file.size<=UPLOAD_IMAGE_COMPRESSION_THRESHOLD)return original;
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
    const ctx=canvas.getContext('2d');if(!ctx)return original;ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const rules=String(allowed||'').toLowerCase(),jpegAllowed=!rules||rules.includes('image/jpeg')||rules.includes('image/*');
    const outType=jpegAllowed?'image/jpeg':(uploadMimeAllowed(file.type,allowed)?file.type:'image/jpeg');
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,outType,0.82));if(!blob)return original;
    if(blob.size>=file.size&&uploadMimeAllowed(file.type,allowed))return original;
    const mime=blob.type||outType,ext=mime==='image/png'?'.png':mime==='image/webp'?'.webp':'.jpg';
    const base=String(file.name||'dokumen').replace(/\.[^.]*$/,'')||'dokumen';
    return {blob,fileName:base+ext,mimeType:mime,fileSize:blob.size,compressed:true};
  }finally{if(typeof image.close==='function')image.close();}
}

function formatFileSize(bytes){const n=Number(bytes||0);if(!n)return '-';if(n<1024)return n+' B';if(n<1024*1024)return (n/1024).toFixed(1)+' KB';if(n<1024*1024*1024)return (n/1024/1024).toFixed(2)+' MB';return (n/1024/1024/1024).toFixed(2)+' GB';}
const DOCUMENT_UPLOAD_MAX_SIZE_MB=14;
function getDocumentMaxSizeMb(type){
  const configured=Number(type?.maxSizeMb);
  return Number.isFinite(configured)&&configured>0?Math.min(configured,DOCUMENT_UPLOAD_MAX_SIZE_MB):10;
}
function openDocumentUpload(type){
  const maxSizeMb=getDocumentMaxSizeMb(type);
  const allowed=getSupportedDocumentMimeTypes(type.allowedMimeTypes),accept=allowed.join(','),disabledAttr=allowed.length?'':'disabled';
  const old=type.document||{};
  const uploadInfo=allowed.length?'Tipe diizinkan: '+allowed.join(', ')+' · Maksimum '+maxSizeMb+' MB':'Konfigurasi tipe file belum didukung. Hubungi Admin PSB untuk memperbaiki Master Data.';
  document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="documentUploadModal"><div class="modal"><h3>${old.fileId?'Ganti':'Unggah'} ${esc(type.name||'Dokumen')}</h3><p>Pilih file yang sesuai dengan aturan dokumen. File akan disimpan pada folder Google Drive pendaftaran ini.</p><div id="documentUploadMsg"></div><div class="upload-box"><input id="documentFileInput" type="file" ${accept?`accept="${esc(accept)}"`:''} ${disabledAttr} onchange="previewDocumentFile()"><div class="file-picker"><button type="button" class="file-picker-btn" ${disabledAttr} onclick="$('documentFileInput').click()">Pilih File</button><span class="file-picker-name" id="documentFileName">Belum ada file dipilih</span></div><div id="documentFileInfo" class="upload-note">${esc(uploadInfo)}</div></div><div class="modal-actions"><button id="documentUploadSubmitBtn" class="btn btn-primary" ${disabledAttr} onclick='submitDocumentUpload(${JSON.stringify(type)})'>${old.fileId?'Ganti File':'Unggah Sekarang'}</button><button class="btn btn-secondary" onclick="closeDocumentUpload()">Batal</button></div></div></div>`);
}
function previewDocumentFile(){const input=$('documentFileInput'),info=$('documentFileInfo'),name=$('documentFileName');const f=input?.files?.[0];if(!f||!info)return;if(name){name.textContent=f.name;name.classList.add('selected')}info.innerHTML=`<div class="file-name">${esc(f.name)}</div><div class="upload-note">${formatFileSize(f.size)} · ${esc(f.type||'Tipe tidak terdeteksi')}</div>`;}
function closeDocumentUpload(){$('documentUploadModal')?.remove()}
async function submitDocumentUpload(type){
  const input=$('documentFileInput'),msg=$('documentUploadMsg'),file=input?.files?.[0],btn=$('documentUploadSubmitBtn');
  if(!file){msg.innerHTML=showMessage('Pilih file terlebih dahulu.','warning');return}
  if(btn?.disabled)return;
  if(btn){btn.disabled=true;btn.textContent='Menyiapkan...'}if(input)input.disabled=true;
  loading(true,'Mengoptimalkan foto dokumen...');
  try{
    const prepared=await prepareUploadFile(file,type.allowedMimeTypes),max=getDocumentMaxSizeMb(type);
    if(prepared.fileSize>max*1024*1024){msg.innerHTML=showMessage('Ukuran file setelah diproses masih melebihi batas '+max+' MB untuk dokumen '+(type.name||'ini')+'. Silakan pilih foto beresolusi lebih rendah atau file yang lebih kecil.','warning');loading(false);if(btn){btn.disabled=false;btn.textContent=type.document?.fileId?'Ganti File':'Unggah Sekarang'}if(input)input.disabled=false;return}
    if(!uploadMimeAllowed(prepared.mimeType,type.allowedMimeTypes)){msg.innerHTML=showMessage('Tipe file tidak diizinkan untuk dokumen ini. Gunakan format yang tercantum pada petunjuk upload.','warning');loading(false);if(btn){btn.disabled=false;btn.textContent=type.document?.fileId?'Ganti File':'Unggah Sekarang'}if(input)input.disabled=false;return}
    if(prepared.compressed)processPopupUpdate(22,'Foto berhasil dioptimalkan',formatFileSize(file.size)+' menjadi '+formatFileSize(prepared.fileSize),false);
    const reader=new FileReader();
    reader.onprogress=e=>{if(e.lengthComputable)processPopupUpdate(25+Math.round(e.loaded/e.total*25),'Membaca file dokumen...','Menyiapkan '+prepared.fileName,false)};
    reader.onload=async()=>{
      const dataUrl=String(reader.result||''),base64=dataUrl.indexOf(',')>=0?dataUrl.split(',')[1]:dataUrl;
      processPopupUpdate(55,'Mengirim dokumen...','File siap dikirim ke Google Drive.',false);
      try{
        const r=await server('uploadDocument',state.token,{registrationId:state.documentRegistrationId,documentTypeId:type.documentTypeId,fileName:prepared.fileName,mimeType:prepared.mimeType,fileSize:prepared.fileSize,base64});
        if(!r.success){msg.innerHTML=showMessage(r.message);return}
        closeDocumentUpload();showToast(r.message,'success');delete state.cache.documents[state.documentRegistrationId];await loadDocumentsForRegistration(state.documentRegistrationId);
      }catch(e){if($('documentUploadMsg'))$('documentUploadMsg').innerHTML=showMessage('Koneksi terputus saat mengunggah. Tunggu sebentar, lalu periksa status dokumen sebelum mencoba unggah ulang.')}
      finally{loading(false);if(btn?.isConnected){btn.disabled=false;btn.textContent=type.document?.fileId?'Ganti File':'Unggah Sekarang'}if(input?.isConnected)input.disabled=false}
    };
    reader.onerror=()=>{if(msg)msg.innerHTML=showMessage('File tidak dapat dibaca. Silakan pilih file lain.','error');loading(false);if(btn?.isConnected){btn.disabled=false;btn.textContent=type.document?.fileId?'Ganti File':'Unggah Sekarang'}if(input?.isConnected)input.disabled=false};
    reader.readAsDataURL(prepared.blob);
  }catch(e){msg.innerHTML=showMessage('Foto tidak dapat diproses. Silakan pilih file JPG, PNG, atau WEBP lain.','error');loading(false);if(btn){btn.disabled=false;btn.textContent=type.document?.fileId?'Ganti File':'Unggah Sekarang'}if(input)input.disabled=false}
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
   body.innerHTML=`<section class="status-card" style="margin-bottom:10px"><div class="status-row"><div><b>${users.length} akun pengguna</b><div class="muted" style="font-size:11px;margin-top:4px">Pilih Ganti Password untuk mengatur password baru pengguna.</div></div><button class="btn btn-secondary" onclick="loadUserManagementPage()">Refresh</button></div></section><div style="display:grid;gap:9px">${users.length?users.map(u=>{return `<article class="status-card" style="margin:0"><div class="status-row" style="align-items:flex-start"><div style="min-width:0"><b>${esc(u.name||'-')}</b><div class="muted" style="font-size:10px;margin-top:3px">${esc(u.phone||'-')}${u.email?` · ${esc(u.email)}`:''}</div><div style="margin-top:7px;display:flex;gap:6px;flex-wrap:wrap"><span class="pill">${esc(u.role||'-')}</span><span class="pill">${esc(u.status||'-')}</span>${u.mustChangePassword?'<span class="pill warning">Wajib ganti password</span>':''}</div></div><div style="display:grid;gap:7px;justify-items:end"><span class="muted" style="font-size:9px">${esc(u.userId||'-')}</span><button class="btn btn-primary" data-action="admin-reset-password" data-user-id="${esc(u.userId||'')}" data-user-name="${esc(u.name||'Pengguna')}">Ganti Password</button></div></div></article>`}).join(''):'<div class="empty-state">Belum ada akun pengguna.</div>'}</div>`;
   body.onclick=event=>{const button=event.target.closest('[data-action="admin-reset-password"]');if(button)openAdminResetPassword(button.dataset.userId,button.dataset.userName);};
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
async function renderReregistration(force=false){
  if(!hasAnyRole(['WALI','SUPERADMIN','ADMIN_PSB','VERIFIKATOR','KEUANGAN'])){renderMore();return;}
  $('content').innerHTML=`<section class="hero"><h2>Daftar Ulang</h2><p>Lengkapi tahap akhir setelah dinyatakan lulus seleksi.</p></section><div id="reregPanel"><div class="empty-state">Memuat data daftar ulang...</div></div>`;
  try{
    const r=force?await server('getReregistrationPageData',state.token):(pageDataCached('reregistration')||await warmPageData('reregistration',()=>server('getReregistrationPageData',state.token)));
    if(!r?.success){$('reregPanel').innerHTML=showMessage(r?.message||'Gagal memuat data daftar ulang.');return;}
    renderReregistrationPanel(r);
  }catch(e){$('reregPanel').innerHTML=showMessage('Gagal memuat data daftar ulang.');}
}
function reregStatusLabel(s){return ({PENDING:'Menunggu proses',PAYMENT_PENDING:'Menunggu pembayaran',PAYMENT_VERIFIED:'Pembayaran terverifikasi',COMPLETED:'Selesai'})[String(s||'').toUpperCase()]||String(s||'-')}
function renderReregistrationPanel(data,targetEl=null){
  const el=targetEl||$('reregPanel');if(!el)return;
  const admin=!!data.canManage,items=data.items||[];
  if(!items.length){el.innerHTML=`<div class="status-card"><div class="status-row"><div><b>Belum ada Daftar Ulang</b><div class="muted" style="margin-top:5px">Daftar Ulang hanya dibuka untuk pendaftaran yang hasil seleksinya sudah diumumkan sebagai Lulus.</div></div></div></div>`;return;}
  if(!hasAnyRole(['WALI'])){
    const columns=[
      {label:'No.',className:'staff-col-number',render:(x,i)=>String(i+1)},
      {label:'Calon Santri',render:x=>{const reg=x.registration||{},c=x.candidate||{};return `<div class="staff-primary-text">${esc(c.fullName||'-')}</div><div class="staff-secondary-text">${esc(reg.registrationNumber||reg.registrationId||'-')}</div>`;}},
      {label:'Dokumen Wajib',render:x=>{const docs=x.documents||{};const missing=docs.missing||[];return `<div>${Number(docs.verifiedCount||0)}/${Number(docs.requiredCount||0)} terverifikasi</div>${missing.length?`<div class="staff-secondary-text">Kurang: ${esc(missing.join(', '))}</div>`:'<div class="staff-secondary-text">Lengkap</div>'}`;}},
      {label:'Tagihan',render:x=>{const pay=x.payment;return pay?`<div>Rp ${Number(pay.amount||0).toLocaleString('id-ID')}</div><div class="staff-secondary-text">${esc(pay.dueDate||'')}</div>`:'Belum tersedia';}},
      {label:'Pembayaran',render:x=>{const pay=x.payment;if(!pay)return 'Belum ada tagihan';const label=pay.status==='PAID'?'LUNAS':pay.paymentStatus==='SUBMITTED'?'MENUNGGU VERIFIKASI':pay.paymentStatus==='REJECTED'?'DITOLAK':pay.status==='PAYMENT_REVIEW'?'MENUNGGU VERIFIKASI':'BELUM BAYAR';return `<span class="pill ${pay.status==='PAID'?'ok':''}">${label}</span>`;}},
      {label:'Status Daftar Ulang',render:x=>{const st=String(x.reregistration?.status||'PENDING').toUpperCase();return `<span class="pill ${st==='COMPLETED'?'ok':''}">${esc(reregStatusLabel(st))}</span>`;}},
      {label:'Aksi',className:'staff-col-actions',render:x=>{const reg=x.registration||{},st=String(x.reregistration?.status||'PENDING').toUpperCase();return admin&&x.readyToComplete&&st!=='COMPLETED'?`<button class="btn btn-primary staff-table-action" onclick="finalizeReregistrationUI('${esc(reg.registrationId)}')">Selesaikan</button>`:'-';}}
    ];
    el.innerHTML=`<div class="status-card"><div class="status-row"><div><b>Ringkasan</b><div class="muted" style="margin-top:4px">${Number(data.summary?.completed||0)} selesai · ${Number(data.summary?.pending||0)} masih diproses</div></div></div></div><div style="margin-top:10px">${renderStaffDataTable(items,columns,'Belum ada pendaftaran yang memasuki tahap daftar ulang.')}</div>`;
    return;
  }
  el.innerHTML=`<div class="status-card"><div class="status-row"><div><b>Ringkasan</b><div class="muted" style="margin-top:4px">${Number(data.summary?.completed||0)} selesai · ${Number(data.summary?.pending||0)} masih diproses</div></div></div></div><div class="registration-list" style="margin-top:10px">${items.map(x=>{const rr=x.reregistration||{},reg=x.registration||{},c=x.candidate||{},docs=x.documents||{},pay=x.payment;const ready=!!x.readyToComplete;const st=String(rr.status||'PENDING').toUpperCase();return `<article class="registration-item"><div class="registration-item-top"><div><div class="registration-name">${esc(c.fullName||'-')}</div><div class="registration-number">${esc(reg.registrationNumber||reg.registrationId||'-')}</div></div><span class="pill ${st==='COMPLETED'?'ok':''}">${esc(reregStatusLabel(st))}</span></div><div class="registration-meta"><span>Dokumen wajib: ${Number(docs.verifiedCount||0)}/${Number(docs.requiredCount||0)} terverifikasi</span><span>${pay?`Daftar Ulang: Rp ${Number(pay.amount||0).toLocaleString('id-ID')}`:'Tagihan belum tersedia'}</span></div>${docs.missing?.length?`<div class="status-card" style="margin:10px 0 0;background:#fff8ef;box-shadow:none"><b>Dokumen perlu dilengkapi</b><div class="muted" style="margin-top:5px">${docs.missing.map(v=>esc(v)).join(', ')}</div></div>`:'<div class="registration-meta" style="margin-top:8px"><span>✓ Dokumen wajib sudah lengkap/terverifikasi.</span></div>'}${pay?`<div class="registration-meta" style="margin-top:8px"><span>Status pembayaran: ${esc(pay.status==='PAID'?'LUNAS':pay.paymentStatus==='SUBMITTED'?'MENUNGGU VERIFIKASI':pay.paymentStatus==='REJECTED'?'DITOLAK':pay.status==='PAYMENT_REVIEW'?'MENUNGGU VERIFIKASI':'BELUM BAYAR')}</span>${pay.dueDate?`<span>Jatuh tempo: ${esc(pay.dueDate)}</span>`:''}</div>`:''}<div class="registration-actions" style="margin-top:10px">${docs.missing?.length&&hasAnyRole(['WALI'])?`<button class="btn btn-secondary" onclick="openDocumentsForRegistration('${esc(reg.registrationId)}')">Lengkapi Dokumen</button>`:''}${pay&&String(pay.status)!=='PAID'&&hasAnyRole(['WALI'])?`<button class="btn btn-primary" onclick="goPage('payments')">Bayar Daftar Ulang</button>`:''}${x.needsOpen&&hasAnyRole(['WALI'])?`<button class="btn btn-primary" onclick="openReregistrationUI('${esc(reg.registrationId)}')">Buka Daftar Ulang</button>`:''}${admin&&ready&&st!=='COMPLETED'?`<button class="btn btn-primary" onclick="finalizeReregistrationUI('${esc(reg.registrationId)}')">Selesaikan Daftar Ulang</button>`:''}</div></article>`}).join('')}</div>`;
}

async function openReregistrationUI(registrationId){loading(true,'Membuka daftar ulang...');try{const r=await server('openReregistration',state.token,registrationId);if(r.success){showToast(r.message,'success');await renderReregistration()}else showAlert('Belum dapat dibuka',r.message||'Daftar ulang belum dapat dibuka.','warning')}catch(e){showAlert('Gagal membuka daftar ulang','Terjadi gangguan saat membuka daftar ulang.','error')}finally{loading(false)}}
async function finalizeReregistrationUI(registrationId){showConfirm('Selesaikan Daftar Ulang?','Pastikan dokumen wajib sudah lengkap dan pembayaran Daftar Ulang sudah lunas.',async()=>{loading(true,'Menyelesaikan daftar ulang...');try{const r=await server('finalizeReregistration',state.token,registrationId);if(r.success){showToast(r.message,'success');await renderReregistration()}else showAlert('Belum dapat diselesaikan',r.message||'Periksa dokumen dan pembayaran.','warning')}catch(e){showAlert('Gagal menyelesaikan','Terjadi gangguan saat menyimpan daftar ulang.','error')}finally{loading(false)}} ,'Selesaikan');}
async function renderWaliVerificationStatus(){
  if(!hasAnyRole(['WALI'])){renderMore();return;}
  $('content').innerHTML=`<section class="hero"><h2>Verifikasi</h2><p>Pantau status pembayaran dan pemeriksaan dokumen pendaftaran secara terpisah.</p></section><div id="waliVerificationPanel"><div class="empty-state">Memuat status verifikasi...</div></div>`;
  try{
    const r=await server('getWaliHomeData',state.token),el=$('waliVerificationPanel');
    if(!el)return;
    if(!r?.success){el.innerHTML=showMessage(r?.message||'Status verifikasi belum dapat dimuat.');return;}
    const items=r.registrations||[];
    if(!items.length){el.innerHTML='<div class="empty-state">Belum ada pendaftaran untuk dipantau.</div>';return;}
    el.innerHTML=items.map(x=>{
      const paid=!!x.formPaid,docs=x.documents||{},payment=x.formPayment||{};
      const paymentLabel=payment.paymentStatusLabel||(paid?'Terverifikasi':payment.paymentStatus==='REJECTED'?'Ditolak':payment.paymentStatus==='SUBMITTED'?'Menunggu verifikasi':payment.billExists?'Belum dibayar':'Tagihan belum dibuat');
      const required=Number(docs.requiredCount||0),uploaded=Number(docs.uploadedRequiredCount||0),verified=Number(docs.verifiedRequiredCount||0),missing=Number(docs.missingRequiredCount||0);
      const documentLabel=required===0?'Tidak ada dokumen wajib':Number(docs.revisionRequiredCount||0)>0?'Perlu perbaikan':missing>0?(uploaded===0?'Belum upload':'Belum lengkap'):verified>=required?'Terverifikasi':'Menunggu verifikasi';
      const registrationLabel=x.statusLabel||statusLabel(x.status);
      const message=!paid?'Pembayaran formulir belum terverifikasi. Upload dokumen akan aktif setelah pembayaran dikonfirmasi oleh Keuangan.':Number(docs.revisionRequiredCount||0)>0?'Pembayaran sudah terverifikasi, tetapi ada dokumen yang perlu diperbaiki sesuai catatan petugas.':missing>0?'Pembayaran sudah terverifikasi. Silakan lengkapi dokumen persyaratan.':verified<required?'Dokumen telah diunggah dan sedang menunggu pemeriksaan petugas PSB.':'Pembayaran dan seluruh dokumen wajib sudah terverifikasi.';
      return `<article class="card wali-verification-card"><div class="wali-flow-head"><div><div class="wali-flow-title">${esc(x.candidateName||'-')}</div><div class="wali-flow-sub">${esc(x.registrationNumber||'-')}</div></div><span class="pill">${esc(registrationLabel)}</span></div><p class="muted" style="font-size:12px;line-height:1.55;margin:10px 0">${esc(message)}</p><div class="registration-meta"><span>Pembayaran: ${esc(paymentLabel)}</span><span>Dokumen: ${esc(documentLabel)}</span><span>Dokumen diunggah: ${uploaded}/${required}</span><span>Dokumen terverifikasi: ${verified}/${required}</span></div><div class="registration-actions" style="margin-top:10px"><button class="btn btn-secondary" onclick="state.documentRegistrationId='${esc(x.registrationId)}';goPage('documents')">Lihat Dokumen</button><button class="btn btn-primary" onclick="state.paymentRegistrationId='${esc(x.registrationId)}';goPage('payments')">Lihat Pembayaran</button></div></article>`;
    }).join('');
  }catch(e){const el=$('waliVerificationPanel');if(el)el.innerHTML=showMessage('Gagal memuat status verifikasi. Silakan coba lagi.');}
}
function renderMore(){
  if(hasAnyRole(['WALI'])){
    const items=[
      ['selection','Tes','Lihat jadwal tes, status peserta, dan hasil seleksi.','grad'],
      ['reregistration','Daftar Ulang','Lanjutkan proses akhir jika calon santri dinyatakan lulus.','refresh']
    ];
    $('content').innerHTML=`<section class="hero"><h2>Lainnya</h2><p>Menu lanjutan sesuai tahapan penerimaan santri baru.</p></section><div class="wali-more-list">${items.map(([page,title,desc,icon])=>`<button type="button" class="status-card wali-more-item" onclick="goPage('${page}')"><span class="wali-more-icon">${ico(icon)}</span><span class="wali-more-copy"><b>${title}</b><span>${desc}</span></span><span class="wali-flow-open" aria-hidden="true">${ico('chevron-right')}</span></button>`).join('')}</div>`;
    return;
  }
  const canPayment=hasAnyRole(['SUPERADMIN','ADMIN_PSB','KEUANGAN']);
  const canSelection=hasAnyRole(['SUPERADMIN','ADMIN_PSB','SELEKSI','VERIFIKATOR']);
  const canAnnouncement=hasAnyRole(['SUPERADMIN','ADMIN_PSB','SELEKSI','VERIFIKATOR']);
  const canRereg=hasAnyRole(['WALI','SUPERADMIN','ADMIN_PSB','VERIFIKATOR','KEUANGAN']);
  const canReport=hasAnyRole(['SUPERADMIN','ADMIN_PSB','VERIFIKATOR','SELEKSI','KEUANGAN']);
  const isMaster=hasAnyRole(['SUPERADMIN','ADMIN_PSB']);
  const cards=[];
  const add=(condition,page,title,desc,mt='')=>{if(condition)cards.push(`<button class="status-card" style="width:100%;text-align:left;cursor:pointer${mt?`;margin-top:${mt}`:''}" onclick="goPage('${page}')"><div class="status-row"><div><b>${title}</b><div class="muted" style="font-size:11px;margin-top:4px">${desc}</div></div></div></button>`)};
  add(canPayment,'payments','Pembayaran','Kelola tagihan, bukti pembayaran, dan verifikasi pembayaran.');
  add(canSelection,'selection','Tes','Kelola jadwal tes, peserta, nilai, dan hasil seleksi.','10px');
  add(canAnnouncement,'announcement','Pengumuman','Kelola hasil seleksi dan publikasi pengumuman kepada wali.','10px');
  add(canRereg,'reregistration','Daftar Ulang','Kelola kelengkapan dokumen dan pembayaran bagi santri yang lulus seleksi.','10px');
  add(canReport,'reports','Laporan','Filter dan rekap pendaftar, pembayaran, seleksi, dan Daftar Ulang.','10px');
  add(isMaster,'master','Data','Kelola tahun ajaran, gelombang, jenjang, kelas, dokumen, dan pembayaran.','10px');
  add(hasAnyRole(['SUPERADMIN','ADMIN_PSB']),'audit','Audit','Lihat jejak aktivitas penting dan perubahan data aplikasi.','10px');
  add(hasAnyRole(['SUPERADMIN']),'userManagement','Manajemen Pengguna','Lihat semua akun pengguna dan ganti password masing-masing akun.','10px');
  $('content').innerHTML=`<section class="hero"><h2>Lainnya</h2><p>Fungsi tambahan dan pengaturan aplikasi berada di sini.</p></section>${cards.join('')}`;
}

function hasAnyRole(roles){const current=String(state.user?.role||'').split(',').map(x=>x.trim().toUpperCase());return roles.some(r=>current.includes(r));}
async function renderPayments(registrationId,force=false){
  if(!hasAnyRole(['WALI','SUPERADMIN','ADMIN_PSB','KEUANGAN'])){renderMore();return;}
  if(!hasAnyRole(['WALI'])){
    state.paymentQueuePage=Number(state.paymentQueuePage||1);
    $('content').innerHTML=`<section class="hero"><h2>Antrean Pembayaran</h2><p>Periksa bukti transfer dan status tagihan seluruh pendaftar.</p></section><div id="paymentPanel"><div class="empty-state">Memuat antrean pembayaran...</div></div>`;
    try{await loadPaymentQueuePage(force?1:state.paymentQueuePage||1);}
    catch(e){$('paymentPanel').innerHTML=showMessage('Gagal memuat antrean pembayaran.');}
    return;
  }
  state.paymentRegistrationId=String(registrationId||state.paymentRegistrationId||state.registrationList?.[0]?.registrationId||'');
  $('content').innerHTML=`<section class="hero"><h2>Pembayaran Formulir</h2><p>Unggah bukti pembayaran dan pantau proses verifikasi oleh petugas Keuangan.</p></section><div id="paymentPanel"><div class="empty-state">Memuat data pembayaran...</div></div>`;
  try{
    let r=!force&&state.paymentRegistrationId?state.cache.payments[state.paymentRegistrationId]:null;
    if(!r){r=await server('getPaymentPageData',state.token,state.paymentRegistrationId);if(r?.success&&r.paymentData?.registrationId)state.cache.payments[String(r.paymentData.registrationId)]=r;}
    if(!r?.success){$('paymentPanel').innerHTML=showMessage(r?.message||'Gagal memuat pembayaran.');return}
    state.paymentData=r.paymentData;state.paymentTypes=r.paymentTypes||[];state.registrationList=r.registrations||state.registrationList||[];state.cache.registration=state.registrationList;
    if(!state.registrationList.length){$('paymentPanel').innerHTML='<div class="empty-state">Belum ada pendaftaran.</div>';return}
    state.paymentRegistrationId=String(r.paymentData?.registrationId||state.paymentRegistrationId||state.registrationList[0].registrationId);renderPaymentContent();
  }catch(e){$('paymentPanel').innerHTML=showMessage('Gagal memuat pembayaran.')}
}

async function loadPaymentQueuePage(page){
  state.paymentQueuePage=Math.max(1,Number(page)||1);
  const panel=$('paymentPanel');if(!panel)return;
  panel.innerHTML='<div class="empty-state">Memuat antrean pembayaran...</div>';
  const filters=state.paymentQueueFilters||{search:'',status:''};
  const r=await server('getPaymentQueue',state.token,state.paymentQueuePage,filters);
  if(!r?.success){panel.innerHTML=showMessage(r?.message||'Antrean pembayaran tidak dapat dimuat.');return;}
  state.paymentQueue=r.items||[];
  state.paymentQueueMeta={page:Number(r.page||1),pageCount:Number(r.pageCount||1),totalBills:Number(r.totalBills||0),allBills:Number(r.allBills||0),pageSize:Number(r.pageSize||50)};
  state.paymentTypes=r.paymentTypes||[];
  renderPaymentQueue();
}
function renderPaymentQueue(){
  const panel=$('paymentPanel');if(!panel)return;
  const meta=state.paymentQueueMeta||{},filters=state.paymentQueueFilters||{search:'',status:''};
  panel.innerHTML=`<div class="staff-list-toolbar"><div class="search-box"><span class="search-icon">${ico('search')}</span><input id="paymentQueueSearch" class="search-input" value="${esc(filters.search||'')}" placeholder="Cari nama, nomor pendaftaran, atau tagihan..." oninput="filterPaymentQueue()"></div><div class="filter-box professional-filter"><span class="filter-label">Status</span><select id="paymentQueueStatus" class="select-field compact professional-select" onchange="filterPaymentQueue()"><option value="">Semua status</option><option value="WAITING" ${filters.status==='WAITING'?'selected':''}>Menunggu verifikasi</option><option value="REJECTED" ${filters.status==='REJECTED'?'selected':''}>Ditolak</option><option value="PAID" ${filters.status==='PAID'?'selected':''}>Lunas</option><option value="UNPAID" ${filters.status==='UNPAID'?'selected':''}>Belum bayar</option><option value="RECONCILIATION_REQUIRED" ${filters.status==='RECONCILIATION_REQUIRED'?'selected':''}>Perlu rekonsiliasi</option></select></div><button class="btn btn-secondary staff-table-action" onclick="loadPaymentQueuePage(1)">Muat ulang</button><div class="staff-result-count" id="paymentQueueCount"></div></div><div id="paymentQueueTable"></div><div class="staff-pagination"><button class="btn btn-secondary staff-table-action" id="paymentQueuePrev" onclick="loadPaymentQueuePage(${Math.max(1,meta.page-1)})" ${meta.page<=1?'disabled':''}>Sebelumnya</button><span id="paymentQueuePageInfo">Halaman ${meta.page} dari ${meta.pageCount} · ${meta.totalBills} hasil dari ${meta.allBills} tagihan</span><button class="btn btn-secondary staff-table-action" id="paymentQueueNext" onclick="loadPaymentQueuePage(${Math.min(meta.pageCount,meta.page+1)})" ${meta.page>=meta.pageCount?'disabled':''}>Berikutnya</button></div>`;
  const count=$('paymentQueueCount');if(count)count.textContent=`Menampilkan ${(state.paymentQueue||[]).length} dari ${meta.totalBills||0} hasil`;
  const columns=[
    {label:'No.',className:'staff-col-number',render:(x,i)=>String((Math.max(1,meta.page)-1)*50+i+1)},
    {label:'Calon Santri',render:x=>`<div class="staff-primary-text">${esc(x.candidateName||'-')}</div><div class="staff-secondary-text">${esc(x.registrationNumber||'-')}</div>`},
    {label:'Jenis Tagihan',render:x=>`<div class="staff-primary-text">${esc(x.paymentTypeName||'-')}</div><div class="staff-secondary-text">${esc(x.dueDate?'Jatuh tempo: '+x.dueDate:'')}</div>`},
    {label:'Nominal',render:x=>'Rp '+Number(x.amount||0).toLocaleString('id-ID')},
    {label:'Status',render:x=>{const labels={WAITING:'Menunggu verifikasi',REJECTED:'Ditolak',PAID:'Lunas',UNPAID:'Belum bayar',RECONCILIATION_REQUIRED:'Perlu rekonsiliasi'};return `<span class="pill ${x.queueStatus==='PAID'?'ok':x.queueStatus==='WAITING'||x.queueStatus==='RECONCILIATION_REQUIRED'?'warn':''}">${labels[x.queueStatus]||x.queueStatus||'-'}</span>${x.reconciliationRequired?`<div class="staff-secondary-text">Periksa kecocokan tagihan, pendaftar, nominal, dan riwayat pembayaran.</div>`:''}${x.verificationNote?`<div class="staff-secondary-text">${esc(x.verificationNote)}</div>`:''}`;}},
    {label:'Bukti',className:'staff-col-actions',render:x=>x.proofFileUrl?`<button class="btn btn-secondary staff-table-action" onclick="window.open('${esc(x.proofFileUrl)}','_blank','noopener')">Lihat Bukti</button>`:'-'},
    {label:'Aksi',className:'staff-col-actions',render:x=>x.paymentStatus==='SUBMITTED'&&(x.queueStatus==='WAITING'||!x.reconciliationRequired)?`<div class="staff-table-actions"><button class="btn btn-primary staff-table-action" onclick="verifyPaymentUI('${esc(x.paymentId)}','VERIFIED')">Verifikasi</button><button class="btn btn-danger staff-table-action" onclick="verifyPaymentUI('${esc(x.paymentId)}','REJECTED')">Tolak</button></div>`:'-'}
  ];
  const target=$('paymentQueueTable');if(target)target.innerHTML=renderStaffDataTable(state.paymentQueue||[],columns,'Tidak ada tagihan yang sesuai dengan filter.');
}
function filterPaymentQueue(){
  state.paymentQueueFilters={
    search:String($('paymentQueueSearch')?.value||'').trim(),
    status:String($('paymentQueueStatus')?.value||'').trim().toUpperCase()
  };
  if(state.paymentQueueSearchTimer)clearTimeout(state.paymentQueueSearchTimer);
  state.paymentQueueSearchTimer=setTimeout(()=>loadPaymentQueuePage(1).catch(()=>{
    const panel=$('paymentPanel');if(panel)panel.innerHTML=showMessage('Pencarian antrean pembayaran gagal dimuat.');
  }),300);
}

function renderPaymentContent(){
 const d=state.paymentData||{}, items=d.bills||[], isWali=hasAnyRole(['WALI']), canManage=hasAnyRole(['SUPERADMIN','ADMIN_PSB','KEUANGAN']);
 const list=items.length?items.map(b=>{const p=b.payment, st=String(b.status||'').toUpperCase(), displayStatus=p?.status==='SUBMITTED'?'PAYMENT_REVIEW':b.reconciliationRequired?'RECONCILIATION_REQUIRED':(st==='PAID'?'PAID':(st==='PAYMENT_REVIEW'?'PAYMENT_REVIEW':st));return `<article class="registration-item"><div class="registration-item-top"><div><div class="registration-name">${esc(b.paymentTypeName||'Tagihan')}</div><div class="registration-number">Rp ${Number(b.amount||0).toLocaleString('id-ID')}</div></div><span class="pill">${esc(displayStatus==='PAID'?'LUNAS':displayStatus==='PAYMENT_REVIEW'?'MENUNGGU VERIFIKASI':displayStatus==='RECONCILIATION_REQUIRED'?'PERLU PEMERIKSAAN KEUANGAN':p?.status==='REJECTED'?'DITOLAK':'BELUM BAYAR')}</span></div>${b.reconciliationRequired?`<div class="message warning" style="margin-top:8px">Status tagihan dan transaksi pembayaran belum konsisten. Mohon tunggu pemeriksaan bagian Keuangan.</div>`:''}${p?.submittedAt?`<div class="registration-meta"><span>Dikirim: ${esc(String(p.submittedAt).substring(0,10))}</span></div>`:'' }${p?.status==='REJECTED'&&p?.verificationNote?`<div class="message warning" style="margin-top:8px">Alasan penolakan: ${esc(p.verificationNote)}</div>`:''}<div class="registration-actions">${p?.proofFileUrl?`<button class="btn btn-secondary" onclick="window.open('${esc(p.proofFileUrl)}','_blank')">Bukti</button>`:''}${isWali&&!b.reconciliationRequired&&p?.status!=='SUBMITTED'&&st!=='PAID'&&(!p||p.status==='REJECTED')?`<button class="btn btn-primary" onclick="openPaymentUpload('${esc(b.billId)}')">${p?.status==='REJECTED'?'Upload Ulang':'Upload Bukti'}</button>`:''}${canManage&&p&&p.status==='SUBMITTED'&&!b.reconciliationRequired?`<button class="btn btn-primary" onclick="verifyPaymentUI('${esc(p.paymentId)}','VERIFIED')">Verifikasi</button><button class="btn btn-danger" onclick="verifyPaymentUI('${esc(p.paymentId)}','REJECTED')">Tolak</button>`:''}</div></article>`}).join(''):`<div class="empty-state">${isWali?(d.autoBillMessage?'Tagihan formulir belum dapat dibuat: '+d.autoBillMessage:'Tagihan formulir akan dibuat otomatis setelah pendaftaran dikirim. Jika belum muncul, silakan hubungi Admin PSB.'):'Belum ada tagihan pembayaran.'}</div>`;
 const regOptions=(state.registrationList||[]).map(x=>`<option value="${esc(x.registrationId)}" ${String(x.registrationId)===String(state.paymentRegistrationId)?'selected':''}>${esc(x.candidateName||'-')} · ${esc(x.registrationNumber||'-')}</option>`).join('');
const transferGuide=isWali?`<section class="status-card" style="margin-top:10px"><div class="status-row"><div><b>Petunjuk Pembayaran Uang Pendaftaran</b><div class="muted" style="font-size:11px;margin-top:5px">Silakan transfer melalui rekening resmi berikut. Pastikan nominal mengikuti tagihan yang tampil di halaman ini.</div></div></div><div style="margin-top:12px;padding:12px;border-radius:12px;background:var(--surface-soft,rgba(120,100,160,.08))"><div class="muted" style="font-size:11px">Bank Mandiri</div><div style="font-size:20px;font-weight:800;letter-spacing:.5px;margin:3px 0">1330005698469</div><div style="font-size:13px">a.n. <b>Siti Makbulah</b></div></div></section>`:'';
 $('paymentPanel').innerHTML=`<div class="status-card"><div class="status-row"><div><b>Pendaftaran</b><div class="muted" style="font-size:11px;margin-top:4px">Pilih santri untuk melihat tagihan.</div></div></div><select class="doc-select" onchange="renderPayments(this.value)">${regOptions}</select></div>${transferGuide}<div class="registration-list" style="margin-top:10px">${list}</div>`;
}
function openPaymentUpload(billId){document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="paymentUploadModal"><div class="modal"><h3>Upload Bukti Pembayaran</h3><p>File JPG, PNG, WEBP, atau PDF maksimal 5 MB.</p><div id="paymentUploadMsg"></div><div class="upload-box"><input id="paymentFileInput" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onchange="previewPaymentFile()"><div class="file-picker"><button type="button" class="file-picker-btn" onclick="$('paymentFileInput').click()">Pilih File</button><span class="file-picker-name" id="paymentFileName">Belum ada file dipilih</span></div><div class="upload-note" id="paymentFileInfo">JPG, PNG, WEBP, atau PDF · Maks. 5 MB</div></div><div class="modal-actions"><button class="btn btn-primary" onclick="submitPaymentUpload('${esc(billId)}')">Kirim Bukti</button><button class="btn btn-secondary" onclick="closePaymentUpload()">Batal</button></div></div></div>`)}
function previewPaymentFile(){const f=$('paymentFileInput')?.files?.[0],name=$('paymentFileName'),info=$('paymentFileInfo');if(!f)return;if(name){name.textContent=f.name;name.classList.add('selected')}if(info)info.textContent=`${formatFileSize(f.size)} · ${f.type||'Tipe file'}`}
function closePaymentUpload(){$('paymentUploadModal')?.remove()}
async function submitPaymentUpload(billId){
  const file=$('paymentFileInput')?.files?.[0],msg=$('paymentUploadMsg');
  if(!file){msg.innerHTML=showMessage('Pilih file bukti pembayaran terlebih dahulu.','warning');return}
  loading(true,'Mengoptimalkan bukti pembayaran...');
  try{
    const allowed='image/jpeg,image/png,image/webp,application/pdf',prepared=await prepareUploadFile(file,allowed);
    if(prepared.fileSize>5*1024*1024){msg.innerHTML=showMessage('Ukuran file setelah diproses masih melebihi batas 5 MB. Silakan pilih foto beresolusi lebih rendah atau file yang lebih kecil.','warning');loading(false);return}
    if(!uploadMimeAllowed(prepared.mimeType,allowed)){msg.innerHTML=showMessage('Format bukti pembayaran tidak didukung. Gunakan JPG, PNG, WEBP, atau PDF.','warning');loading(false);return}
    if(prepared.compressed)processPopupUpdate(22,'Foto berhasil dioptimalkan',formatFileSize(file.size)+' menjadi '+formatFileSize(prepared.fileSize),false);
    const reader=new FileReader();
    reader.onprogress=e=>{if(e.lengthComputable)processPopupUpdate(25+Math.round(e.loaded/e.total*25),'Membaca bukti pembayaran...','Menyiapkan '+prepared.fileName,false)};
    reader.onload=async()=>{
      const dataUrl=String(reader.result||''),base64=dataUrl.split(',')[1]||'';
      processPopupUpdate(55,'Mengirim bukti pembayaran...','File siap dikirim untuk diproses server.',false);
      try{
        const r=await server('submitPayment',state.token,{billId,fileName:prepared.fileName,mimeType:prepared.mimeType,fileSize:prepared.fileSize,base64});
        if(!r.success){msg.innerHTML=showMessage(r.message||'Bukti pembayaran belum dapat disimpan.');return}
        closePaymentUpload();showToast(r.message||'Bukti pembayaran berhasil dikirim.','success');delete state.cache.payments[state.paymentRegistrationId];
        try{await renderPayments(state.paymentRegistrationId,true)}catch(refreshError){/* Data sudah berhasil disimpan; refresh hanya pelengkap. */}
      }catch(e){if($('paymentUploadMsg'))$('paymentUploadMsg').innerHTML=showMessage('Koneksi terputus setelah pengiriman. Silakan cek status pembayaran.','warning')}
      finally{loading(false)}
    };
    reader.onerror=()=>{if(msg)msg.innerHTML=showMessage('File tidak dapat dibaca. Silakan pilih file lain.','error');loading(false)};
    reader.readAsDataURL(prepared.blob);
  }catch(e){msg.innerHTML=showMessage('Foto tidak dapat diproses. Silakan pilih file JPG, PNG, atau WEBP lain.','error');loading(false)}
}
async function verifyPaymentUI(paymentId,status){const note=status==='REJECTED'?(prompt('Tuliskan alasan penolakan pembayaran:')||'').trim():'';if(status==='REJECTED'&&!note){showAlert('Alasan diperlukan','Tuliskan alasan agar Wali mengetahui perbaikan yang harus dilakukan.','warning');return}showConfirm(status==='VERIFIED'?'Verifikasi pembayaran?':'Tolak pembayaran?',status==='VERIFIED'?'Pembayaran akan dikonfirmasi dan pendaftaran masuk antrean verifikasi PSB.':'Pembayaran akan ditolak. Alasan penolakan akan dikirimkan kepada Wali.',async()=>{loading(true,status==='VERIFIED'?'Memverifikasi pembayaran...':'Menolak pembayaran...');try{const r=await server('verifyPayment',state.token,{paymentId,status,note});if(r.success){showToast(r.message,'success');if(!hasAnyRole(['WALI']))await loadPaymentQueuePage(state.paymentQueuePage||1);else await renderPayments(state.paymentRegistrationId,true)}else showAlert('Belum dapat diproses',r.message||'Operasi gagal.','warning')}catch(e){showAlert('Gagal menyimpan','Terjadi gangguan saat menyimpan.','error')}finally{loading(false)}} ,status==='VERIFIED'?'Verifikasi':'Tolak')}
function openCreateBill(){const types=state.paymentTypes||[];document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="createBillModal"><div class="modal"><h3>Buat Tagihan</h3><div id="createBillMsg"></div><div class="field"><label>Jenis Pembayaran</label><select id="billType">${types.map(x=>`<option value="${esc(x.paymentTypeId)}">${esc(x.name)} · Rp ${Number(x.amount||0).toLocaleString('id-ID')}</option>`).join('')}</select></div><div class="field"><label>Nominal</label><input id="billAmount" type="number" min="1" value="${Number(types[0]?.amount||0)}"></div><div class="field"><label>Jatuh Tempo</label><input id="billDueDate" type="date"></div><div class="modal-actions"><button class="btn btn-primary" onclick="createBillUI()">Simpan</button><button class="btn btn-secondary" onclick="$('createBillModal')?.remove()">Batal</button></div></div></div>`)}
async function createBillUI(){const msg=$('createBillMsg');loading(true,'Membuat tagihan...');try{const r=await server('createBill',state.token,{registrationId:state.paymentRegistrationId,paymentTypeId:$('billType').value,amount:Number($('billAmount').value||0),dueDate:$('billDueDate').value});if(r.success){$('createBillModal')?.remove();showToast(r.message,'success');await renderPayments(state.paymentRegistrationId)}else msg.innerHTML=showMessage(r.message)}catch(e){msg.innerHTML=showMessage('Gagal membuat tagihan.')}finally{loading(false)}}

async function renderMasterData(force=false){
  if(!hasAnyRole(['SUPERADMIN','ADMIN_PSB'])){renderMore();return;}
  $('content').innerHTML=`<section class="hero"><h2>Data</h2><p>Data dasar yang menjadi referensi seluruh workflow PSB.</p></section><div id="masterPanel"><div class="empty-state">Memuat master data...</div></div>`;
  try{
    const warmed=!force?pageDataCached('master'):null;
    if(warmed?.success){
      state.masterDefinitions=warmed.definitions||state.masterDefinitions;
      state.masterItems=warmed.items||[];
      state.masterCache[state.masterKey]=state.masterItems;
      if(warmed.lifecycle)state.academicYearLifecycle=warmed.lifecycle;
    }
    if(force||!Object.keys(state.masterDefinitions).length){const d=await server('getMasterDefinitions',state.token);if(!d.success){$('masterPanel').innerHTML=showMessage(d.message);return}state.masterDefinitions=d.definitions||{};}
    if(force||!state.academicYearLifecycle){const lifecycle=await server('getAcademicYearLifecycleData',state.token);if(lifecycle?.success)state.academicYearLifecycle=lifecycle;}
    renderMasterPanel();
    await loadMasterData(state.masterKey,true,force);
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
function showToast(text,type='info'){
  const safeType=['success','warning','error'].includes(type)?type:'info';
  const id='toast_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);
  const title={success:'Berhasil',warning:'Perlu perhatian',error:'Belum berhasil',info:'Informasi'}[safeType];
  const detail=safeType==='error'?friendlyErrorMessage(text,'Permintaan belum berhasil diselesaikan.'):String(text||'');
  const role=safeType==='error'?'alert':'status';
  let host=$('psbToastHost');if(!host){document.body.insertAdjacentHTML('beforeend','<div class="psb-toast-host" id="psbToastHost" aria-label="Pemberitahuan aplikasi"></div>');host=$('psbToastHost');}
  host.insertAdjacentHTML('beforeend',`<section id="${id}" class="psb-toast ${safeType}" role="${role}" aria-live="${safeType==='error'?'assertive':'polite'}"><span class="psb-toast-icon">${ico(safeType==='success'?'check':safeType==='warning'?'warning':safeType==='error'?'error':'info')}</span><span class="psb-toast-copy"><b>${title}</b><span>${esc(detail)}</span></span><button class="psb-toast-close" type="button" aria-label="Tutup pemberitahuan" onclick="document.getElementById('${id}')?.remove()">×</button></section>`);
  setTimeout(()=>$(id)?.remove(),safeType==='error'?6500:4000);
}

function openChangePassword(){
 $('app').insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="modal"><div class="modal"><h3>Ganti Password</h3><p>Gunakan minimal 6 karakter. Password lama tidak disimpan dalam bentuk asli.</p><div id="modalMsg"></div><div class="field"><label>Password Lama</label><input id="oldPass" type="password" autocomplete="current-password"></div><div class="field"><label>Password Baru</label><input id="newPass" type="password" autocomplete="new-password"></div><div class="field"><label>Ulangi Password Baru</label><input id="newPass2" type="password" autocomplete="new-password"></div><div class="modal-actions"><button class="btn btn-primary" onclick="savePassword()">Simpan Password</button><button class="btn btn-secondary" onclick="closeModal()">Batal</button></div></div></div>`);
}
function closeModal(){$('modal')?.remove()}
async function savePassword(){const a=$('oldPass').value,b=$('newPass').value,c=$('newPass2').value;if(b.length<6){$('modalMsg').innerHTML=showMessage('Password baru minimal 6 karakter.');return}if(b!==c){$('modalMsg').innerHTML=showMessage('Konfirmasi password baru tidak sama.');return}loading(true,'Menyimpan password...');try{const r=await server('changePassword',state.token,a,b);if(r.success){$('modalMsg').innerHTML=showMessage(r.message,'success');setTimeout(closeModal,700)}else $('modalMsg').innerHTML=showMessage(r.message)}catch(e){$('modalMsg').innerHTML=showMessage('Gagal menyimpan password.')}finally{loading(false)}}
async function doLogout(){
  const authFlowId=state.authFlowId=Number(state.authFlowId||0)+1;
  const token=String(state.token||localStorage.getItem('psb_session')||'');
  // Logout lokal selalu dilakukan segera; pencabutan sesi server dilaporkan terpisah.
  state.token='';state.user=null;state.appInitialized=false;state.preloadRunning=false;state.preloadReady=false;state.cache={registration:null,documents:{},payments:{},pages:{}};state.prefetchPromises={};state.pageSnapshots={};state.registrationList=[];state.documentData=null;state.paymentData=null;
  localStorage.removeItem('psb_session');
  try{sessionStorage.clear();}catch(e){}
  loading(false);
  renderPublicHome();
  showToast('Anda sudah keluar dari perangkat ini.','info');
  if(!token)return;
  try{
    const result=await server('logout',token);
    // Do not let an older logout RPC display a result after a newer auth flow starts.
    if(state.authFlowId!==authFlowId||state.token||state.appInitialized)return;
    if(result?.success&&result.revoked===true){
      showToast('Sesi server berhasil dicabut.','success');
    }else if(result?.success&&result.alreadyInactive===true){
      showToast('Anda sudah keluar dari perangkat ini. Sesi server sebelumnya sudah tidak aktif.','info');
    }else{
      showToast('Anda sudah keluar dari perangkat ini, tetapi pencabutan sesi server belum terkonfirmasi. Silakan coba masuk kembali atau ulangi logout saat koneksi stabil.','warning');
    }
  }catch(error){
    if(state.authFlowId!==authFlowId||state.token||state.appInitialized)return;
    showToast('Anda sudah keluar dari perangkat ini, tetapi server belum mengonfirmasi pencabutan sesi. Periksa koneksi dan ulangi logout saat tersedia.','warning');
  }
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
