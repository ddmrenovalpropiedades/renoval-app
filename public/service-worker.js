// Service Worker mínimo — habilita instalación PWA en Android/iOS
// En el futuro se puede extender para push notifications y caché offline

const CACHE_NAME = 'renoval-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Sin interceptar fetch por ahora — la app sigue funcionando 100% online
self.addEventListener('fetch', () => {});
