<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import ToastContainer from '../components/ui/ToastContainer.vue';

const router = useRouter();

function onSwMessage(event: MessageEvent) {
  if (event.origin && event.origin !== window.location.origin) {
    return;
  }

  const url = event.data?.url;
  if (
    event.data?.type === 'NAVIGATE' &&
    typeof url === 'string' &&
    url.startsWith('/')
  ) {
    router.push(url);
  }
}

onMounted(() => {
  navigator.serviceWorker?.addEventListener('message', onSwMessage);
});

onUnmounted(() => {
  navigator.serviceWorker?.removeEventListener('message', onSwMessage);
});
</script>

<template>
  <a
    href="#main-content"
    class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-primary focus:text-primary-content"
    >Skip to main content</a
  >
  <RouterView />
  <ToastContainer />
</template>
