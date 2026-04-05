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

// Register service worker for PWA — auto-update on new versions
const updateSW = registerSW({
  onRegistered(registration) {
    if (registration) {
      setInterval(() => registration.update(), 60 * 1000);
    }
  },
  onNeedRefresh() {
    console.log('[PWA] New content available, updating automatically...');
    updateSW(true);
  },
  onOfflineReady() {
    console.log('[PWA] App ready for offline use.');
  },
});
