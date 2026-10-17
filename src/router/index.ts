import { createRouter, createWebHistory } from 'vue-router';

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            name: 'home',
            component: () => import('@/pages/HomeView.vue'),
        },
        {
            path: '/cart',
            name: 'cart',
            component: () => import('@/pages/CartView.vue'),
        },
        {
            path: '/order/complete',
            name: 'order-complete',
            component: () => import('@/pages/OrderCompleteView.vue'),
        },
        {
            path: '/about',
            name: 'about',
            component: () => import('@/pages/AboutView.vue'),
        },
    ],
})

export default router
