import { flushPromises, mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'
import UnsubscribePage from '../UnsubscribePage.vue'

describe('UnsubscribePage', () => {
    it('fires the unsubscribe call with the token from the URL on mount and renders the confirmation', async () => {
        const unsubscribe = vi.fn<(token: string) => Promise<unknown>>(async () => ({ unsubscribed: true }))
        const router = createRouter({
            history: createMemoryHistory(),
            routes: [{ path: '/unsubscribe', name: 'unsubscribe', component: UnsubscribePage }],
        })
        router.push('/unsubscribe?token=some-real-token')
        await router.isReady()

        const wrapper = mount(UnsubscribePage, {
            global: {
                plugins: [router],
                provide: { $api: { subscribe: { unsubscribe } } },
            },
        })
        await flushPromises()

        expect(unsubscribe).toHaveBeenCalledWith('some-real-token')
        expect(wrapper.get('[data-test="unsubscribe-confirmation"]').text()).toContain("won't receive any more")
        wrapper.unmount()
    })

    it('still renders the confirmation even with no token in the URL', async () => {
        const unsubscribe = vi.fn<(token: string) => Promise<unknown>>(async () => ({ unsubscribed: true }))
        const router = createRouter({
            history: createMemoryHistory(),
            routes: [{ path: '/unsubscribe', name: 'unsubscribe', component: UnsubscribePage }],
        })
        router.push('/unsubscribe')
        await router.isReady()

        const wrapper = mount(UnsubscribePage, {
            global: {
                plugins: [router],
                provide: { $api: { subscribe: { unsubscribe } } },
            },
        })
        await flushPromises()

        expect(unsubscribe).not.toHaveBeenCalled()
        expect(wrapper.get('[data-test="unsubscribe-confirmation"]').exists()).toBe(true)
        wrapper.unmount()
    })
})
