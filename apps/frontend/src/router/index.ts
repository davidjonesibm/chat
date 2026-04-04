import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '../stores/authStore';
import { useChannelStore } from '../stores/channelStore';

const ChatView = () => import('../views/ChatView.vue');
const GroupsView = () => import('../views/GroupsView.vue');
const InviteView = () => import('../views/InviteView.vue');
const LoginView = () => import('../views/LoginView.vue');
const RegisterView = () => import('../views/RegisterView.vue');

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
    name: 'groups',
    component: GroupsView,
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
    path: '/invite/:token',
    name: 'invite',
    component: InviteView,
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
    // Save intended destination for post-login redirect
    sessionStorage.setItem('postLoginRedirect', to.fullPath);
    next('/login');
  } else if (guestOnly && authStore.isAuthenticated) {
    // Route is guest-only but user is authenticated
    next('/');
  } else if (to.name === 'group' || to.name === 'channel') {
    // Group context guard: validate and load group context before ChatView mounts
    const channelStore = useChannelStore();
    const groupId = to.params.groupId as string;

    if (channelStore.groups.length === 0) {
      await channelStore.fetchMyGroups();
    }

    const groupExists = channelStore.groups.some((g) => g.id === groupId);
    if (!groupExists) {
      next('/');
      return;
    }

    if (channelStore.currentGroupId !== groupId) {
      await channelStore.selectGroup(groupId);
    }

    if (to.name === 'channel') {
      const channelId = to.params.channelId as string;
      if (channelStore.currentChannelId !== channelId) {
        await channelStore.selectChannel(channelId);
      }
    }

    next();
  } else {
    next();
  }
});

export default router;
