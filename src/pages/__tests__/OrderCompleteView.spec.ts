import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import OrderCompleteView from '../OrderCompleteView.vue'
import { POLL_INTERVAL_MS, SLOW_AFTER_MS } from '@/composables/useOrderConfirmation'
import { stubApi } from '@/test/stubApi'

let query: Record<string, string> = {}
vi.mock('vue-router', () => ({ useRoute: () => ({ query }), RouterLink: { template: '<a><slot /></a>' } }))

const complete = {
    status: 'complete' as const,
    pickup_code: 142,
    billing_email: 'jane@example.com',
    items: [{ id: 'i1', title: 'Margherita', qty: 2, price_subtotal: 4400 }],
    price_subtotal: 4400,
    sales_tax: 396,
    grand_total: 4796,
}

const mountPage = (confirmation: (sessionId: string) => Promise<unknown>, closedAt: string | null = '2026-11-07T20:00:00.000Z') => {
    setActivePinia(createPinia())
    const forget = vi.fn<(...args: never[]) => unknown>()
    const confirm = vi.fn<(sessionId: string) => Promise<unknown>>(confirmation)
    stubApi({
        orders: { confirmation: confirm },
        cart: { credentials: () => ({ id: 'cart-1', token: 't' }), get: async () => ({ data: { id: 'cart-1', closed_at: closedAt, cart_items: [] } }), forget },
    })
    const wrapper = mount(OrderCompleteView)
    return { wrapper, confirm, forget }
}

describe('OrderCompleteView', () => {
    afterEach(() => {
        vi.useRealTimers()
        query = {}
    })

    it('says the order could not be found when there is no session id, and never claims payment', async () => {
        const { wrapper, confirm } = mountPage(async () => complete)
        await flushPromises()

        expect(confirm).not.toHaveBeenCalled()
        expect(wrapper.text()).toContain("We couldn't find that order")
        expect(wrapper.text()).not.toContain('payment was received')
    })

    it('shows the pickup code, order contents and receipt email, then forgets the closed cart', async () => {
        query = { session_id: 'cs_test_1' }
        const { wrapper, confirm, forget } = mountPage(async () => complete)
        await flushPromises()

        expect(confirm).toHaveBeenCalledWith('cs_test_1')
        expect(wrapper.get('[data-test="pickup-code"]').text()).toBe('142')
        expect(wrapper.get('[data-test="order-items"]').text()).toContain('2 × Margherita')
        expect(wrapper.get('[data-test="order-total"]').text()).toBe('47.96')
        expect(wrapper.text()).toContain('jane@example.com')
        expect(forget).toHaveBeenCalled()
    })

    it('keeps a newer, still-open cart', async () => {
        query = { session_id: 'cs_test_1' }
        const { forget } = mountPage(async () => complete, null)
        await flushPromises()

        expect(forget).not.toHaveBeenCalled()
    })

    it('keeps polling while pending, tells the customer when it is slow, then shows the code', async () => {
        vi.useFakeTimers()
        query = { session_id: 'cs_test_1' }
        let paid = false
        const { wrapper, confirm } = mountPage(async () => (paid ? complete : { status: 'pending' }))
        await flushPromises()
        expect(wrapper.text()).toContain('Confirming your order')

        await vi.advanceTimersByTimeAsync(SLOW_AFTER_MS + POLL_INTERVAL_MS)
        expect(wrapper.text()).toContain('Still confirming your payment')
        expect(wrapper.text()).not.toContain('payment was received')

        paid = true
        await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS)
        await flushPromises()
        expect(confirm.mock.calls.length).toBeGreaterThan(2)
        expect(wrapper.get('[data-test="pickup-code"]').text()).toBe('142')
    })

    it('reports an unknown session instead of polling forever', async () => {
        query = { session_id: 'cs_test_gone' }
        const { wrapper, confirm } = mountPage(async () => { throw { response: { status: 404 } } })
        await flushPromises()

        expect(confirm).toHaveBeenCalledTimes(1)
        expect(wrapper.text()).toContain("We couldn't find that order")
    })
})
