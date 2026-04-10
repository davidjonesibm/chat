<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { GiphyFetch, type GifsResult } from '@giphy/js-fetch-api';

type IGif = GifsResult['data'][number];

const gf = new GiphyFetch(import.meta.env.VITE_GIPHY_API_KEY);

const props = defineProps<{
  visible: boolean;
  embedded?: boolean;
}>();

const emit = defineEmits<{
  send: [
    payload: { gifUrl: string; caption: string; width: number; height: number },
  ];
  close: [];
}>();

const searchQuery = ref('');
const gifs = ref<IGif[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const hasMore = ref(false);
const offset = ref(0);
const totalCount = ref(0);
const selectedGif = ref<IGif | null>(null);
const caption = ref('');

const LIMIT = 25;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

async function fetchGifs(query: string, newOffset: number, append: boolean) {
  if (append) {
    loadingMore.value = true;
  } else {
    loading.value = true;
    gifs.value = [];
  }

  try {
    const result = query.trim()
      ? await gf.search(query.trim(), {
          offset: newOffset,
          limit: LIMIT,
          rating: 'g',
          lang: 'en',
        })
      : await gf.trending({ offset: newOffset, limit: LIMIT, rating: 'g' });

    if (append) {
      gifs.value = [...gifs.value, ...result.data];
    } else {
      gifs.value = result.data;
    }

    offset.value = newOffset + result.data.length;
    totalCount.value = result.pagination.total_count;
    hasMore.value = offset.value < result.pagination.total_count;
  } catch {
    // silent — GiphyFetch throws on network error
  } finally {
    loading.value = false;
    loadingMore.value = false;
  }
}

function handleSearchInput(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  searchQuery.value = value;

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    selectedGif.value = null;
    offset.value = 0;
    fetchGifs(value, 0, false);
  }, 300);
}

function handleLoadMore() {
  fetchGifs(searchQuery.value, offset.value, true);
}

function handleSelectGif(gif: IGif) {
  selectedGif.value = gif;
  caption.value = '';
}

function handleBack() {
  selectedGif.value = null;
  caption.value = '';
}

function handleSend() {
  if (!selectedGif.value) return;
  const rendition = selectedGif.value.images.fixed_height;
  emit('send', {
    gifUrl: rendition.url,
    caption: caption.value.trim(),
    width: parseInt(String(rendition.width), 10) || 0,
    height: parseInt(String(rendition.height), 10) || 0,
  });
  selectedGif.value = null;
  caption.value = '';
  searchQuery.value = '';
}

function handleClose() {
  emit('close');
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (selectedGif.value) {
      handleBack();
    } else {
      handleClose();
    }
  }
}

function handleCaptionKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}

function clearSearch() {
  searchQuery.value = '';
  offset.value = 0;
  gifs.value = [];
  hasMore.value = false;
  if (debounceTimer) clearTimeout(debounceTimer);
}

watch(
  () => props.visible,
  (isVisible) => {
    if (isVisible) {
      if (gifs.value.length === 0) fetchGifs('', 0, false);
    } else {
      clearSearch();
      selectedGif.value = null;
      caption.value = '';
    }
  },
);

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
  if (props.visible) {
    fetchGifs('', 0, false);
  }
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  if (debounceTimer) clearTimeout(debounceTimer);
});
</script>

<template>
  <Transition name="slide-up">
    <div
      v-if="visible || embedded"
      class="flex flex-col overflow-hidden"
      :class="
        embedded
          ? 'h-full'
          : 'absolute bottom-full left-0 right-0 mb-1 z-20 bg-base-200 rounded-t-2xl border border-base-300 shadow-xl max-h-[60vh] sm:max-h-[50vh]'
      "
      role="dialog"
      aria-label="GIF picker"
    >
      <!-- Header -->
      <div
        class="flex items-center gap-2 p-3 border-b border-base-300 shrink-0"
      >
        <button
          v-if="selectedGif"
          class="btn btn-ghost btn-sm btn-square"
          aria-label="Back to GIF grid"
          @click="handleBack"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        <template v-if="!selectedGif">
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
              :class="searchQuery ? 'pr-8' : ''"
              placeholder="Search GIFs..."
              aria-label="Search GIFs"
              :value="searchQuery"
              @input="handleSearchInput"
            />
            <button
              v-if="searchQuery"
              class="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs btn-circle"
              aria-label="Clear search"
              @click="
                () => {
                  clearSearch();
                  fetchGifs('', 0, false);
                }
              "
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-3.5 h-3.5"
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
        </template>
        <span v-else class="font-semibold text-sm flex-1">Send GIF</span>

        <button
          v-if="!embedded"
          class="btn btn-ghost btn-sm btn-square"
          aria-label="Close GIF picker"
          @click="handleClose"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-5 h-5"
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

      <!-- GIF grid -->
      <div v-if="!selectedGif" class="flex-1 overflow-y-auto p-2">
        <div v-if="loading" class="flex items-center justify-center p-8">
          <span class="loading loading-spinner loading-lg"></span>
        </div>

        <template v-else>
          <div
            v-if="gifs.length === 0"
            class="flex items-center justify-center p-8 text-base-content/50"
          >
            <span>{{
              searchQuery.trim() ? 'No GIFs found' : 'No trending GIFs'
            }}</span>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <button
              v-for="gif in gifs"
              :key="gif.id"
              class="relative overflow-hidden rounded-lg bg-base-300 cursor-pointer hover:ring-2 hover:ring-primary focus:ring-2 focus:ring-primary transition-shadow aspect-square"
              :title="gif.title"
              @click="handleSelectGif(gif)"
            >
              <img
                :src="gif.images.fixed_width.url"
                :alt="gif.title"
                class="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          </div>

          <div v-if="hasMore" class="flex justify-center py-3">
            <button
              class="btn btn-ghost btn-sm"
              :disabled="loadingMore"
              @click="handleLoadMore"
            >
              <span
                v-if="loadingMore"
                class="loading loading-spinner loading-sm"
              ></span>
              <span v-else>Load more</span>
            </button>
          </div>
        </template>
      </div>

      <!-- Selected GIF preview / send confirmation -->
      <div
        v-else
        class="flex-1 overflow-y-auto p-4 flex flex-col items-center gap-3"
      >
        <div class="rounded-lg overflow-hidden bg-base-300 max-w-xs">
          <img
            :src="selectedGif.images.fixed_height.url"
            :alt="selectedGif.title"
            class="max-w-full h-auto"
          />
        </div>

        <input
          type="text"
          class="input input-bordered w-full max-w-xs"
          placeholder="Add a caption (optional)"
          v-model="caption"
          @keydown="handleCaptionKeydown"
        />

        <div class="flex gap-2">
          <button class="btn btn-ghost btn-sm" @click="handleBack">
            Cancel
          </button>
          <button class="btn btn-primary btn-sm" @click="handleSend">
            Send
          </button>
        </div>
      </div>

      <!-- Powered by GIPHY attribution -->
      <div class="shrink-0 px-3 py-1.5 border-t border-base-300 text-center">
        <span class="text-xs text-base-content/40">Powered by GIPHY</span>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(1rem);
  opacity: 0;
}
</style>
