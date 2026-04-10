import type { FastifyBaseLogger } from 'fastify';
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

// --- M3: WS Message Validation ---

const VALID_CLIENT_MESSAGE_TYPES = new Set<string>([
  'message:send',
  'typing:start',
  'typing:stop',
  'channel:join',
  'channel:leave',
  'reaction:toggle',
]);

function isValidClientMessage(data: unknown): data is ClientMessage {
  if (data === null || typeof data !== 'object') return false;
  const msg = data as Record<string, unknown>;
  if (typeof msg.type !== 'string' || !VALID_CLIENT_MESSAGE_TYPES.has(msg.type))
    return false;
  if (msg.payload === null || typeof msg.payload !== 'object') return false;
  return true;
}

// --- M4: WS Rate Limiting (Token Bucket per Socket) ---

class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(
    private readonly maxTokens: number = 30,
    private readonly refillRate: number = 10,
  ) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(
      this.maxTokens,
      this.tokens + elapsed * this.refillRate,
    );
    this.lastRefill = now;
  }

  consume(): boolean {
    this.refill();
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

// --- ConnectionManager: encapsulates all WebSocket connection state ---

export class ConnectionManager {
  // Maps channel IDs to connected sockets
  private readonly channelRooms = new Map<string, Set<WebSocket>>();
  // Maps sockets to authenticated users
  private readonly socketUsers = new Map<WebSocket, WsUser>();
  // Maps sockets to channels they've joined
  private readonly socketChannels = new Map<WebSocket, Set<string>>();
  // Maps channel IDs to typing user names
  private readonly typingUsers = new Map<string, Set<string>>();
  // Typing indicator timeout handles: `${channelId}:${username}` -> timeout
  private readonly typingTimeouts = new Map<string, NodeJS.Timeout>();
  // Maps channel IDs to online user IDs
  private readonly onlineUsers = new Map<string, Set<string>>();
  // Rate limiting buckets per socket
  private readonly socketBuckets = new Map<WebSocket, TokenBucket>();

  constructor(private readonly logger: FastifyBaseLogger) {}

  /** Get all currently connected WebSocket instances */
  getConnectedSockets(): WebSocket[] {
    return Array.from(this.socketUsers.keys());
  }

  /** Get all currently online user IDs across all channels */
  getOnlineUserIds(): Set<string> {
    const ids = new Set<string>();
    for (const user of this.socketUsers.values()) {
      ids.add(user.id);
    }
    return ids;
  }

  /** Broadcast a message to all WebSockets in a room */
  broadcastToRoom(
    channelId: string,
    message: ServerMessage,
    excludeSocket?: WebSocket,
  ): void {
    const room = this.channelRooms.get(channelId);
    if (!room) return;

    const payload = JSON.stringify(message);
    for (const ws of room) {
      if (ws !== excludeSocket && ws.readyState === 1) {
        // 1 = OPEN
        ws.send(payload);
      }
    }
  }

  /** Add a WebSocket to a channel room */
  joinRoom(ws: WebSocket, channelId: string): void {
    let room = this.channelRooms.get(channelId);
    if (!room) {
      room = new Set();
      this.channelRooms.set(channelId, room);
    }
    room.add(ws);

    // Track channel membership for this socket
    let channels = this.socketChannels.get(ws);
    if (!channels) {
      channels = new Set();
      this.socketChannels.set(ws, channels);
    }
    channels.add(channelId);
  }

  /** Remove a WebSocket from a channel room */
  leaveRoom(ws: WebSocket, channelId: string): void {
    this.channelRooms.get(channelId)?.delete(ws);
    this.socketChannels.get(ws)?.delete(channelId);
  }

  /** Register a new socket connection */
  registerSocket(ws: WebSocket, user: WsUser): void {
    this.socketUsers.set(ws, user);
    this.socketChannels.set(ws, new Set());
    this.socketBuckets.set(ws, new TokenBucket());
  }

  /** Check rate limit for a socket. Returns true if allowed, false if rate limited. */
  checkRateLimit(ws: WebSocket): boolean {
    const bucket = this.socketBuckets.get(ws);
    if (bucket && !bucket.consume()) return false;
    return true;
  }

  /** Get typing users set for a channel, creating if needed */
  getOrCreateTypingUsers(channelId: string): Set<string> {
    let typing = this.typingUsers.get(channelId);
    if (!typing) {
      typing = new Set();
      this.typingUsers.set(channelId, typing);
    }
    return typing;
  }

  /** Get typing users set for a channel (may be undefined) */
  getTypingUsers(channelId: string): Set<string> | undefined {
    return this.typingUsers.get(channelId);
  }

  /** Clear a typing timeout and optionally delete the key */
  clearTypingTimeout(timeoutKey: string): void {
    const existing = this.typingTimeouts.get(timeoutKey);
    if (existing) {
      clearTimeout(existing);
      this.typingTimeouts.delete(timeoutKey);
    }
  }

  /** Set a typing timeout */
  setTypingTimeout(timeoutKey: string, timeout: NodeJS.Timeout): void {
    this.typingTimeouts.set(timeoutKey, timeout);
  }

  /** Get or create online users set for a channel */
  getOrCreateOnlineUsers(channelId: string): Set<string> {
    let online = this.onlineUsers.get(channelId);
    if (!online) {
      online = new Set();
      this.onlineUsers.set(channelId, online);
    }
    return online;
  }

  /** Get online users set for a channel (may be undefined) */
  getOnlineUsers(channelId: string): Set<string> | undefined {
    return this.onlineUsers.get(channelId);
  }

  /** Clean up an empty online users set */
  cleanupOnlineUsers(channelId: string): void {
    const online = this.onlineUsers.get(channelId);
    if (online && online.size === 0) {
      this.onlineUsers.delete(channelId);
    }
  }

  /** Handle WebSocket disconnection — clean up all state for this socket */
  handleDisconnect(ws: WebSocket, user: WsUser): void {
    try {
      this.logger.info(
        { userId: user.id, username: user.username },
        'WebSocket user disconnected',
      );

      // Get all channels this socket was in
      const channels = this.socketChannels.get(ws);
      if (channels) {
        // Remove user from typing and online tracking for each channel
        channels.forEach((channelId) => {
          // Remove socket from channel room
          this.channelRooms.get(channelId)?.delete(ws);
          if (this.channelRooms.get(channelId)?.size === 0) {
            this.channelRooms.delete(channelId);
          }

          // Remove from typing
          const typing = this.typingUsers.get(channelId);
          if (typing) {
            typing.delete(user.username);

            // Clear typing timeout
            const timeoutKey = `${channelId}:${user.username}`;
            const timeout = this.typingTimeouts.get(timeoutKey);
            if (timeout) {
              clearTimeout(timeout);
              this.typingTimeouts.delete(timeoutKey);
            }

            // Emit updated typing state
            const typingMessage: ServerMessage = {
              type: 'typing:update',
              payload: {
                channelId,
                users: Array.from(typing),
              },
            };
            this.broadcastToRoom(channelId, typingMessage);

            // Clean up empty typing sets
            if (typing.size === 0) {
              this.typingUsers.delete(channelId);
            }
          }

          // Remove from online users
          const online = this.onlineUsers.get(channelId);
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
            this.broadcastToRoom(channelId, presenceMessage);

            // Clean up empty online sets
            if (online.size === 0) {
              this.onlineUsers.delete(channelId);
            }
          }
        });

        // Clean up socket channels tracking
        this.socketChannels.delete(ws);
      }
    } catch (err) {
      this.logger.error({ err }, 'Error in disconnect handler');
    } finally {
      // Clean up user tracking
      this.socketUsers.delete(ws);
      this.socketChannels.delete(ws);
      this.socketBuckets.delete(ws);
    }
  }
}

