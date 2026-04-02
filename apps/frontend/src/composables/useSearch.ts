import { ref } from 'vue';
import type { MessageWithSender, CursorPaginatedResponse } from '@chat/shared';
import { apiFetch } from '../lib/api';

const baseUrl = import.meta.env.VITE_API_URL || window.location.origin;

const DEBOUNCE_MS = 300;

export function useSearch() {
  const searchQuery = ref('');
  const searchResults = ref<MessageWithSender[]>([]);
  const searching = ref(false);
  const hasMore = ref(false);

  let nextCursor: string | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let lastGroupId = '';
  let lastChannelId: string | undefined;

  async function fetchResults(
    query: string,
    groupId: string,
    channelId?: string,
    cursor?: string,
  ): Promise<CursorPaginatedResponse<MessageWithSender>> {
    const params = new URLSearchParams({ query, groupId });
    if (channelId) params.set('channelId', channelId);
    if (cursor) params.set('cursor', cursor);

    return apiFetch<CursorPaginatedResponse<MessageWithSender>>(
      `${baseUrl}/api/search/messages?${params.toString()}`,
    );
  }

  function search(query: string, groupId: string, channelId?: string): void {
    searchQuery.value = query;
    lastGroupId = groupId;
    lastChannelId = channelId;

    if (debounceTimer) clearTimeout(debounceTimer);

    if (!query.trim()) {
      searchResults.value = [];
      hasMore.value = false;
      nextCursor = null;
      searching.value = false;
      return;
    }

    searching.value = true;

    debounceTimer = setTimeout(async () => {
      try {
        const data = await fetchResults(query, groupId, channelId);
        searchResults.value = data.items;
        nextCursor = data.nextCursor;
        hasMore.value = data.hasMore;
      } catch (err) {
        console.error('[useSearch] Search failed:', err);
        searchResults.value = [];
        hasMore.value = false;
        nextCursor = null;
      } finally {
        searching.value = false;
      }
    }, DEBOUNCE_MS);
  }

  async function loadMore(): Promise<void> {
    if (!nextCursor || !searchQuery.value.trim() || searching.value) return;

    searching.value = true;
    try {
      const data = await fetchResults(
        searchQuery.value,
        lastGroupId,
        lastChannelId,
        nextCursor,
      );
      searchResults.value.push(...data.items);
      nextCursor = data.nextCursor;
      hasMore.value = data.hasMore;
    } catch (err) {
      console.error('[useSearch] Load more failed:', err);
    } finally {
      searching.value = false;
    }
  }

  function clearSearch(): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    searchQuery.value = '';
    searchResults.value = [];
    searching.value = false;
    hasMore.value = false;
    nextCursor = null;
  }

  return {
    searchQuery,
    searchResults,
    searching,
    hasMore,
    search,
    loadMore,
    clearSearch,
  };
}
