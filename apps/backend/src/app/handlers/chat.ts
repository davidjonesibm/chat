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
  PushNotificationPayload,
  ReactionTogglePayload,
  ReactionSummary,
} from '@chat/shared';

// Type for push sender function passed from socket plugin
export type PushSender = (
  userId: string,
  payload: PushNotificationPayload,
) => Promise<void>;

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
 * Get all currently online user IDs across all channels
 */
export function getOnlineUserIds(): Set<string> {
  const ids = new Set<string>();
  for (const user of socketUsers.values()) {
    ids.add(user.id);
  }
  return ids;
}

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
  pushSender?: PushSender,
): Promise<void> {
  try {
    const clientMessage: ClientMessage = JSON.parse(data);

    switch (clientMessage.type) {
      case 'message:send':
        await handleMessageSend(
          ws,
          clientMessage.payload,
          user,
          supabase,
          pushSender,
        );
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

      case 'reaction:toggle': {
        await handleReactionToggle(supabase, clientMessage.payload, user.id);
        break;
      }

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
  pushSender?: PushSender,
): Promise<void> {
  try {
    const {
      channelId,
      content,
      type: payloadType,
      gif_url,
      image_url,
    } = payload;

    // Determine message type
    const messageType =
      payloadType === 'giphy'
        ? 'giphy'
        : payloadType === 'image'
          ? 'image'
          : 'text';

    // Validate payload
    if (!channelId || typeof channelId !== 'string') {
      console.error('[message:send] Invalid channelId');
      return;
    }

    if (messageType === 'giphy') {
      // Giphy messages require a valid gif_url from giphy.com
      if (!gif_url || typeof gif_url !== 'string') {
        console.error('[message:send] Giphy message missing gif_url');
        return;
      }
      if (!gif_url.startsWith('https://')) {
        console.error('[message:send] gif_url must start with https://');
        return;
      }
      try {
        const parsedUrl = new URL(gif_url);
        if (
          parsedUrl.hostname !== 'giphy.com' &&
          !parsedUrl.hostname.endsWith('.giphy.com')
        ) {
          console.error('[message:send] gif_url must be from giphy.com domain');
          ws.send(
            JSON.stringify({
              type: 'error',
              payload: { message: 'gif_url must be from giphy.com domain' },
            }),
          );
          return;
        }
      } catch {
        console.error('[message:send] gif_url is not a valid URL');
        ws.send(
          JSON.stringify({
            type: 'error',
            payload: { message: 'gif_url is not a valid URL' },
          }),
        );
        return;
      }
    } else if (messageType === 'image') {
      if (!image_url || typeof image_url !== 'string') {
        console.error('[message:send] Image message missing image_url');
        return;
      }
      if (!image_url.startsWith('https://')) {
        console.error('[message:send] image_url must start with https://');
        return;
      }
      const allowedPrefix = `${process.env.SUPABASE_URL}/storage/v1/object/public/chat-images/`;
      if (!image_url.startsWith(allowedPrefix)) {
        console.error(
          '[message:send] image_url must be from Supabase chat-images bucket',
        );
        ws.send(
          JSON.stringify({
            type: 'error',
            payload: {
              code: 'INVALID_IMAGE_URL',
              message: 'Image URL must be from the app storage',
            },
          }),
        );
        return;
      }
      // content (caption) is optional for image messages — no content validation needed
    } else {
      // Text messages require non-empty content
      if (
        !content ||
        typeof content !== 'string' ||
        content.trim().length === 0
      ) {
        console.error('[message:send] Invalid content');
        return;
      }
    }

    // Create message in Supabase
    // messages.sender_id references auth.users, not public.profiles — no direct FK to profiles,
    // so we fetch the profile separately rather than using an embedded join.
    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        content: content ? content.trim() : '',
        channel_id: channelId,
        sender_id: user.id,
        type: messageType,
        gif_url: messageType === 'giphy' ? gif_url! : null,
        image_url: messageType === 'image' ? image_url! : null,
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
          type: messageType,
          gif_url: messageType === 'giphy' ? gif_url : undefined,
          image_url: messageType === 'image' ? image_url : undefined,
          created_at: message.created_at,
          updated_at: message.updated_at,
          reactions: [],
        },
      },
    };
    broadcastToRoom(channelId, serverMessage);

    console.log(
      `[message:send] Message sent to channel:${channelId} by ${user.username}`,
    );

    // Send push notifications to offline users (fire and forget)
    if (pushSender) {
      sendPushToOfflineUsers(
        channelId,
        message.content,
        messageType,
        user,
        senderData.username,
        supabase,
        pushSender,
      ).catch((err) => {
        console.error('[message:send] Push notification error:', err);
      });
    }
  } catch (err) {
    console.error('[message:send] Error:', err);
  }
}

/**
 * Send push notifications to offline users in a channel
 */
