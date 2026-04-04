import type {
  BaseRecord,
  CursorPaginatedResponse,
  PaginatedResponse,
} from './base';

/**
 * Message record from messages table
 */
export interface MessageRecord extends BaseRecord {
  content: string;
  channel: string;
  sender: string;
  type: 'text' | 'system';
}

export type Message = Pick<
  MessageRecord,
  'id' | 'content' | 'channel' | 'sender' | 'type' | 'created_at' | 'updated_at'
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
  type: 'text' | 'system';
  created_at: string;
  updated_at: string;
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

export interface MessageSearchResponse extends CursorPaginatedResponse<MessageWithSender> {}
