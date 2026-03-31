/** Push subscription request — sent from frontend to backend */
export interface PushSubscribeRequest {
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
}

export interface PushSubscribeResponse {
  success: boolean;
}

export interface PushUnsubscribeRequest {
  endpoint: string;
}

export interface PushUnsubscribeResponse {
  success: boolean;
}

/** Shape of push notification payload sent from backend to service worker */
export interface PushNotificationPayload {
  title: string;
  body: string;
  channelId: string;
  groupId: string;
  senderUsername: string;
  icon?: string;
  badge?: string;
}

/** VAPID public key response from GET /api/push/vapid-public-key */
export interface VapidPublicKeyResponse {
  publicKey: string;
}
