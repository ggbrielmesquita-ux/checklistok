// sw.js — cache do app shell para uso offline. Estratégia cache-first para
// os arquivos estáticos, com atualização em segundo plano quando online.
// Bump no CACHE_NAME sempre que os arquivos abaixo mudarem de conteúdo,
// para forçar os clientes a buscar a versão nova.
const CACHE_NAME = 'dizai-cache-v4';

const APP_SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/store.js',
  './js/parser.js',
  './js/speech.js',
  './js/ui.js',
  './js/time.js',
  './js/categories.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          if (request.mode === 'navigate') return caches.match('./index.html');
          return undefined;
        });
    })
  );
});
