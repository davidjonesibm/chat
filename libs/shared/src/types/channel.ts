export interface Group {
  id: string;
  name: string;
  description: string;
  owner: string; // user ID
  members: string[]; // user IDs
  created: string;
  updated: string;
}

export interface Channel {
  id: string;
  name: string;
  group: string; // group ID
  description: string;
  is_default: boolean;
  created: string;
  updated: string;
}
