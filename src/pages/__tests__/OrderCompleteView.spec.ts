import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import OrderCompleteView from '../OrderCompleteView.vue'
import { useServiceStore } from '@/stores/service'

function baseApi(overrides: Record<string, unknown> = {}) {
    const getNext = vi.fn<() => Promise<unknown>>(async () => ({
        status: 'open', server_now: new Date().toISOString(), service: null, next_service: null, remaining: 5,
    }))
    return { service: { getNext }, ...overrides }
}

describe('OrderCompleteView', () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    it('skips polling and cleans up immediately when there are no cart credentials', async () => {
        const forget = vi.fn<() => void>()
        const credentials = vi.fn(() => ({ id: null }))
        const get = vi.fn<() => Promise<unknown>>()
        const pinia = createPinia()

        const wrapper = mount(OrderCompleteView, {
            global: {
                plugins: [pinia],
                stubs: { RouterLink: true },
                provide: { $api: baseApi({ cart: { forget, credentials, get } }) },
            },
        })
        await flushPromises()

        expect(credentials).toHaveBeenCalled()
        expect(get).not.toHaveBeenCalled()
        expect(forget).toHaveBeenCalled()
        expect(useServiceStore(pinia).status).toBe('open')
        wrapper.unmount()
    })

    it('shows the pickup code and receipt email once the cart closes', async () => {
        const forget = vi.fn<() => void>()
        const credentials = vi.fn(() => ({ id: 'cart-1' }))
        const get = vi.fn<() => Promise<unknown>>(async () => ({
            data: { closed_at: new Date().toISOString(), pickup_code: 142, billing_email: 'jane@example.com' },
        }))
        const pinia = createPinia()

        const wrapper = mount(OrderCompleteView, {
            global: {
                plugins: [pinia],
                stubs: { RouterLink: true },
                provide: { $api: baseApi({ cart: { forget, credentials, get } }) },
            },
        })
        await flushPromises()

        expect(get).toHaveBeenCalledTimes(1)
        expect(wrapper.text()).toContain('142')
        expect(wrapper.text()).toContain('jane@example.com')
        expect(forget).toHaveBeenCalled()
        wrapper.unmount()
    })

    it('falls back to a generic message if the cart never closes within the poll timeout', async () => {
        vi.useFakeTimers()

        const forget = vi.fn<() => void>()
        const credentials = vi.fn(() => ({ id: 'cart-1' }))
        const get = vi.fn<() => Promise<unknown>>(async () => ({
            data: { closed_at: null, pickup_code: null, billing_email: null },
        }))
        const pinia = createPinia()

        const wrapper = mount(OrderCompleteView, {
            global: {
                plugins: [pinia],
                stubs: { RouterLink: true },
                provide: { $api: baseApi({ cart: { forget, credentials, get } }) },
            },
        })

        for(let i = 0; i < 14; i++) {
            await vi.advanceTimersByTimeAsync(1500)
        }
        await flushPromises()

        expect(get.mock.calls.length).toBeGreaterThan(1)
        expect(wrapper.text()).not.toContain('Your pickup code')
        expect(wrapper.text()).toContain('Thank you for your order!')
        expect(forget).toHaveBeenCalled()
        wrapper.unmount()
    })
})
