import type { BaseRecord } from './base';

/**
 * Group record from groups table
 */
export interface GroupRecord extends BaseRecord {
  name: string;
  description: string;
  owner: string;
  members?: string[];
}

export type Group = Pick<
  GroupRecord,
  | 'id'
  | 'name'
  | 'description'
  | 'owner'
  | 'members'
  | 'created_at'
  | 'updated_at'
>;

/**
 * Channel record from channels table
 */
export interface ChannelRecord extends BaseRecord {
  name: string;
  group: string;
  description: string;
  is_default: boolean;
}

export type Channel = Pick<
  ChannelRecord,
  | 'id'
  | 'name'
  | 'group'
  | 'description'
  | 'is_default'
  | 'created_at'
  | 'updated_at'
>;

// API request/response contracts
export interface CreateGroupRequest {
  name: string;
  description?: string;
}

export interface CreateGroupResponse {
  group: Group;
  defaultChannel: Channel;
}

export interface CreateChannelRequest {
  name: string;
  groupId: string;
  description?: string;
}

export interface AddMemberRequest {
  userId: string;
}

// --- Group Invites ---
export interface GroupInviteRecord extends BaseRecord {
  token: string;
  group_id: string;
  created_by: string;
  expires_at: string;
  max_uses: number | null;
  use_count: number;
}

export type GroupInvite = Pick<
  GroupInviteRecord,
  | 'id'
  | 'token'
  | 'group_id'
  | 'created_by'
  | 'expires_at'
  | 'max_uses'
  | 'use_count'
  | 'created_at'
  | 'updated_at'
>;

export interface CreateInviteRequest {
  groupId: string;
  expiresInHours?: number;
  maxUses?: number | null;
}

export interface CreateInviteResponse {
  invite: GroupInvite;
}

export interface InviteInfoResponse {
  groupId: string;
  groupName: string;
  groupDescription: string;
  memberCount: number;
  inviterName: string;
  expiresAt: string;
  alreadyMember: boolean;
}

export interface JoinViaInviteResponse {
  group: Group;
  defaultChannel: Channel;
}
