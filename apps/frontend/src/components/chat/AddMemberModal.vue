<script setup lang="ts">
import { ref, useTemplateRef, watch, nextTick } from 'vue';
import { useChannelStore } from '../../stores/channelStore';

const props = defineProps<{
  groupId: string;
}>();

const open = defineModel<boolean>({ required: true });

const emit = defineEmits<{
  added: [];
}>();

const channelStore = useChannelStore();

const userId = ref('');
const loading = ref(false);
const error = ref<string | null>(null);
const userIdInput = useTemplateRef<HTMLInputElement>('userIdInput');

// Reset form when modal opens
watch(open, (isOpen) => {
  if (isOpen) {
    userId.value = '';
    error.value = null;
    nextTick(() => userIdInput.value?.focus());
  }
});

function close() {
  open.value = false;
}

async function handleSubmit() {
  if (!userId.value.trim()) {
    error.value = 'User ID is required';
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    await channelStore.addMember(props.groupId, userId.value.trim());
    emit('added');
    close();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to add member';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <dialog
    class="modal"
    :class="{ 'modal-open': open }"
    aria-labelledby="add-member-title"
    aria-modal="true"
  >
    <div class="modal-box">
      <h3 id="add-member-title" class="font-bold text-lg">
        Add Member to Group
      </h3>
      <form @submit.prevent="handleSubmit">
        <div class="form-control w-full mt-4">
          <label class="label">
            <span class="label-text">User ID</span>
          </label>
          <input
            ref="userIdInput"
            v-model="userId"
            type="text"
            placeholder="Enter user ID"
            class="input input-bordered w-full"
            required
          />
          <label class="label">
            <span class="label-text-alt text-base-content/60"
              >Enter the ID of the user you want to add</span
            >
          </label>
        </div>

        <div v-if="error" class="alert alert-error mt-4">
          <span>{{ error }}</span>
        </div>

        <div class="modal-action">
          <button type="button" class="btn" @click="close">Cancel</button>
          <button type="submit" class="btn btn-primary" :disabled="loading">
            <span v-if="loading" class="loading loading-spinner"></span>
            Add Member
          </button>
        </div>
      </form>
    </div>
    <form method="dialog" class="modal-backdrop" @click="close">
      <button type="button">close</button>
    </form>
  </dialog>
</template>
