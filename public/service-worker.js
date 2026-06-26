// Service Worker — PWA Renoval v4

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
    Promise.all([
      self.registration.showNotification(data.title, {
        body:     data.body,
        icon:     '/Logo_192.png',
        badge:    '/Icono_Notificacion.png',
        tag:      'wa-mensaje',
        renotify: true,
        data:     { url: data.url },
      }),
      // Mostrar ! en el ícono de la app (no un número)
      navigator.setAppBadge
        ? navigator.setAppBadge(data.badge || 1).catch(() => {})
        : Promise.resolve(),
    ])
  );
});

// ── Click en la notificación → abrir/focalizar la app ─────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find(c => c.url.includes(self.location.origin));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});

// ── Limpiar badge cuando el usuario abre la app ────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'CLEAR_BADGE') {
    if (navigator.clearAppBadge) {
      navigator.clearAppBadge().catch(() => {});
    }
  }
});
