import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { MessageWithSender } from '@chat/shared';

export const useChatStore = defineStore('chat', () => {
  // State
  const messages = ref<MessageWithSender[]>([]);
  const typingUsers = ref<string[]>([]);
  const onlineUsers = ref<string[]>([]);
  const currentChannelId = ref<string | null>(null);
  const loading = ref(false);
  const connected = ref(false);

  // Actions
  function addMessage(msg: MessageWithSender) {
    messages.value.push(msg);
  }

  function setMessages(msgs: MessageWithSender[]) {
    messages.value = msgs;
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

  function clearChat() {
    messages.value = [];
    typingUsers.value = [];
    onlineUsers.value = [];
    currentChannelId.value = null;
    loading.value = false;
    connected.value = false;
  }

  return {
    // State
    messages,
    typingUsers,
    onlineUsers,
    currentChannelId,
    loading,
    connected,
    // Actions
    addMessage,
    setMessages,
    setTypingUsers,
    setOnlineUsers,
    setCurrentChannel,
    clearChat,
  };
});
