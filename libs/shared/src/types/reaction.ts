import type { BaseRecord } from './base';

/** Full DB row for a reaction */
export interface ReactionRecord extends BaseRecord {
  message_id: string;
  user_id: string;
  emoji: string;
}

/** Aggregated summary sent to clients */
export interface ReactionSummary {
  emoji: string;
  count: number;
  /** user IDs who reacted with this emoji */
  userIds: string[];
}

/** Payload from client when toggling a reaction */
export interface ReactionTogglePayload {
  messageId: string;
  emoji: string;
}

/** Payload server broadcasts after a reaction change */
export interface ReactionUpdatedPayload {
  messageId: string;
  reactions: ReactionSummary[];
}