// Module-level singleton — initialized lazily on first WebSocket connection
let connectionManager: ConnectionManager | undefined;

// --- C1/C2: Channel membership verification helper ---

type MembershipResult =
  | { ok: true; groupId: string }
  | { ok: false; code: string; message: string };

async function verifyChannelMembership(
  supabase: SupabaseClient<Database>,
  channelId: string,
  userId: string,
): Promise<MembershipResult> {
  const { data: channel } = await supabase
    .from('channels')
    .select('group_id')
    .eq('id', channelId)
    .single();

  if (!channel) {
    return {
      ok: false,
      code: 'CHANNEL_NOT_FOUND',
      message: 'Channel not found',
    };
  }

  const { data: membership } = await supabase
    .from('group_members')
    .select('user_id')
    .eq('group_id', channel.group_id)
    .eq('user_id', userId)
    .single();

  if (!membership) {
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: 'Not a member of this group',
    };
  }

  return { ok: true, groupId: channel.group_id };
}

/**
 * Handle incoming WebSocket messages
 */
async function handleMessage(
  ws: WebSocket,
  data: string,
  user: WsUser,
  supabase: SupabaseClient<Database>,
  logger: FastifyBaseLogger,
  pushSender?: PushSender,
): Promise<void> {
  const mgr = getManager();
  try {
    // M4: Rate limiting
    if (!mgr.checkRateLimit(ws)) {
      ws.send(
        JSON.stringify({
          type: 'error',
          payload: {
            code: 'RATE_LIMITED',
            message: 'Too many messages, slow down',
          },
        }),
      );
      return;
    }

    // M3: Validate incoming message
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      ws.send(
        JSON.stringify({
          type: 'error',
          payload: {
            code: 'INVALID_MESSAGE',
            message: 'Invalid message format',
          },
        }),
      );
      return;
    }

    if (!isValidClientMessage(parsed)) {
      ws.send(
        JSON.stringify({
          type: 'error',
          payload: {
            code: 'INVALID_MESSAGE',
            message: 'Invalid message format',
          },
        }),
      );
      return;
    }

    const clientMessage = parsed;

    switch (clientMessage.type) {
      case 'message:send':
        await handleMessageSend(
          ws,
          clientMessage.payload,
          user,
          supabase,
          logger,
          pushSender,
        );
        break;

      case 'typing:start':
        handleTypingStart(ws, clientMessage.payload, user, logger);
        break;

      case 'typing:stop':
        handleTypingStop(ws, clientMessage.payload, user, logger);
        break;

      case 'channel:join':
        await handleChannelJoin(
          ws,
          clientMessage.payload,
          user,
          supabase,
          logger,
        );
        break;

      case 'channel:leave':
        handleChannelLeave(ws, clientMessage.payload, user, logger);
        break;

      case 'reaction:toggle': {
        await handleReactionToggle(
          supabase,
          clientMessage.payload,
          user.id,
          logger,
        );
        break;
      }

      default:
        logger.error({ msg: clientMessage }, 'Unknown message type');
    }
  } catch (err) {
    logger.error({ err }, 'Error handling message');
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
  logger: FastifyBaseLogger,
  pushSender?: PushSender,
): Promise<void> {
  try {
    const {
      channelId,
      content,
      type: payloadType,
      gif_url,
      image_url,
      image_width,
      image_height,
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
      logger.error('Invalid channelId in message:send');
      return;
    }

    // C2: Verify sender is a member of the channel's group
    const membershipResult = await verifyChannelMembership(
      supabase,
      channelId,
      user.id,
    );
    if (!membershipResult.ok) {
      ws.send(
        JSON.stringify({
          type: 'error',
          payload: {
            code: membershipResult.code,
            message: membershipResult.message,
          },
        }),
      );
      return;
    }

    if (messageType === 'giphy') {
      // Giphy messages require a valid gif_url from giphy.com
      if (!gif_url || typeof gif_url !== 'string') {
        logger.error('Giphy message missing gif_url');
        return;
      }
      if (!gif_url.startsWith('https://')) {
        logger.error('gif_url must start with https://');
        return;
      }
      try {
        const parsedUrl = new URL(gif_url);
        if (
          parsedUrl.hostname !== 'giphy.com' &&
          !parsedUrl.hostname.endsWith('.giphy.com')
        ) {
          logger.error('gif_url must be from giphy.com domain');
          ws.send(
            JSON.stringify({
              type: 'error',
              payload: { message: 'gif_url must be from giphy.com domain' },
            }),
          );
          return;
        }
      } catch {
        logger.error('gif_url is not a valid URL');
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
        logger.error('Image message missing image_url');
        return;
      }
      if (!image_url.startsWith('https://')) {
        logger.error('image_url must start with https://');
        return;
      }
      const allowedPrefix = `${process.env.SUPABASE_URL}/storage/v1/object/public/chat-images/`;
      if (!image_url.startsWith(allowedPrefix)) {
        logger.error('image_url must be from Supabase chat-images bucket');
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
        logger.error('Invalid content in message:send');
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
        image_width:
          (messageType === 'image' || messageType === 'giphy') && image_width
            ? image_width
            : null,
        image_height:
          (messageType === 'image' || messageType === 'giphy') && image_height
            ? image_height
            : null,
      })
      .select('*')
      .single();

    if (error) {
      logger.error({ err: error, channelId }, 'Database error in message:send');
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
          image_width:
            messageType === 'image' || messageType === 'giphy'
              ? (image_width ?? undefined)
              : undefined,
          image_height:
            messageType === 'image' || messageType === 'giphy'
              ? (image_height ?? undefined)
              : undefined,
          seq: message.seq,
          created_at: message.created_at,
          updated_at: message.updated_at,
          reactions: [],
        },
      },
    };
    getManager().broadcastToRoom(channelId, serverMessage);

    logger.info(
      { channelId, username: user.username },
      'Message sent to channel',
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
        logger,
      ).catch((err) => {
        logger.error(
          { err, channelId },
          'Push notification error in message:send',
        );
      });
    }
  } catch (err) {
    logger.error({ err }, 'Error in message:send');
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
  logger: FastifyBaseLogger,
): Promise<void> {
  try {
    // Get the channel's group_id
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('group_id, name')
      .eq('id', channelId)
      .single();

    if (channelError || !channel) {
      logger.error(
        { err: channelError, channelId },
        'Failed to fetch channel for push',
      );
      return;
    }

    // Get all members of the group
    const { data: members, error: membersError } = await supabase
      .from('group_members')
      .select('user_id')
      .eq('group_id', channel.group_id);

    if (membersError || !members) {
      logger.error(
        { err: membersError, groupId: channel.group_id },
        'Failed to fetch group members for push',
      );
      return;
    }

    // Get currently online user IDs
    const onlineUserIds = getManager().getOnlineUserIds();

    // Filter to offline users (not online, not the sender)
    const offlineUserIds = members
      .map((m) => m.user_id)
      .filter((userId) => userId !== sender.id && !onlineUserIds.has(userId));

    if (offlineUserIds.length === 0) {
      logger.debug({ channelId }, 'No offline users to notify');
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
    const pushPromises = offlineUserIds.map(async (userId) => {
      const payload: PushNotificationPayload = {
        title: `${senderUsername} in ${channel.name}`,
        body: truncatedContent,
        channelId,
        groupId: channel.group_id,
        senderUsername,
      };

      await pushSender(userId, payload);
    });

    const results = await Promise.allSettled(pushPromises);
    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    logger.info(
      { channelId, attempted: offlineUserIds.length, delivered: successCount },
      'Push notifications sent',
    );
  } catch (err) {
    logger.error({ err, channelId }, 'Error sending push notifications');
  }
}

/**
 * Handle typing:start event
 */
function handleTypingStart(
  ws: WebSocket,
  payload: TypingPayload,
  user: WsUser,
  logger: FastifyBaseLogger,
): void {
  try {
    const { channelId } = payload;

    if (!channelId || typeof channelId !== 'string') {
      logger.error('Invalid channelId in typing:start');
      return;
    }

    const mgr = getManager();

    // Get or create typing users set for this channel
    const typing = mgr.getOrCreateTypingUsers(channelId);
    typing.add(user.username);

    // Clear any existing timeout for this user in this channel
    const timeoutKey = `${channelId}:${user.username}`;
    mgr.clearTypingTimeout(timeoutKey);

    // Set auto-clear timeout (5 seconds)
    const timeout = setTimeout(() => {
      typing.delete(user.username);
      mgr.clearTypingTimeout(timeoutKey);

      // Emit updated typing state (exclude sender)
      const serverMessage: ServerMessage = {
        type: 'typing:update',
        payload: {
          channelId,
          users: Array.from(typing),
        },
      };
      mgr.broadcastToRoom(channelId, serverMessage, ws);
    }, 5000);

    mgr.setTypingTimeout(timeoutKey, timeout);

    // Emit to others in the channel (exclude sender)
    const serverMessage: ServerMessage = {
      type: 'typing:update',
      payload: {
        channelId,
        users: Array.from(typing),
      },
    };
    mgr.broadcastToRoom(channelId, serverMessage, ws);

    logger.debug({ username: user.username, channelId }, 'User started typing');
  } catch (err) {
    logger.error({ err }, 'Error in typing:start');
  }
}

/**
 * Handle typing:stop event
 */
function handleTypingStop(
  ws: WebSocket,
  payload: TypingPayload,
  user: WsUser,
  logger: FastifyBaseLogger,
): void {
  try {
    const { channelId } = payload;

    if (!channelId || typeof channelId !== 'string') {
      logger.error('Invalid channelId in typing:stop');
      return;
    }

    const mgr = getManager();
    const typing = mgr.getTypingUsers(channelId);
    if (typing) {
      typing.delete(user.username);

      // Clear timeout
      const timeoutKey = `${channelId}:${user.username}`;
      mgr.clearTypingTimeout(timeoutKey);

      // Emit to others in the channel (exclude sender)
      const serverMessage: ServerMessage = {
        type: 'typing:update',
        payload: {
          channelId,
          users: Array.from(typing),
        },
      };
      mgr.broadcastToRoom(channelId, serverMessage, ws);

      logger.debug(
        { username: user.username, channelId },
        'User stopped typing',
      );
    }
  } catch (err) {
    logger.error({ err }, 'Error in typing:stop');
  }
}

/**
 * Handle channel:join event
 */
async function handleChannelJoin(
  ws: WebSocket,
  payload: ChannelPayload,
  user: WsUser,
  supabase: SupabaseClient<Database>,
  logger: FastifyBaseLogger,
): Promise<void> {
  try {
    const { channelId } = payload;

    if (!channelId || typeof channelId !== 'string') {
      logger.error('Invalid channelId in channel:join');
      return;
    }

    // C1: Verify user is a member of the channel's group
    const membershipResult = await verifyChannelMembership(
      supabase,
      channelId,
      user.id,
    );
    if (!membershipResult.ok) {
      ws.send(
        JSON.stringify({
          type: 'error',
          payload: {
            code: membershipResult.code,
            message: membershipResult.message,
          },
        }),
      );
      return;
    }

    const mgr = getManager();

    // Join the room
    mgr.joinRoom(ws, channelId);

    // Add user to online users for this channel
    const online = mgr.getOrCreateOnlineUsers(channelId);
    online.add(user.id);

    // Emit presence update to all users in the channel
    const presenceMessage: ServerMessage = {
      type: 'presence:update',
      payload: {
        channelId,
        users: Array.from(online),
      },
    };
    mgr.broadcastToRoom(channelId, presenceMessage);

    logger.info(
      { username: user.username, channelId, onlineCount: online.size },
      'User joined channel',
    );
  } catch (err) {
    logger.error({ err }, 'Error in channel:join');
  }
}

/**
 * Handle channel:leave event
 */
function handleChannelLeave(
  ws: WebSocket,
  payload: ChannelPayload,
  user: WsUser,
  logger: FastifyBaseLogger,
): void {
  try {
    const { channelId } = payload;

    if (!channelId || typeof channelId !== 'string') {
      logger.error('Invalid channelId in channel:leave');
      return;
    }

    const mgr = getManager();

    // Leave the room
    mgr.leaveRoom(ws, channelId);

    // Remove user from online users for this channel
    const online = mgr.getOnlineUsers(channelId);
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
      mgr.broadcastToRoom(channelId, presenceMessage);

      // Clean up empty sets
      mgr.cleanupOnlineUsers(channelId);
    }

    logger.info({ username: user.username, channelId }, 'User left channel');
  } catch (err) {
    logger.error({ err }, 'Error in channel:leave');
  }
}

