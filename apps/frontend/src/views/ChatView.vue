<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useChat } from '../composables/useChat';
import { useAuth } from '../composables/useAuth';
import { useChatStore } from '../stores/chatStore';
import { useAuthStore } from '../stores/authStore';
import ChatHeader from '../components/chat/ChatHeader.vue';
import MessageList from '../components/chat/MessageList.vue';
import MessageInput from '../components/chat/MessageInput.vue';

const { connect, disconnect, sendMessage } = useChat();
const { isAuthenticated } = useAuth();
const chatStore = useChatStore();
const authStore = useAuthStore();

const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000';

onMounted(async () => {
  if (!isAuthenticated.value) return;

  // Set the current channel before connecting so the WS onopen auto-join fires
  const res = await fetch(`${apiBase}/api/channels`, {
    headers: { Authorization: `Bearer ${authStore.token}` },
  });
  if (res.ok) {
    const channels = await res.json();
    if (channels.length > 0) {
      chatStore.setCurrentChannel(channels[0].id);
    }
  }

  connect();
});

onUnmounted(() => {
  disconnect();
});

function handleSend(content: string) {
  sendMessage(content);
}
</script>

<template>
  <div class="h-screen flex flex-col">
    <ChatHeader />
    <MessageList />
    <MessageInput @send="handleSend" />
  </div>
</template>
