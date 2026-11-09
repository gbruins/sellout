import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import DefaultLayout from '../DefaultLayout.vue'
import { stubApi } from '@/test/stubApi'

vi.mock('@/plugins/serviceRealtime', () => ({ getServiceRealtimeClient: () => ({ removeChannel: vi.fn<(...args: never[]) => unknown>() }), setServiceRealtimeToken: vi.fn() }))

const mountLayout = () => {
    const getNext = vi.fn<(...args: never[]) => Promise<unknown>>(async () => ({ status: 'open', server_now: new Date().toISOString(), timezone: null, service: null, next_service: null, remaining: 5 }))
    stubApi({
        service: { getNext, getRealtimeToken: async () => ({ realtime_jwt: null, tenant_id: 't1' }) },
        cart: { credentials: () => ({ id: null, token: null }) },
    })
    const wrapper = mount(DefaultLayout, {
        global: { plugins: [createPinia()], stubs: ['RouterLink'] },
        slots: { default: '<div>Page content</div>' },
    })
    return { wrapper, getNext }
}

describe('DefaultLayout', () => {
    it('renders the slot content, with no home page content of its own', async () => {
        const { wrapper } = mountLayout()
        await flushPromises()

        expect(wrapper.text()).toContain('Page content')
        expect(wrapper.text()).not.toContain('Pizzas remaining')
        wrapper.unmount()
    })

    it('loads the live service status once, so every page gets a real header badge', async () => {
        const { wrapper, getNext } = mountLayout()
        expect(wrapper.get('[data-test="store-badge"]').text()).toBe('Checking…')

        await flushPromises()

        expect(getNext).toHaveBeenCalledTimes(1)
        expect(wrapper.get('[data-test="store-badge"]').text()).toBe('Open now')
        wrapper.unmount()
    })
})
