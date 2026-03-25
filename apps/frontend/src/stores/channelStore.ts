import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import type {
  Group,
  Channel,
  MessageWithSender,
  CursorPaginatedMessages,
} from '@chat/shared';
import { useChatStore } from './chatStore';
import { useAuthStore } from './authStore';

const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const useChannelStore = defineStore('channel', () => {
  // State
  const groups = ref<Group[]>([]);
  const channels = ref<Channel[]>([]);
  const currentGroupId = ref<string | null>(null);
  const currentChannelId = ref<string | null>(null);
  const loading = ref(false);
  const memberProfiles = ref<
    Record<
      string,
      {
        id: string;
        username: string;
        name: string | null;
        avatar: string | null;
      }
    >
  >({});

  // Getters
  const currentGroup = computed(
    () => groups.value.find((g) => g.id === currentGroupId.value) || null,
  );
  const currentChannel = computed(
    () => channels.value.find((c) => c.id === currentChannelId.value) || null,
  );
  const defaultChannel = computed(
    () => channels.value.find((c) => c.is_default) || null,
  );

  // Helper for API calls
  const getHeaders = () => {
    const authStore = useAuthStore();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authStore.token}`,
    };
  };

  // Actions
  async function fetchMyGroups(): Promise<void> {
    loading.value = true;
    try {
      const response = await fetch(`${baseUrl}/api/groups`, {
        headers: getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch groups: ${response.statusText}`);
      }

      const data = await response.json();
      groups.value = data;
    } catch (err) {
      console.error('[ChannelStore] Failed to fetch groups:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function createGroup(
    name: string,
    description?: string,
  ): Promise<Group> {
    loading.value = true;
    try {
      const response = await fetch(`${baseUrl}/api/groups`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ name, description }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create group: ${response.statusText}`);
      }

      const data = await response.json();
      const newGroup = data.group;

      groups.value.push(newGroup);

      // Auto-select the new group
      await selectGroup(newGroup.id);

      return newGroup;
    } catch (err) {
      console.error('[ChannelStore] Failed to create group:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchChannels(groupId: string): Promise<void> {
    loading.value = true;
    try {
      const response = await fetch(
        `${baseUrl}/api/channels?groupId=${groupId}`,
        {
          headers: getHeaders(),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch channels: ${response.statusText}`);
      }

      const data = await response.json();
      channels.value = data;
    } catch (err) {
      console.error('[ChannelStore] Failed to fetch channels:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function createChannel(
    name: string,
    groupId: string,
    description?: string,
  ): Promise<Channel> {
    loading.value = true;
    try {
      const response = await fetch(`${baseUrl}/api/channels`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ name, groupId, description }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create channel: ${response.statusText}`);
      }

      const newChannel = await response.json();
      channels.value.push(newChannel);

      return newChannel;
    } catch (err) {
      console.error('[ChannelStore] Failed to create channel:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function selectGroup(groupId: string): Promise<void> {
    currentGroupId.value = groupId;

    // Fetch channels for this group
    await fetchChannels(groupId);

    // Fetch member profiles for this group
    await fetchGroupMembers(groupId);

    // Auto-select default channel or first channel
    const channelToSelect = defaultChannel.value || channels.value[0];
    if (channelToSelect) {
      await selectChannel(channelToSelect.id);
    }
  }

  async function selectChannel(channelId: string): Promise<void> {
    const chatStore = useChatStore();

    // Update current channel ID
    currentChannelId.value = channelId;

    // Update chat store
    chatStore.setCurrentChannel(channelId);

    // Fetch message history from backend
    await fetchMessages(channelId);
  }

  async function fetchMessages(channelId: string): Promise<void> {
    const chatStore = useChatStore();

    // Reset pagination state before fetching
    chatStore.resetPagination();

    loading.value = true;
    try {
      const response = await fetch(
        `${baseUrl}/api/channels/${channelId}/messages?limit=50`,
        {
          headers: getHeaders(),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.statusText}`);
      }

      const data: CursorPaginatedMessages = await response.json();
      const messages: MessageWithSender[] = data.items || [];

      chatStore.setMessages(messages);
      chatStore.nextCursor = data.nextCursor || null;
      chatStore.hasMore = data.hasMore;
    } catch (err) {
      console.error('[ChannelStore] Failed to fetch messages:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function fetchOlderMessages(channelId: string): Promise<void> {
    const chatStore = useChatStore();

    // Guard: if no more messages or already loading, return early
    if (!chatStore.hasMore || chatStore.loadingMore) {
      return;
    }

    chatStore.loadingMore = true;
    try {
      let url = `${baseUrl}/api/channels/${channelId}/messages?limit=50`;
      if (chatStore.nextCursor) {
        url += `&cursor=${encodeURIComponent(chatStore.nextCursor)}`;
      }
      const response = await fetch(url, {
        headers: getHeaders(),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch older messages: ${response.statusText}`,
        );
      }

      const data: CursorPaginatedMessages = await response.json();
      const messages: MessageWithSender[] = data.items || [];

      chatStore.prependMessages(messages);
      chatStore.nextCursor = data.nextCursor || null;
      chatStore.hasMore = data.hasMore;
    } catch (err) {
      console.error('[ChannelStore] Failed to fetch older messages:', err);
      throw err;
    } finally {
      chatStore.loadingMore = false;
    }
  }

  async function fetchGroupMembers(groupId: string): Promise<void> {
    try {
      const response = await fetch(`${baseUrl}/api/groups/${groupId}/members`, {
        headers: getHeaders(),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch group members: ${response.statusText}`,
        );
      }

      const members = await response.json();

      // Populate memberProfiles as a lookup by user ID
      const profilesLookup: Record<
        string,
        {
          id: string;
          username: string;
          name: string | null;
          avatar: string | null;
        }
      > = {};
      for (const member of members) {
        profilesLookup[member.id] = {
          id: member.id,
          username: member.username,
          name: member.name || null,
          avatar: member.avatar || null,
        };
      }

      memberProfiles.value = profilesLookup;
    } catch (err) {
      console.error('[ChannelStore] Failed to fetch group members:', err);
      throw err;
    }
  }

  async function addMember(groupId: string, userId: string): Promise<void> {
    loading.value = true;
    try {
      const response = await fetch(`${baseUrl}/api/groups/${groupId}/members`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to add member: ${response.statusText}`);
      }

      // Update local group record
      const updatedGroup = await response.json();
      const index = groups.value.findIndex((g) => g.id === groupId);
      if (index !== -1) {
        groups.value[index] = updatedGroup;
      }
    } catch (err) {
      console.error('[ChannelStore] Failed to add member:', err);
      throw err;
    } finally {
      loading.value = false;
    }
  }

  return {
    // State
    groups,
    channels,
    currentGroupId,
    currentChannelId,
    loading,
    memberProfiles,
    // Getters
    currentGroup,
    currentChannel,
    defaultChannel,
    // Actions
    fetchMyGroups,
    createGroup,
    fetchChannels,
    createChannel,
    selectGroup,
    selectChannel,
    fetchMessages,
    fetchOlderMessages,
    fetchGroupMembers,
    addMember,
  };
});
