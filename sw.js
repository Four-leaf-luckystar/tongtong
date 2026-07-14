const CACHE_NAME = 'ios-sim-cache-v1';

// 需要缓存的文件列表
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  './fullscreen.js',
  // 如果你有真实的图标，请把它们也加进来，例如：
  // './icon-192.png',
  // './icon-512.png'
];

// 安装阶段：缓存核心资源
self.addEventListener('install', event => {
  self.skipWaiting(); // 强制立即接管控制权
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// 激活阶段：清理旧版本的缓存
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim(); // 立即控制所有打开的页面
});

// 拦截网络请求：优先从缓存读取，如果没有再从网络获取 (Cache First 策略)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 如果在缓存中找到匹配的响应，则直接返回缓存
        if (response) {
          return response;
        }
        // 否则发起网络请求
        return fetch(event.request).then(
          function(networkResponse) {
            // 检查是否是有效的响应
            if(!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            // 动态缓存新请求到的资源
            var responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(function(cache) {
                // 仅缓存 http/https 请求，避免 chrome-extension 等协议报错
                if (event.request.url.startsWith('http')) {
                  cache.put(event.request, responseToCache);
                }
              });

            return networkResponse;
          }
        );
      })
  );
});