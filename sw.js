const CACHE_NAME = 'tonghuaji-v2';
const urlsToCache = [
  './',
  './index.html',
  './fullscreen.js',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // 逐个缓存，某个资源失败不会导致整个安装失败
      return Promise.allSettled(urlsToCache.map(url => cache.add(url)));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  
  // 跳过非 http/https 请求 (如 chrome-extension://)
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(response => {
      if (response) return response;
      return fetch(event.request).then(response => {
        // 缓存成功的响应（200）以及跨域不透明响应（0）
        if (!response || (response.status !== 200 && response.status !== 0)) return response;
        
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
        return response;
      }).catch(() => {
        // 离线且资源未缓存时，如果是页面请求，可返回 index.html 兜底
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => Promise.all(
      cacheNames.map(cacheName => cacheWhitelist.indexOf(cacheName) === -1 ? caches.delete(cacheName) : null)
    )).then(() => self.clients.claim())
  );
});
