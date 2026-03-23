<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import { storeToRefs } from 'pinia';
import { useChatStore } from '../../stores/chatStore';
import { useAuthStore } from '../../stores/authStore';
import MessageBubble from './MessageBubble.vue';

const chatStore = useChatStore();
const authStore = useAuthStore();

const { messages, loading } = storeToRefs(chatStore);
const { user } = storeToRefs(authStore);

const messageContainer = ref<HTMLElement | null>(null);
const scrollAnchor = ref<HTMLElement | null>(null);

const currentUserId = ref(user.value?.id);

// Auto-scroll to bottom when new messages arrive
watch(
  messages,
  async () => {
    await nextTick();
    scrollAnchor.value?.scrollIntoView({ behavior: 'smooth' });
  },
  { deep: true },
);
</script>

<template>
  <div class="flex-1 overflow-y-auto p-4 space-y-1" ref="messageContainer">
    <div v-if="loading" class="flex justify-center py-8">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
    <div
      v-else-if="messages.length === 0"
      class="flex justify-center py-8 text-base-content/50"
    >
      No messages yet. Say something!
    </div>
    <template v-else>
      <MessageBubble
        v-for="msg in messages"
        :key="msg.id"
        :message="msg"
        :is-own="msg.sender.id === currentUserId"
      />
    </template>
    <div ref="scrollAnchor"></div>
  </div>
</template>
