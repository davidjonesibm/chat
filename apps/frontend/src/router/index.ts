import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '../stores/authStore';
import ChatView from '../views/ChatView.vue';
import LoginView from '../views/LoginView.vue';
import RegisterView from '../views/RegisterView.vue';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: LoginView,
    meta: { guestOnly: true },
  },
  {
    path: '/register',
    name: 'register',
    component: RegisterView,
    meta: { guestOnly: true },
  },
  {
    path: '/',
    name: 'chat',
    component: ChatView,
    meta: { requiresAuth: true },
  },
  {
    path: '/g/:groupId',
    name: 'group',
    component: ChatView,
    meta: { requiresAuth: true },
  },
  {
    path: '/g/:groupId/c/:channelId',
    name: 'channel',
    component: ChatView,
    meta: { requiresAuth: true },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

// Navigation guard
let isFirstNavigation = true;

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();

  // Initialize auth on first navigation to restore session
  if (isFirstNavigation) {
    await authStore.initAuth();
    isFirstNavigation = false;
  }

  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth);
  const guestOnly = to.matched.some((record) => record.meta.guestOnly);

  if (requiresAuth && !authStore.isAuthenticated) {
    // Route requires auth but user is not authenticated
    next('/login');
  } else if (guestOnly && authStore.isAuthenticated) {
    // Route is guest-only but user is authenticated
    next('/');
  } else {
    next();
  }
});

export default router;
