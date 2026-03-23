import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import type { User, RegisterRequest, LoginRequest } from '@chat/shared';
import pb from '../lib/pocketbase';
import router from '../router';

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null);
  const token = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Computed
  const isAuthenticated = computed(() => !!token.value && !!user.value);

  // Helper to map PocketBase record to User type
  const mapRecordToUser = (record: Record<string, unknown>): User => ({
    id: record.id as string,
    email: record.email as string,
    username: record.username as string,
    avatar: record.avatar as string | undefined,
    createdAt: record.created as string,
    updated: record.updated as string,
  });

  // Actions
  const register = async (data: RegisterRequest): Promise<void> => {
    loading.value = true;
    error.value = null;

    try {
      // Create the user
      await pb.collection('users').create({
        ...data,
        passwordConfirm: data.password,
      });

      // Authenticate with the new credentials
      const authData = await pb
        .collection('users')
        .authWithPassword(data.email, data.password);

      user.value = mapRecordToUser(authData.record);
      token.value = authData.token;
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Registration failed';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const login = async (data: LoginRequest): Promise<void> => {
    loading.value = true;
    error.value = null;

    try {
      const authData = await pb
        .collection('users')
        .authWithPassword(data.email, data.password);

      user.value = mapRecordToUser(authData.record);
      token.value = authData.token;
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Login failed';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const logout = (): void => {
    pb.authStore.clear();
    user.value = null;
    token.value = null;
    error.value = null;
    router.push('/login');
  };

  const initAuth = (): void => {
    if (pb.authStore.isValid && pb.authStore.record) {
      user.value = mapRecordToUser(pb.authStore.record);
      token.value = pb.authStore.token;
    } else {
      pb.authStore.clear();
      user.value = null;
      token.value = null;
    }
  };

  // Subscribe to PocketBase auth changes
  pb.authStore.onChange(() => {
    if (pb.authStore.isValid && pb.authStore.record) {
      user.value = mapRecordToUser(pb.authStore.record);
      token.value = pb.authStore.token;
    } else {
      user.value = null;
      token.value = null;
    }
  });

  return {
    user,
    token,
    loading,
    error,
    isAuthenticated,
    register,
    login,
    logout,
    initAuth,
  };
});
