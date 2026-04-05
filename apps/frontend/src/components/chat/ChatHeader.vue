<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useChatStore } from '../../stores/chatStore';
import { useChannelStore } from '../../stores/channelStore';

const emit = defineEmits<{
  'toggle-sidebar': [];
  'toggle-search': [];
}>();

const chatStore = useChatStore();
const channelStore = useChannelStore();
const { onlineUsers } = storeToRefs(chatStore);

const onlineCount = computed(() => onlineUsers.value.length);

const currentChannel = computed(() => channelStore.currentChannel);
const currentGroup = computed(() => channelStore.currentGroup);

const channelName = computed(
  () => currentChannel.value?.name || 'Select a channel',
);
const groupName = computed(() => currentGroup.value?.name || '');
</script>

<template>
  <div>
    <header
      class="navbar bg-base-200 border-b border-base-300 pt-[env(safe-area-inset-top,0px)]"
    >
      <!-- Mobile hamburger menu -->
      <div class="flex-none lg:hidden">
        <button
          class="btn btn-ghost btn-sm"
          aria-label="Open sidebar"
          @click="emit('toggle-sidebar')"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            class="inline-block w-5 h-5 stroke-current"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6h16M4 12h16M4 18h16"
            ></path>
          </svg>
        </button>
      </div>

      <div class="flex-1">
        <div class="flex flex-col">
          <div class="flex items-center gap-2">
            <span class="text-xl font-bold"># {{ channelName }}</span>
            <span class="badge badge-soft badge-sm"
              >{{ onlineCount }} online</span
            >
          </div>
          <span v-if="groupName" class="text-xs text-base-content/60">{{
            groupName
          }}</span>
        </div>
      </div>

      <!-- Search button -->
      <div class="flex-none">
        <button
          class="btn btn-ghost btn-sm btn-square"
          aria-label="Search messages"
          @click="emit('toggle-search')"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            class="inline-block w-5 h-5 stroke-current"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            ></path>
          </svg>
        </button>
      </div>
    </header>
  </div>
</template>
