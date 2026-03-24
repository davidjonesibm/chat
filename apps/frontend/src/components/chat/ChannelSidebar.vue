<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useChannelStore } from '../../stores/channelStore';
import { useAuthStore } from '../../stores/authStore';

const router = useRouter();
const channelStore = useChannelStore();
const authStore = useAuthStore();

const emit = defineEmits<{
  'create-group': [];
  'create-channel': [groupId: string];
  'add-member': [groupId: string];
}>();

// Track which groups are expanded
const expandedGroups = ref<Set<string>>(new Set());

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
        @click="emit('create-group')"
      >
        <span>+</span>
        Create Group
      </button>
    </div>

    <!-- Groups & Channels List -->
    <div class="flex-1 overflow-y-auto">
      <div
        v-for="group in channelStore.groups"
        :key="group.id"
        class="border-b border-base-300"
      >
        <!-- Group Header -->
        <div
          class="flex items-center gap-2 p-3 hover:bg-base-300 cursor-pointer transition-colors"
          :class="{
            'bg-base-300': channelStore.currentGroupId === group.id,
          }"
          @click="toggleGroup(group.id)"
        >
          <span class="text-sm">{{
            expandedGroups.has(group.id) ? '▼' : '▶'
          }}</span>
          <span class="font-semibold flex-1 truncate">{{ group.name }}</span>
        </div>

        <!-- Channels (shown when expanded) -->
        <div v-if="expandedGroups.has(group.id)" class="bg-base-100">
          <div
            v-for="channel in getGroupChannels(group.id)"
            :key="channel.id"
            class="pl-8 pr-3 py-2 hover:bg-base-300 cursor-pointer transition-colors flex items-center gap-2"
            :class="{
              'bg-primary text-primary-content':
                channelStore.currentChannelId === channel.id,
            }"
            @click="handleSelectChannel(channel.id)"
          >
            <span class="text-base-content/70">#</span>
            <span class="flex-1 truncate text-sm">{{ channel.name }}</span>
          </div>

          <!-- Add Channel Button -->
          <div class="pl-8 pr-3 py-2">
            <button
              class="btn btn-ghost btn-xs text-xs w-full justify-start"
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
              @click.stop="emit('add-member', group.id)"
            >
              <span>+</span>
              Add Member
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- User Info & Logout -->
    <div
      class="p-3 border-t border-base-300 flex items-center gap-2 bg-base-300"
    >
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-lg">👤</span>
          <span class="font-medium truncate text-sm">{{
            authStore.user?.username
          }}</span>
        </div>
      </div>
      <button class="btn btn-ghost btn-sm" @click="handleLogout">Logout</button>
    </div>
  </aside>
</template>
