// Service Worker — PWA Renoval
// Habilita instalación y push notifications

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});

// ── Push notification recibida ─────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = { title: 'Renoval', body: 'Nuevo mensaje de WhatsApp', url: '/' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:    data.body,
      icon:    '/Logo_192.png',
      badge:   '/Logo_192.png',
      tag:     'wa-mensaje',       // reemplaza la anterior en vez de apilar
      renotify: true,
      data:    { url: data.url },
    })
  );
});

// ── Click en la notificación → abrir/focalizar la app ─────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Si la app ya está abierta, enfocarla
      const existing = clients.find(c => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      // Si no, abrir una nueva ventana
      return self.clients.openWindow(url);
    })
  );
});
