import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import CartView from '../CartView.vue'
import { useCartStore } from '@/stores/cart'

vi.mock('@/utils/serviceStream', () => ({ openServiceStream: vi.fn<() => () => void>(() => vi.fn<() => void>()) }))

const replace = vi.fn<(to: unknown) => void>()
let query: Record<string, string> = {}
vi.mock('vue-router', () => ({
    useRoute: () => ({ query }),
    useRouter: () => ({ replace }),
}))

const line = { id: 'l1', qty: 1, price_subtotal: 1400, product: { id: 'p1', title: 'Margherita', base_price: 1400 } }
const cartData = (extra: Record<string, unknown> = {}) => ({
    id: 'c1', num_items: 1, price_subtotal: 1400, grand_total: 1400, customer_note: null,
    checkout_in_progress: false, cart_items: [line], ...extra,
})
const serviceState = (status: string) => ({ status, server_now: new Date().toISOString(), service: null, next_service: null, remaining: 5 })

type Fn = (...args: unknown[]) => unknown
const mountView = (cart: Record<string, Fn>, status = 'open') => {
    query = {}
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
    it('shows the locked state with Continue and Cancel, and no edits', async () => {
        const cancelCheckout = vi.fn<Fn>(async () => ({}))
        const { wrapper } = mountView({ get: async () => ({ data: cartData({ checkout_in_progress: true }) }), cancelCheckout })
        await flushPromises()
        expect(wrapper.find('[data-test=locked]').text()).toContain('Payment in progress')
        expect(wrapper.find('[data-test=remove]').exists()).toBe(false)
        expect(wrapper.find('[data-test=pay]').exists()).toBe(false)
        await wrapper.find('[data-test=cancel]').trigger('click')
        await flushPromises()
        expect(cancelCheckout).toHaveBeenCalled()
    })

    it('shows the cancel message once and clears the query', async () => {
        query = { checkout: 'cancelled' }
        const wrapper = mount(CartView, {
            global: {
                plugins: [createPinia()], stubs: { RouterLink: true },
                provide: { $api: { cart: { credentials: () => ({ id: 'c1' }), get: async () => ({ data: cartData() }) }, service: { getNext: async () => serviceState('open') } } },
            },
        })
        await flushPromises()
        expect(wrapper.find('[data-test=cancelled]').exists()).toBe(true)
        expect(replace).toHaveBeenCalledWith({ name: 'cart' })
        expect(wrapper.find('[data-test=total]').exists()).toBe(true)
    })

    it('highlights the unavailable pizza, never leaves for Stripe, and lets the visitor remove it', async () => {
        const err = { response: { status: 409, data: { message: 'x', data: { code: 'item_unavailable', product_id: 'p1', title: 'Margherita' } } } }
        const { wrapper } = mountView({ get: async () => ({ data: cartData() }), checkout: async () => { throw err }, removeItem: vi.fn<Fn>(async () => ({})) })
        await flushPromises()
        await wrapper.find('[data-test=pay]').trigger('click')
        await flushPromises()
        expect(wrapper.find('[data-test=cart-error]').text()).toContain('"Margherita" is no longer available')
        expect(wrapper.find('[data-test=cart-line]').classes().join(' ')).toContain('border-red-600')
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

    it('makes the note read-only and hides the buttons when locked', async () => {
        const { wrapper } = mountView({ get: async () => ({ data: cartData({ checkout_in_progress: true }) }) })
        await flushPromises()
        expect((wrapper.find('[data-test=note]').element as HTMLTextAreaElement).readOnly).toBe(true)
        expect(wrapper.find('[data-test=plus]').exists()).toBe(false)
        expect(wrapper.find('[data-test=note-save]').exists()).toBe(false)
    })
})
