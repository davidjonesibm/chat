import type { WebSocket } from 'ws';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../database.types';
import type {
  ClientMessage,
  ServerMessage,
  WsUser,
  MessageSendPayload,
  TypingPayload,
  ChannelPayload,
} from '@chat/shared';

// Track WebSocket connections per channel (room tracking)
const channelRooms = new Map<string, Set<WebSocket>>();

// Track user data per WebSocket
const socketUsers = new Map<WebSocket, WsUser>();

// Track which channels a WebSocket is in
const socketChannels = new Map<WebSocket, Set<string>>();

// Track typing users per channel: channelId -> Set<username>
const typingUsers = new Map<string, Set<string>>();

// Track typing timeouts per user per channel: `${channelId}:${username}` -> timeout
const typingTimeouts = new Map<string, NodeJS.Timeout>();

// Track online users per channel: channelId -> Set<userId>
const onlineUsers = new Map<string, Set<string>>();

/**
 * Broadcast a message to all WebSockets in a room
 */
function broadcastToRoom(
  channelId: string,
  message: ServerMessage,
  excludeSocket?: WebSocket,
): void {
  const room = channelRooms.get(channelId);
  if (!room) return;

  const payload = JSON.stringify(message);
  for (const ws of room) {
    if (ws !== excludeSocket && ws.readyState === 1) {
      // 1 = OPEN
      ws.send(payload);
    }
  }
}

/**
 * Add a WebSocket to a channel room
 */
function joinRoom(ws: WebSocket, channelId: string): void {
  let room = channelRooms.get(channelId);
  if (!room) {
    room = new Set();
    channelRooms.set(channelId, room);
  }
  room.add(ws);

  // Track channel membership for this socket
  let channels = socketChannels.get(ws);
  if (!channels) {
    channels = new Set();
    socketChannels.set(ws, channels);
  }
  channels.add(channelId);
}

/**
 * Remove a WebSocket from a channel room
 */
function leaveRoom(ws: WebSocket, channelId: string): void {
  channelRooms.get(channelId)?.delete(ws);
  socketChannels.get(ws)?.delete(channelId);
}

/**
 * Handle incoming WebSocket messages
 */
async function handleMessage(
  ws: WebSocket,
  data: string,
  user: WsUser,
  supabase: SupabaseClient<Database>,
): Promise<void> {
  try {
    const clientMessage: ClientMessage = JSON.parse(data);

    switch (clientMessage.type) {
      case 'message:send':
        await handleMessageSend(ws, clientMessage.payload, user, supabase);
        break;

      case 'typing:start':
        handleTypingStart(ws, clientMessage.payload, user);
        break;

      case 'typing:stop':
        handleTypingStop(ws, clientMessage.payload, user);
        break;

      case 'channel:join':
        handleChannelJoin(ws, clientMessage.payload, user);
        break;

      case 'channel:leave':
        handleChannelLeave(ws, clientMessage.payload, user);
        break;

      default:
        console.error('Unknown message type:', clientMessage);
    }
  } catch (err) {
    console.error('Error handling message:', err);
  }
}

/**
 * Handle message:send event
 */
async function handleMessageSend(
  ws: WebSocket,
  payload: MessageSendPayload,
  user: WsUser,
  supabase: SupabaseClient<Database>,
): Promise<void> {
  try {
    const { channelId, content } = payload;

    // Validate payload
    if (
      !content ||
      typeof content !== 'string' ||
      content.trim().length === 0
    ) {
      console.error('[message:send] Invalid content');
      return;
    }

    if (!channelId || typeof channelId !== 'string') {
      console.error('[message:send] Invalid channelId');
      return;
    }

    // Create message in Supabase
    // messages.sender_id references auth.users, not public.profiles — no direct FK to profiles,
    // so we fetch the profile separately rather than using an embedded join.
    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        content: content.trim(),
        channel_id: channelId,
        sender_id: user.id,
        type: 'text',
      })
      .select('*')
      .single();

    if (error) {
      console.error('[message:send] Database error:', error);
      return;
    }

    // Fetch sender profile separately
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, username, avatar')
      .eq('id', user.id)
      .single();

    const senderData = profile
      ? {
          id: profile.id,
          username: profile.username || user.username,
          avatar: profile.avatar ?? undefined,
        }
      : {
          id: user.id,
          username: user.username,
          avatar: undefined,
        };

    // Broadcast to all users in the channel
    const serverMessage: ServerMessage = {
      type: 'message:new',
      payload: {
        message: {
          id: message.id,
          content: message.content,
          channel: channelId,
          sender: senderData,
          type: 'text',
          created_at: message.created_at,
          updated_at: message.updated_at,
        },
      },
    };
    broadcastToRoom(channelId, serverMessage);

    console.log(
      `[message:send] Message sent to channel:${channelId} by ${user.username}`,
    );
  } catch (err) {
    console.error('[message:send] Error:', err);
  }
}

