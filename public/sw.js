// Disable the old service worker and clear its caches.
const purge = async () => {
  const keys = await caches.keys();
  await Promise.all(keys.map((k) => caches.delete(k)));
  await self.registration.unregister();
};

self.addEventListener("install", (event) => {
  event.waitUntil(purge());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(purge());
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Always network; this SW only exists to unregister itself.
  return;
});
