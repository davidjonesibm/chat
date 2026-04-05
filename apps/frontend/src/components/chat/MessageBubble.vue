<script setup lang="ts">
import { computed, ref } from 'vue';
import type { MessageWithSender } from '@chat/shared';
import UserAvatar from '../ui/UserAvatar.vue';
import 'emoji-picker-element';

interface Props {
  message: MessageWithSender;
  isOwn: boolean;
  currentUserId: string;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  react: [messageId: string, emoji: string];
}>();

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];
const pickerOpen = ref(false);

function onEmojiClick(event: Event) {
  const detail = (event as CustomEvent<{ unicode: string }>).detail;
  if (detail?.unicode) pickEmoji(detail.unicode);
}

const formattedTime = computed(() => {
  return new Date(props.message.created_at).toLocaleTimeString();
});

const visibleReactions = computed(
  () => props.message.reactions?.filter((r) => r.count > 0) || [],
);

function openPicker() {
  pickerOpen.value = true;
  setTimeout(() => {
    window.addEventListener('click', closePicker, { once: true });
  }, 0);
}

function closePicker() {
  pickerOpen.value = false;
}

function pickEmoji(emoji: string) {
  emit('react', props.message.id, emoji);
  pickerOpen.value = false;
}
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
      class="chat group"
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
      <!-- Giphy message -->
      <div v-if="message.type === 'giphy'" class="chat-bubble max-w-xs p-1">
        <img
          :src="message.gif_url"
          :alt="message.content || 'GIF'"
          loading="lazy"
          referrerpolicy="no-referrer"
          class="rounded-lg w-full"
        />
        <p v-if="message.content" class="text-sm mt-1 px-1">
          {{ message.content }}
        </p>
      </div>

      <!-- Text message -->
      <div
        v-else
        class="chat-bubble"
        :class="isOwn ? 'chat-bubble-primary' : 'chat-bubble-secondary'"
      >
        {{ message.content }}
      </div>

      <!-- Reactions row -->
      <div
        class="chat-footer flex flex-wrap items-center gap-1 mt-1 min-h-[24px]"
      >
        <!-- Reaction badges -->
        <button
          v-for="reaction in visibleReactions"
          :key="reaction.emoji"
          class="badge badge-sm cursor-pointer select-none"
          :class="
            reaction.userIds.includes(currentUserId)
              ? 'badge-primary'
              : 'badge-ghost'
          "
          @click.stop="emit('react', message.id, reaction.emoji)"
        >
          {{ reaction.emoji }} {{ reaction.count }}
        </button>

        <!-- Picker trigger (always visible) -->
        <div class="relative">
          <button
            class="btn btn-xs btn-ghost leading-none px-1"
            aria-label="Add reaction"
            @click.stop="openPicker"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1.5"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path
                stroke-linecap="round"
                d="M8.5 14.5s1 1.5 3.5 1.5 3.5-1.5 3.5-1.5"
              />
              <circle
                cx="9"
                cy="10"
                r="0.75"
                fill="currentColor"
                stroke="none"
              />
              <circle
                cx="15"
                cy="10"
                r="0.75"
                fill="currentColor"
                stroke="none"
              />
            </svg>
          </button>

          <!-- Full emoji picker -->
          <div
            v-if="pickerOpen"
            class="absolute z-20 bottom-full mb-1"
            :class="isOwn ? 'right-0' : 'left-0'"
            @click.stop
          >
            <!-- Quick row -->
            <div class="bg-base-200 rounded-t-box px-1 pt-1 flex gap-0.5">
              <button
                v-for="emoji in QUICK_EMOJIS"
                :key="emoji"
                class="btn btn-xs btn-ghost text-base px-1"
                @click.stop="pickEmoji(emoji)"
              >
                {{ emoji }}
              </button>
            </div>
            <!-- Full picker -->
            <emoji-picker class="rounded-b-box" @emoji-click="onEmojiClick" />
          </div>
        </div>
      </div>
    </article>
  </template>
</template>
