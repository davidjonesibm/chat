/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';
import { BackgroundSyncPlugin } from 'workbox-background-sync';
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

// --- 3. Background Sync for offline message POSTs ---
const bgSyncPlugin = new BackgroundSyncPlugin('offlineMessageQueue', {
  maxRetentionTime: 24 * 60, // 24 hours in minutes
});

registerRoute(
  ({ url, request }) =>
    request.method === 'POST' &&
    url.pathname.includes('/api/channels/') &&
    url.pathname.includes('/messages'),
  new NetworkFirst({
    cacheName: 'message-post-cache',
    plugins: [bgSyncPlugin],
  }),
  'POST',
);

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

// --- 6. Activate: claim clients immediately ---
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
