const CACHE='psb-pwa-shell-v32-4-15';
const ASSETS=[
  './',
  './index.html',
  './manifest.webmanifest?v=32.4.15',
  './styles.css?v=32.4.15',
  './api-bridge.js?v=32.4.15',
  './app.js?v=32.4.15',
  './assets/logo-fathanmubina.svg?v=32.4.15',
  './assets/logo-fathan-mubina.png?v=32.4.15',
  './icons/favicon-32.svg?v=32.4.15',
  './icons/favicon-48.svg?v=32.4.15',
  './icons/icon-512.svg?v=32.4.15',
  './icons/icon-maskable-512.svg?v=32.4.15'
];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==location.origin)return;
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));}
    return response;
  }).catch(()=>cached)));
});
