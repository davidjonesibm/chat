interface BaseRecord {
  id: string;
  created_at: string;
  updated_at: string;
}

/**
 * Group record from groups table
 */
export interface GroupRecord extends BaseRecord {
  name: string;
  description: string;
  owner: string;
  members?: Array<{ id: string; username: string; name: string; avatar?: string }>;
}

export type Group = Pick<
  GroupRecord,
  'id' | 'name' | 'description' | 'owner' | 'members' | 'created_at' | 'updated_at'
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
  'id' | 'name' | 'group' | 'description' | 'is_default' | 'created_at' | 'updated_at'
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
