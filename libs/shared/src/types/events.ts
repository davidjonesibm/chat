import type { MessageWithSender } from './message';
import type { ReactionTogglePayload, ReactionUpdatedPayload } from './reaction';

// --- Payload types ---

export interface MessageSendPayload {
  channelId: string;
  content: string;
  type?: 'text' | 'giphy' | 'image';
  gif_url?: string;
  image_url?: string;
}

export interface MessageNewPayload {
  message: MessageWithSender;
}

export interface TypingPayload {
  channelId: string;
}

export interface TypingUpdatePayload {
  channelId: string;
  users: string[];
}

export interface ChannelPayload {
  channelId: string;
}

export interface PresenceUpdatePayload {
  channelId: string;
  users: string[];
}

export interface ChannelUpdatedPayload {
  channelId: string;
  name?: string;
  description?: string;
}

// --- Client → Server WebSocket messages (discriminated union) ---

export type ClientMessage =
  | { type: 'message:send'; payload: MessageSendPayload }
  | { type: 'typing:start'; payload: TypingPayload }
  | { type: 'typing:stop'; payload: TypingPayload }
  | { type: 'channel:join'; payload: ChannelPayload }
  | { type: 'channel:leave'; payload: ChannelPayload }
  | { type: 'reaction:toggle'; payload: ReactionTogglePayload };

// --- Server → Client WebSocket messages (discriminated union) ---

export type ServerMessage =
  | { type: 'message:new'; payload: MessageNewPayload }
  | { type: 'typing:update'; payload: TypingUpdatePayload }
  | { type: 'presence:update'; payload: PresenceUpdatePayload }
  | { type: 'channel:updated'; payload: ChannelUpdatedPayload }
  | { type: 'reaction:updated'; payload: ReactionUpdatedPayload }
  | { type: 'error'; payload: { code: string; message: string } };

// --- User data attached to WebSocket connections ---

export interface WsUser {
  id: string;
  email: string;
  username: string;
}
