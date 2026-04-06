<script setup lang="ts">
import { ref } from 'vue';
import { useCamera } from '../../composables/useCamera';

const emit = defineEmits<{
  select: [payload: { file: File; caption: string }];
}>();

const { selectedFile, previewUrl, isCompressing, handleFileSelect, clear } =
  useCamera();

const caption = ref('');
const cameraInput = ref<HTMLInputElement | null>(null);
const libraryInput = ref<HTMLInputElement | null>(null);

function openCamera() {
  cameraInput.value?.click();
}

function openLibrary() {
  libraryInput.value?.click();
}

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    await handleFileSelect(file);
  }
  // Reset input so the same file can be re-selected
  input.value = '';
}

function handleBack() {
  clear();
  caption.value = '';
}

function handleSend() {
  if (!selectedFile.value) return;
  emit('select', {
    file: selectedFile.value,
    caption: caption.value.trim(),
  });
  clear();
  caption.value = '';
}

function handleCaptionKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}
</script>

<template>
  <!-- Hidden file inputs -->
  <input
    ref="cameraInput"
    type="file"
    accept="image/*"
    capture="environment"
    class="hidden"
    @change="onFileChange"
  />
  <input
    ref="libraryInput"
    type="file"
    accept="image/*"
    class="hidden"
    @change="onFileChange"
  />

  <!-- Selection state -->
  <div
    v-if="!selectedFile && !isCompressing"
    class="flex flex-col items-center justify-center gap-4 p-6"
  >
    <div class="flex gap-3">
      <button class="btn btn-outline gap-2" @click="openCamera">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
          />
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
        Take Photo
      </button>
      <button class="btn btn-outline gap-2" @click="openLibrary">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        Choose Photo
      </button>
    </div>
    <p class="text-sm text-base-content/50">
      Take a photo or choose from your library
    </p>
  </div>

  <!-- Compressing state -->
  <div v-else-if="isCompressing" class="flex items-center justify-center p-8">
    <span class="loading loading-spinner loading-lg"></span>
  </div>

  <!-- Preview + caption state (matches GiphyPicker confirm view) -->
  <div v-else class="flex flex-col items-center gap-3 p-4">
    <div class="rounded-lg overflow-hidden bg-base-300 max-w-xs">
      <img :src="previewUrl!" alt="Selected photo" class="max-w-full h-auto" />
    </div>

    <input
      type="text"
      class="input input-bordered w-full max-w-xs"
      placeholder="Add a caption (optional)"
      v-model="caption"
      @keydown="handleCaptionKeydown"
    />

    <div class="flex gap-2">
      <button class="btn btn-ghost btn-sm" @click="handleBack">Cancel</button>
      <button class="btn btn-primary btn-sm" @click="handleSend">Send</button>
    </div>
  </div>
</template>
