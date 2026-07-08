// Service Worker for Push Notifications
// Kill-switch: al activarse borra TODA la Cache Storage y recarga las pestañas
// abiertas para que ningún cliente quede con assets viejos (batch67, 8-jul).
// SW_VERSION: 2026-07-08-batch67-purga-total-cache

self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil((async () => {
    // 1) Borra por completo toda la Cache Storage (cualquier cache de cualquier SW previo).
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (e) {}
    // 2) Toma control inmediato de todas las pestañas.
    await self.clients.claim();
    // 3) Fuerza recarga UNA vez para que carguen el HTML/JS/assets frescos.
    //    Solo ocurre al cambiar de versión de SW, así que no genera bucle.
    try {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clientList) {
        if ('navigate' in client) client.navigate(client.url);
      }
    } catch (e) {}
  })());
});

self.addEventListener('push', function(event) {
  console.log('[SW] Push received:', event);
  
  let data = { title: 'DocSeek', body: 'Nueva notificación' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || data.message,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    vibrate: [100, 50, 100],
    data: data.data || {},
    actions: data.actions || [],
    tag: data.tag || 'default',
    renotify: true,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  console.log('[SW] Notification clicked:', event);
  
  event.notification.close();

  const data = event.notification.data || {};
  let targetUrl = '/';

  // Navigate based on notification type
  if (data.liveId) {
    targetUrl = `/live/${data.liveId}`;
  } else if (data.url) {
    targetUrl = data.url;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // If a window is already open, focus it and navigate
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.navigate(targetUrl);
          return;
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

