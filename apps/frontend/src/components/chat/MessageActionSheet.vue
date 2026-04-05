<script setup lang="ts">
import { ref } from 'vue';
import type { MessageWithSender } from '@chat/shared';
import { QUICK_EMOJIS } from '../../composables/useMessageActions';
import 'emoji-picker-element';

interface Props {
  message: MessageWithSender | null;
  show: boolean;
  isMobile: boolean;
  showFullPicker: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  close: [];
  react: [emoji: string];
  copy: [];
  share: [];
  reply: [];
  'toggle-full-picker': [];
}>();

function onEmojiClick(event: Event) {
  const detail = (event as CustomEvent<{ unicode: string }>).detail;
  if (detail?.unicode) {
    emit('react', detail.unicode);
  }
}
</script>

<template>
  <!-- MOBILE: Bottom sheet -->
  <div
    v-if="isMobile && message"
    class="modal modal-bottom"
    :class="{ 'modal-open': show }"
    @click.self="emit('close')"
  >
    <div class="modal-box p-4 pb-6">
      <!-- Quick emoji row -->
      <div
        v-if="!showFullPicker"
        class="flex items-center justify-center gap-2 mb-2"
      >
        <button
          v-for="emoji in QUICK_EMOJIS"
          :key="emoji"
          class="btn btn-circle btn-ghost text-xl"
          @click="emit('react', emoji)"
        >
          {{ emoji }}
        </button>
        <button
          v-if="!showFullPicker"
          class="btn btn-circle btn-ghost text-lg"
          aria-label="More reactions"
          @click="emit('toggle-full-picker')"
        >
          <!-- Plus icon -->
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
        </button>
      </div>

      <!-- Full emoji picker (mobile — inside sheet) -->
      <div v-if="showFullPicker" class="w-full overflow-hidden rounded-lg mb-2">
        <emoji-picker
          class="w-full"
          style="
            --border-size: 0px;
            --border-radius: 0;
            --num-columns: 8;
            height: 300px;
          "
          @emoji-click="onEmojiClick"
        />
      </div>

      <div class="divider my-1" />

      <!-- Action buttons -->
      <ul class="menu menu-lg w-full rounded-box p-0">
        <li>
          <button @click="emit('copy')">
            <!-- Copy icon -->
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1.5"
              aria-hidden="true"
            >
              <rect x="9" y="9" width="11" height="11" rx="2" />
              <path d="M5 15V5a2 2 0 0 1 2-2h10" />
            </svg>
            Copy message
          </button>
        </li>
        <li>
          <button @click="emit('share')">
            <!-- Share icon -->
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1.5"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15m0-3-3-3m0 0-3 3m3-3v11.25"
              />
            </svg>
            Share message
          </button>
        </li>
        <li>
          <button @click="emit('reply')">
            <!-- Reply icon -->
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1.5"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 0 1 0 12h-3"
              />
            </svg>
            Reply
            <span class="badge badge-sm badge-outline ml-auto"
              >coming soon</span
            >
          </button>
        </li>
      </ul>

      <!-- Cancel -->
      <button class="btn btn-block btn-ghost mt-2" @click="emit('close')">
        Cancel
      </button>
    </div>
  </div>

  <!-- DESKTOP: Compact floating toolbar -->
  <Transition v-else name="toolbar">
    <div
      v-if="show && message"
      class="rounded-box shadow-lg border border-base-300 bg-base-100 flex items-center gap-0.5 px-1 py-0.5"
    >
      <!-- Quick emojis -->
      <template v-if="!showFullPicker">
        <button
          v-for="emoji in QUICK_EMOJIS"
          :key="emoji"
          class="btn btn-xs btn-ghost text-base px-1"
          @click="emit('react', emoji)"
        >
          {{ emoji }}
        </button>
      </template>

      <!-- More emoji button -->
      <div
        v-if="!showFullPicker"
        class="tooltip tooltip-bottom"
        data-tip="More reactions"
      >
        <button
          class="btn btn-xs btn-ghost px-1"
          aria-label="More reactions"
          @click="emit('toggle-full-picker')"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
        </button>
      </div>

      <!-- Divider -->
      <div class="w-px h-5 bg-base-300 mx-0.5" />

      <!-- Copy -->
      <div class="tooltip tooltip-bottom" data-tip="Copy">
        <button
          class="btn btn-xs btn-ghost px-1"
          aria-label="Copy message"
          @click="emit('copy')"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="1.5"
            aria-hidden="true"
          >
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h10" />
          </svg>
        </button>
      </div>

      <!-- Share -->
      <div class="tooltip tooltip-bottom" data-tip="Share">
        <button
          class="btn btn-xs btn-ghost px-1"
          aria-label="Share message"
          @click="emit('share')"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="1.5"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M9 8.25H7.5a2.25 2.25 0 0 0-2.25 2.25v9a2.25 2.25 0 0 0 2.25 2.25h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25H15m0-3-3-3m0 0-3 3m3-3v11.25"
            />
          </svg>
        </button>
      </div>

      <!-- Reply -->
      <div class="tooltip tooltip-bottom" data-tip="Reply (coming soon)">
        <button
          class="btn btn-xs btn-ghost px-1"
          aria-label="Reply"
          @click="emit('reply')"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="1.5"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 0 1 0 12h-3"
            />
          </svg>
        </button>
      </div>

      <!-- Desktop full emoji picker (floating below) -->
      <div
        v-if="showFullPicker"
        class="absolute z-20 top-full mt-1 right-0 rounded-box overflow-hidden shadow-xl border border-base-300"
      >
        <emoji-picker
          style="--border-size: 0px; --border-radius: 0"
          @emoji-click="onEmojiClick"
        />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Desktop toolbar transition */
.toolbar-enter-active,
.toolbar-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s ease;
}
.toolbar-enter-from,
.toolbar-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
