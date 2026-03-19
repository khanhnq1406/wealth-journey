// Minimal push-only service worker — no caching (must not interfere with Next.js)
self.addEventListener("install", (event) => {
  console.log("[SW] install, skipWaiting");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[SW] activate, claiming clients");
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  console.log("[SW] push event received, has data:", !!event.data);

  let data;
  try {
    data = event.data ? event.data.json() : null;
    console.log("[SW] parsed payload:", JSON.stringify(data));
  } catch (e) {
    console.warn("[SW] failed to parse push payload", e);
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

  console.log("[SW] showNotification:", title, JSON.stringify(options));
  event.waitUntil(
    self.registration
      .showNotification(title, options)
      .then(() => console.log("[SW] showNotification resolved OK"))
      .catch((err) => console.error("[SW] showNotification FAILED:", err))
  );
});

self.addEventListener("notificationclick", (event) => {
  console.log("[SW] notificationclick:", event.notification.tag);
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
