import './styles.css';
import router from './router';
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './app/App.vue';
import { registerSW } from 'virtual:pwa-register';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#root');

// Register service worker for PWA and push notifications
registerSW({
  onNeedRefresh() {
    console.log('[PWA] New content available, refresh to update.');
  },
  onOfflineReady() {
    console.log('[PWA] App ready for offline use.');
  },
});
