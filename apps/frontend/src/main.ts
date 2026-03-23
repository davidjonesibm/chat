import './styles.css';
import router from './router';
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './app/App.vue';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#root');
