/// <reference lib="webworker" />
// LetResearch service worker: makes the app installable, loads it offline, and shows
// notifications (web push) while the app is closed.
import { clientsClaim } from 'workbox-core';
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

// The app shell, styles, fonts, icons and sounds – replaced as a set when a new version ships.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Every page of the app opens from the cached shell, so it starts instantly and offline.
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')));

// A new version waits until the user taps "Reload" in the app.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') void self.skipWaiting();
});
clientsClaim();

interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
  badge?: number;
}

self.addEventListener('push', (event) => {
  let data: PushPayload = {};
  try {
    data = event.data ? (event.data.json() as PushPayload) : {};
  } catch {
    data = { body: event.data?.text() };
  }
  const title = data.title || 'LetResearch';
  const options: NotificationOptions & { renotify?: boolean } = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag: data.tag,
    renotify: !!data.tag,
    data: { url: data.url || '/' },
  };
  const nav = self.navigator as WorkerNavigator & { setAppBadge?: (n?: number) => Promise<void> };
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      typeof data.badge === 'number' && nav.setAppBadge ? nav.setAppBadge(data.badge).catch(() => {}) : Promise.resolve(),
    ]),
  );
});

// Tapping a notification opens the right page: in an open LetResearch window when there is one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = (event.notification.data as { url?: string } | null)?.url || '/';
  const target = new URL(path, self.location.origin);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (existing) {
        await existing.focus().catch(() => undefined);
        existing.postMessage({ type: 'navigate', url: target.pathname + target.search });
        return;
      }
      await self.clients.openWindow(target.href);
    })(),
  );
});
