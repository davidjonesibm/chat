<script setup lang="ts">
import { ref } from 'vue';
import { useAuth } from '../../composables/useAuth';
import { useRouter } from 'vue-router';
import type { LoginRequest } from '@chat/shared';

const router = useRouter();
const { login, loading, error } = useAuth();

const email = ref('');
const password = ref('');

const handleSubmit = async () => {
  try {
    const data: LoginRequest = {
      email: email.value,
      password: password.value,
    };
    await login(data);
    router.push('/');
  } catch (err) {
    // Error is handled by the store
  }
};
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-base-200">
    <div class="card w-96 bg-base-100 shadow-xl">
      <div class="card-body">
        <h2 class="card-title text-2xl font-bold mb-4">Login</h2>

        <div v-if="error" class="alert alert-error mb-4">
          <span>{{ error }}</span>
        </div>

        <form @submit.prevent="handleSubmit">
          <div class="w-full mb-4">
            <label class="label">
              <span>Email</span>
            </label>
            <input
              v-model="email"
              type="email"
              placeholder="Enter your email"
              class="input w-full"
              required
            />
          </div>

          <div class="w-full mb-4">
            <label class="label">
              <span>Password</span>
            </label>
            <input
              v-model="password"
              type="password"
              placeholder="Enter your password"
              class="input w-full"
              minlength="8"
              required
            />
          </div>

          <div class="mt-6">
            <button type="submit" class="btn btn-primary" :disabled="loading">
              <span v-if="loading" class="loading loading-spinner"></span>
              {{ loading ? 'Logging in...' : 'Login' }}
            </button>
          </div>
        </form>

        <div class="divider"></div>

        <p class="text-center text-sm">
          Don't have an account?
          <router-link to="/register" class="link link-primary"
            >Register</router-link
          >
        </p>
      </div>
    </div>
  </div>
</template>
