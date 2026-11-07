import { createRouter, createWebHistory } from 'vue-router'
import { i18n } from '@/plugins/i18n'

declare module 'vue-router' {
    interface RouteMeta {
        // i18n key for the browser tab title
        titleKey?: string
    }
}

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            name: 'home',
            component: () => import('@/pages/HomeView.vue'),
            meta: { titleKey: 'titles.home' },
        },
        {
            path: '/cart',
            name: 'cart',
            component: () => import('@/pages/CartView.vue'),
            meta: { titleKey: 'titles.cart' },
        },
        {
            path: '/order/complete',
            name: 'order-complete',
            component: () => import('@/pages/OrderCompleteView.vue'),
            meta: { titleKey: 'titles.orderComplete' },
        },
        {
            path: '/about',
            name: 'about',
            component: () => import('@/pages/AboutView.vue'),
            meta: { titleKey: 'titles.about' },
        },
        {
            path: '/unsubscribe',
            name: 'unsubscribe',
            component: () => import('@/pages/UnsubscribePage.vue'),
            meta: { titleKey: 'titles.unsubscribe' },
        },
        {
            path: '/:pathMatch(.*)*',
            name: 'not-found',
            component: () => import('@/pages/NotFoundView.vue'),
            meta: { titleKey: 'titles.notFound' },
        },
    ],
    scrollBehavior(to, _from, savedPosition) {
        return savedPosition ?? (to.hash ? { el: to.hash } : { top: 0 })
    },
})

router.afterEach((to) => {
    const { t } = i18n.global
    document.title = to.meta.titleKey ? `${t(to.meta.titleKey)} · ${t('app.name')}` : t('app.name')
})

export default router
