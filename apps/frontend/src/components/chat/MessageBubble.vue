<script setup lang="ts">
import { computed } from 'vue';
import type { MessageWithSender } from '@chat/shared';

interface Props {
  message: MessageWithSender;
  isOwn: boolean;
}

const props = defineProps<Props>();

const formattedTime = computed(() => {
  return new Date(props.message.created).toLocaleTimeString();
});
</script>

<template>
  <div class="chat" :class="isOwn ? 'chat-end' : 'chat-start'">
    <div class="chat-header">
      {{ message.sender.username }}
      <time class="text-xs opacity-50">{{ formattedTime }}</time>
    </div>
    <div class="chat-bubble" :class="isOwn ? 'chat-bubble-primary' : ''">
      {{ message.content }}
    </div>
  </div>
</template>