async function sendPushToOfflineUsers(
  channelId: string,
  messageContent: string,
  messageType: string,
  sender: WsUser,
  senderUsername: string,
  supabase: SupabaseClient<Database>,
  pushSender: PushSender,
): Promise<void> {
  try {
    // Get the channel's group_id
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('group_id, name')
      .eq('id', channelId)
      .single();

    if (channelError || !channel) {
      console.error('[push] Failed to fetch channel:', channelError);
      return;
    }

    // Get all members of the group
    const { data: members, error: membersError } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', channel.group_id);

    if (membersError || !members) {
      console.error('[push] Failed to fetch group members:', membersError);
      return;
    }

    // Get currently online user IDs
    const onlineUserIds = getOnlineUserIds();

    // Filter to offline users (not online, not the sender)
    const offlineUserIds = members
      .map((m) => m.user_id)
      .filter((userId) => userId !== sender.id && !onlineUserIds.has(userId));

    if (offlineUserIds.length === 0) {
      console.log('[push] No offline users to notify');
      return;
    }

    // Truncate message content for notification
    let truncatedContent: string;
    if (messageType === 'giphy') {
      truncatedContent = messageContent
        ? `sent a GIF: ${messageContent}`
        : 'sent a GIF';
    } else if (messageType === 'image') {
      truncatedContent = messageContent
        ? `sent a photo: ${messageContent}`
        : 'sent a photo';
    } else {
      truncatedContent =
        messageContent.length > 100
          ? messageContent.substring(0, 97) + '...'
          : messageContent;
    }

    // Send push to each offline user
    let successCount = 0;
    const pushPromises = offlineUserIds.map(async (userId) => {
      const payload: PushNotificationPayload = {
        title: `${senderUsername} in ${channel.name}`,
        body: truncatedContent,
        channelId,
        groupId: channel.group_id,
        senderUsername,
      };

      try {
        await pushSender(userId, payload);
        successCount++;
      } catch (err) {
        console.error(`[push] Failed to send to user ${userId}:`, err);
      }
    });

    await Promise.all(pushPromises);
    console.log(
      `[push] Attempted ${offlineUserIds.length} push(es), ${successCount} delivered successfully`,
    );
  } catch (err) {
    console.error('[push] Error sending push notifications:', err);
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
    const presenceMessage: ServerMessage = {
      type: 'presence:update',
      payload: {
        channelId,
        users: Array.from(online),
      },
    };
    broadcastToRoom(channelId, presenceMessage);

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
      const presenceMessage: ServerMessage = {
        type: 'presence:update',
        payload: {
          channelId,
          users: Array.from(online),
        },
      };
      broadcastToRoom(channelId, presenceMessage);

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
 * Handle reaction:toggle WebSocket message
 */
async function handleReactionToggle(
  supabase: SupabaseClient<Database>,
  payload: ReactionTogglePayload,
  userId: string,
): Promise<void> {
  try {
    const { messageId, emoji } = payload;

    if (!messageId || typeof messageId !== 'string') {
      console.error('[reaction:toggle] Invalid messageId');
      return;
    }

    if (!emoji || typeof emoji !== 'string') {
      console.error('[reaction:toggle] Invalid emoji');
      return;
    }

    // Authorization: verify the requesting user is a member of the group that owns the channel
    const { data: msg } = await supabase
      .from('messages')
      .select('channel_id')
      .eq('id', messageId)
      .single();

    if (!msg) {
      return;
    }

    const { data: channel } = await supabase
      .from('channels')
      .select('group_id')
      .eq('id', msg.channel_id)
      .single();

    if (!channel) {
      return;
    }

    const { data: membership } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', channel.group_id)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return;
    }

    const channelId = msg.channel_id;

    // Check whether this user has already reacted with this emoji
    const { data: existing } = await supabase
      .from('message_reactions')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .eq('emoji', emoji)
      .single();

    if (existing) {
      // Un-react: delete the row
      await supabase.from('message_reactions').delete().eq('id', existing.id);
    } else {
      // React: insert a new row
      await supabase.from('message_reactions').insert({
        message_id: messageId,
        user_id: userId,
        emoji,
      });
    }

    // Fetch all current reactions for this message and aggregate
    const { data: allReactions, error: fetchError } = await supabase
      .from('message_reactions')
      .select('user_id, emoji')
      .eq('message_id', messageId);

    if (fetchError) {
      console.error('[reaction:toggle] Failed to fetch reactions:', fetchError);
      return;
    }

    const summaryMap = new Map<string, ReactionSummary>();
    for (const row of allReactions ?? []) {
      const existing = summaryMap.get(row.emoji);
      if (existing) {
        existing.count++;
        existing.userIds.push(row.user_id);
      } else {
        summaryMap.set(row.emoji, {
          emoji: row.emoji,
          count: 1,
          userIds: [row.user_id],
        });
      }
    }

    const reactions = Array.from(summaryMap.values());

    // Broadcast reaction:updated to all subscribers of the channel
    const serverMessage: ServerMessage = {
      type: 'reaction:updated',
      payload: { messageId, reactions },
    };
    broadcastToRoom(channelId, serverMessage);

    console.log(
      `[reaction:toggle] message:${messageId} emoji:${emoji} by user:${userId}`,
    );
  } catch (err) {
    console.error('[reaction:toggle] Error:', err);
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
  } catch (err) {
    console.error('[disconnect] Error:', err);
  } finally {
    // Clean up user tracking
    socketUsers.delete(ws);
    socketChannels.delete(ws);
  }
}

/**
 * Main handler for WebSocket connections
 */
export function handleWebSocketConnection(
  socket: WebSocket,
  user: WsUser,
  supabase: SupabaseClient<Database>,
  pushSender?: PushSender,
): void {
  console.log(`[WebSocket] User connected: ${user.username}`);

  // Track user for this socket
  socketUsers.set(socket, user);
  socketChannels.set(socket, new Set());

  // Handle incoming messages
  socket.on('message', (data: Buffer) => {
    handleMessage(socket, data.toString(), user, supabase, pushSender);
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
