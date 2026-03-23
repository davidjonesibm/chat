<script setup lang="ts">
import { ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useChatStore } from '../../stores/chatStore';
import { useChat } from '../../composables/useChat';

const emit = defineEmits<{
  send: [content: string];
}>();

const chatStore = useChatStore();
const { connected } = storeToRefs(chatStore);
const { startTyping, stopTyping } = useChat();

const messageText = ref('');

function handleSend() {
  const content = messageText.value.trim();
  if (!content || !connected.value) {
    return;
  }

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
        placeholder="Type a message..."
        class="input input-bordered flex-1"
        @input="onTyping"
        @blur="onBlur"
        :disabled="!connected"
      />
      <button
        type="submit"
        class="btn btn-primary"
        :disabled="!messageText.trim() || !connected"
      >
        Send
      </button>
    </form>
  </div>
</template>
