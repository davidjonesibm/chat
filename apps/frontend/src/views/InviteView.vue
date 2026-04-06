<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useChannelStore } from '../stores/channelStore';
import { useToast } from '../composables/useToast';
import type { InviteInfoResponse } from '@chat/shared';

type ViewState = 'loading' | 'preview' | 'already-member' | 'error';

const route = useRoute();
const router = useRouter();
const channelStore = useChannelStore();
const { addToast } = useToast();

const state = ref<ViewState>('loading');
const inviteInfo = ref<InviteInfoResponse | null>(null);
const joining = ref(false);

const token = route.params.token as string;

function formatExpiry(expiresAt: string): string {
  const date = new Date(expiresAt);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  if (diffMs <= 0) return 'Expired';
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return 'Expires in less than an hour';
  if (diffHours < 24)
    return `Expires in ${diffHours} hour${diffHours === 1 ? '' : 's'}`;
  const diffDays = Math.floor(diffHours / 24);
  return `Expires in ${diffDays} day${diffDays === 1 ? '' : 's'}`;
}

async function loadInviteInfo() {
  state.value = 'loading';
  try {
    inviteInfo.value = await channelStore.getInviteInfo(token);
    state.value = inviteInfo.value.alreadyMember ? 'already-member' : 'preview';
  } catch {
    state.value = 'error';
  }
}

async function handleJoin() {
  joining.value = true;
  try {
    const result = await channelStore.joinViaInvite(token);
    router.push({ name: 'group', params: { groupId: result.group.id } });
  } catch (err) {
    const message = err instanceof Error ? err.message.toLowerCase() : '';
    if (message.includes('already')) {
      state.value = 'already-member';
    } else if (
      message.includes('not found') ||
      message.includes('expired') ||
      message.includes('invalid')
    ) {
      state.value = 'error';
    }
    // Other errors: toast is already shown by apiFetch
  } finally {
    joining.value = false;
  }
}

function goToGroup() {
  if (inviteInfo.value) {
    router.push({
      name: 'group',
      params: { groupId: inviteInfo.value.groupId },
    });
  }
}

onMounted(() => {
  loadInviteInfo();
});
</script>

<template>
  <div
    class="min-h-[100dvh] bg-base-200 flex items-center justify-center px-4 pt-safe-or-4 pb-safe-or-4"
  >
    <!-- Loading -->
    <div v-if="state === 'loading'" class="flex flex-col items-center gap-4">
      <span class="loading loading-spinner loading-lg text-primary"></span>
      <p class="text-base-content/60">Loading invite…</p>
    </div>

    <!-- Preview -->
    <div
      v-else-if="state === 'preview' && inviteInfo"
      class="card w-full max-w-md bg-base-100 shadow-xl"
    >
      <div class="card-body items-center text-center">
        <!-- Group icon -->
        <div
          class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-8 w-8 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
            />
          </svg>
        </div>

        <p class="text-sm text-base-content/60">
          <span class="font-medium">{{ inviteInfo.inviterName }}</span> invited
          you to join
        </p>

        <h2 class="card-title text-2xl mt-1">{{ inviteInfo.groupName }}</h2>

        <p
          v-if="inviteInfo.groupDescription"
          class="text-base-content/60 text-sm mt-1"
        >
          {{ inviteInfo.groupDescription }}
        </p>

        <div class="flex items-center gap-4 text-sm text-base-content/50 mt-3">
          <span
            >{{ inviteInfo.memberCount }}
            {{ inviteInfo.memberCount === 1 ? 'member' : 'members' }}</span
          >
          <span>·</span>
          <span>{{ formatExpiry(inviteInfo.expiresAt) }}</span>
        </div>

        <div class="card-actions mt-6 w-full">
          <button
            class="btn btn-primary btn-block"
            :disabled="joining"
            @click="handleJoin"
          >
            <span
              v-if="joining"
              class="loading loading-spinner loading-sm"
            ></span>
            {{ joining ? 'Joining…' : `Join ${inviteInfo.groupName}` }}
          </button>
        </div>
      </div>
    </div>

    <!-- Already member -->
    <div
      v-else-if="state === 'already-member' && inviteInfo"
      class="card w-full max-w-md bg-base-100 shadow-xl"
    >
      <div class="card-body items-center text-center">
        <div
          class="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-8 w-8 text-success"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <h2 class="card-title text-xl">You're already in this group</h2>
        <p class="text-base-content/60 text-sm mt-1">
          You're a member of
          <span class="font-medium">{{ inviteInfo.groupName }}</span
          >.
        </p>

        <div class="card-actions mt-6 w-full">
          <button class="btn btn-primary btn-block" @click="goToGroup">
            Go to {{ inviteInfo.groupName }}
          </button>
        </div>
      </div>
    </div>

    <!-- Error -->
    <div
      v-else-if="state === 'error'"
      class="card w-full max-w-md bg-base-100 shadow-xl"
    >
      <div class="card-body items-center text-center">
        <div
          class="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center mb-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-8 w-8 text-error"
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
        </div>

        <h2 class="card-title text-xl">Invalid Invite</h2>
        <p class="text-base-content/60 text-sm mt-1">
          This invite link has expired or is invalid.
        </p>

        <div class="card-actions mt-6 w-full">
          <router-link to="/" class="btn btn-ghost btn-block">
            Go to My Groups
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>
