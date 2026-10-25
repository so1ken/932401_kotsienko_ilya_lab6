// Service Worker: кеширует оболочку приложения и позволяет открыть её без сети.
const CACHE_NAME = 'password-generator-cache-v1';
const STATIC_ASSETS = [
    '/',
    '/about',
    '/assets/css/style.css',
    '/assets/js/script.js',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png'
];

// При установке заранее сохраняем необходимые файлы.
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(STATIC_ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Удаляем устаревшие кеши после обновления версии Service Worker.
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => Promise.all(
                cacheNames
                    .filter((cacheName) => cacheName !== CACHE_NAME)
                    .map((cacheName) => caches.delete(cacheName))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;

    // Кешируем только GET-запросы к этому сайту.
    if (request.method !== 'GET') {
        return;
    }

    const requestUrl = new URL(request.url);

    if (requestUrl.origin !== self.location.origin) {
        return;
    }

    // API динамический, поэтому его ответы не сохраняются в кеше.
    // Если сервер недоступен, script.js создаст пароль на устройстве.
    if (requestUrl.pathname.startsWith('/api/')) {
        return;
    }

    // Для страниц сначала используем кеш, чтобы навигация работала офлайн.
    if (request.mode === 'navigate') {
        event.respondWith(
            caches.match(request)
                .then((cachedResponse) => cachedResponse || fetch(request))
                .catch(() => caches.match('/'))
        );
        return;
    }

    // Для статики используем кеш, а при отсутствии записи запрашиваем сеть.
    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(request).then((response) => {
                    if (response && response.ok) {
                        const responseCopy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseCopy));
                    }

                    return response;
                });
            })
    );
});
