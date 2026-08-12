// Service Worker for Push Notifications
// Kill-switch: al activarse borra TODA la Cache Storage de SWs previos.
// NO recargar pestañas desde aquí: client.navigate() en iOS Safari provocaba
// recarga en bucle y dejaba la página EN BLANCO (regresión batch67, revertido
// en batch68, 8-jul). Purgar caché sí es seguro; forzar navegación NO.
// SW_VERSION: 2026-08-12-batch115-reproductor-hls-audio

self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (e) {}
    await self.clients.claim();
  })());
});

self.addEventListener('push', function(event) {
  console.log('[SW] Push received:', event);
  
  // Título por defecto: marca actual. Decía 'DocSeek' (nombre viejo del proyecto),
  // así que una notificación sin título se anunciaba con una marca que no existe.
  let data = { title: 'Medical Masters', body: 'Nueva notificación' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || data.message,
    // icon = logo a color (el favicon.ico es de 16-48 px y salía pixeleado);
    // badge = silueta monocroma, que es lo que Android pinta en la barra de estado.
    icon: data.icon || '/icon-192.png?v=18',
    badge: '/badge-mono.png?v=18',
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

