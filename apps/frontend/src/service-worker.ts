/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  matchPrecache,
  precacheAndRoute,
} from 'workbox-precaching';
import {
  NavigationRoute,
  registerRoute,
  setCatchHandler,
} from 'workbox-routing';
import { NetworkFirst, NetworkOnly } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import type { PushNotificationPayload } from '@chat/shared';

// --- 1. Precache app shell ---
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// --- 2. SPA navigation fallback ---
const navigationRoute = new NavigationRoute(
  createHandlerBoundToURL('/index.html'),
  {
    denylist: [/^\/api\//],
  },
);
registerRoute(navigationRoute);

// --- 3. Runtime caching for API GET requests ---
registerRoute(
  ({ url, request }) =>
    request.method === 'GET' && url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-get-cache',
    networkTimeoutSeconds: 3,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 5 * 60 }),
    ],
  }),
);

// --- 3b. NetworkOnly for offline message POSTs ---
registerRoute(
  ({ url, request }) =>
    request.method === 'POST' &&
    url.pathname.includes('/api/channels/') &&
    url.pathname.includes('/messages'),
  new NetworkOnly(),
  'POST',
);

// --- 3c. Offline fallback for failed navigations ---
setCatchHandler(async ({ event }) => {
  if (
    'request' in event &&
    (event as FetchEvent).request.destination === 'document'
  ) {
    const response = await matchPrecache('/offline.html');
    return response || Response.error();
  }
  return Response.error();
});

// --- 4. Push event handler ---
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload: PushNotificationPayload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/icons/icon-192x192.png',
      badge: payload.badge || '/icons/icon-192x192.png',
      data: {
        channelId: payload.channelId,
        groupId: payload.groupId,
      },
      tag: `channel-${payload.channelId}`,
    }),
  );
});

// --- 5. Notification click handler ---
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const { channelId, groupId } = event.notification.data || {};
  const urlPath = channelId && groupId ? `/g/${groupId}/c/${channelId}` : '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(async (clientList) => {
        // Focus existing tab if found
        for (const client of clientList) {
          if (new URL(client.url).origin === self.location.origin) {
            if (new URL(client.url).pathname === urlPath) {
              // Already at the target URL — just focus
              await client.focus();
              return;
            }
            // SPA navigate via postMessage to avoid full page reload
            await client.focus();
            client.postMessage({ type: 'NAVIGATE', url: urlPath });
            return;
          }
        }
        // Open new window
        await self.clients.openWindow(urlPath);
      }),
  );
});

// --- Skip waiting when told by the client ---
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// --- 7. Re-subscribe on pushsubscriptionchange ---
interface PushSubscriptionChangeEvent extends ExtendableEvent {
  readonly oldSubscription?: PushSubscription;
  readonly newSubscription?: PushSubscription;
}

self.addEventListener(
  'pushsubscriptionchange' as keyof ServiceWorkerGlobalScopeEventMap,
  ((event: PushSubscriptionChangeEvent) => {
    event.waitUntil(
      self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          for (const client of clientList) {
            client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED' });
          }
        }),
    );
  }) as EventListener,
);

// --- 8. Activate: claim clients immediately ---
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
