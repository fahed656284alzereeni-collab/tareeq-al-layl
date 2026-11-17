const STATIC_CACHE = "mersal-static-v30";
const STATIC_PATHS = new Set([
  "/app.js",
  "/auth-bootstrap.js",
  "/supabase-client.js",
  "/tools.js",
  "/channels.js",
  "/communities.js",
  "/styles.css",
  "/inclusive-responsive.css",
  "/mersal-redesign.css",
  "/mersal-experience-v2.css",
  "/icon.svg",
  "/manifest.webmanifest"
]);

self.addEventListener("install", event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith("mersal-static-") && key !== STATIC_CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

// Cache only the app shell and versioned same-origin assets. Supabase requests,
// OAuth callbacks, uploads, realtime traffic, and all other API calls stay network-only.
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    if (url.pathname !== "/" || url.search) return;
    const cachePromise = caches.open(STATIC_CACHE);
    const refreshPromise = cachePromise.then(cache => fetch(request).then(response => {
      if (response.ok) return cache.put("/", response.clone()).then(() => response);
      return response;
    }));
    // Register background refresh during the fetch event, without delaying cached navigation.
    event.waitUntil(refreshPromise.then(() => undefined).catch(error => {
      console.warn("Mersal background page refresh failed:", error);
    }));
    event.respondWith(cachePromise.then(cache => cache.match("/")).then(cached => {
      if (cached) return cached;
      return refreshPromise;
    }));
    return;
  }

  if (!STATIC_PATHS.has(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(STATIC_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  })());
});

self.addEventListener("push", event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { body: event.data ? event.data.text() : "" }; }
  const title = payload.title || "مرسال";
  const options = {
    body: payload.body || "وصلتك رسالة جديدة",
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: payload.tag || "mersal-message",
    renotify: true,
    data: { url: payload.url || "/" }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (client.url.startsWith(self.location.origin) && "focus" in client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(target);
        return;
      }
    }
    if (clients.openWindow) await clients.openWindow(target);
  })());
});