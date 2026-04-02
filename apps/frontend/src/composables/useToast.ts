import { ref } from 'vue';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

// Module-level singleton state — shared across all consumers
const toasts = ref<Toast[]>([]);

let idCounter = 0;

function addToast(
  type: Toast['type'],
  message: string,
  duration?: number,
): void {
  const id = `toast-${++idCounter}-${Date.now()}`;
  const toast: Toast = { id, type, message };
  toasts.value.push(toast);

  const timeout = duration ?? (type === 'error' ? 8000 : 5000);
  setTimeout(() => removeToast(id), timeout);
}

function removeToast(id: string): void {
  const index = toasts.value.findIndex((t) => t.id === id);
  if (index !== -1) {
    toasts.value.splice(index, 1);
  }
}

export function useToast() {
  return { toasts, addToast, removeToast };
}
