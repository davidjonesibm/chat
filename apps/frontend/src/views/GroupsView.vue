<script setup lang="ts">
import { ref, onMounted, defineAsyncComponent } from 'vue';
import { useRouter } from 'vue-router';
import { useChannelStore } from '../stores/channelStore';
import { useAuthStore } from '../stores/authStore';
import UserAvatar from '../components/ui/UserAvatar.vue';
import PushToggle from '../components/chat/PushToggle.vue';

const CreateGroupModal = defineAsyncComponent(
  () => import('../components/chat/CreateGroupModal.vue'),
);
const ProfileModal = defineAsyncComponent(
  () => import('../components/chat/ProfileModal.vue'),
);

const router = useRouter();
const channelStore = useChannelStore();
const authStore = useAuthStore();

const showCreateGroup = ref(false);
const showProfile = ref(false);
const loading = ref(false);
const loadingGroupId = ref<string | null>(null);

async function loadGroups() {
  loading.value = true;
  try {
    await channelStore.fetchMyGroups();
  } finally {
    loading.value = false;
  }
}

async function handleSelectGroup(groupId: string) {
  loadingGroupId.value = groupId;
  try {
    await router.push(`/g/${groupId}`);
  } finally {
    loadingGroupId.value = null;
  }
}

function handleGroupCreated() {
  showCreateGroup.value = false;
  // createGroup auto-selects the new group and populates currentGroupId
  if (channelStore.currentGroupId) {
    router.push(`/g/${channelStore.currentGroupId}`);
  }
}

async function handleLogout() {
  await authStore.logout();
  router.push('/login');
}

onMounted(() => {
  loadGroups();
});
</script>

<template>
  <div class="min-h-screen bg-base-200 flex flex-col">
    <!-- Top bar -->
    <header class="navbar bg-base-100 shadow-sm px-4">
      <div class="flex-1">
        <h1 class="text-xl font-bold">My Groups</h1>
      </div>
      <div class="flex-none flex items-center gap-2">
        <button
          class="btn btn-ghost btn-circle"
          aria-label="Edit profile"
          @click="showProfile = true"
        >
          <UserAvatar
            :username="authStore.user?.username ?? ''"
            :avatar-url="authStore.user?.avatar"
            size="sm"
          />
        </button>
        <span class="text-sm font-medium hidden sm:inline">{{
          authStore.user?.username
        }}</span>
        <button class="btn btn-ghost btn-sm" @click="handleLogout">
          Logout
        </button>
      </div>
    </header>

    <!-- Main content -->
    <main
      id="main-content"
      class="flex-1 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full"
    >
      <!-- Loading state -->
      <div v-if="loading" class="flex justify-center items-center py-20">
        <span class="loading loading-spinner loading-lg text-primary"></span>
      </div>

      <!-- Empty state -->
      <div
        v-else-if="channelStore.groups.length === 0"
        class="flex flex-col items-center justify-center py-20 text-center"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-16 w-16 text-base-content/30 mb-4"
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
        <h2 class="text-lg font-semibold mb-1">No groups yet</h2>
        <p class="text-base-content/60 mb-6">
          Create a group to start chatting with your team.
        </p>
        <button class="btn btn-primary" @click="showCreateGroup = true">
          Create Your First Group
        </button>
      </div>

      <!-- Groups grid -->
      <template v-else>
        <div class="flex justify-between items-center mb-6">
          <p class="text-base-content/60">
            {{ channelStore.groups.length }}
            {{ channelStore.groups.length === 1 ? 'group' : 'groups' }}
          </p>
          <button
            class="btn btn-primary btn-sm"
            @click="showCreateGroup = true"
          >
            + Create Group
          </button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            v-for="group in channelStore.groups"
            :key="group.id"
            class="card bg-base-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer text-left"
            :disabled="loadingGroupId !== null"
            @click="handleSelectGroup(group.id)"
          >
            <div class="card-body p-5">
              <div class="flex items-center justify-between gap-2">
                <h2 class="card-title text-base">{{ group.name }}</h2>
                <span
                  v-if="loadingGroupId === group.id"
                  class="loading loading-spinner loading-sm text-primary shrink-0"
                  aria-label="Loading"
                ></span>
              </div>
              <p
                v-if="group.description"
                class="text-sm text-base-content/60 line-clamp-2"
              >
                {{ group.description }}
              </p>
              <p v-else class="text-sm text-base-content/40 italic">
                No description
              </p>
            </div>
          </button>
        </div>
      </template>

      <!-- Push toggle -->
      <div class="mt-8">
        <PushToggle />
      </div>
    </main>

    <!-- Modals -->
    <CreateGroupModal v-model="showCreateGroup" @created="handleGroupCreated" />
    <ProfileModal v-model="showProfile" />
  </div>
</template>
