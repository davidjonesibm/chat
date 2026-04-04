import { ref } from 'vue';
import type { ClientMessage, ServerMessage } from '@chat/shared';
import { useChatStore } from '../stores/chatStore';
import { useAuthStore } from '../stores/authStore';
import { useChannelStore } from '../stores/channelStore';
import { enqueueMessage, flushQueue } from '../lib/offlineQueue';
import { useToast } from './useToast';

const baseUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;

// Convert http/https to ws/wss
function getWebSocketUrl(token: string): string {
  const wsBase = baseUrl.replace(/^http/, 'ws');
  return `${wsBase}/ws?token=${encodeURIComponent(token)}`;
}

// Module-level singleton WebSocket
let ws: WebSocket | null = null;
let reconnectAttempts = 0;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let isManualDisconnect = false;

// Typing debounce
let typingTimeout: ReturnType<typeof setTimeout> | null = null;
const TYPING_DEBOUNCE_MS = 2000;

// Reconnection config
const MAX_RECONNECT_ATTEMPTS = 10;
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 30000]; // exponential backoff with max 30s

export function useChat() {
  const chatStore = useChatStore();
  const authStore = useAuthStore();
  const error = ref<string | null>(null);

  function getReconnectDelay(): number {
    const index = Math.min(reconnectAttempts, RECONNECT_DELAYS.length - 1);
    return RECONNECT_DELAYS[index];
  }

  function sendClientMessage(message: ClientMessage) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  function setupWebSocket(token: string) {
    const channelStore = useChannelStore();
    const url = getWebSocketUrl(token);
    ws = new WebSocket(url);

    ws.onopen = () => {
      chatStore.connected = true;
      chatStore.reconnecting = false;
      chatStore.reconnectAttempt = 0;
      error.value = null;
      reconnectAttempts = 0;
      console.log('[WebSocket] Connected');

      // Flush offline message queue
      flushQueue((channelId, content) => {
        sendClientMessage({
          type: 'message:send',
          payload: { channelId, content },
        });
      })
        .then((count) => {
          if (count > 0) {
            console.log(`[WebSocket] Flushed ${count} queued messages`);
          }
        })
        .catch((err) => {
          console.error('[WebSocket] Failed to flush queue:', err);
        });

      // Auto-join current channel
      if (chatStore.currentChannelId) {
        sendClientMessage({
          type: 'channel:join',
          payload: { channelId: chatStore.currentChannelId },
        });
      }
    };

    ws.onmessage = (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data);

        switch (message.type) {
          case 'message:new':
            chatStore.addMessage(message.payload.message);
            break;

          case 'typing:update':
            chatStore.typingUsers = message.payload.users;
            break;

          case 'presence:update':
            chatStore.onlineUsers = message.payload.users;
            if (channelStore.currentGroupId) {
              const missing = message.payload.users.filter(
                (id) => !channelStore.memberProfiles[id],
              );
              if (missing.length > 0) {
                channelStore
                  .fetchGroupMembers(channelStore.currentGroupId)
                  .catch((err) =>
                    console.error(
                      '[WebSocket] Failed to refresh member profiles:',
                      err,
                    ),
                  );
              }
            }
            break;

          case 'channel:updated':
            // Handle channel updates if needed
            console.log('[WebSocket] Channel updated:', message.payload);
            break;

          case 'error':
            useToast().addToast('error', message.payload.message);
            break;

          default:
            console.warn('[WebSocket] Unknown message type:', message);
        }
      } catch (err) {
        console.error('[WebSocket] Failed to parse message:', err);
      }
    };

    ws.onclose = (event) => {
      chatStore.connected = false;
      console.log('[WebSocket] Disconnected:', event.code, event.reason);

      ws = null;

      // Attempt reconnection if not manually disconnected
      if (!isManualDisconnect) {
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          chatStore.reconnecting = false;
          useToast().addToast(
            'error',
            'Unable to connect. Please refresh the page.',
          );
          return;
        }

        chatStore.reconnecting = true;
        const delay = getReconnectDelay();
        console.log(
          `[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1})...`,
        );

        reconnectTimeout = setTimeout(() => {
          reconnectAttempts++;
          chatStore.reconnectAttempt = reconnectAttempts;
          connect();
        }, delay);
      }
    };

    ws.onerror = (event) => {
      error.value = 'WebSocket connection error';
      useToast().addToast('error', 'Connection error');
      console.error('[WebSocket] Error:', event);
    };
  }

  function connect() {
    if (
      ws?.readyState === WebSocket.OPEN ||
      ws?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    const token = authStore.token;
    if (!token) {
      error.value = 'No auth token available';
      return;
    }

    isManualDisconnect = false;
    setupWebSocket(token);
  }

  function disconnect() {
    if (!ws) return;

    isManualDisconnect = true;

    // Clear any pending reconnection
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }

    // Leave current channel before disconnecting
    if (chatStore.currentChannelId) {
      sendClientMessage({
        type: 'channel:leave',
        payload: { channelId: chatStore.currentChannelId },
      });
    }

    ws.close();
    ws = null;
    chatStore.connected = false;
    chatStore.reconnecting = false;
    chatStore.reconnectAttempt = 0;
    reconnectAttempts = 0;
    console.log('[WebSocket] Manually disconnected');
  }

  function sendMessage(content: string) {
    if (!chatStore.currentChannelId) {
      return;
    }

    // If WebSocket is not connected, enqueue message for later
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      enqueueMessage(chatStore.currentChannelId, content)
        .then(() => {
          console.log('[WebSocket] Message queued for offline delivery');
        })
        .catch((err) => {
          console.error('[WebSocket] Failed to queue message:', err);
        });
      return;
    }

    sendClientMessage({
      type: 'message:send',
      payload: {
        channelId: chatStore.currentChannelId,
        content,
      },
    });
  }

  function startTyping() {
    if (
      !ws ||
      ws.readyState !== WebSocket.OPEN ||
      !chatStore.currentChannelId
    ) {
      return;
    }

    sendClientMessage({
      type: 'typing:start',
      payload: {
        channelId: chatStore.currentChannelId,
      },
    });

    // Auto-stop typing after debounce
    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      stopTyping();
    }, TYPING_DEBOUNCE_MS);
  }

  function stopTyping() {
    if (
      !ws ||
      ws.readyState !== WebSocket.OPEN ||
      !chatStore.currentChannelId
    ) {
      return;
    }

    sendClientMessage({
      type: 'typing:stop',
      payload: {
        channelId: chatStore.currentChannelId,
      },
    });

    if (typingTimeout) {
      clearTimeout(typingTimeout);
      typingTimeout = null;
    }
  }

  function switchChannel(
    oldChannelId: string | null,
    newChannelId: string,
  ): void {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }

    // Leave old channel if it exists
    if (oldChannelId) {
      sendClientMessage({
        type: 'channel:leave',
        payload: {
          channelId: oldChannelId,
        },
      });
    }

    // Join new channel
    sendClientMessage({
      type: 'channel:join',
      payload: {
        channelId: newChannelId,
      },
    });
  }

  return {
    connect,
    disconnect,
    sendMessage,
    startTyping,
    stopTyping,
    switchChannel,
    error,
  };
}
