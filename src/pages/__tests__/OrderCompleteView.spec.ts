import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import OrderCompleteView from '../OrderCompleteView.vue'
import { useServiceStore } from '@/stores/service'

vi.mock('@/utils/serviceStream', () => ({ openServiceStream: vi.fn<() => () => void>(() => vi.fn<() => void>()) }))

describe('OrderCompleteView', () => {
    it('forgets the cart and loads the service state so the header badge is right', async () => {
        const forget = vi.fn<() => void>()
        const getNext = vi.fn<() => Promise<unknown>>(async () => ({
            status: 'open', server_now: new Date().toISOString(), service: null, next_service: null, remaining: 5,
        }))
        const pinia = createPinia()
        const wrapper = mount(OrderCompleteView, {
            global: {
                plugins: [pinia],
                stubs: { RouterLink: true },
                provide: { $api: { cart: { forget }, service: { getNext } } },
            },
        })
        await flushPromises()

        expect(forget).toHaveBeenCalled()
        expect(getNext).toHaveBeenCalled()
        expect(useServiceStore(pinia).status).toBe('open')
        wrapper.unmount()
    })
})
