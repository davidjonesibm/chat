export interface Message {
  id: string;
  content: string;
  channel: string; // channel ID
  sender: string; // user ID
  type: 'text' | 'system';
  created: string;
  updated: string;
}

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
  created: string;
  updated: string;
}
