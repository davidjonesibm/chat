import type { BaseRecord, CursorPaginatedResponse } from './base';
import type { ReactionSummary } from './reaction';

/**
 * Message record from messages table
 */
export interface MessageRecord extends BaseRecord {
  content: string;
  channel: string;
  sender: string;
  type: 'text' | 'system' | 'giphy' | 'image';
  gif_url?: string;
  image_url?: string;
}

export type Message = Pick<
  MessageRecord,
  | 'id'
  | 'content'
  | 'channel'
  | 'sender'
  | 'type'
  | 'gif_url'
  | 'image_url'
  | 'created_at'
  | 'updated_at'
>;

/**
 * Message with expanded sender data
 */
export interface MessageWithSender {
  id: string;
  content: string;
  channel: string;
  sender: {
    id: string;
    username: string;
    avatar?: string;
  };
  type: 'text' | 'system' | 'giphy' | 'image';
  gif_url?: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
  reactions?: ReactionSummary[];
}

export interface MessageListResponse {
  messages: MessageWithSender[];
  totalPages: number;
  page: number;
}

export type CursorPaginatedMessages =
  CursorPaginatedResponse<MessageWithSender>;

export interface MessageSearchRequest {
  query: string;
  channelId?: string;
  groupId: string;
  cursor?: string;
  limit?: number;
}

export interface MessageSearchResponse
  extends CursorPaginatedResponse<MessageWithSender> {}
