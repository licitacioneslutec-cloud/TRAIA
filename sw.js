const CACHE_NAME='tria-v1';
const APP_SHELL=['./index.html','./manifest.json'];
const CDN_LIBS=[
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-database-compat.js'
];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll([...APP_SHELL,...CDN_LIBS])));
  self.skipWaiting();
});

self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  if(CDN_LIBS.some(lib=>e.request.url===lib)){
    e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{const cl=res.clone();caches.open(CACHE_NAME).then(c=>c.put(e.request,cl));return res})));
    return;
  }
  if(url.origin===location.origin){
    e.respondWith(fetch(e.request).then(res=>{const cl=res.clone();caches.open(CACHE_NAME).then(c=>c.put(e.request,cl));return res}).catch(()=>caches.match(e.request)));
    return;
  }
  e.respondWith(fetch(e.request));
});
