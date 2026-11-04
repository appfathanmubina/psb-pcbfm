// PSB PWA 32.12.0 — refresh same-origin assets from the network before using offline cache.
const CACHE='psb-pwa-shell-v32-12-0';
const ASSETS=[
  './',
  './index.html',
  './manifest.webmanifest?v=32.12.0',
  './styles.css?v=32.12.0',
  './api-bridge.js?v=32.11.0',
  './app.js?v=32.12.0',
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
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  // Connected devices always check the deployment first; cache is offline fallback only.
  event.respondWith(
    fetch(request,{cache:'no-cache'}).then(response=>{
      if(response&&response.ok&&response.type==='basic'){
        const copy=response.clone();
        event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)));
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
