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
  'create-group': [];
  'create-channel': [groupId: string];
  'add-member': [groupId: string];
  'open-profile': [];
}>();

// Track which groups are expanded
const expandedGroups = ref<Set<string>>(new Set());

// Keyboard navigation: track focused tree item index
const focusedIndex = ref(-1);

// Flat list of all visible tree items for keyboard navigation
const treeItems = computed(() => {
  const items: { type: 'group' | 'channel'; id: string; groupId?: string }[] =
    [];
  for (const group of channelStore.groups) {
    items.push({ type: 'group', id: group.id });
    if (expandedGroups.value.has(group.id)) {
      for (const channel of getGroupChannels(group.id)) {
        items.push({ type: 'channel', id: channel.id, groupId: group.id });
      }
    }
  }
  return items;
});

function handleTreeKeydown(e: KeyboardEvent) {
  const items = treeItems.value;
  if (items.length === 0) return;

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      focusedIndex.value = Math.min(focusedIndex.value + 1, items.length - 1);
      focusTreeItem();
      break;
    case 'ArrowUp':
      e.preventDefault();
      focusedIndex.value = Math.max(focusedIndex.value - 1, 0);
      focusTreeItem();
      break;
    case 'ArrowRight': {
      e.preventDefault();
      const item = items[focusedIndex.value];
      if (item?.type === 'group' && !expandedGroups.value.has(item.id)) {
        toggleGroup(item.id);
      }
      break;
    }
    case 'ArrowLeft': {
      e.preventDefault();
      const item = items[focusedIndex.value];
      if (item?.type === 'group' && expandedGroups.value.has(item.id)) {
        expandedGroups.value.delete(item.id);
      } else if (item?.type === 'channel') {
        // Move focus to parent group
        const groupIdx = items.findIndex(
          (i) => i.type === 'group' && i.id === item.groupId,
        );
        if (groupIdx !== -1) focusedIndex.value = groupIdx;
        focusTreeItem();
      }
      break;
    }
    case 'Enter':
    case ' ': {
      e.preventDefault();
      const item = items[focusedIndex.value];
      if (item?.type === 'group') toggleGroup(item.id);
      else if (item?.type === 'channel') handleSelectChannel(item.id);
      break;
    }
    case 'Home':
      e.preventDefault();
      focusedIndex.value = 0;
      focusTreeItem();
      break;
    case 'End':
      e.preventDefault();
      focusedIndex.value = items.length - 1;
      focusTreeItem();
      break;
  }
}

function focusTreeItem() {
  const el = document.querySelector(
    `[data-tree-index="${focusedIndex.value}"]`,
  ) as HTMLElement | null;
  el?.focus();
}

function getTreeIndex(type: 'group' | 'channel', id: string) {
  return treeItems.value.findIndex((i) => i.type === type && i.id === id);
}

function toggleGroup(groupId: string) {
  if (expandedGroups.value.has(groupId)) {
    expandedGroups.value.delete(groupId);
  } else {
    expandedGroups.value.add(groupId);
    // Auto-fetch channels when expanding
    channelStore.selectGroup(groupId);
  }
}

function handleSelectChannel(channelId: string) {
  channelStore.selectChannel(channelId);
}

function handleLogout() {
  authStore.logout();
  router.push('/login');
}

function getGroupChannels(groupId: string) {
  return channelStore.channels.filter((c) => c.group === groupId);
}
</script>

<template>
  <aside class="h-full bg-base-200 flex flex-col border-r border-base-300">
    <!-- Header -->
    <div class="p-4 border-b border-base-300">
      <h1 class="text-xl font-bold flex items-center gap-2">
        <span>💬</span>
        <span>Chat App</span>
      </h1>
    </div>

    <!-- Create Group Button -->
    <div class="p-3">
      <button
        class="btn btn-primary btn-sm w-full"
        aria-label="Create Group"
        @click="emit('create-group')"
      >
        <span>+</span>
        Create Group
      </button>
    </div>

    <!-- Groups & Channels List -->
    <div
      class="flex-1 overflow-y-auto"
      role="tree"
      aria-label="Groups and channels"
      @keydown="handleTreeKeydown"
    >
      <div
        v-for="group in channelStore.groups"
        :key="group.id"
        class="border-b border-base-300"
      >
        <!-- Group Header -->
        <div
          role="treeitem"
          :aria-expanded="expandedGroups.has(group.id)"
          :aria-label="group.name"
          :tabindex="getTreeIndex('group', group.id) === focusedIndex ? 0 : -1"
          :data-tree-index="getTreeIndex('group', group.id)"
          class="flex items-center gap-2 p-3 hover:bg-base-300 cursor-pointer transition-colors"
          :class="{
            'bg-base-300': channelStore.currentGroupId === group.id,
          }"
          @click="toggleGroup(group.id)"
          @focus="focusedIndex = getTreeIndex('group', group.id)"
        >
          <span class="text-sm">{{
            expandedGroups.has(group.id) ? '▼' : '▶'
          }}</span>
          <span class="font-semibold flex-1 truncate">{{ group.name }}</span>
        </div>

        <!-- Channels (shown when expanded) -->
        <div
          v-if="expandedGroups.has(group.id)"
          role="group"
          class="bg-base-100"
        >
          <div
            v-for="channel in getGroupChannels(group.id)"
            :key="channel.id"
            role="treeitem"
            :aria-selected="channelStore.currentChannelId === channel.id"
            :aria-label="channel.name"
            :tabindex="
              getTreeIndex('channel', channel.id) === focusedIndex ? 0 : -1
            "
            :data-tree-index="getTreeIndex('channel', channel.id)"
            class="pl-8 pr-3 py-2 hover:bg-base-300 cursor-pointer transition-colors flex items-center gap-2"
            :class="{
              'bg-primary text-primary-content':
                channelStore.currentChannelId === channel.id,
            }"
            @click="handleSelectChannel(channel.id)"
            @focus="focusedIndex = getTreeIndex('channel', channel.id)"
          >
            <span class="text-base-content/70">#</span>
            <span class="flex-1 truncate text-sm">{{ channel.name }}</span>
          </div>

          <!-- Add Channel Button -->
          <div class="pl-8 pr-3 py-2">
            <button
              class="btn btn-ghost btn-xs text-xs w-full justify-start"
              :aria-label="`Add Channel to ${group.name}`"
              @click.stop="emit('create-channel', group.id)"
            >
              <span>+</span>
              Add Channel
            </button>
          </div>

          <!-- Add Member Button -->
          <div class="pl-8 pr-3 py-2">
            <button
              class="btn btn-ghost btn-xs text-xs w-full justify-start"
              :aria-label="`Add Member to ${group.name}`"
              @click.stop="emit('add-member', group.id)"
            >
              <span>+</span>
              Add Member
            </button>
          </div>
        </div>
      </div>
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
