/**
 * AGCX service worker.
 *
 * Deliberately conservative about what it caches. The app shell is versioned and
 * cached so the phone opens instantly and survives a dead signal, but **API
 * responses are never cached** — a customer-success tool that shows yesterday's
 * pipeline as though it were today's is worse than one that says it is offline.
 */
const VERSION = 'agcx-v1';
const SHELL = ['/', '/m', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);

    // Never serve data from cache — always the network, and fail honestly.
    if (url.pathname.startsWith('/api/') || e.request.method !== 'GET') return;

    // Navigations: network first so a deployed change is picked up, falling back
    // to the cached shell when there is no signal.
    if (e.request.mode === 'navigate') {
        e.respondWith(
            fetch(e.request)
                .then((r) => { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); return r; })
                .catch(() => caches.match(e.request).then((m) => m || caches.match('/m')))
        );
        return;
    }

    // Static assets are content-hashed by the build, so cache-first is safe.
    e.respondWith(
        caches.match(e.request).then((hit) => hit || fetch(e.request).then((r) => {
            if (r.ok && url.origin === self.location.origin) {
                const copy = r.clone();
                caches.open(VERSION).then((c) => c.put(e.request, copy));
            }
            return r;
        }))
    );
});
