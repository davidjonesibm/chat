<script setup lang="ts">
import { ref, computed } from 'vue';
import { useAuth } from '../../composables/useAuth';
import { useRouter } from 'vue-router';
import type { RegisterRequest } from '@chat/shared';

const router = useRouter();
const { register, loading, error } = useAuth();

const username = ref('');
const email = ref('');
const password = ref('');
const passwordConfirm = ref('');

const passwordsMatch = computed(() => password.value === passwordConfirm.value);
const passwordError = computed(() => {
  if (passwordConfirm.value && !passwordsMatch.value) {
    return 'Passwords do not match';
  }
  return null;
});

const handleSubmit = async () => {
  if (!passwordsMatch.value) {
    return;
  }

  try {
    const data: RegisterRequest = {
      email: email.value,
      password: password.value,
      username: username.value,
    };
    await register(data);
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
        <h2 class="card-title text-2xl font-bold mb-4">Register</h2>

        <div v-if="error" class="alert alert-error mb-4" role="alert">
          <span>{{ error }}</span>
        </div>

        <div v-if="passwordError" class="alert alert-warning mb-4" role="alert">
          <span>{{ passwordError }}</span>
        </div>

        <form @submit.prevent="handleSubmit">
          <div class="w-full mb-4">
            <label class="label" for="register-username">
              <span>Username</span>
            </label>
            <input
              id="register-username"
              v-model="username"
              type="text"
              placeholder="Choose a username"
              class="input w-full"
              :aria-invalid="!!error"
              required
            />
          </div>

          <div class="w-full mb-4">
            <label class="label" for="register-email">
              <span>Email</span>
            </label>
            <input
              id="register-email"
              v-model="email"
              type="email"
              placeholder="Enter your email"
              class="input w-full"
              :aria-invalid="!!error"
              required
            />
          </div>

          <div class="w-full mb-4">
            <label class="label" for="register-password">
              <span>Password</span>
            </label>
            <input
              id="register-password"
              v-model="password"
              type="password"
              placeholder="Choose a password"
              class="input w-full"
              aria-describedby="register-password-hint"
              :aria-invalid="!!error"
              minlength="8"
              required
            />
            <p
              id="register-password-hint"
              class="text-xs text-base-content/60 mt-1"
            >
              Minimum 8 characters
            </p>
          </div>

          <div class="w-full mb-4">
            <label class="label" for="register-password-confirm">
              <span>Confirm Password</span>
            </label>
            <input
              id="register-password-confirm"
              v-model="passwordConfirm"
              type="password"
              placeholder="Confirm your password"
              class="input w-full"
              :aria-invalid="!!passwordError"
              minlength="8"
              required
            />
          </div>

          <div class="mt-6">
            <button
              type="submit"
              class="btn btn-primary"
              :disabled="loading || !passwordsMatch"
            >
              <span v-if="loading" class="loading loading-spinner"></span>
              {{ loading ? 'Creating account...' : 'Register' }}
            </button>
          </div>
        </form>

        <div class="divider"></div>

        <p class="text-center text-sm">
          Already have an account?
          <router-link to="/login" class="link link-primary">Login</router-link>
        </p>
      </div>
    </div>
  </div>
</template>
