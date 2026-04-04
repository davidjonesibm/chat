<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useChannelStore } from '../../stores/channelStore';
import { useAuthStore } from '../../stores/authStore';
import PushToggle from './PushToggle.vue';
import UserAvatar from '../ui/UserAvatar.vue';

const router = useRouter();
const channelStore = useChannelStore();
const authStore = useAuthStore();

const emit = defineEmits<{
  'create-channel': [];
  'invite-people': [];
  'open-profile': [];
  close: [];
}>();

const isOwner = computed(
  () =>
    !!authStore.user &&
    !!channelStore.currentGroup &&
    channelStore.currentGroup.owner === authStore.user.id,
);

const focusedIndex = ref(0);

function handleListKeydown(e: KeyboardEvent) {
  const items = channelStore.channels;
  if (items.length === 0) return;

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      focusedIndex.value = Math.min(focusedIndex.value + 1, items.length - 1);
      focusItem();
      break;
    case 'ArrowUp':
      e.preventDefault();
      focusedIndex.value = Math.max(focusedIndex.value - 1, 0);
      focusItem();
      break;
    case 'Enter':
    case ' ':
      e.preventDefault();
      if (items[focusedIndex.value]) {
        handleSelectChannel(items[focusedIndex.value].id);
      }
      break;
    case 'Home':
      e.preventDefault();
      focusedIndex.value = 0;
      focusItem();
      break;
    case 'End':
      e.preventDefault();
      focusedIndex.value = items.length - 1;
      focusItem();
      break;
  }
}

function focusItem() {
  const el = document.querySelector(
    `[data-channel-index="${focusedIndex.value}"]`,
  ) as HTMLElement | null;
  el?.focus();
}

function handleSelectChannel(channelId: string) {
  channelStore.selectChannel(channelId);
  router.push(`/g/${channelStore.currentGroupId}/c/${channelId}`);
  emit('close');
}

function handleLogout() {
  authStore.logout();
  router.push('/login');
}
</script>

<template>
  <aside class="h-full bg-base-200 flex flex-col border-r border-base-300">
    <!-- Group Header -->
    <div class="p-4 border-b border-base-300 flex items-center gap-2">
      <button
        class="btn btn-ghost btn-xs gap-1 shrink-0"
        aria-label="Back to groups"
        @click="router.push('/')"
      >
        ← Groups
      </button>
      <h2 class="text-lg font-bold truncate">
        {{ channelStore.currentGroup?.name }}
      </h2>
    </div>

    <!-- Flat Channel List -->
    <div
      class="flex-1 overflow-y-auto"
      role="listbox"
      aria-label="Channels"
      @keydown="handleListKeydown"
    >
      <div
        v-for="(channel, index) in channelStore.channels"
        :key="channel.id"
        role="option"
        :aria-selected="channelStore.currentChannelId === channel.id"
        :tabindex="index === focusedIndex ? 0 : -1"
        :data-channel-index="index"
        class="px-4 py-2 cursor-pointer transition-colors flex items-center gap-2"
        :class="{
          'active bg-primary text-primary-content':
            channelStore.currentChannelId === channel.id,
        }"
        @click="handleSelectChannel(channel.id)"
        @focus="focusedIndex = index"
      >
        <span class="text-base-content/70">#</span>
        <span class="flex-1 truncate text-sm">{{ channel.name }}</span>
      </div>
    </div>

    <!-- Add Channel / Add Member Buttons -->
    <div class="p-3 border-t border-base-300 flex flex-col gap-1">
      <button
        class="btn btn-ghost btn-sm w-full justify-start"
        aria-label="Add Channel"
        @click="emit('create-channel')"
      >
        <span>+</span>
        Add Channel
      </button>
      <button
        v-if="isOwner"
        class="btn btn-ghost btn-sm w-full justify-start"
        aria-label="Invite People"
        @click="emit('invite-people')"
      >
        <span>+</span>
        Invite People
      </button>
    </div>

    <!-- Push Notifications Toggle -->
    <PushToggle />

    <!-- User Info & Logout -->
    <div
      class="p-3 border-t border-base-300 flex items-center gap-2 bg-base-300"
    >
      <div
        class="flex-1 min-w-0 flex items-center gap-2 cursor-pointer hover:opacity-80"
        @click="emit('open-profile')"
      >
        <UserAvatar
          :username="authStore.user?.username ?? ''"
          :avatar-url="authStore.user?.avatar"
          size="sm"
        />
        <span class="font-medium truncate text-sm">{{
          authStore.user?.username
        }}</span>
      </div>
      <button
        class="btn btn-ghost btn-sm"
        aria-label="Sign out"
        @click="handleLogout"
      >
        Logout
      </button>
    </div>
  </aside>
</template>
