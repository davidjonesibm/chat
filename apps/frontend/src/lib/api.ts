import { useAuthStore } from '../stores/authStore';
import { useToast } from '../composables/useToast';
import router from '../router';

const MAX_RETRIES = 3;
const BACKOFF_MS = [1000, 2000, 4000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function apiFetch<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const authStore = useAuthStore();
  const { addToast } = useToast();

  const headers = new Headers(options?.headers);
  if (!headers.has('Content-Type') && options?.body != null) {
    headers.set('Content-Type', 'application/json');
  }
  if (authStore.token) {
    headers.set('Authorization', `Bearer ${authStore.token}`);
  }

  const mergedOptions: RequestInit = { ...options, headers };

  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, mergedOptions);

      if (response.ok) {
        if (response.status === 204) {
          return undefined as T;
        }
        return (await response.json()) as T;
      }

      // 401 — sign out and redirect
      if (response.status === 401) {
        await authStore.logout();
        await router.push('/login');
        throw new Error('Session expired. Please log in again.');
      }

      // 4xx (non-401) — do not retry
      if (response.status >= 400 && response.status < 500) {
        let message = `Request failed: ${response.statusText}`;
        try {
          const body = await response.json();
          if (body && typeof body.message === 'string') {
            message = body.message;
          }
        } catch {
          // response body not JSON — keep default message
        }
        addToast('error', message);
        throw new Error(message);
      }

      // 5xx — retry
      lastError = new Error(
        `Server error ${response.status}: ${response.statusText}`,
      );
    } catch (err) {
      // Network error (TypeError from fetch) — retry
      if (err instanceof TypeError) {
        lastError = new Error('Network error. Check your connection.');
      } else {
        // Re-throw non-retryable errors (4xx, 401, etc.)
        throw err;
      }
    }

    // Wait before retry (skip wait on last attempt that will throw)
    if (attempt < MAX_RETRIES) {
      await sleep(BACKOFF_MS[attempt]);
    }
  }

  // All retries exhausted
  let message =
    lastError instanceof Error ? lastError.message : 'Request failed';
  if (
    lastError instanceof Error &&
    lastError.message.startsWith('Server error')
  ) {
    message = 'Server is unreachable. Please try again later.';
  }
  addToast('error', message);
  throw lastError;
}
