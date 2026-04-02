<script setup lang="ts">
import { computed } from 'vue';
import { storeToRefs } from 'pinia';
import { useChatStore } from '../../stores/chatStore';
import { useChannelStore } from '../../stores/channelStore';
import UserAvatar from '../ui/UserAvatar.vue';

const emit = defineEmits<{
  'toggle-sidebar': [];
  'toggle-search': [];
}>();

const chatStore = useChatStore();
const channelStore = useChannelStore();
const { onlineUsers } = storeToRefs(chatStore);
const { memberProfiles } = storeToRefs(channelStore);

const onlineCount = computed(() => onlineUsers.value.length);

// Map online user IDs to their profiles
const onlineUserProfiles = computed(() => {
  return onlineUsers.value
    .map((userId) => memberProfiles.value[userId])
    .filter(Boolean); // Filter out undefined profiles
});

// Limit to 5 visible avatars
const MAX_VISIBLE_AVATARS = 5;
const visibleOnlineUsers = computed(() =>
  onlineUserProfiles.value.slice(0, MAX_VISIBLE_AVATARS),
);

const overflowCount = computed(() => {
  const overflow = onlineUserProfiles.value.length - MAX_VISIBLE_AVATARS;
  return overflow > 0 ? overflow : 0;
});

// Generate initials from username (first letter, uppercase)
const getInitials = (username: string) => {
  return username.charAt(0).toUpperCase();
};

const currentChannel = computed(() => channelStore.currentChannel);
const currentGroup = computed(() => channelStore.currentGroup);

const channelName = computed(
  () => currentChannel.value?.name || 'Select a channel',
);
const groupName = computed(() => currentGroup.value?.name || '');
</script>

<template>
  <div>
    <header class="navbar bg-base-200 border-b border-base-300">
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

      <!-- Online users avatars -->
      <div v-if="onlineCount > 0" class="flex-none">
        <div class="avatar-group -space-x-4" aria-label="Online users">
          <div
            v-for="user in visibleOnlineUsers"
            :key="user.id"
            class="avatar online"
          >
            <UserAvatar
              :username="user.username"
              :avatar-url="user.avatar"
              size="sm"
            />
          </div>
          <div v-if="overflowCount > 0" class="avatar placeholder">
            <div
              class="w-8 h-8 bg-base-300 text-base-content rounded-full flex items-center justify-center text-xs"
            >
              +{{ overflowCount }}
            </div>
          </div>
        </div>
      </div>
    </header>
  </div>
</template>
