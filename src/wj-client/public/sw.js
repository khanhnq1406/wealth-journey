// Minimal push-only service worker — no caching (must not interfere with Next.js)
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data;
  try {
    data = event.data ? event.data.json() : null;
  } catch (e) {
    console.warn("SW: failed to parse push payload", e);
    data = null;
  }

  const title = (data && data.title) || "congdongvang.com";
  const options = {
    body: (data && data.body) || "Bạn có thông báo mới",
    icon: (data && data.icon) || "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    tag: (data && data.tag) || "cdv-default",
    renotify: true,
    data: { url: (data && data.url) || "/dashboard/home" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard/home";

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
