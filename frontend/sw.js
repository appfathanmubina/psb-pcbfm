// PSB PWA 32.4.18 — network-first navigation prevents stale cached entry pages.
const CACHE='psb-pwa-shell-v32-4-18';
const ASSETS=[
  './',
  './index.html',
  './manifest.webmanifest?v=32.4.18',
  './styles.css?v=32.4.18',
  './api-bridge.js?v=32.4.18',
  './app.js?v=32.4.18',
  './assets/logo-fathanmubina.svg?v=32.4.18',
  './assets/logo-fathan-mubina.png?v=32.4.18',
  './icons/favicon-32.svg?v=32.4.18',
  './icons/favicon-48.svg?v=32.4.18',
  './icons/icon-512.svg?v=32.4.18',
  './icons/icon-maskable-512.svg?v=32.4.18'
];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==location.origin)return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).then(response=>{
      if(response&&response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put('./',copy));}
      return response;
    }).catch(()=>caches.match('./').then(cached=>cached||new Response('Aplikasi belum tersedia secara offline. Periksa koneksi internet.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}}))));
    return;
  }
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
    if(response&&response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));}
    return response;
  }).catch(()=>cached)));
});
