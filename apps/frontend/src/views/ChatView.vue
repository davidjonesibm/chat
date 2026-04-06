<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, defineAsyncComponent } from 'vue';
import { useRoute } from 'vue-router';
import { useChannelStore } from '../stores/channelStore';
import { useChatStore } from '../stores/chatStore';
import { useChat } from '../composables/useChat';
import { useSwipePanel } from '../composables/useSwipePanel';
import ChannelSidebar from '../components/chat/ChannelSidebar.vue';
import ChatHeader from '../components/chat/ChatHeader.vue';
import MessageList from '../components/chat/MessageList.vue';
import MessageInput from '../components/chat/MessageInput.vue';
import ConnectionStatus from '../components/ui/ConnectionStatus.vue';
import SlidePanel from '../components/ui/SlidePanel.vue';

const CreateChannelModal = defineAsyncComponent(
  () => import('../components/chat/CreateChannelModal.vue'),
);
const InviteModal = defineAsyncComponent(
  () => import('../components/chat/InviteModal.vue'),
);
const MessageSearch = defineAsyncComponent(
  () => import('../components/chat/MessageSearch.vue'),
);
const ProfileModal = defineAsyncComponent(
  () => import('../components/chat/ProfileModal.vue'),
);
const GiphyPicker = defineAsyncComponent(
  () => import('../components/chat/GiphyPicker.vue'),
);

const route = useRoute();
const channelStore = useChannelStore();
const chatStore = useChatStore();
const { connect, disconnect, sendMessage, sendGiphyMessage, switchChannel } =
  useChat();

// Sidebar toggle (mobile)
const sidebarOpen = ref(false);

// Search panel
const showSearch = ref(false);

// Mutual exclusion: only one panel open at a time
watch(sidebarOpen, (v) => {
  if (v) showSearch.value = false;
});
watch(showSearch, (v) => {
  if (v) sidebarOpen.value = false;
});

// Swipe-to-open panels
const { onTouchStart: sidebarTouchStart, onTouchEnd: sidebarTouchEnd } =
  useSwipePanel('left', sidebarOpen);
const { onTouchStart: searchTouchStart, onTouchEnd: searchTouchEnd } =
  useSwipePanel('right', showSearch);

function onTouchStart(e: TouchEvent) {
  if (showSearch.value) {
    searchTouchStart(e);
  } else if (sidebarOpen.value) {
    sidebarTouchStart(e);
  } else {
    sidebarTouchStart(e);
    searchTouchStart(e);
  }
}
function onTouchEnd(e: TouchEvent) {
  if (showSearch.value) {
    searchTouchEnd(e);
  } else if (sidebarOpen.value) {
    sidebarTouchEnd(e);
  } else {
    sidebarTouchEnd(e);
    searchTouchEnd(e);
  }
}

// Giphy picker
const showGiphyPicker = ref(false);

// Modal state
const showCreateChannel = ref(false);
const showInvite = ref(false);
const showProfile = ref(false);

function handleCreateChannel() {
  showCreateChannel.value = true;
}

function handleInvitePeople() {
  showInvite.value = true;
}

function handleChannelCreated() {
  showCreateChannel.value = false;
}

function handleSend(content: string) {
  sendMessage(content);
}

function handleToggleSearch() {
  showSearch.value = !showSearch.value;
}

function handleToggleGiphy() {
  showGiphyPicker.value = !showGiphyPicker.value;
}

function handleGifSend(payload: { gifUrl: string; caption: string }) {
  sendGiphyMessage(payload.gifUrl, payload.caption);
  showGiphyPicker.value = false;
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

watch(
  () => route.params.channelId,
  async (newChannelId) => {
    if (
      newChannelId &&
      typeof newChannelId === 'string' &&
      newChannelId !== channelStore.currentChannelId
    ) {
      await channelStore.selectChannel(newChannelId);
    }
  },
);

onMounted(() => {
  connect();
});

onUnmounted(() => {
  disconnect();
});
</script>

<template>
  <div
    class="fixed inset-0 flex overflow-hidden"
    @touchstart.passive="onTouchStart"
    @touchend.passive="onTouchEnd"
  >
    <!-- Sidebar -->
    <SlidePanel
      :open="sidebarOpen"
      side="left"
      width="w-64"
      :static-on-desktop="true"
      aria-label="Channels"
      @close="sidebarOpen = false"
    >
      <ChannelSidebar
        @create-channel="handleCreateChannel"
        @invite-people="handleInvitePeople"
        @open-profile="showProfile = true"
        @close="sidebarOpen = false"
      />
    </SlidePanel>

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
            <div class="relative">
              <GiphyPicker
                :visible="showGiphyPicker"
                @send="handleGifSend"
                @close="showGiphyPicker = false"
              />
              <MessageInput
                @send="handleSend"
                @toggle-giphy="handleToggleGiphy"
              />
            </div>
          </div>
        </div>

        <SlidePanel
          :open="showSearch"
          side="right"
          width="w-80"
          aria-label="Search messages"
          @close="showSearch = false"
        >
          <MessageSearch
            :group-id="channelStore.currentGroupId!"
            :current-channel-id="channelStore.currentChannelId!"
            @close="showSearch = false"
            @navigate-to-message="handleNavigateToMessage"
          />
        </SlidePanel>
      </template>
      <template v-else>
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <h2 class="text-2xl font-bold mb-2">No channel selected</h2>
            <p class="text-base-content/60">
              Select a channel from the sidebar
            </p>
          </div>
        </div>
      </template>
    </div>

    <!-- Modals -->
    <CreateChannelModal
      v-model="showCreateChannel"
      :group-id="channelStore.currentGroupId!"
      @created="handleChannelCreated"
    />
    <InviteModal
      v-if="showInvite"
      :group-id="channelStore.currentGroupId!"
      @close="showInvite = false"
    />
    <ProfileModal v-model="showProfile" />
  </div>
</template>
