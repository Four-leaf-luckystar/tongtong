self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(fetch(e.request));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const contactId = event.notification.data && event.notification.data.contactId;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const client = clients[0];
      if (!client) return self.clients.openWindow('./index.html');
      client.postMessage({ type: 'wc-proactive-message', contactId });
      return client.focus();
    })
  );
});

