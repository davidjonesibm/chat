<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useChatStore } from '../../stores/chatStore';
import { useChannelStore } from '../../stores/channelStore';
import { useAuthStore } from '../../stores/authStore';
import { useChat } from '../../composables/useChat';
import { useMessageActions } from '../../composables/useMessageActions';
import Message from './Message.vue';
import MessageActionSheet from './MessageActionSheet.vue';

const chatStore = useChatStore();
const channelStore = useChannelStore();
const authStore = useAuthStore();
const { toggleReaction } = useChat();
const {
  activeMessage,
  isOpen,
  showFullPicker,
  isMobile,
  open: openActionSheet,
  close: closeActionSheet,
  copyMessage,
  shareMessage,
  reply,
} = useMessageActions();

const {
  messages,
  loading,
  hasMore,
  loadingMore,
  unreadCount,
  typingUsers,
  highlightedMessageId,
} = storeToRefs(chatStore);
const { currentChannelId } = storeToRefs(channelStore);
const { user } = storeToRefs(authStore);

const scrollContainer = ref<HTMLElement | null>(null);
const topSentinel = ref<HTMLElement | null>(null);
const isNearBottom = ref(true);
const isPrepending = ref(false);

// Compute Slack-style sender grouping metadata for each message
function formatDateLabel(date: Date): string {
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1,
  ).toDateString();
  const ds = date.toDateString();
  if (ds === today) return 'Today';
  if (ds === yesterday) return 'Yesterday';
  const sameYear = date.getFullYear() === now.getFullYear();
  const options: Intl.DateTimeFormatOptions = sameYear
    ? { weekday: 'short', month: 'short', day: 'numeric' }
    : { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

const messageMetadata = computed(() => {
  const meta: Record<
    string,
    { isNewSender: boolean; dateLabel: string | null }
  > = {};
  let lastHumanSenderId: string | null = null;
  let lastHumanMessageTime: number | null = null;
  let lastDateString: string | null = null;
  const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

  for (const msg of messages.value) {
    const msgDate = new Date(msg.created_at);
    const msgDateString = msgDate.toDateString();
    const dateLabel =
      msgDateString !== lastDateString ? formatDateLabel(msgDate) : null;
    lastDateString = msgDateString;

    if (msg.type === 'system') {
      meta[msg.id] = { isNewSender: false, dateLabel };
      lastHumanSenderId = null;
      lastHumanMessageTime = null;
      continue;
    }
    const msgTime = msgDate.getTime();
    const senderChanged = lastHumanSenderId !== msg.sender.id;
    const timedOut =
      lastHumanMessageTime !== null &&
      msgTime - lastHumanMessageTime >= TIMEOUT_MS;
    const isNewSender = senderChanged || timedOut;
    meta[msg.id] = { isNewSender, dateLabel };
    lastHumanSenderId = msg.sender.id;
    lastHumanMessageTime = msgTime;
  }

  return meta;
});

const typingText = computed(() => {
  const count = typingUsers.value.length;
  if (count === 0) return '';
  if (count === 1) return `${typingUsers.value[0]} is typing...`;
  if (count === 2)
    return `${typingUsers.value[0]} and ${typingUsers.value[1]} are typing...`;
  return `${count} people are typing...`;
});

let topObserver: IntersectionObserver | null = null;
let previousMessageCount = 0;

// Check if user is near bottom of scroll container
function updateNearBottomStatus() {
  if (!scrollContainer.value) return;

  const { scrollTop, scrollHeight, clientHeight } = scrollContainer.value;
  const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

  const wasNearBottom = isNearBottom.value;
  isNearBottom.value = distanceFromBottom < 150;

  // If user scrolled back to bottom, reset unread count
  if (isNearBottom.value && !wasNearBottom && chatStore.unreadCount > 0) {
    chatStore.unreadCount = 0;
  }
}

// Scroll to bottom (smooth or instant)
function scrollToBottom(smooth = true) {
  if (!scrollContainer.value) return;

  scrollContainer.value.scrollTo({
    top: scrollContainer.value.scrollHeight,
    behavior: smooth ? 'smooth' : 'auto',
  });

  chatStore.unreadCount = 0;
}

// Handle scroll event
function handleScroll() {
  updateNearBottomStatus();
}

// Setup infinite scroll observer
function setupInfiniteScroll() {
  if (!topSentinel.value) return;

  topObserver = new IntersectionObserver(
    async (entries) => {
      const entry = entries[0];

      // When sentinel enters viewport and we have more messages
      if (
        entry.isIntersecting &&
        hasMore.value &&
        !loadingMore.value &&
        currentChannelId.value &&
        messages.value.length > 0
      ) {
        const oldScrollHeight = scrollContainer.value?.scrollHeight || 0;

        // Fetch older messages
        isPrepending.value = true;
        try {
          await channelStore.fetchOlderMessages(currentChannelId.value);
        } catch (err) {
          console.error('[MessageList] Failed to fetch older messages:', err);
        } finally {
          // Preserve scroll position after prepend (always, even on error)
          await nextTick();
          if (scrollContainer.value) {
            const newScrollHeight = scrollContainer.value.scrollHeight;
            scrollContainer.value.scrollTop = newScrollHeight - oldScrollHeight;
          }
          isPrepending.value = false;
        }
      }
    },
    {
      root: scrollContainer.value,
      threshold: 0.1,
    },
  );

  topObserver.observe(topSentinel.value);
}

// Watch for new messages and handle auto-scroll
watch(
  () => messages.value.length,
  async (newCount, oldCount) => {
    // Skip initial load
    if (oldCount === 0 && newCount > 0) {
      previousMessageCount = newCount;
      await nextTick();
      scrollToBottom(false); // Instant scroll on initial load
      return;
    }

    // New messages arrived
    if (newCount > previousMessageCount) {
      previousMessageCount = newCount;

      if (isNearBottom.value) {
        // Auto-scroll if user is at bottom
        await nextTick();
        scrollToBottom(true);
      } else if (!isPrepending.value) {
        // Increment unread count if user is scrolled up (skip historical prepends)
        const newMessagesCount = newCount - oldCount;
        chatStore.unreadCount += newMessagesCount;
      }
    } else {
      // Messages decreased (channel changed or cleared)
      previousMessageCount = newCount;
    }
  },
);

// Watch for highlighted message and scroll to it
watch(highlightedMessageId, async (messageId) => {
  if (!messageId) return;
  await nextTick();
  const el = scrollContainer.value?.querySelector(
    `[data-message-id="${messageId}"]`,
  );
  if (el) {
    (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  chatStore.highlightedMessageId = null;
});

// Watch for channel changes and scroll to bottom
watch(currentChannelId, async () => {
  if (currentChannelId.value) {
    previousMessageCount = 0;
    chatStore.unreadCount = 0;
    isNearBottom.value = true;

    await nextTick();
    scrollToBottom(false);
  }
});

// Setup on mount
onMounted(() => {
  setupInfiniteScroll();
  previousMessageCount = messages.value.length;

  // Scroll to bottom on initial mount
  nextTick(() => {
    scrollToBottom(false);
  });
});

// Close mobile sheet on breakpoint change
watch(isMobile, () => {
  closeActionSheet();
});

// Cleanup on unmount
onUnmounted(() => {
  if (topObserver) {
    topObserver.disconnect();
    topObserver = null;
  }
});
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0">
    <div class="relative flex-1 flex flex-col min-h-0 bg-base-100">
      <!-- Scroll container -->
      <div
        role="log"
        aria-live="polite"
        aria-label="Message history"
        class="flex-1 overflow-y-auto py-2 space-y-1"
        ref="scrollContainer"
        @scroll="handleScroll"
      >
        <!-- Top sentinel for infinite scroll -->
        <div ref="topSentinel" class="h-1"></div>

        <!-- Loading spinner at top during infinite scroll -->
        <div v-if="loadingMore" class="flex justify-center py-2">
          <span class="loading loading-spinner loading-sm"></span>
        </div>

        <!-- Initial loading state -->
        <div v-if="loading" class="flex justify-center py-8">
          <span class="loading loading-spinner loading-lg"></span>
        </div>

        <!-- Empty state -->
        <div
          v-else-if="messages.length === 0"
          class="flex justify-center py-8 text-base-content/50"
        >
          No messages yet. Say something!
        </div>

        <!-- Messages -->
        <template v-else>
          <div v-for="msg in messages" :key="msg.id" :data-message-id="msg.id">
            <div
              v-if="messageMetadata[msg.id]?.dateLabel"
              class="divider text-xs text-base-content/50 mx-4"
            >
              <span class="badge badge-sm badge-ghost font-normal">{{
                messageMetadata[msg.id].dateLabel
              }}</span>
            </div>
            <Message
              :message="msg"
              :is-new-sender="messageMetadata[msg.id]?.isNewSender ?? true"
              @react="toggleReaction"
              @open-actions="openActionSheet"
            />
          </div>
        </template>
      </div>

      <!-- "N new messages" banner -->
      <div
        v-if="unreadCount > 0"
        class="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10"
      >
        <button
          class="btn btn-sm btn-primary shadow-lg"
          :aria-label="`${unreadCount} new ${unreadCount === 1 ? 'message' : 'messages'}, click to scroll down`"
          @click="scrollToBottom(true)"
        >
          ↓ {{ unreadCount }} new
          {{ unreadCount === 1 ? 'message' : 'messages' }}
        </button>
      </div>
    </div>

    <!-- Typing indicator -->
    <div
      v-if="typingUsers.length > 0"
      role="status"
      aria-live="polite"
      class="px-4 py-1 text-sm text-base-content/50 italic bg-base-100"
    >
      {{ typingText }}
      <span class="typing-dots ml-1">
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </span>
    </div>

    <!-- Mobile action sheet (one instance for all messages) -->
    <MessageActionSheet
      :message="activeMessage"
      :show="isOpen && isMobile"
      :is-mobile="true"
      :show-full-picker="showFullPicker"
      @react="
        (emoji: string) => {
          if (activeMessage) toggleReaction(activeMessage.id, emoji);
          closeActionSheet();
        }
      "
      @copy="copyMessage"
      @share="shareMessage"
      @reply="reply"
      @toggle-full-picker="showFullPicker = !showFullPicker"
      @close="closeActionSheet"
    />
  </div>
</template>

<style scoped>
@keyframes bounce-dot {
  0%,
  80%,
  100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-4px);
  }
}

.typing-dots {
  display: inline-flex;
  gap: 2px;
  align-items: center;
}

.typing-dots .dot {
  display: inline-block;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background-color: currentColor;
  opacity: 0.6;
  animation: bounce-dot 1.4s infinite ease-in-out;
}

.typing-dots .dot:nth-child(1) {
  animation-delay: 0s;
}

.typing-dots .dot:nth-child(2) {
  animation-delay: 0.15s;
}

.typing-dots .dot:nth-child(3) {
  animation-delay: 0.3s;
}
</style>
