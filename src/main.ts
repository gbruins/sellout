import './assets/main.css';

import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { i18n } from '@/plugins/i18n';
import apiPlugin from '@/plugins/api';

import App from './App.vue';
import router from './router';

async function bootstrap() {
    const app = createApp(App);

    app.use(createPinia());
    app.use(apiPlugin);
    app.use(router);
    app.use(i18n());

    app.mount('#app');
}

bootstrap().catch(err => console.error(err));