/**
 * Handle reaction:toggle WebSocket message
 */
async function handleReactionToggle(
  supabase: SupabaseClient<Database>,
  payload: ReactionTogglePayload,
  userId: string,
  logger: FastifyBaseLogger,
): Promise<void> {
  try {
    const { messageId, emoji } = payload;

    if (!messageId || typeof messageId !== 'string') {
      logger.error('Invalid messageId in reaction:toggle');
      return;
    }

    if (!emoji || typeof emoji !== 'string') {
      logger.error('Invalid emoji in reaction:toggle');
      return;
    }

    // Authorization: verify the requesting user is a member of the group that owns the channel
    const { data: msg } = await supabase
      .from('messages')
      .select('channel_id')
      .eq('id', messageId)
      .single();

    if (!msg || !msg.channel_id) {
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
      logger.error({ err: fetchError, messageId }, 'Failed to fetch reactions');
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
    getManager().broadcastToRoom(channelId, serverMessage);

    logger.info({ messageId, emoji, userId }, 'Reaction toggled');
  } catch (err) {
    logger.error({ err }, 'Error in reaction:toggle');
  }
}

/**
 * Helper to get the ConnectionManager singleton, throwing if not yet initialized.
 */
function getManager(): ConnectionManager {
  if (!connectionManager) {
    throw new Error(
      'ConnectionManager not initialized — handleWebSocketConnection must be called first',
    );
  }
  return connectionManager;
}

/**
 * Get all currently connected WebSocket instances (backward-compatible export for socket.ts)
 */
export function getConnectedSockets(): WebSocket[] {
  if (!connectionManager) return [];
  return connectionManager.getConnectedSockets();
}

/**
 * Main handler for WebSocket connections
 */
export function handleWebSocketConnection(
  socket: WebSocket,
  user: WsUser,
  supabase: SupabaseClient<Database>,
  logger: FastifyBaseLogger,
  pushSender?: PushSender,
): void {
  // Lazily initialize the singleton ConnectionManager
  if (!connectionManager) {
    connectionManager = new ConnectionManager(logger);
  }

  const mgr = connectionManager;

  logger.info(
    { userId: user.id, username: user.username },
    'WebSocket user connected',
  );

  // Register this socket
  mgr.registerSocket(socket, user);

  // Handle incoming messages
  socket.on('message', (data: Buffer) => {
    handleMessage(socket, data.toString(), user, supabase, logger, pushSender);
  });

  // Handle disconnection
  socket.on('close', () => {
    mgr.handleDisconnect(socket, user);
  });

  // Handle errors
  socket.on('error', (err) => {
    logger.error({ err, username: user.username }, 'WebSocket error');
  });
}
