<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue';
import type { MessageWithSender } from '@chat/shared';
import UserAvatar from '../ui/UserAvatar.vue';
import MessageActionSheet from './MessageActionSheet.vue';
import EmojiPickerPopover from './EmojiPickerPopover.vue';
import { useAuthStore } from '../../stores/authStore';
import { useMessageActions } from '../../composables/useMessageActions';
import { toStorageUrl } from '../../lib/supabase';

interface Props {
  message: MessageWithSender;
  isNewSender: boolean;
}

const props = defineProps<Props>();

const authStore = useAuthStore();
const currentUserId = computed(() => authStore.user?.id ?? '');
const {
  isMobile,
  copyMessage,
  shareMessage,
  reply,
  open: openActions,
} = useMessageActions();

const emit = defineEmits<{
  react: [messageId: string, emoji: string];
  'open-actions': [message: MessageWithSender];
}>();

const hovered = ref(false);
const touched = ref(false);
const desktopFullPickerOpen = ref(false);
const inlinePickerOpen = ref(false);
const emojiTriggerRect = ref<DOMRect | null>(null);
const emojiTriggerRef = ref<HTMLElement | null>(null);
const highlighted = computed(
  () => touched.value || (!isMobile.value && hovered.value),
);
let longPressTimer: ReturnType<typeof setTimeout> | null = null;
let touchStartX = 0;
let touchStartY = 0;
const MOVE_THRESHOLD = 10;

onUnmounted(() => {
  if (longPressTimer) clearTimeout(longPressTimer);
});

const formattedTime = computed(() => {
  return new Date(props.message.created_at).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
});

const visibleReactions = computed(
  () => props.message.reactions?.filter((r) => r.count > 0) || [],
);

function onMouseEnter() {
  if (!isMobile.value) hovered.value = true;
}

function onMouseLeave() {
  if (!isMobile.value) {
    hovered.value = false;
    desktopFullPickerOpen.value = false;
  }
}

// Long-press handlers for mobile
function onTouchStart(e: TouchEvent) {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
  const touch = e.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  touched.value = true;
  longPressTimer = setTimeout(() => {
    touched.value = false;
    hovered.value = false;
    emit('open-actions', props.message);
  }, 500);
}

function onTouchMove(e: TouchEvent) {
  if (!longPressTimer) return;
  const touch = e.touches[0];
  const dx = touch.clientX - touchStartX;
  const dy = touch.clientY - touchStartY;
  if (dx * dx + dy * dy > MOVE_THRESHOLD * MOVE_THRESHOLD) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
    touched.value = false;
  }
}

