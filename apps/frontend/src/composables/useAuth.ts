import { useAuthStore } from '../stores/authStore';
import { storeToRefs } from 'pinia';

export function useAuth() {
  const store = useAuthStore();
  const { user, isAuthenticated, loading, error } = storeToRefs(store);

  return {
    user,
    isAuthenticated,
    loading,
    error,
    login: store.login,
    register: store.register,
    logout: store.logout,
  };
}
