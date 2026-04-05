import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { MessageWithSender, ReactionSummary } from '@chat/shared';

export const useChatStore = defineStore('chat', () => {
  // State
  const messages = ref<MessageWithSender[]>([]);
  const typingUsers = ref<string[]>([]);
  const onlineUsers = ref<string[]>([]);
  const currentChannelId = ref<string | null>(null);
  const loading = ref(false);
  const connected = ref(false);
  const reconnecting = ref(false);
  const reconnectAttempt = ref(0);

  // Pagination & scroll tracking
  const highlightedMessageId = ref<string | null>(null);
  const hasMore = ref(true);
  const nextCursor = ref<string | null>(null);
  const loadingMore = ref(false);
  const unreadCount = ref(0);

  // Actions
  function addMessage(msg: MessageWithSender) {
    messages.value.push(msg);
  }

  function setMessages(msgs: MessageWithSender[]) {
    messages.value = msgs;
  }

  function prependMessages(msgs: MessageWithSender[]) {
    messages.value = [...msgs, ...messages.value];
  }

  function setTypingUsers(users: string[]) {
    typingUsers.value = users;
  }

  function setOnlineUsers(users: string[]) {
    onlineUsers.value = users;
  }

  function setCurrentChannel(channelId: string) {
    currentChannelId.value = channelId;
  }

  function resetPagination() {
    hasMore.value = true;
    nextCursor.value = null;
    loadingMore.value = false;
    unreadCount.value = 0;
  }

  function updateMessageReactions(
    messageId: string,
    reactions: ReactionSummary[],
  ) {
    const msg = messages.value.find((m) => m.id === messageId);
    if (msg) {
      msg.reactions = reactions;
    }
  }

  function clearChat() {
    messages.value = [];
    typingUsers.value = [];
    onlineUsers.value = [];
    currentChannelId.value = null;
    loading.value = false;
    connected.value = false;
    reconnecting.value = false;
    reconnectAttempt.value = 0;
    resetPagination();
  }

  return {
    // State
    messages,
    typingUsers,
    onlineUsers,
    currentChannelId,
    loading,
    connected,
    reconnecting,
    reconnectAttempt,
    highlightedMessageId,
    hasMore,
    nextCursor,
    loadingMore,
    unreadCount,
    // Actions
    addMessage,
    setMessages,
    prependMessages,
    setTypingUsers,
    setOnlineUsers,
    setCurrentChannel,
    resetPagination,
    updateMessageReactions,
    clearChat,
  };
});
