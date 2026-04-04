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
    const redirect = sessionStorage.getItem('postLoginRedirect');
    sessionStorage.removeItem('postLoginRedirect');
    router.push(redirect ?? '/');
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

        <div v-if="error" class="alert alert-error mb-4" role="alert">
          <span>{{ error }}</span>
        </div>

        <form @submit.prevent="handleSubmit">
          <div class="w-full mb-4">
            <label class="label" for="login-email">
              <span>Email</span>
            </label>
            <input
              id="login-email"
              v-model="email"
              type="email"
              placeholder="Enter your email"
              class="input w-full"
              :aria-invalid="!!error"
              required
            />
          </div>

          <div class="w-full mb-4">
            <label class="label" for="login-password">
              <span>Password</span>
            </label>
            <input
              id="login-password"
              v-model="password"
              type="password"
              placeholder="Enter your password"
              class="input w-full"
              aria-describedby="login-password-hint"
              :aria-invalid="!!error"
              minlength="8"
              required
            />
            <p id="login-password-hint" class="sr-only">Minimum 8 characters</p>
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
