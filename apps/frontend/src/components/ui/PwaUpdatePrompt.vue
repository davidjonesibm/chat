<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRegisterSW } from 'virtual:pwa-register/vue';

const showOfflineReady = ref(false);

const { needRefresh, offlineReady, updateServiceWorker } = useRegisterSW({
  onRegistered(registration) {
    if (registration) {
      setInterval(() => registration.update(), 60 * 1000);
    }

    if (navigator.storage?.persist) {
      navigator.storage.persist().then((result) => {
        console.log('[PWA] Storage persisted:', result);
      });
    }
  },
  onRegisterError(error) {
    console.error('[PWA] Registration error:', error);
  },
});

watch(offlineReady, (ready) => {
  if (ready) {
    showOfflineReady.value = true;
    setTimeout(() => {
      showOfflineReady.value = false;
    }, 3000);
  }
});

function onUpdate() {
  updateServiceWorker(true);
}

function onDismiss() {
  needRefresh.value = false;
}
</script>

<template>
  <Transition name="toast-slide">
    <div v-if="needRefresh" class="toast toast-center toast-bottom z-50">
      <div class="alert alert-info shadow-lg gap-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        <span>A new version is available.</span>
        <div class="flex gap-2">
          <button class="btn btn-sm btn-ghost" @click="onDismiss">
            Dismiss
          </button>
          <button class="btn btn-sm btn-primary" @click="onUpdate">
            Update
          </button>
        </div>
      </div>
    </div>
  </Transition>

  <Transition name="toast-slide">
    <div v-if="showOfflineReady" class="toast toast-center toast-bottom z-50">
      <div class="alert alert-success shadow-lg">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M5 13l4 4L19 7"
          />
        </svg>
        <span>Ready for offline use.</span>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.toast-slide-enter-active,
.toast-slide-leave-active {
  transition: all 0.3s ease;
}

.toast-slide-enter-from,
.toast-slide-leave-to {
  opacity: 0;
  transform: translateY(1rem);
}
</style>
