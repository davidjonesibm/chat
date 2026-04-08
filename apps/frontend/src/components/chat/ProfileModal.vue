<script setup lang="ts">
import { ref, useTemplateRef, watch, onUnmounted } from 'vue';
import { useAuthStore } from '../../stores/authStore';
import UserAvatar from '../ui/UserAvatar.vue';

const open = defineModel<boolean>({ required: true });

const authStore = useAuthStore();

const username = ref('');
const displayName = ref('');
const selectedFile = ref<File | null>(null);
const previewUrl = ref<string | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const fileInput = useTemplateRef<HTMLInputElement>('fileInput');

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// Reset form when modal opens / load avatar URL
watch(open, (isOpen) => {
  if (isOpen) {
    username.value = authStore.user?.username ?? '';
    displayName.value = '';
    selectedFile.value = null;
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value);
    }
    previewUrl.value = null;
    error.value = null;
    currentAvatarUrl.value = authStore.user?.avatar ?? null;
  } else {
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value);
      previewUrl.value = null;
    }
  }
});

function close() {
  open.value = false;
}

function triggerFileInput() {
  fileInput.value?.click();
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  if (!ALLOWED_TYPES.includes(file.type)) {
    error.value = 'Please select a valid image (JPEG, PNG, GIF, or WebP)';
    return;
  }

  if (file.size > MAX_FILE_SIZE) {
    error.value = 'Image must be smaller than 2MB';
    return;
  }

  error.value = null;
  selectedFile.value = file;
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
  }
  previewUrl.value = URL.createObjectURL(file);
}

const currentAvatarUrl = ref<string | null>(null);

onUnmounted(() => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
  }
});

async function handleDeleteAvatar() {
  loading.value = true;
  error.value = null;
  try {
    await authStore.deleteAvatar();
    currentAvatarUrl.value = null;
    selectedFile.value = null;
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value);
      previewUrl.value = null;
    }
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : 'Failed to remove avatar';
  } finally {
    loading.value = false;
  }
}

async function handleSubmit() {
  loading.value = true;
  error.value = null;

  try {
    // Upload avatar first if a new file was selected (updates store directly)
    if (selectedFile.value) {
      await authStore.uploadAvatar(selectedFile.value);
    }

    // Build profile update payload
    const payload: Record<string, string> = {};
    if (
      username.value.trim() &&
      username.value.trim() !== authStore.user?.username
    ) {
      payload.username = username.value.trim();
    }
    if (displayName.value.trim()) {
      payload.name = displayName.value.trim();
    }

    // Only call update if there's something to update
    if (Object.keys(payload).length > 0) {
      await authStore.updateProfile(payload);
    }

    close();
  } catch (err) {
    error.value =
      err instanceof Error ? err.message : 'Failed to update profile';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <dialog
    class="modal"
    :class="{ 'modal-open': open }"
    aria-labelledby="profile-title"
    aria-modal="true"
  >
    <div class="modal-box">
      <h3 id="profile-title" class="font-bold text-lg">Edit Profile</h3>
      <form @submit.prevent="handleSubmit">
        <!-- Avatar -->
        <div class="flex justify-center mt-4">
          <div
            class="cursor-pointer flex flex-col items-center"
            @click="triggerFileInput"
          >
            <UserAvatar
              v-if="!previewUrl"
              :username="authStore.user?.username ?? ''"
              :avatar-url="currentAvatarUrl"
              size="lg"
            />
            <div v-else class="avatar">
              <div class="w-12 h-12 rounded-full">
                <img :src="previewUrl" alt="Preview" class="rounded-full" />
              </div>
            </div>
            <p class="text-xs text-center mt-1 text-base-content/60">
              Click to change
            </p>
            <button
              v-if="currentAvatarUrl && !previewUrl"
              type="button"
              class="btn btn-xs btn-error mt-1"
              :disabled="loading"
              @click.stop="handleDeleteAvatar"
            >
              Remove
            </button>
          </div>
          <input
            ref="fileInput"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            class="hidden"
            @change="handleFileSelect"
          />
        </div>

        <!-- Username -->
        <div class="form-control w-full mt-4">
          <label class="label">
            <span class="label-text">Username</span>
          </label>
          <input
            v-model="username"
            type="text"
            placeholder="Username"
            class="input input-bordered w-full"
          />
        </div>

        <!-- Display Name -->
        <div class="form-control w-full mt-2">
          <label class="label">
            <span class="label-text">Display Name (optional)</span>
          </label>
          <input
            v-model="displayName"
            type="text"
            placeholder="Display name"
            class="input input-bordered w-full"
          />
        </div>

        <div v-if="error" class="alert alert-error mt-4">
          <span>{{ error }}</span>
        </div>

        <div class="modal-action">
          <button type="button" class="btn" @click="close">Cancel</button>
          <button type="submit" class="btn btn-primary" :disabled="loading">
            <span v-if="loading" class="loading loading-spinner"></span>
            Save
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop" @click="close">
      <button type="button">close</button>
    </form>
  </dialog>
</template>