function onTouchEnd() {
  touched.value = false;
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

// Desktop hover toolbar action handlers
function onToolbarReact(emoji: string) {
  emit('react', props.message.id, emoji);
  desktopFullPickerOpen.value = false;
}

function onToolbarCopy() {
  openActions(props.message);
  copyMessage();
}

function onToolbarShare() {
  openActions(props.message);
  shareMessage();
}

function onToolbarReply() {
  openActions(props.message);
  reply();
}

function onEmojiTriggerClick() {
  if (isMobile.value) {
    emit('open-actions', props.message);
  } else {
    if (emojiTriggerRef.value) {
      emojiTriggerRect.value = emojiTriggerRef.value.getBoundingClientRect();
    }
    inlinePickerOpen.value = true;
  }
}

function onInlinePickerSelect(emoji: string) {
  emit('react', props.message.id, emoji);
  inlinePickerOpen.value = false;
}

function onInlinePickerClose() {
  inlinePickerOpen.value = false;
}

function onContextMenu(e: Event) {
  if (isMobile.value) e.preventDefault();
}

watch(isMobile, () => {
  hovered.value = false;
  desktopFullPickerOpen.value = false;
});
</script>

<template>
  <!-- System message: centered divider style -->
  <template v-if="message.type === 'system'">
    <div role="separator" class="divider text-xs text-base-content/50">
      <span class="italic">{{ message.content }}</span>
    </div>
  </template>

  <!-- Regular message: Slack-style -->
  <template v-else>
    <article
      :aria-label="`Message from ${message.sender.username} at ${formattedTime}`"
      class="transition-colors duration-150 rounded-lg select-none"
      :class="{ 'bg-base-200/50': highlighted }"
      @mouseenter="onMouseEnter"
      @mouseleave="onMouseLeave"
      @touchstart.passive="onTouchStart"
      @touchmove.passive="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchEnd"
      @contextmenu="onContextMenu"
    >
      <div class="flex gap-3 px-4 py-0.5">
        <!-- Left column: avatar or spacer -->
        <div class="w-8 flex-shrink-0 flex items-start pt-0.5">
          <UserAvatar
            v-if="isNewSender"
            :username="message.sender.username"
            :avatar-url="message.sender.avatar"
            size="sm"
          />
        </div>

        <!-- Right column: header + content + reactions -->
        <div class="relative flex-1 min-w-0">
          <!-- Desktop hover action bar -->
          <div v-if="hovered && !isMobile" class="absolute -top-3 right-2 z-10">
            <MessageActionSheet
              :message="props.message"
              :show="true"
              :is-mobile="false"
              :show-full-picker="desktopFullPickerOpen"
              @react="onToolbarReact"
              @copy="onToolbarCopy"
              @share="onToolbarShare"
              @reply="onToolbarReply"
              @toggle-full-picker="
                desktopFullPickerOpen = !desktopFullPickerOpen
              "
              @close="hovered = false"
            />
          </div>
          <!-- Header: username + timestamp (new sender only) -->
          <div v-if="isNewSender" class="flex items-baseline mb-0.5">
            <span class="font-semibold text-sm text-base-content">{{
              message.sender.username
            }}</span>
            <time class="text-xs text-base-content/40 ml-2">{{
              formattedTime
            }}</time>
          </div>

          <!-- Giphy message -->
          <div v-if="message.type === 'giphy'">
            <img
              :src="message.gif_url"
              :alt="message.content || 'GIF'"
              loading="lazy"
              referrerpolicy="no-referrer"
              class="rounded-lg max-w-[300px]"
            />
            <p
              v-if="message.content"
              class="text-sm text-base-content leading-relaxed mt-1"
            >
              {{ message.content }}
            </p>
          </div>

          <!-- Image message -->
          <div v-else-if="message.type === 'image'">
            <img
              :src="toStorageUrl(message.image_url)"
              :alt="message.content || 'Shared image'"
              loading="lazy"
              class="rounded-lg max-w-[300px] cursor-pointer"
            />
            <p
              v-if="message.content"
              class="text-sm text-base-content leading-relaxed mt-1"
            >
              {{ message.content }}
            </p>
          </div>

          <!-- Text message -->
          <p v-else class="text-sm text-base-content leading-relaxed">
            {{ message.content }}
          </p>

          <!-- Reactions row -->
          <div
            v-if="visibleReactions.length > 0"
            class="flex flex-wrap items-center gap-1 mt-1"
          >
            <!-- Reaction badges -->
            <button
              v-for="reaction in visibleReactions"
              :key="reaction.emoji"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs cursor-pointer select-none bg-base-200"
              :class="
                reaction.userIds.includes(currentUserId)
                  ? 'border-primary text-primary'
                  : 'border-base-300 text-base-content'
              "
              @click.stop="emit('react', message.id, reaction.emoji)"
            >
              {{ reaction.emoji }} {{ reaction.count }}
            </button>

            <!-- Add reaction button (only when reactions already exist) -->
            <button
              v-if="visibleReactions.length > 0"
              ref="emojiTriggerRef"
              class="btn btn-xs btn-ghost leading-none px-1 text-base"
              aria-label="Add reaction"
              @click.stop="onEmojiTriggerClick"
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
          </div>
        </div>
      </div>

      <EmojiPickerPopover
        :visible="inlinePickerOpen"
        :trigger-rect="emojiTriggerRect"
        @select="onInlinePickerSelect"
        @close="onInlinePickerClose"
      />
    </article>
  </template>
</template>
