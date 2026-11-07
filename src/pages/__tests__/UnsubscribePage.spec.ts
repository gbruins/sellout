import { flushPromises, mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'
import UnsubscribePage from '../UnsubscribePage.vue'
import { stubApi } from '@/test/stubApi'

const mountAt = async (url: string, unsubscribe: (token: string) => Promise<unknown>) => {
    stubApi({ subscribe: { unsubscribe } })
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/unsubscribe', component: UnsubscribePage },
            { path: '/', component: { template: '<div />' } },
        ],
    })
    router.push(url)
    await router.isReady()
    const wrapper = mount(UnsubscribePage, { global: { plugins: [router] } })
    await flushPromises()
    return wrapper
}

describe('UnsubscribePage', () => {
    it('unsubscribes with the token from the URL and confirms it', async () => {
        const unsubscribe = vi.fn<(value: string) => Promise<unknown>>(async () => ({ unsubscribed: true }))
        const wrapper = await mountAt('/unsubscribe?token=some-real-token', unsubscribe)

        expect(unsubscribe).toHaveBeenCalledWith('some-real-token')
        expect(wrapper.get('[data-test="unsubscribe-title"]').text()).toBe("You're unsubscribed")
        expect(wrapper.get('[data-test="unsubscribe-body"]').text()).toContain("won't receive any more")
    })

    it('says so when the request fails, instead of claiming success', async () => {
        const wrapper = await mountAt('/unsubscribe?token=bad', async () => { throw new Error('400') })

        expect(wrapper.get('[data-test="unsubscribe-title"]').text()).toBe("We couldn't unsubscribe you")
    })

    it('explains an incomplete link and never calls the API', async () => {
        const unsubscribe = vi.fn<(value: string) => Promise<unknown>>(async () => ({}))
        const wrapper = await mountAt('/unsubscribe', unsubscribe)

        expect(unsubscribe).not.toHaveBeenCalled()
        expect(wrapper.get('[data-test="unsubscribe-title"]').text()).toBe('This unsubscribe link is incomplete')
    })
})
