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
import { supabase } from '../lib/supabase';
import router from '../router';

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
        if (!authData.user.email)
          throw new Error('User email is missing from registration response');
        token.value = authData.session.access_token;
        user.value = {
          id: authData.user.id,
          email: authData.user.email,
          username: authData.user.user_metadata?.username ?? data.username,
          avatar: (authData.user.user_metadata?.avatar as string) || '',
          created_at: authData.user.created_at ?? new Date().toISOString(),
          updated_at: authData.user.updated_at ?? new Date().toISOString(),
        };
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
      if (!authData.user.email)
        throw new Error('User email is missing from login response');
      token.value = authData.session.access_token;
      user.value = {
        id: authData.user.id,
        email: authData.user.email,
        username: authData.user.user_metadata?.username ?? '',
        avatar: (authData.user.user_metadata?.avatar as string) || '',
        created_at: authData.user.created_at ?? '',
        updated_at: authData.user.updated_at ?? '',
      };
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
        if (!session.user.email)
          throw new Error('User email is missing from session');
        token.value = session.access_token;
        user.value = {
          id: session.user.id,
          email: session.user.email,
          username: session.user.user_metadata?.username ?? '',
          avatar: (session.user.user_metadata?.avatar as string) || '',
          created_at: session.user.created_at ?? '',
          updated_at: session.user.updated_at ?? '',
        };
      }

      // Set up auth state change listener for automatic token refresh
      supabase.auth.onAuthStateChange((_event, session) => {
        if (session && session.user) {
          if (!session.user.email)
            throw new Error('User email is missing from session');
          token.value = session.access_token;
          user.value = {
            id: session.user.id,
            email: session.user.email,
            username: session.user.user_metadata?.username ?? '',
            avatar: (session.user.user_metadata?.avatar as string) || '',
            created_at: session.user.created_at ?? '',
            updated_at: session.user.updated_at ?? '',
          };
        } else {
          token.value = null;
          user.value = null;
        }
      });
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
