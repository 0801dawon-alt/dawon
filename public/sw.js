// Pass-through service worker: it only makes the homepage installable as an app; nothing is cached,
// so every launch loads the latest version.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
