<script setup lang="ts">
import { computed } from 'vue';
import type { MessageWithSender } from '@chat/shared';
import UserAvatar from '../ui/UserAvatar.vue';

interface Props {
  message: MessageWithSender;
  isOwn: boolean;
}

const props = defineProps<Props>();

const formattedTime = computed(() => {
  return new Date(props.message.created_at).toLocaleTimeString();
});
</script>

<template>
  <!-- System message: centered divider style -->
  <template v-if="message.type === 'system'">
    <div role="separator" class="divider text-xs text-base-content/50">
      <span class="italic">{{ message.content }}</span>
    </div>
  </template>

  <!-- Regular message: chat bubble -->
  <template v-else>
    <article
      :aria-label="`Message from ${message.sender.username} at ${formattedTime}`"
      class="chat"
      :class="isOwn ? 'chat-end' : 'chat-start'"
    >
      <div class="chat-image avatar">
        <UserAvatar
          :username="message.sender.username"
          :avatar-url="message.sender.avatar"
          size="sm"
        />
      </div>
      <div class="chat-header">
        {{ message.sender.username }}
        <time class="text-xs opacity-50">{{ formattedTime }}</time>
      </div>
      <div class="chat-bubble" :class="isOwn ? 'chat-bubble-primary' : ''">
        {{ message.content }}
      </div>
    </article>
  </template>
</template>
