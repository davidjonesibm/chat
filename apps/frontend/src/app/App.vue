<script setup lang="ts">
import ToastContainer from '../components/ui/ToastContainer.vue';
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
