<script setup lang="ts">
import { ref, watch } from 'vue';
import GiphyPicker from './GiphyPicker.vue';
import CameraPanel from './CameraPanel.vue';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  'send-gif': [
    payload: { gifUrl: string; caption: string; width: number; height: number },
  ];
  'send-image': [payload: { file: File; caption: string }];
  close: [];
}>();

const activeTab = ref<'gifs' | 'photos'>('gifs');

watch(
  () => props.visible,
  (isVisible) => {
    if (!isVisible) {
      activeTab.value = 'gifs';
    }
  },
);

function handleGifSend(payload: {
  gifUrl: string;
  caption: string;
  width: number;
  height: number;
}) {
  emit('send-gif', payload);
}

function handleImageSelect(payload: { file: File; caption: string }) {
  emit('send-image', payload);
}

function handleClose() {
  emit('close');
}
</script>

<template>
  <Transition name="slide-up">
    <div
      v-if="visible"
      class="absolute bottom-full left-0 right-0 mb-1 z-20 flex flex-col bg-base-200 rounded-t-2xl border border-base-300 shadow-xl h-[60vh] sm:h-[50vh] overflow-hidden"
      role="dialog"
      aria-label="Media picker"
    >
      <!-- Tab header -->
      <div class="flex items-center border-b border-base-300 shrink-0">
        <div role="tablist" class="tabs tabs-bordered flex-1">
          <button
            role="tab"
            class="tab"
            :class="{ 'tab-active': activeTab === 'gifs' }"
            @click="activeTab = 'gifs'"
          >
            GIFs
          </button>
          <button
            role="tab"
            class="tab"
            :class="{ 'tab-active': activeTab === 'photos' }"
            @click="activeTab = 'photos'"
          >
            Photos
          </button>
        </div>
        <button
          class="btn btn-ghost btn-sm btn-square mr-2"
          aria-label="Close"
          @click="handleClose"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <!-- Tab content -->
      <div class="flex-1 min-h-0 overflow-hidden">
        <GiphyPicker
          v-show="activeTab === 'gifs'"
          :visible="visible && activeTab === 'gifs'"
          embedded
          @send="handleGifSend"
          @close="handleClose"
        />
        <div v-show="activeTab === 'photos'" class="h-full overflow-y-auto">
          <CameraPanel @select="handleImageSelect" />
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(1rem);
  opacity: 0;
}
</style>
