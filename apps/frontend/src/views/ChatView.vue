<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, defineAsyncComponent } from 'vue';
import { useChannelStore } from '../stores/channelStore';
import { useChatStore } from '../stores/chatStore';
import { useChat } from '../composables/useChat';
import ChannelSidebar from '../components/chat/ChannelSidebar.vue';
import ChatHeader from '../components/chat/ChatHeader.vue';
import MessageList from '../components/chat/MessageList.vue';
import MessageInput from '../components/chat/MessageInput.vue';
import ConnectionStatus from '../components/ui/ConnectionStatus.vue';

const CreateGroupModal = defineAsyncComponent(
  () => import('../components/chat/CreateGroupModal.vue'),
);
const CreateChannelModal = defineAsyncComponent(
  () => import('../components/chat/CreateChannelModal.vue'),
);
const AddMemberModal = defineAsyncComponent(
  () => import('../components/chat/AddMemberModal.vue'),
);
const MessageSearch = defineAsyncComponent(
  () => import('../components/chat/MessageSearch.vue'),
);
const ProfileModal = defineAsyncComponent(
  () => import('../components/chat/ProfileModal.vue'),
);

const channelStore = useChannelStore();
const chatStore = useChatStore();
const { connect, disconnect, sendMessage, switchChannel } = useChat();

// Sidebar toggle (mobile)
const sidebarOpen = ref(false);

// Search panel
const showSearch = ref(false);

// Modal state
const showCreateGroup = ref(false);
const showCreateChannel = ref(false);
const showAddMember = ref(false);
const createChannelGroupId = ref('');
const addMemberGroupId = ref('');
const showProfile = ref(false);

function handleCreateChannel(groupId: string) {
  createChannelGroupId.value = groupId;
  showCreateChannel.value = true;
}

function handleAddMember(groupId: string) {
  addMemberGroupId.value = groupId;
  showAddMember.value = true;
}

function handleGroupCreated() {
  showCreateGroup.value = false;
  // Group is auto-selected by the store
}

function handleChannelCreated() {
  showCreateChannel.value = false;
}

function handleMemberAdded() {
  showAddMember.value = false;
}

function handleSend(content: string) {
  sendMessage(content);
}

function handleToggleSearch() {
  showSearch.value = !showSearch.value;
}

async function handleNavigateToMessage(channelId: string, messageId: string) {
  showSearch.value = false;
  if (channelId !== channelStore.currentChannelId) {
    await channelStore.selectChannel(channelId);
  }
  chatStore.highlightedMessageId = messageId;
}

watch(
  () => channelStore.currentChannelId,
  (newId, oldId) => {
    if (newId) {
      switchChannel(oldId ?? null, newId);
    }
  },
);

onMounted(async () => {
  await channelStore.fetchMyGroups();
  if (channelStore.groups.length > 0) {
    await channelStore.selectGroup(channelStore.groups[0].id);
  }
  connect();
});

onUnmounted(() => {
  disconnect();
});
</script>

<template>
  <div class="h-screen flex overflow-hidden">
    <!-- Mobile sidebar overlay -->
    <div
      v-if="sidebarOpen"
      class="fixed inset-0 bg-black/50 z-20 lg:hidden"
      @click="sidebarOpen = false"
    ></div>

    <!-- Sidebar -->
    <aside
      role="navigation"
      aria-label="Channels"
      class="fixed lg:static inset-y-0 left-0 z-30 w-64 transform transition-transform lg:translate-x-0"
      :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <ChannelSidebar
        @create-group="showCreateGroup = true"
        @create-channel="handleCreateChannel"
        @add-member="handleAddMember"
        @open-profile="showProfile = true"
      />
    </aside>

    <!-- Main chat area -->
    <div
      id="main-content"
      role="main"
      aria-label="Chat"
      class="flex-1 flex flex-col min-w-0"
    >
      <ChatHeader
        @toggle-sidebar="sidebarOpen = !sidebarOpen"
        @toggle-search="handleToggleSearch"
      />

      <!-- Show empty state if no groups/channels selected -->
      <template v-if="channelStore.currentChannelId">
        <div class="flex-1 flex min-h-0">
          <div class="flex-1 flex flex-col min-w-0">
            <ConnectionStatus />
            <MessageList class="flex-1" />
            <MessageInput @send="handleSend" />
          </div>
          <div v-if="showSearch" class="w-80 shrink-0">
            <MessageSearch
              :group-id="channelStore.currentGroupId!"
              :current-channel-id="channelStore.currentChannelId!"
              @close="showSearch = false"
              @navigate-to-message="handleNavigateToMessage"
            />
          </div>
        </div>
      </template>
      <template v-else>
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <h2 class="text-2xl font-bold mb-2">Welcome to Chat!</h2>
            <p class="text-base-content/60 mb-4">
              Create a group to get started
            </p>
            <button class="btn btn-primary" @click="showCreateGroup = true">
              Create Group
            </button>
          </div>
        </div>
      </template>
    </div>

    <!-- Modals -->
    <CreateGroupModal v-model="showCreateGroup" @created="handleGroupCreated" />
    <CreateChannelModal
      v-model="showCreateChannel"
      :group-id="createChannelGroupId"
      @created="handleChannelCreated"
    />
    <AddMemberModal
      v-model="showAddMember"
      :group-id="addMemberGroupId"
      @added="handleMemberAdded"
    />
    <ProfileModal v-model="showProfile" />
  </div>
</template>
