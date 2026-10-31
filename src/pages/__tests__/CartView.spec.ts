import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import CartView from '../CartView.vue'
import { useCartStore } from '@/stores/cart'

vi.mock('@/utils/serviceStream', () => ({ openServiceStream: vi.fn<() => () => void>(() => vi.fn<() => void>()) }))

const mountCheckout = vi.fn()
const destroyCheckout = vi.fn()
vi.mock('@stripe/stripe-js', () => ({
    loadStripe: vi.fn(async () => ({
        createEmbeddedCheckoutPage: vi.fn(async () => ({ mount: mountCheckout, unmount: vi.fn(), destroy: destroyCheckout })),
    })),
}))

const line = { id: 'l1', qty: 1, price_subtotal: 1400, product: { id: 'p1', title: 'Margherita', base_price: 1400 } }
const cartData = (extra: Record<string, unknown> = {}) => ({
    id: 'c1', num_items: 1, price_subtotal: 1400, grand_total: 1400, customer_note: null,
    checkout_in_progress: false, cart_items: [line], ...extra,
})
const serviceState = (status: string) => ({ status, server_now: new Date().toISOString(), service: null, next_service: null, remaining: 5 })

type Fn = (...args: unknown[]) => unknown
const mountView = (cart: Record<string, Fn>, status = 'open') => {
    const pinia = createPinia()
    const wrapper = mount(CartView, {
        global: {
            plugins: [pinia],
            stubs: { RouterLink: true },
            provide: { $api: { cart: { credentials: () => ({ id: 'c1' }), ...cart }, service: { getNext: async () => serviceState(status) } } },
        },
    })
    return { wrapper, pinia }
}

describe('CartView', () => {
    it('shows the locked state, mounts the embedded form, and no edits', async () => {
        const cancelCheckout = vi.fn<Fn>(async () => ({}))
        const checkout = vi.fn<Fn>(async () => ({ data: { client_secret: 'cs_test_x_secret_y' } }))
        const { wrapper } = mountView({ get: async () => ({ data: cartData({ checkout_in_progress: true }) }), cancelCheckout, checkout })
        await flushPromises()
        // Already locked on arrival (e.g. a page reload) — the component fetches the existing
        // session's client_secret on its own, with no click required, and mounts the form.
        expect(checkout).toHaveBeenCalled()
        expect(mountCheckout).toHaveBeenCalledWith('#embedded-checkout-container')
        expect(wrapper.find('[data-test=locked]').text()).toContain('finish paying')
        expect(wrapper.find('[data-test=remove]').exists()).toBe(false)
        expect(wrapper.find('[data-test=pay]').exists()).toBe(false)
        await wrapper.find('[data-test=cancel]').trigger('click')
        await flushPromises()
        expect(cancelCheckout).toHaveBeenCalled()
        expect(destroyCheckout).toHaveBeenCalled()
    })

    it('highlights the unavailable pizza, never leaves for Stripe, and lets the visitor remove it', async () => {
        const err = { response: { status: 409, data: { message: 'x', data: { code: 'item_unavailable', product_id: 'p1', title: 'Margherita' } } } }
        const { wrapper } = mountView({ get: async () => ({ data: cartData() }), checkout: async () => { throw err }, removeItem: vi.fn<Fn>(async () => ({})) })
        await flushPromises()
        await wrapper.find('[data-test=pay]').trigger('click')
        await flushPromises()
        expect(wrapper.find('[data-test=cart-error]').text()).toContain('"Margherita" is no longer available')
        expect(wrapper.find('[data-test=cart-line]').classes().join(' ')).toContain('border-destructive')
        expect(wrapper.find('[data-test=remove]').exists()).toBe(true)
    })

    it.each([['sold_out', 'sold out'], ['upcoming', 'not open'], ['none', 'not open']])('disables Pay when %s', async (status, text) => {
        const { wrapper } = mountView({ get: async () => ({ data: cartData() }) }, status)
        await flushPromises()
        expect((wrapper.find('[data-test=pay]').element as HTMLButtonElement).disabled).toBe(true)
        expect(wrapper.find('[data-test=closed-reason]').text()).toContain(text)
    })

    it('offers Retry on a network error and keeps the cart', async () => {
        let fail = false
        const { wrapper, pinia } = mountView({ get: async () => { if(fail) throw new Error('network'); return { data: cartData() } } })
        await flushPromises()
        fail = true
        await useCartStore(pinia).load()
        await flushPromises()
        expect(wrapper.find('[data-test=retry]').exists()).toBe(true)
        expect(wrapper.find('[data-test=total]').exists()).toBe(true)
    })

    it('plus, minus and remove call the server and show its cart', async () => {
        let qty = 2
        const updateItem = vi.fn<Fn>(async (...args) => { qty = (args[0] as { qty: number }).qty })
        const removeItem = vi.fn<Fn>(async () => { qty = 0 })
        const { wrapper } = mountView({
            get: async () => ({ data: cartData({ cart_items: qty ? [{ ...line, qty }] : [] }) }),
            updateItem, removeItem,
        })
        await flushPromises()
        await wrapper.find('[data-test=plus]').trigger('click'); await flushPromises()
        expect(updateItem).toHaveBeenLastCalledWith({ id: 'l1', qty: 3 })
        await wrapper.find('[data-test=minus]').trigger('click'); await flushPromises()
        expect(updateItem).toHaveBeenLastCalledWith({ id: 'l1', qty: 2 })
        qty = 1
        await useCartStore(wrapper.vm.$pinia).load(); await flushPromises()
        await wrapper.find('[data-test=minus]').trigger('click'); await flushPromises()
        expect(removeItem).toHaveBeenCalledWith('l1')
        expect(wrapper.find('[data-test=empty]').exists()).toBe(true)
    })

    it('shows the server limit message and leaves the cart unchanged', async () => {
        const err = { response: { status: 409, data: { data: { code: 'over_limit', max_per_order: 4, remaining: 3 } } } }
        const { wrapper } = mountView({ get: async () => ({ data: cartData() }), updateItem: async () => { throw err } })
        await flushPromises()
        await wrapper.find('[data-test=plus]').trigger('click'); await flushPromises()
        expect(wrapper.find('[data-test=cart-error]').text()).toContain('You can order up to 3 pizzas.')
        expect(wrapper.find('[data-test=qty]').text()).toBe('1')
    })

    it('saves the note on blur, shows it as text, and clears when empty', async () => {
        const setCustomerNote = vi.fn<Fn>(async () => ({}))
        const { wrapper } = mountView({ get: async () => ({ data: cartData({ customer_note: '<b>x</b>' }) }), setCustomerNote })
        await flushPromises()
        const note = wrapper.find('[data-test=note]')
        expect((note.element as HTMLTextAreaElement).value).toBe('<b>x</b>')
        expect(wrapper.find('b').exists()).toBe(false)
        await note.setValue('  ')
        await note.trigger('blur'); await flushPromises()
        expect(setCustomerNote).toHaveBeenCalledWith(null)
        expect(wrapper.find('[data-test=note-count]').text()).toContain('/ 500')
    })

    it('hides the note section and item controls when locked', async () => {
        const checkout = vi.fn<Fn>(async () => ({ data: { client_secret: 'cs_test_x_secret_y' } }))
        const { wrapper } = mountView({ get: async () => ({ data: cartData({ checkout_in_progress: true }) }), checkout })
        await flushPromises()
        expect(wrapper.find('[data-test=note]').exists()).toBe(false)
        expect(wrapper.find('[data-test=plus]').exists()).toBe(false)
        expect(wrapper.find('[data-test=note-save]').exists()).toBe(false)
    })
})
