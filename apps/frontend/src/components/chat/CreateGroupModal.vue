<script setup lang="ts">
import { ref, useTemplateRef, watch, nextTick } from 'vue';
import { useChannelStore } from '../../stores/channelStore';

const open = defineModel<boolean>({ required: true });

const emit = defineEmits<{
  created: [];
}>();

const channelStore = useChannelStore();

const name = ref('');
const description = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const nameInput = useTemplateRef<HTMLInputElement>('nameInput');

// Reset form when modal opens
watch(open, (isOpen) => {
  if (isOpen) {
    name.value = '';
    description.value = '';
    error.value = null;
    nextTick(() => nameInput.value?.focus());
  }
});

function close() {
  open.value = false;
}

async function handleSubmit() {
  if (!name.value.trim()) {
    error.value = 'Group name is required';
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    await channelStore.createGroup(name.value.trim(), description.value.trim());
    emit('created');
    close();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to create group';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <dialog
    class="modal"
    :class="{ 'modal-open': open }"
    aria-labelledby="create-group-title"
    aria-modal="true"
  >
    <div class="modal-box">
      <h3 id="create-group-title" class="font-bold text-lg">Create Group</h3>
      <form @submit.prevent="handleSubmit">
        <div class="form-control w-full mt-4">
          <label class="label">
            <span class="label-text">Group Name</span>
          </label>
          <input
            ref="nameInput"
            v-model="name"
            type="text"
            placeholder="e.g. My Team"
            class="input input-bordered w-full"
            required
          />
        </div>

        <div class="form-control w-full mt-2">
          <label class="label">
            <span class="label-text">Description (optional)</span>
          </label>
          <input
            v-model="description"
            type="text"
            placeholder="What's this group about?"
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
            Create
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop" @click="close">
      <button type="button">close</button>
    </form>
  </dialog>
</template>
