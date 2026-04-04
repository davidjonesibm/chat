<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import ToastContainer from '../components/ui/ToastContainer.vue';

const router = useRouter();

function onSwMessage(event: MessageEvent) {
  if (event.data?.type === 'NAVIGATE' && typeof event.data.url === 'string') {
    router.push(event.data.url);
  }
}

onMounted(() => {
  window.addEventListener('message', onSwMessage);
});

onUnmounted(() => {
  window.removeEventListener('message', onSwMessage);
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
