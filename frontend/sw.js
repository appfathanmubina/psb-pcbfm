// PSB PWA 32.14.0 — refresh same-origin assets from the network before using offline cache.
const CACHE='psb-pwa-shell-v32-14-0';
const ASSETS=[
  './',
  './index.html',
  './manifest.webmanifest?v=32.14.0',
  './styles.css?v=32.14.0',
  './api-bridge.js?v=32.13.0',
  './app.js?v=32.16.0',
  './assets/logo-fathanmubina.svg?v=32.7.0',
  './assets/logo-fathan-mubina.png?v=32.7.0',
  './icons/favicon-32.svg?v=32.7.0',
  './icons/favicon-48.svg?v=32.7.0',
  './icons/icon-512.svg?v=32.7.0',
  './icons/icon-maskable-512.svg?v=32.7.0'
];
self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE)
    .then(cache=>cache.addAll(ASSETS.map(asset=>new Request(asset,{cache:'reload'}))))
    .then(()=>self.skipWaiting())
));
self.addEventListener('activate',event=>event.waitUntil(
  caches.keys()
    .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
    .then(()=>self.clients.claim())
));
const CACHE_FIRST_ASSETS=new Set(ASSETS.filter(asset=>asset!=='./'&&asset!=='./index.html').map(asset=>new URL(asset,self.registration.scope).href));
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  // Render aset shell dari cache terlebih dahulu agar buka ulang terasa instan.
  // Pembaruan jaringan berjalan di belakang layar; HTML navigasi tetap network-first.
  if(CACHE_FIRST_ASSETS.has(request.url)){
    const update=fetch(request,{cache:'no-cache'}).then(response=>{
      if(response&&response.ok&&response.type==='basic'){
        return caches.open(CACHE).then(cache=>cache.put(request,response.clone())).then(()=>response);
      }
      return response;
    });
    event.waitUntil(update.catch(()=>{}));
    event.respondWith(caches.match(request).then(cached=>cached||update).catch(()=>caches.match(request)));
    return;
  }

  // Dokumen navigasi selalu memeriksa versi terbaru; cache menjadi fallback offline.
  event.respondWith(
    fetch(request,{cache:'no-cache'}).then(response=>{
      if(response&&response.ok&&response.type==='basic'){
        return caches.open(CACHE).then(cache=>cache.put(request,response.clone())).then(()=>response);
      }
      return response;
    }).catch(()=>caches.match(request).then(cached=>{
      if(cached)return cached;
      if(request.mode==='navigate')return caches.match('./').then(root=>root||new Response(
        'Aplikasi belum tersedia secara offline. Periksa koneksi internet.',
        {status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}}
      ));
      return new Response('Konten tidak tersedia saat offline.',{
        status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}
      });
    }))
  );
});
