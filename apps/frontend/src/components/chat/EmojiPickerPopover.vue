<script setup lang="ts">
import { computed } from 'vue';
import 'emoji-picker-element';

interface Props {
  visible: boolean;
  triggerRect: DOMRect | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  select: [emoji: string];
  close: [];
}>();

const pickerStyle = computed(() => {
  if (!props.triggerRect) return { display: 'none' };

  const gap = 8;
  const pickerHeight = 380;
  const pickerWidth = 350;
  const style: Record<string, string> = { position: 'fixed' };

  // Vertical: prefer above, fall back to below
  if (props.triggerRect.top < pickerHeight) {
    style.top = `${props.triggerRect.bottom + gap}px`;
  } else {
    style.bottom = `${window.innerHeight - props.triggerRect.top + gap}px`;
  }

  // Horizontal: align right edges, fall back to left edges
  const rightAligned = props.triggerRect.right - pickerWidth;
  if (rightAligned < 0) {
    style.left = `${props.triggerRect.left}px`;
  } else {
    style.left = `${rightAligned}px`;
  }

  return style;
});

function onEmojiClick(event: Event) {
  const detail = (event as CustomEvent<{ unicode: string }>).detail;
  emit('select', detail.unicode);
}
</script>

<template>
  <Teleport to="body">
    <template v-if="visible">
      <div class="fixed inset-0 z-50" @click="emit('close')" />
      <div
        class="z-50 shadow-lg rounded-box overflow-hidden"
        :style="pickerStyle"
      >
        <emoji-picker style="--border-size: 0px" @emoji-click="onEmojiClick" />
      </div>
    </template>
  </Teleport>
</template>
