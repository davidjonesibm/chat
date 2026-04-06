<script setup lang="ts">
defineProps<{
  open: boolean;
  side?: 'left' | 'right';
  width?: string;
  staticOnDesktop?: boolean;
  ariaLabel?: string;
}>();

const emit = defineEmits<{
  close: [];
}>();
</script>

<template>
  <!-- Mobile overlay backdrop -->
  <Transition name="fade">
    <div
      v-if="open"
      class="fixed inset-0 bg-black/50 z-20"
      :class="staticOnDesktop ? 'lg:hidden' : ''"
      aria-hidden="true"
      @click="emit('close')"
    />
  </Transition>

  <!-- Panel -->
  <aside
    :aria-label="ariaLabel"
    class="fixed inset-y-0 z-30 transform transition-transform duration-300 ease-in-out"
    :class="[
      width ?? 'w-64',
      side === 'right' ? 'right-0' : 'left-0',
      staticOnDesktop ? 'lg:static lg:translate-x-0 lg:z-auto' : '',
      open
        ? 'translate-x-0'
        : side === 'right'
          ? 'translate-x-full'
          : '-translate-x-full',
    ]"
  >
    <slot />
  </aside>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 300ms ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
