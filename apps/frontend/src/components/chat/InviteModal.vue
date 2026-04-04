<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { GroupInvite } from '@chat/shared';
import { useChannelStore } from '../../stores/channelStore';
import { useToast } from '../../composables/useToast';

const props = defineProps<{
  groupId: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const channelStore = useChannelStore();
const { addToast } = useToast();

const invite = ref<GroupInvite | null>(null);
const inviteUrl = ref('');
const loading = ref(false);
const copied = ref(false);
let copiedTimeout: ReturnType<typeof setTimeout> | undefined;

const canShare = computed(
  () => typeof navigator !== 'undefined' && !!navigator.share,
);

const expiryLabel = computed(() => {
  if (!invite.value) return '';
  const now = Date.now();
  const expiresAt = new Date(invite.value.expires_at).getTime();
  const diffMs = expiresAt - now;
  if (diffMs <= 0) return 'Expired';
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 1) return 'Expires in 1 day';
  return `Expires in ${diffDays} days`;
});

async function loadOrCreateInvite() {
  loading.value = true;
  try {
    const existing = await channelStore.listInvites(props.groupId);
    if (existing.length > 0) {
      invite.value = existing[0];
      inviteUrl.value = `${window.location.origin}/invite/${existing[0].token}`;
    } else {
      const result = await channelStore.createInvite(props.groupId);
      invite.value = result.invite;
      inviteUrl.value = `${window.location.origin}/invite/${result.invite.token}`;
    }
  } catch {
    addToast('error', 'Failed to load invite link');
  } finally {
    loading.value = false;
  }
}

async function handleCopy() {
  try {
    await navigator.clipboard.writeText(inviteUrl.value);
    copied.value = true;
    copiedTimeout = setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    addToast('error', 'Failed to copy link');
  }
}

async function handleShare() {
  try {
    await navigator.share({
      title: 'Join my group',
      url: inviteUrl.value,
    });
  } catch (err) {
    // User cancelled the share dialog — not an error
    if (err instanceof Error && err.name === 'AbortError') return;
  }
}

async function handleRevokeAndRegenerate() {
  if (!invite.value) return;
  loading.value = true;
  try {
    await channelStore.revokeInvite(invite.value.token);
    const result = await channelStore.createInvite(props.groupId);
    invite.value = result.invite;
    inviteUrl.value = `${window.location.origin}/invite/${result.invite.token}`;
    addToast('success', 'Invite link regenerated');
  } catch {
    addToast('error', 'Failed to regenerate invite link');
  } finally {
    loading.value = false;
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    emit('close');
  }
}

onMounted(() => {
  loadOrCreateInvite();
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  if (copiedTimeout) clearTimeout(copiedTimeout);
});
</script>

<template>
  <dialog
    class="modal modal-open"
    aria-labelledby="invite-modal-title"
    aria-modal="true"
  >
    <div class="modal-box">
      <h3 id="invite-modal-title" class="font-bold text-lg">Invite People</h3>

      <!-- Loading state -->
      <div v-if="loading" class="flex justify-center py-8">
        <span class="loading loading-spinner loading-lg"></span>
      </div>

      <!-- Invite link display -->
      <template v-else-if="invite">
        <p class="text-base-content/60 text-sm mt-2">
          Share this link to invite others to the group.
        </p>

        <div class="form-control w-full mt-4">
          <label class="label">
            <span class="label-text">Invite Link</span>
          </label>
          <input
            :value="inviteUrl"
            type="text"
            class="input input-bordered w-full"
            readonly
            @focus="($event.target as HTMLInputElement).select()"
          />
          <label class="label">
            <span class="label-text-alt text-base-content/60">{{
              expiryLabel
            }}</span>
          </label>
        </div>

        <div class="flex flex-wrap gap-2 mt-2">
          <button class="btn btn-primary btn-sm" @click="handleCopy">
            {{ copied ? 'Copied!' : 'Copy Link' }}
          </button>
          <button
            v-if="canShare"
            class="btn btn-secondary btn-sm"
            @click="handleShare"
          >
            Share
          </button>
          <button
            class="btn btn-ghost btn-sm"
            :disabled="loading"
            @click="handleRevokeAndRegenerate"
          >
            Revoke &amp; Regenerate
          </button>
        </div>
      </template>

      <div class="modal-action">
        <button class="btn" @click="emit('close')">Close</button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @click="emit('close')">
      <button type="button">close</button>
    </form>
  </dialog>
</template>
