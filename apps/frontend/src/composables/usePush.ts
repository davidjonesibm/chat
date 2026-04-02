import { ref } from 'vue';
import type {
  PushSubscribeRequest,
  PushSubscribeResponse,
  PushUnsubscribeRequest,
  VapidPublicKeyResponse,
} from '@chat/shared';
import { apiFetch } from '../lib/api';

const baseUrl = import.meta.env.VITE_API_URL || window.location.origin;

const pushSupported = ref(
  'serviceWorker' in navigator && 'PushManager' in window,
);
const pushPermission = ref<NotificationPermission>(
  typeof Notification !== 'undefined' ? Notification.permission : 'default',
);
const subscribed = ref(false);

export function usePush() {
  async function getVapidPublicKey(): Promise<string> {
    const data = await apiFetch<VapidPublicKeyResponse>(
      `${baseUrl}/api/push/vapid-public-key`,
    );
    return data.publicKey;
  }

  function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  }

  async function subscribeToPush(): Promise<boolean> {
    if (!pushSupported.value) {
      console.warn('[Push] Push notifications not supported');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      pushPermission.value = permission;

      if (permission !== 'granted') {
        console.log('[Push] Permission denied');
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      const vapidPublicKey = await getVapidPublicKey();

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          vapidPublicKey,
        ) as BufferSource,
      });

      const subscriptionJson = subscription.toJSON();
      if (!subscriptionJson.keys || !subscriptionJson.endpoint) {
        throw new Error('Subscription keys or endpoint missing');
      }

      const requestBody: PushSubscribeRequest = {
        subscription: {
          endpoint: subscriptionJson.endpoint,
          keys: {
            p256dh: subscriptionJson.keys.p256dh,
            auth: subscriptionJson.keys.auth,
          },
        },
      };

      const response = await apiFetch<PushSubscribeResponse>(
        `${baseUrl}/api/push/subscribe`,
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
        },
      );

      subscribed.value = response.success;
      console.log('[Push] Subscribed successfully');
      return data.success;
    } catch (error) {
      console.error('[Push] Subscribe error:', error);
      subscribed.value = false;
      return false;
    }
  }

  async function unsubscribeFromPush(): Promise<boolean> {
    if (!pushSupported.value) {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();

        const requestBody: PushUnsubscribeRequest = { endpoint };

        try {
          await apiFetch(`${baseUrl}/api/push/unsubscribe`, {
            method: 'DELETE',
            body: JSON.stringify(requestBody),
          });
          console.log('[Push] Unsubscribed successfully');
        } catch {
          console.warn('[Push] Failed to notify backend of unsubscribe');
        }
      }

      subscribed.value = false;
      return true;
    } catch (error) {
      console.error('[Push] Unsubscribe error:', error);
      subscribed.value = false;
      return false;
    }
  }

  async function checkExistingSubscription(): Promise<void> {
    if (!pushSupported.value) {
      subscribed.value = false;
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      subscribed.value = !!subscription;
      pushPermission.value = Notification.permission;
    } catch (error) {
      console.error('[Push] Failed to check existing subscription:', error);
      subscribed.value = false;
    }
  }

  return {
    pushSupported,
    pushPermission,
    subscribed,
    subscribeToPush,
    unsubscribeFromPush,
    checkExistingSubscription,
  };
}
