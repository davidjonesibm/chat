<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useChatStore } from '../../stores/chatStore';

const chatStore = useChatStore();
const { connected, reconnecting, reconnectAttempt } = storeToRefs(chatStore);

const isOnline = ref(navigator.onLine);
const showReconnecting = ref(false);
let reconnectBannerTimer: ReturnType<typeof setTimeout> | null = null;

watch([reconnecting, connected], ([isReconnecting, isConnected]) => {
  if (isReconnecting && !isConnected) {
    reconnectBannerTimer = setTimeout(() => {
      showReconnecting.value = true;
    }, 2000);
  } else {
    if (reconnectBannerTimer) {
      clearTimeout(reconnectBannerTimer);
      reconnectBannerTimer = null;
    }
    showReconnecting.value = false;
  }
});

function handleOnline() {
  isOnline.value = true;
}

function handleOffline() {
  isOnline.value = false;
}

onMounted(() => {
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
});

onUnmounted(() => {
  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);
  if (reconnectBannerTimer) clearTimeout(reconnectBannerTimer);
});
</script>

<template>
  <Transition name="banner">
    <div v-if="!isOnline" class="alert alert-error rounded-none gap-2 py-2">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-5 w-5 shrink-0"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fill-rule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
          clip-rule="evenodd"
        />
      </svg>
      <span>You're offline. Messages will be queued.</span>
    </div>
    <div
      v-else-if="showReconnecting"
      class="alert alert-warning rounded-none gap-2 py-2"
    >
      <span class="loading loading-spinner loading-sm"></span>
      <span>
        Reconnecting…
        <span v-if="reconnectAttempt > 0" class="opacity-70">
          (attempt {{ reconnectAttempt }})
        </span>
      </span>
    </div>
  </Transition>
</template>

<style scoped>
.banner-enter-active,
.banner-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}
.banner-enter-from,
.banner-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
}
.banner-enter-to,
.banner-leave-from {
  max-height: 4rem;
  opacity: 1;
}
</style>
