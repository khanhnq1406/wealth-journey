// Minimal push-only service worker — no caching (must not interfere with Next.js)
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    return;
  }

  const options = {
    body: data.body || "",
    icon: data.icon || "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    data: { url: data.url || "/dashboard/home" },
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(
      data.title || "congdongvang.com",
      options
    )
  );
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
