import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { registerSW } from 'virtual:pwa-register';
import App from '@/app/App.vue';
import { router } from '@/router';
import '@/styles/main.css';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
app.mount('#app');

if (import.meta.env.PROD) {
  registerSW({ immediate: true });
}
