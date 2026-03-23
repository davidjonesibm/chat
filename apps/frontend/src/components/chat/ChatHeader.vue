<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useChatStore } from '../../stores/chatStore';
import { useAuth } from '../../composables/useAuth';

const chatStore = useChatStore();
const { user, logout } = useAuth();
const { onlineUsers, typingUsers } = storeToRefs(chatStore);

const onlineCount = computed(() => onlineUsers.value.length);

const typingText = computed(() => {
  const count = typingUsers.value.length;
  if (count === 0) return '';
  if (count === 1) return `${typingUsers.value[0]} is typing...`;
  if (count === 2)
    return `${typingUsers.value[0]} and ${typingUsers.value[1]} are typing...`;
  return `${count} people are typing...`;
});
</script>

<template>
  <div>
    <header class="navbar bg-base-200 border-b border-base-300">
      <div class="flex-1">
        <span class="text-xl font-bold"># general</span>
        <span class="ml-2 badge badge-soft badge-sm"
          >{{ onlineCount }} online</span
        >
      </div>
      <div class="flex-none gap-2">
        <span class="text-sm">{{ user?.username }}</span>
        <button class="btn btn-ghost btn-sm" @click="logout">Logout</button>
      </div>
    </header>
    <div
      v-if="typingUsers.length > 0"
      class="px-4 py-1 text-sm text-base-content/50 italic bg-base-100"
    >
      {{ typingText }}
    </div>
  </div>
</template>
