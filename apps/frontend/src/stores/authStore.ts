import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import type {
  User,
  RegisterRequest,
  LoginRequest,
  UpdateProfileRequest,
  UpdateProfileResponse,
  AvatarUploadResponse,
} from '@chat/shared';
import { apiFetch } from '../lib/api';
import type { User as SupabaseUser, Subscription } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import router from '../router';

interface MapUserDefaults {
  username?: string;
  created_at?: string;
  updated_at?: string;
}

function mapSupabaseUser(
  supaUser: SupabaseUser,
  defaults?: MapUserDefaults,
): User {
  if (!supaUser.email) throw new Error('User email is missing');
  return {
    id: supaUser.id,
    email: supaUser.email,
    username: supaUser.user_metadata?.username ?? defaults?.username ?? '',
    avatar: (supaUser.user_metadata?.avatar as string) || '',
    created_at: supaUser.created_at ?? defaults?.created_at ?? '',
    updated_at: supaUser.updated_at ?? defaults?.updated_at ?? '',
  };
}

let authSubscription: Subscription | null = null;

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null);
  const token = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Computed
  const isAuthenticated = computed(() => !!token.value && !!user.value);

  // Actions
  const register = async (data: RegisterRequest): Promise<void> => {
    loading.value = true;
    error.value = null;

    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp(
        {
          email: data.email,
          password: data.password,
          options: {
            data: {
              username: data.username,
            },
          },
        },
      );

      if (signUpError) throw signUpError;

      // After signUp with email confirm disabled (local dev), session is immediately available
      if (authData.session && authData.user) {
        token.value = authData.session.access_token;
        const now = new Date().toISOString();
        user.value = mapSupabaseUser(authData.user, {
          username: data.username,
          created_at: now,
          updated_at: now,
        });
      }
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
      const { data: authData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });

      if (signInError) throw signInError;

      // Store token and user
      token.value = authData.session.access_token;
      user.value = mapSupabaseUser(authData.user);
    } catch (err: unknown) {
      error.value = err instanceof Error ? err.message : 'Login failed';
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      user.value = null;
      token.value = null;
      error.value = null;
      router.push('/login');
    }
  };

  const initAuth = async (): Promise<void> => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session && session.user) {
        token.value = session.access_token;
        user.value = mapSupabaseUser(session.user);
      }

      // Set up auth state change listener for automatic token refresh
      authSubscription?.unsubscribe();
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session && session.user) {
          token.value = session.access_token;
          user.value = mapSupabaseUser(session.user);
        } else {
          token.value = null;
          user.value = null;
        }
      });
      authSubscription = subscription;
    } catch (err) {
      console.error('Init auth error:', err);
      user.value = null;
      token.value = null;
    }
  };

  const baseUrl = import.meta.env.VITE_API_URL || window.location.origin;

  const updateProfile = async (data: UpdateProfileRequest): Promise<void> => {
    const response = await apiFetch<UpdateProfileResponse>(
      `${baseUrl}/api/auth/profile`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      },
    );
    user.value = response.user;
  };

  const uploadAvatar = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('avatar', file);

    const headers: Record<string, string> = {};
    if (token.value) {
      headers['Authorization'] = `Bearer ${token.value}`;
    }

    const response = await fetch(`${baseUrl}/api/auth/avatar`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Avatar upload failed: ${response.statusText}`);
    }

    const data = (await response.json()) as AvatarUploadResponse;
    if (user.value) {
      user.value = { ...user.value, avatar: data.url };
    }
    return data.url;
  };

  const deleteAvatar = async (): Promise<void> => {
    const response = await apiFetch<UpdateProfileResponse>(
      `${baseUrl}/api/auth/avatar`,
      {
        method: 'DELETE',
      },
    );
    user.value = response.user;
  };

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
    updateProfile,
    uploadAvatar,
    deleteAvatar,
  };
});