/**
 * Handle typing:start event
 */
function handleTypingStart(
  ws: WebSocket,
  payload: TypingPayload,
  user: WsUser,
): void {
  try {
    const { channelId } = payload;

    if (!channelId || typeof channelId !== 'string') {
      console.error('[typing:start] Invalid channelId');
      return;
    }

    // Get or create typing users set for this channel
    let typing = typingUsers.get(channelId);
    if (!typing) {
      typing = new Set();
      typingUsers.set(channelId, typing);
    }
    typing.add(user.username);

    // Clear any existing timeout for this user in this channel
    const timeoutKey = `${channelId}:${user.username}`;
    const existingTimeout = typingTimeouts.get(timeoutKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set auto-clear timeout (5 seconds)
    const timeout = setTimeout(() => {
      typing.delete(user.username);
      typingTimeouts.delete(timeoutKey);

      // Emit updated typing state (exclude sender)
      const serverMessage: ServerMessage = {
        type: 'typing:update',
        payload: {
          channelId,
          users: Array.from(typing),
        },
      };
      broadcastToRoom(channelId, serverMessage, ws);
    }, 5000);

    typingTimeouts.set(timeoutKey, timeout);

    // Emit to others in the channel (exclude sender)
    const serverMessage: ServerMessage = {
      type: 'typing:update',
      payload: {
        channelId,
        users: Array.from(typing),
      },
    };
    broadcastToRoom(channelId, serverMessage, ws);

    console.log(
      `[typing:start] ${user.username} typing in channel:${channelId}`,
    );
  } catch (err) {
    console.error('[typing:start] Error:', err);
  }
}

/**
 * Handle typing:stop event
 */
function handleTypingStop(
  ws: WebSocket,
  payload: TypingPayload,
  user: WsUser,
): void {
  try {
    const { channelId } = payload;

    if (!channelId || typeof channelId !== 'string') {
      console.error('[typing:stop] Invalid channelId');
      return;
    }

    const typing = typingUsers.get(channelId);
    if (typing) {
      typing.delete(user.username);

      // Clear timeout
      const timeoutKey = `${channelId}:${user.username}`;
      const existingTimeout = typingTimeouts.get(timeoutKey);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
        typingTimeouts.delete(timeoutKey);
      }

      // Emit to others in the channel (exclude sender)
      const serverMessage: ServerMessage = {
        type: 'typing:update',
        payload: {
          channelId,
          users: Array.from(typing),
        },
      };
      broadcastToRoom(channelId, serverMessage, ws);

      console.log(
        `[typing:stop] ${user.username} stopped typing in channel:${channelId}`,
      );
    }
  } catch (err) {
    console.error('[typing:stop] Error:', err);
  }
}

/**
 * Handle channel:join event
 */
function handleChannelJoin(
  ws: WebSocket,
  payload: ChannelPayload,
  user: WsUser,
): void {
  try {
    const { channelId } = payload;

    if (!channelId || typeof channelId !== 'string') {
      console.error('[channel:join] Invalid channelId');
      return;
    }

    // Join the room
    joinRoom(ws, channelId);

    // Add user to online users for this channel
    let online = onlineUsers.get(channelId);
    if (!online) {
      online = new Set();
      onlineUsers.set(channelId, online);
    }
    online.add(user.id);

    // Emit presence update to all users in the channel
    const serverMessage: ServerMessage = {
      type: 'presence:update',
      payload: {
        channelId,
        users: Array.from(online),
      },
    };
    broadcastToRoom(channelId, serverMessage);

    console.log(
      `[channel:join] ${user.username} joined channel:${channelId}, online: ${online.size}`,
    );
  } catch (err) {
    console.error('[channel:join] Error:', err);
  }
}

