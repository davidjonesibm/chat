<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useSearch } from '../../composables/useSearch';
import { useChannelStore } from '../../stores/channelStore';

const props = defineProps<{
  groupId: string;
  currentChannelId?: string;
}>();

const emit = defineEmits<{
  close: [];
  'navigate-to-message': [channelId: string];
}>();

const channelStore = useChannelStore();
const {
  searchQuery,
  searchResults,
  searching,
  hasMore,
  search,
  loadMore,
  clearSearch,
} = useSearch();

const currentChannelOnly = ref(false);

const channelMap = computed(() => {
  const map: Record<string, string> = {};
  for (const ch of channelStore.channels) {
    map[ch.id] = ch.name;
  }
  return map;
});

function getChannelName(channelId: string): string {
  return channelMap.value[channelId] || 'unknown';
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function handleInput(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  search(
    value,
    props.groupId,
    currentChannelOnly.value ? props.currentChannelId : undefined,
  );
}

function handleToggleScope() {
  currentChannelOnly.value = !currentChannelOnly.value;
  if (searchQuery.value.trim()) {
    search(
      searchQuery.value,
      props.groupId,
      currentChannelOnly.value ? props.currentChannelId : undefined,
    );
  }
}

function handleResultClick(channelId: string) {
  emit('navigate-to-message', channelId);
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('close');
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  clearSearch();
});
</script>

<template>
  <div
    class="flex flex-col h-full bg-base-100 border-l border-base-300"
    role="search"
  >
    <!-- Header -->
    <div class="flex items-center gap-2 p-3 border-b border-base-300">
      <div class="relative flex-1">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/50"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          class="input input-bordered input-sm w-full pl-9"
          placeholder="Search messages..."
          aria-label="Search messages"
          :value="searchQuery"
          @input="handleInput"
          autofocus
        />
      </div>
      <button
        class="btn btn-ghost btn-sm btn-square"
        aria-label="Close search"
        @click="emit('close')"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>

    <!-- Scope toggle -->
    <div
      v-if="props.currentChannelId"
      class="px-3 py-2 border-b border-base-300"
    >
      <label class="label cursor-pointer justify-start gap-2">
        <input
          type="checkbox"
          class="toggle toggle-sm toggle-primary"
          :checked="currentChannelOnly"
          @change="handleToggleScope"
        />
        <span class="label-text text-sm">Current channel only</span>
      </label>
    </div>

    <!-- Results -->
    <div class="flex-1 overflow-y-auto">
      <!-- Loading -->
      <div
        v-if="searching && searchResults.length === 0"
        class="flex justify-center py-8"
      >
        <span class="loading loading-spinner loading-md"></span>
      </div>

      <!-- Empty state -->
      <div
        v-else-if="
          !searching && searchQuery.trim() && searchResults.length === 0
        "
        class="flex flex-col items-center justify-center py-8 text-base-content/50"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-12 h-12 mb-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <p class="text-sm">No messages found</p>
      </div>

      <!-- Initial state -->
      <div
        v-else-if="!searchQuery.trim()"
        class="flex flex-col items-center justify-center py-8 text-base-content/50"
      >
        <p class="text-sm">Type to search messages</p>
      </div>

      <!-- Results list -->
      <template v-else>
        <div role="list">
          <button
            v-for="msg in searchResults"
            :key="msg.id"
            role="listitem"
            class="w-full text-left px-3 py-2 hover:bg-base-200 transition-colors border-b border-base-200 cursor-pointer"
            @click="handleResultClick(msg.channel)"
          >
            <div class="flex items-baseline justify-between gap-2">
              <span class="font-semibold text-sm truncate">{{
                msg.sender.username
              }}</span>
              <span class="text-xs text-base-content/50 shrink-0">{{
                formatTime(msg.created_at)
              }}</span>
            </div>
            <p class="text-sm text-base-content/80 line-clamp-2 mt-0.5">
              {{ msg.content }}
            </p>
            <span class="text-xs text-base-content/40 mt-0.5 inline-block"
              >#{{ getChannelName(msg.channel) }}</span
            >
          </button>
        </div>
        <!-- Load more -->
        <div v-if="hasMore" class="flex justify-center py-3">
          <button
            class="btn btn-ghost btn-sm"
            :disabled="searching"
            @click="loadMore"
          >
            <span
              v-if="searching"
              class="loading loading-spinner loading-xs"
            ></span>
            <span v-else>Load more</span>
          </button>
        </div>
      </template>
    </div>
  </div>
</template>
