<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useChatStore } from '../../stores/chatStore';
import { useChat } from '../../composables/useChat';

const emit = defineEmits<{
  send: [content: string];
  'toggle-giphy': [];
}>();

const chatStore = useChatStore();
const { connected, reconnecting } = storeToRefs(chatStore);
const { startTyping, stopTyping } = useChat();

const messageText = ref('');
const isOnline = ref(navigator.onLine);

function handleOnline() {
  isOnline.value = true;
}
function handleOffline() {
  isOnline.value = false;
}

onMounted(() => {
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
});

onUnmounted(() => {
  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);
});

const placeholder = computed(() => {
  if (!isOnline.value) return 'Offline \u2014 messages will be queued';
  if (reconnecting.value && !connected.value) return 'Reconnecting\u2026';
  return 'Type a message...';
});

function handleSend() {
  const content = messageText.value.trim();
  if (!content) return;

  emit('send', content);
  messageText.value = '';
  stopTyping();
}

function onTyping() {
  if (messageText.value.trim()) {
    startTyping();
  }
}

function onBlur() {
  stopTyping();
}
</script>

<template>
  <div class="border-t border-base-300 p-4">
    <form @submit.prevent="handleSend" class="flex gap-2">
      <input
        v-model="messageText"
        type="text"
        :placeholder="placeholder"
        aria-label="Type a message"
        class="input input-bordered flex-1"
        @input="onTyping"
        @blur="onBlur"
      />
      <button
        type="button"
        class="btn btn-ghost btn-sm btn-circle"
        aria-label="Send a GIF"
        @click="emit('toggle-giphy')"
      >
        GIF
      </button>
      <button
        type="submit"
        class="btn btn-primary"
        aria-label="Send message"
        :disabled="!messageText.trim()"
      >
        Send
      </button>
    </form>
  </div>
</template>