/**
 * Handle channel:leave event
 */
function handleChannelLeave(
  ws: WebSocket,
  payload: ChannelPayload,
  user: WsUser,
): void {
  try {
    const { channelId } = payload;

    if (!channelId || typeof channelId !== 'string') {
      console.error('[channel:leave] Invalid channelId');
      return;
    }

    // Leave the room
    leaveRoom(ws, channelId);

    // Remove user from online users for this channel
    const online = onlineUsers.get(channelId);
    if (online) {
      online.delete(user.id);

      // Emit presence update to remaining users in the channel
      const serverMessage: ServerMessage = {
        type: 'presence:update',
        payload: {
          channelId,
          users: Array.from(online),
        },
      };
      broadcastToRoom(channelId, serverMessage);

      // Clean up empty sets
      if (online.size === 0) {
        onlineUsers.delete(channelId);
      }
    }

    console.log(`[channel:leave] ${user.username} left channel:${channelId}`);
  } catch (err) {
    console.error('[channel:leave] Error:', err);
  }
}

/**
 * Handle WebSocket disconnection
 */
function handleDisconnect(ws: WebSocket, user: WsUser): void {
  try {
    console.log(`[WebSocket] User disconnected: ${user.username} (${user.id})`);

    // Get all channels this socket was in
    const channels = socketChannels.get(ws);
    if (channels) {
      // Remove user from typing and online tracking for each channel
      channels.forEach((channelId) => {
        // Remove socket from channel room
        channelRooms.get(channelId)?.delete(ws);
        if (channelRooms.get(channelId)?.size === 0) {
          channelRooms.delete(channelId);
        }

        // Remove from typing
        const typing = typingUsers.get(channelId);
        if (typing) {
          typing.delete(user.username);

          // Clear typing timeout
          const timeoutKey = `${channelId}:${user.username}`;
          const timeout = typingTimeouts.get(timeoutKey);
          if (timeout) {
            clearTimeout(timeout);
            typingTimeouts.delete(timeoutKey);
          }

          // Emit updated typing state
          const typingMessage: ServerMessage = {
            type: 'typing:update',
            payload: {
              channelId,
              users: Array.from(typing),
            },
          };
          broadcastToRoom(channelId, typingMessage);

          // Clean up empty typing sets
          if (typing.size === 0) {
            typingUsers.delete(channelId);
          }
        }

        // Remove from online users
        const online = onlineUsers.get(channelId);
        if (online) {
          online.delete(user.id);

          // Emit updated presence
          const presenceMessage: ServerMessage = {
            type: 'presence:update',
            payload: {
              channelId,
              users: Array.from(online),
            },
          };
          broadcastToRoom(channelId, presenceMessage);

          // Clean up empty online sets
          if (online.size === 0) {
            onlineUsers.delete(channelId);
          }
        }
      });

      // Clean up socket channels tracking
      socketChannels.delete(ws);
    }

    // Clean up user tracking
    socketUsers.delete(ws);
  } catch (err) {
    console.error('[disconnect] Error:', err);
  }
}

/**
 * Main handler for WebSocket connections
 */
export function handleWebSocketConnection(
  socket: WebSocket,
  user: WsUser,
  supabase: SupabaseClient<Database>,
): void {
  console.log(`[WebSocket] User connected: ${user.username}`);

  // Track user for this socket
  socketUsers.set(socket, user);
  socketChannels.set(socket, new Set());

  // Handle incoming messages
  socket.on('message', (data: Buffer) => {
    handleMessage(socket, data.toString(), user, supabase);
  });

  // Handle disconnection
  socket.on('close', () => {
    handleDisconnect(socket, user);
  });

  // Handle errors
  socket.on('error', (err) => {
    console.error(`WebSocket error for ${user.username}:`, err);
  });
}
