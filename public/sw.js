self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {
    title: 'Prometheus DX',
    body: 'You have a new Prometheus notification.',
    url: '/notifications',
    tag: 'prometheus-notification',
  };

  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text() || payload.body;
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/apple-touch-icon.png',
      // Android renders this badge as a monochrome notification/status-bar icon.
      // Keep the canonical source asset in public/icons so the service worker uses it directly.
      badge: '/icons/notification-badge.png',
      tag: payload.tag,
      lang: 'en',
      silent: false,
      vibrate: [200, 100, 200],
      data: { url: payload.url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/notifications', self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windows) => {
        const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
        if (existing) {
          return existing.navigate(target).then((client) => client?.focus());
        }
        return self.clients.openWindow(target);
      }),
  );
});
